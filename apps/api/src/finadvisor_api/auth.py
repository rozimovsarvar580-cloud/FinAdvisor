import hmac
from datetime import UTC, datetime, timedelta
from typing import Annotated

import jwt
from fastapi import APIRouter, Depends, Header, HTTPException, Request, Response, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import PyJWTError
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from finadvisor_api.config import get_settings
from finadvisor_api.database import get_db
from finadvisor_api.email_sender import (
    EmailKind,
    build_action_url,
    build_email,
    get_email_sender,
)
from finadvisor_api.models import EmailToken, OAuthAccount, RefreshToken, User
from finadvisor_api.schemas import (
    AuthActionResponse,
    EmailRequest,
    EmailTokenRequest,
    LoginRequest,
    OAuthExchangeRequest,
    OAuthTokenResponse,
    RefreshTokenRequest,
    RegisterRequest,
    ResetPasswordRequest,
    RoleUpdateRequest,
    TokenResponse,
    UserResponse,
)
from finadvisor_api.security import (
    create_access_token,
    create_email_token,
    create_refresh_token,
    hash_email_token,
    hash_password,
    hash_refresh_token,
    login_attempt_limiter,
    verify_password,
)

router = APIRouter(prefix="/auth", tags=["auth"])
profile_router = APIRouter(tags=["profile"])
bearer_scheme = HTTPBearer(auto_error=False)
REFRESH_TOKEN_LIFETIME = timedelta(days=30)
PASSWORD_RESET_TOKEN_LIFETIME = timedelta(hours=1)
EMAIL_VERIFICATION_TOKEN_LIFETIME = timedelta(hours=24)


def _issue_response(user: User, db: Session) -> TokenResponse:
    refresh_token = create_refresh_token()
    db.add(
        RefreshToken(
            user_id=user.id,
            token_hash=hash_refresh_token(refresh_token),
            expires_at=datetime.now(UTC) + REFRESH_TOKEN_LIFETIME,
        )
    )
    response = TokenResponse(
        access_token=create_access_token(user.id),
        refresh_token=refresh_token,
        user=UserResponse.model_validate(user),
    )
    db.commit()
    return response


def _issue_email_token(
    db: Session, user: User, purpose: str, lifetime: timedelta
) -> str:
    now = datetime.now(UTC)
    db.execute(
        update(EmailToken)
        .where(
            EmailToken.user_id == user.id,
            EmailToken.purpose == purpose,
            EmailToken.used_at.is_(None),
        )
        .values(used_at=now)
        .execution_options(synchronize_session=False)
    )
    raw_token = create_email_token()
    db.add(
        EmailToken(
            user_id=user.id,
            token_hash=hash_email_token(raw_token),
            purpose=purpose,
            expires_at=now + lifetime,
        )
    )
    db.commit()
    return raw_token


def _consume_email_token(
    db: Session, raw_token: str, purpose: str
) -> str | None:
    token_hash = hash_email_token(raw_token)
    token = db.scalar(
        select(EmailToken).where(
            EmailToken.token_hash == token_hash,
            EmailToken.purpose == purpose,
            EmailToken.used_at.is_(None),
        )
    )
    if token is None:
        return None

    now = datetime.now(UTC)
    consumed = db.execute(
        update(EmailToken)
        .where(
            EmailToken.id == token.id,
            EmailToken.used_at.is_(None),
            EmailToken.expires_at > now,
        )
        .values(used_at=now)
        .execution_options(synchronize_session=False)
    )
    return token.user_id if consumed.rowcount == 1 else None


def _send_email(
    user: User, kind: EmailKind, token: str | None = None
) -> None:
    action_url = build_action_url(kind, user.locale, token)
    get_email_sender().send(build_email(kind, user.locale, user.email, action_url))


@router.post("/oauth", response_model=OAuthTokenResponse)
def oauth_exchange(
    payload: OAuthExchangeRequest,
    db: Annotated[Session, Depends(get_db)],
    internal_key: Annotated[str | None, Header(alias="X-Internal-Key")] = None,
) -> OAuthTokenResponse:
    configured_key = get_settings().internal_api_key
    if not configured_key:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="auth.internal_key_missing",
        )
    if internal_key is None or not hmac.compare_digest(internal_key, configured_key):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="auth.invalid_internal_key",
        )

    email = str(payload.email).lower()
    provider_account_id = payload.provider_account_id
    account = db.scalar(
        select(OAuthAccount).where(
            OAuthAccount.provider == payload.provider,
            OAuthAccount.provider_account_id == provider_account_id,
        )
    )
    is_new = False

    if account is not None:
        user = db.get(User, account.user_id)
        if user is None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="auth.account_exists",
            )
        if user.email != email and payload.email_verified:
            email_owner = db.scalar(select(User).where(User.email == email))
            if email_owner is not None and email_owner.id != user.id:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="auth.account_exists",
                )
            user.email = email
        user.email_verified = user.email_verified or payload.email_verified
        user.name = payload.name
        user.avatar_url = payload.avatar_url
    else:
        user = db.scalar(
            select(User).where(
                User.auth_provider == payload.provider,
                User.provider_user_id == provider_account_id,
            )
        )
        if user is not None:
            if user.email != email and payload.email_verified:
                email_owner = db.scalar(select(User).where(User.email == email))
                if email_owner is not None and email_owner.id != user.id:
                    raise HTTPException(
                        status_code=status.HTTP_409_CONFLICT,
                        detail="auth.account_exists",
                    )
                user.email = email
            user.email_verified = user.email_verified or payload.email_verified
            user.name = payload.name
            user.avatar_url = payload.avatar_url
        if user is None:
            user = db.scalar(select(User).where(User.email == email))
            if user is not None and not payload.email_verified:
                raise HTTPException(
                    status_code=status.HTTP_409_CONFLICT,
                    detail="auth.account_exists",
                )
            if user is None:
                user = User(
                    email=email,
                    name=payload.name,
                    avatar_url=payload.avatar_url,
                    role=payload.role,
                    auth_provider=payload.provider,
                    provider_user_id=provider_account_id,
                    email_verified=payload.email_verified,
                )
                db.add(user)
                db.flush()
                is_new = True
            else:
                user.email_verified = True
        account = OAuthAccount(
            user_id=user.id,
            provider=payload.provider,
            provider_account_id=provider_account_id,
        )
        db.add(account)

    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="auth.account_exists",
        ) from error

    db.refresh(user)
    token_response = _issue_response(user, db)
    if is_new:
        _send_email(user, "welcome")
    return OAuthTokenResponse(**token_response.model_dump(), is_new=is_new)


@router.post(
    "/register", response_model=TokenResponse, status_code=status.HTTP_201_CREATED
)
def register(
    payload: RegisterRequest, db: Annotated[Session, Depends(get_db)]
) -> TokenResponse:
    email = str(payload.email).lower()
    existing_user = db.scalar(select(User).where(User.email == email))
    if existing_user is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT, detail="auth.email_in_use"
        )

    user = User(
        email=email,
        name=payload.name,
        role=payload.role,
        auth_provider="credentials",
        password_hash=hash_password(payload.password),
    )
    db.add(user)
    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="auth.email_in_use",
        ) from error
    db.refresh(user)
    response = _issue_response(user, db)
    verification_token = _issue_email_token(
        db, user, "email_verification", EMAIL_VERIFICATION_TOKEN_LIFETIME
    )
    _send_email(user, "verify", verification_token)
    _send_email(user, "welcome")
    return response


@router.post("/login", response_model=TokenResponse)
def login(
    payload: LoginRequest,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
) -> TokenResponse:
    email = str(payload.email).lower()
    client_ip = request.client.host if request.client else "unknown"
    if not login_attempt_limiter.is_allowed(email, client_ip):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="auth.too_many_attempts",
        )
    user = db.scalar(select(User).where(User.email == email))
    if (
        user is None
        or user.password_hash is None
        or not verify_password(payload.password, user.password_hash)
    ):
        login_attempt_limiter.record_failure(email, client_ip)
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="auth.invalid_credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    login_attempt_limiter.reset_account(email)
    return _issue_response(user, db)


@router.post("/refresh", response_model=TokenResponse)
def refresh(
    payload: RefreshTokenRequest,
    db: Annotated[Session, Depends(get_db)],
) -> TokenResponse:
    now = datetime.now(UTC)
    token_hash = hash_refresh_token(payload.refresh_token)
    token = db.scalar(
        select(RefreshToken).where(
            RefreshToken.token_hash == token_hash,
            RefreshToken.revoked_at.is_(None),
            RefreshToken.expires_at > now,
        )
    )
    if token is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="auth.invalid_refresh_token",
        )

    revoked = db.execute(
        update(RefreshToken)
        .where(
            RefreshToken.id == token.id,
            RefreshToken.revoked_at.is_(None),
            RefreshToken.expires_at > now,
        )
        .values(revoked_at=now)
        .execution_options(synchronize_session=False)
    )
    if revoked.rowcount != 1:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="auth.invalid_refresh_token",
        )

    user = db.get(User, token.user_id)
    if user is None:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="auth.invalid_refresh_token",
        )

    next_refresh_token = create_refresh_token()
    db.add(
        RefreshToken(
            user_id=user.id,
            token_hash=hash_refresh_token(next_refresh_token),
            expires_at=now + REFRESH_TOKEN_LIFETIME,
        )
    )
    response = TokenResponse(
        access_token=create_access_token(user.id),
        refresh_token=next_refresh_token,
        user=UserResponse.model_validate(user),
    )
    db.commit()
    return response


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    payload: RefreshTokenRequest,
    db: Annotated[Session, Depends(get_db)],
) -> Response:
    db.execute(
        update(RefreshToken)
        .where(
            RefreshToken.token_hash == hash_refresh_token(payload.refresh_token),
            RefreshToken.revoked_at.is_(None),
        )
        .values(revoked_at=datetime.now(UTC))
        .execution_options(synchronize_session=False)
    )
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/forgot-password", response_model=AuthActionResponse)
def forgot_password(
    payload: EmailRequest,
    db: Annotated[Session, Depends(get_db)],
) -> AuthActionResponse:
    email = str(payload.email).lower()
    user = db.scalar(
        select(User).where(
            User.email == email,
            User.auth_provider == "credentials",
            User.password_hash.is_not(None),
        )
    )
    if user is not None:
        token = _issue_email_token(
            db, user, "password_reset", PASSWORD_RESET_TOKEN_LIFETIME
        )
        _send_email(user, "reset", token)
    return AuthActionResponse(message="auth.password_reset_requested")


@router.post("/reset-password", response_model=AuthActionResponse)
def reset_password(
    payload: ResetPasswordRequest,
    db: Annotated[Session, Depends(get_db)],
) -> AuthActionResponse:
    user_id = _consume_email_token(db, payload.token, "password_reset")
    if user_id is None:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="auth.invalid_or_expired_reset_token",
        )

    user = db.get(User, user_id)
    if user is None:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="auth.invalid_or_expired_reset_token",
        )

    user.password_hash = hash_password(payload.password)
    db.execute(
        update(RefreshToken)
        .where(RefreshToken.user_id == user.id, RefreshToken.revoked_at.is_(None))
        .values(revoked_at=datetime.now(UTC))
        .execution_options(synchronize_session=False)
    )
    db.commit()
    return AuthActionResponse(message="auth.password_reset")


@router.post("/verify-email", response_model=AuthActionResponse)
def verify_email(
    payload: EmailTokenRequest,
    db: Annotated[Session, Depends(get_db)],
) -> AuthActionResponse:
    user_id = _consume_email_token(db, payload.token, "email_verification")
    if user_id is None:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="auth.invalid_or_expired_verification_token",
        )

    user = db.get(User, user_id)
    if user is None:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="auth.invalid_or_expired_verification_token",
        )

    user.email_verified = True
    db.commit()
    return AuthActionResponse(message="auth.email_verified")


@router.post("/resend", response_model=AuthActionResponse)
def resend_verification(
    payload: EmailRequest,
    db: Annotated[Session, Depends(get_db)],
) -> AuthActionResponse:
    email = str(payload.email).lower()
    user = db.scalar(
        select(User).where(User.email == email, User.email_verified.is_(False))
    )
    if user is not None:
        token = _issue_email_token(
            db, user, "email_verification", EMAIL_VERIFICATION_TOKEN_LIFETIME
        )
        _send_email(user, "verify", token)
    return AuthActionResponse(message="auth.verification_requested")


def get_current_user(
    credentials: Annotated[
        HTTPAuthorizationCredentials | None, Depends(bearer_scheme)
    ],
    db: Annotated[Session, Depends(get_db)],
) -> User:
    secret = get_settings().jwt_secret
    if not secret:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="auth.jwt_secret_missing",
        )
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="auth.bearer_required",
            headers={"WWW-Authenticate": "Bearer"},
        )
    try:
        payload = jwt.decode(credentials.credentials, secret, algorithms=["HS256"])
    except PyJWTError as error:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="auth.invalid_token",
            headers={"WWW-Authenticate": "Bearer"},
        ) from error

    subject = payload.get("sub")
    user = db.get(User, subject) if isinstance(subject, str) else None
    if user is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="auth.user_not_found",
            headers={"WWW-Authenticate": "Bearer"},
        )
    return user


@router.get("/me", response_model=UserResponse)
def get_me(
    user: Annotated[User, Depends(get_current_user)],
) -> User:
    return user


@profile_router.patch("/me", response_model=UserResponse)
def update_me_role(
    payload: RoleUpdateRequest,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> User:
    user.role = payload.role
    db.add(user)
    db.commit()
    db.refresh(user)
    return user
