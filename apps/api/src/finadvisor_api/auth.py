<<<<<<< HEAD
import hmac
from datetime import UTC, datetime, timedelta
from typing import Annotated
=======
import hashlib
import hmac
import secrets
from collections import defaultdict
from datetime import UTC, datetime, timedelta
from threading import Lock
from time import monotonic
from typing import Annotated, Literal
>>>>>>> 12899e6e553a1563cc224d5ccc910c29dc2ea331

import jwt
from fastapi import APIRouter, Depends, Header, HTTPException, Request, Response, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import PyJWTError
<<<<<<< HEAD
=======
from pydantic import BaseModel, ConfigDict, EmailStr, Field, ValidationError
>>>>>>> 12899e6e553a1563cc224d5ccc910c29dc2ea331
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from finadvisor_api.config import get_settings
from finadvisor_api.database import get_db
from finadvisor_api.email_sender import (
<<<<<<< HEAD
    EmailKind,
    build_action_url,
    build_email,
    get_email_sender,
)
from finadvisor_api.models import EmailToken, OAuthAccount, RefreshToken, User
from finadvisor_api.schemas import (
    AuthActionResponse,
=======
    EmailDeliveryError,
    ensure_auth_email_delivery_configured,
    send_auth_email,
)
from finadvisor_api.models import EmailToken, OAuthAccount, RefreshToken, User
from finadvisor_api.schemas import (
    ChangePasswordRequest,
>>>>>>> 12899e6e553a1563cc224d5ccc910c29dc2ea331
    EmailRequest,
    EmailTokenRequest,
    LoginRequest,
    OAuthAccountSummary,
    OAuthExchangeRequest,
<<<<<<< HEAD
    OAuthTokenResponse,
=======
    OAuthProviderTokenRequest,
    OAuthTokenResponse,
    PasswordResetRequest,
>>>>>>> 12899e6e553a1563cc224d5ccc910c29dc2ea331
    RefreshTokenRequest,
    RegisterRequest,
    ResetPasswordRequest,
    RoleUpdateRequest,
    TokenResponse,
    UpdateRoleRequest,
    UserResponse,
)
from finadvisor_api.security import (
<<<<<<< HEAD
    create_access_token,
    create_email_token,
    create_refresh_token,
    hash_email_token,
    hash_password,
    hash_refresh_token,
    login_attempt_limiter,
=======
    ACCESS_TOKEN_LIFETIME_SECONDS,
    create_access_token,
    hash_password,
>>>>>>> 12899e6e553a1563cc224d5ccc910c29dc2ea331
    verify_password,
)

router = APIRouter(prefix="/auth", tags=["auth"])
profile_router = APIRouter(tags=["profile"])
bearer_scheme = HTTPBearer(auto_error=False)
REFRESH_TOKEN_LIFETIME = timedelta(days=30)
<<<<<<< HEAD
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
=======
EMAIL_TOKEN_LIFETIMES = {
    "verify": timedelta(hours=24),
    "reset": timedelta(hours=1),
}


class LoginAttemptLimiter:
    def __init__(
        self,
        account_limit: int = 5,
        ip_limit: int = 20,
        window_seconds: int = 900,
    ) -> None:
        self.account_limit = account_limit
        self.ip_limit = ip_limit
        self.window_seconds = window_seconds
        self._attempts: dict[tuple[str, str], list[float]] = defaultdict(list)
        self._lock = Lock()

    def is_limited(self, email: str, ip_address: str) -> bool:
        now = monotonic()
        with self._lock:
            self._prune(now)
            return (
                len(self._attempts[("account", email)]) >= self.account_limit
                or len(self._attempts[("ip", ip_address)]) >= self.ip_limit
            )

    def record_failure(self, email: str, ip_address: str) -> None:
        now = monotonic()
        with self._lock:
            self._prune(now)
            self._attempts[("account", email)].append(now)
            self._attempts[("ip", ip_address)].append(now)

    def clear_account(self, email: str) -> None:
        with self._lock:
            self._attempts.pop(("account", email), None)

    def _prune(self, now: float) -> None:
        for key, attempts in list(self._attempts.items()):
            valid_attempts = [
                hit for hit in attempts if now - hit < self.window_seconds
            ]
            if valid_attempts:
                self._attempts[key] = valid_attempts
            else:
                del self._attempts[key]


login_attempt_limiter = LoginAttemptLimiter()


class OAuthIdentity(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    provider: Literal["google", "facebook"]
    subject: str = Field(min_length=1, max_length=255)
    email: EmailStr
    name: str = Field(min_length=1, max_length=200)
    avatar_url: str | None = Field(default=None, max_length=2048)
    email_verified: bool = False


def _issue_response(user: User, db: Session) -> TokenResponse:
    refresh_token = secrets.token_urlsafe(48)
    db.add(
        RefreshToken(
            user_id=user.id,
            token_hash=hashlib.sha256(refresh_token.encode()).hexdigest(),
            expires_at=datetime.now(UTC) + REFRESH_TOKEN_LIFETIME,
        )
    )
    db.commit()
    return TokenResponse(
        access_token=create_access_token(user.id),
        refresh_token=refresh_token,
        expires_in=ACCESS_TOKEN_LIFETIME_SECONDS,
>>>>>>> 12899e6e553a1563cc224d5ccc910c29dc2ea331
        user=UserResponse.model_validate(user),
    )
    db.commit()
    return response


<<<<<<< HEAD
def _issue_email_token(
    db: Session, user: User, purpose: str, lifetime: timedelta
) -> str:
=======
def _issue_email_token(db: Session, user: User, purpose: str) -> str:
>>>>>>> 12899e6e553a1563cc224d5ccc910c29dc2ea331
    now = datetime.now(UTC)
    db.execute(
        update(EmailToken)
        .where(
            EmailToken.user_id == user.id,
            EmailToken.purpose == purpose,
            EmailToken.used_at.is_(None),
<<<<<<< HEAD
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
=======
        )
        .values(used_at=now)
        .execution_options(synchronize_session=False)
    )
    token = secrets.token_urlsafe(48)
    db.add(
        EmailToken(
            user_id=user.id,
            token_hash=hashlib.sha256(token.encode()).hexdigest(),
            purpose=purpose,
            expires_at=now + EMAIL_TOKEN_LIFETIMES[purpose],
        )
    )
    db.commit()
    return token


def _send_email_token(user: User, purpose: str, token: str) -> None:
    try:
        send_auth_email(user.email, user.locale, purpose, token)
    except EmailDeliveryError as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="auth.email_delivery_unavailable",
        ) from error


def _find_active_email_token(db: Session, token: str, purpose: str) -> EmailToken | None:
    return db.scalar(
        select(EmailToken).where(
            EmailToken.token_hash == hashlib.sha256(token.encode()).hexdigest(),
            EmailToken.purpose == purpose,
            EmailToken.used_at.is_(None),
            EmailToken.expires_at > datetime.now(UTC),
        )
    )


def require_internal_api_key(
    internal_key: Annotated[
        str | None, Header(alias="X-Internal-Key")
    ] = None,
) -> None:
    expected_key = get_settings().internal_api_key
    if not expected_key:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="auth.internal_api_key_missing",
        )
    if internal_key is None or not hmac.compare_digest(internal_key, expected_key):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="auth.invalid_internal_key",
        )


def _upsert_oauth_user(
    db: Session,
    identity: OAuthIdentity,
    role: str,
) -> tuple[User, bool]:
    account = db.scalar(
        select(OAuthAccount).where(
            OAuthAccount.provider == identity.provider,
            OAuthAccount.provider_account_id == identity.subject,
        )
    )
    if account is not None:
        user = db.get(User, account.user_id)
        if user is None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="auth.account_exists",
            )
        return user, False

    email = str(identity.email).lower()
    user = db.scalar(select(User).where(User.email == email))
    is_new = user is None
    if user is not None and not identity.email_verified:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="auth.account_exists",
        )
    if user is None:
        user = User(
            email=email,
            name=identity.name,
            avatar_url=identity.avatar_url,
            role=role,
            needs_role=True,
            auth_provider=identity.provider,
            provider_user_id=identity.subject,
            email_verified=identity.email_verified,
        )
        db.add(user)
        db.flush()

    db.add(
        OAuthAccount(
            user_id=user.id,
            provider=identity.provider,
            provider_account_id=identity.subject,
        )
    )
    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="auth.account_exists",
        ) from error
    db.refresh(user)
    return user, is_new


async def fetch_oauth_identity(
    provider: Literal["google", "facebook"], access_token: str
) -> OAuthIdentity:
    profile_urls = {
        "google": "https://www.googleapis.com/oauth2/v3/userinfo",
        "facebook": "https://graph.facebook.com/me",
    }
    profile_url = profile_urls[provider]
    params = {"fields": "id,name,email,picture"} if provider == "facebook" else None
    try:
        async with httpx.AsyncClient(timeout=5.0) as client:
            response = await client.get(
                profile_url,
                headers={"Authorization": f"Bearer {access_token}"},
                params=params,
            )
            response.raise_for_status()
        profile = response.json()
    except httpx.HTTPStatusError as error:
        if error.response.status_code in {400, 401, 403}:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="auth.invalid_provider_token",
            ) from error
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="auth.provider_unavailable",
        ) from error
    except httpx.RequestError as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="auth.provider_unavailable",
        ) from error
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="auth.invalid_provider_identity",
        ) from error

    if not isinstance(profile, dict):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="auth.invalid_provider_identity",
        )

    subject_key = "sub" if provider == "google" else "id"
    subject = profile.get(subject_key)
    email = profile.get("email")
    raw_name = profile.get("name")
    avatar_url = profile.get("picture")
    if provider == "facebook" and isinstance(avatar_url, dict):
        picture_data = avatar_url.get("data")
        avatar_url = picture_data.get("url") if isinstance(picture_data, dict) else None

    if not isinstance(subject, str) or not isinstance(email, str):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="auth.invalid_provider_identity",
        )
    name = raw_name.strip() if isinstance(raw_name, str) else ""
    if not name:
        name = email.partition("@")[0]

    try:
        return OAuthIdentity.model_validate(
            {
                "provider": provider,
                "subject": subject,
                "email": email.lower(),
                "name": name[:200],
                "avatar_url": avatar_url
                if isinstance(avatar_url, str) and len(avatar_url) <= 2048
                else None,
                "email_verified": profile.get("email_verified") is True
                if provider == "google"
                else False,
            }
        )
    except ValidationError as error:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="auth.invalid_provider_identity",
        ) from error


@router.post(
    "/oauth",
    response_model=OAuthTokenResponse,
    dependencies=[Depends(require_internal_api_key)],
)
def oauth_exchange(
    payload: OAuthExchangeRequest,
    db: Annotated[Session, Depends(get_db)],
) -> OAuthTokenResponse:
    identity = OAuthIdentity(
        provider=payload.provider,
        subject=payload.provider_account_id,
        email=payload.email,
        name=payload.name,
        avatar_url=payload.avatar_url,
        email_verified=payload.email_verified,
    )
    user, is_new = _upsert_oauth_user(db, identity, payload.role)
    tokens = _issue_response(user, db)
    return OAuthTokenResponse(**tokens.model_dump(), is_new=is_new)


@router.post("/oauth/provider-token", response_model=OAuthTokenResponse)
async def oauth_provider_token_exchange(
    payload: OAuthProviderTokenRequest,
    db: Annotated[Session, Depends(get_db)],
) -> OAuthTokenResponse:
    identity = await fetch_oauth_identity(payload.provider, payload.access_token)
    user, is_new = _upsert_oauth_user(db, identity, payload.role)
    tokens = _issue_response(user, db)
    return OAuthTokenResponse(**tokens.model_dump(), is_new=is_new)
>>>>>>> 12899e6e553a1563cc224d5ccc910c29dc2ea331


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
<<<<<<< HEAD
    response = _issue_response(user, db)
    verification_token = _issue_email_token(
        db, user, "email_verification", EMAIL_VERIFICATION_TOKEN_LIFETIME
    )
    _send_email(user, "verify", verification_token)
    _send_email(user, "welcome")
    return response
=======
    verification_token = _issue_email_token(db, user, "verify")
    _send_email_token(user, "verify", verification_token)
    return _issue_response(user, db)
>>>>>>> 12899e6e553a1563cc224d5ccc910c29dc2ea331


@router.post("/login", response_model=TokenResponse)
def login(
    payload: LoginRequest,
    request: Request,
    db: Annotated[Session, Depends(get_db)],
) -> TokenResponse:
    email = str(payload.email).lower()
<<<<<<< HEAD
    client_ip = request.client.host if request.client else "unknown"
    if not login_attempt_limiter.is_allowed(email, client_ip):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="auth.too_many_attempts",
        )
=======
    ip_address = request.client.host if request.client else "unknown"
    if login_attempt_limiter.is_limited(email, ip_address):
        raise HTTPException(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            detail="auth.too_many_attempts",
            headers={"Retry-After": "900"},
        )

>>>>>>> 12899e6e553a1563cc224d5ccc910c29dc2ea331
    user = db.scalar(select(User).where(User.email == email))
    if (
        user is None
        or user.password_hash is None
        or not verify_password(payload.password, user.password_hash)
    ):
<<<<<<< HEAD
        login_attempt_limiter.record_failure(email, client_ip)
=======
        login_attempt_limiter.record_failure(email, ip_address)
>>>>>>> 12899e6e553a1563cc224d5ccc910c29dc2ea331
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="auth.invalid_credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

<<<<<<< HEAD
    login_attempt_limiter.reset_account(email)
=======
    login_attempt_limiter.clear_account(email)
>>>>>>> 12899e6e553a1563cc224d5ccc910c29dc2ea331
    return _issue_response(user, db)


@router.post("/refresh", response_model=TokenResponse)
def refresh(
    payload: RefreshTokenRequest,
    db: Annotated[Session, Depends(get_db)],
) -> TokenResponse:
<<<<<<< HEAD
    now = datetime.now(UTC)
    token_hash = hash_refresh_token(payload.refresh_token)
    token = db.scalar(
=======
    token_hash = hashlib.sha256(payload.refresh_token.encode()).hexdigest()
    now = datetime.now(UTC)
    stored_token = db.scalar(
>>>>>>> 12899e6e553a1563cc224d5ccc910c29dc2ea331
        select(RefreshToken).where(
            RefreshToken.token_hash == token_hash,
            RefreshToken.revoked_at.is_(None),
            RefreshToken.expires_at > now,
        )
    )
<<<<<<< HEAD
    if token is None:
=======
    user = db.get(User, stored_token.user_id) if stored_token is not None else None
    if stored_token is None or user is None:
>>>>>>> 12899e6e553a1563cc224d5ccc910c29dc2ea331
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="auth.invalid_refresh_token",
        )

<<<<<<< HEAD
    revoked = db.execute(
        update(RefreshToken)
        .where(
            RefreshToken.id == token.id,
=======
    result = db.execute(
        update(RefreshToken)
        .where(
            RefreshToken.id == stored_token.id,
>>>>>>> 12899e6e553a1563cc224d5ccc910c29dc2ea331
            RefreshToken.revoked_at.is_(None),
            RefreshToken.expires_at > now,
        )
        .values(revoked_at=now)
        .execution_options(synchronize_session=False)
    )
<<<<<<< HEAD
    if revoked.rowcount != 1:
=======
    if result.rowcount != 1:
>>>>>>> 12899e6e553a1563cc224d5ccc910c29dc2ea331
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="auth.invalid_refresh_token",
        )
<<<<<<< HEAD

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
=======
    db.commit()
    return _issue_response(user, db)
>>>>>>> 12899e6e553a1563cc224d5ccc910c29dc2ea331


@router.post("/logout", status_code=status.HTTP_204_NO_CONTENT)
def logout(
    payload: RefreshTokenRequest,
    db: Annotated[Session, Depends(get_db)],
) -> Response:
<<<<<<< HEAD
    db.execute(
        update(RefreshToken)
        .where(
            RefreshToken.token_hash == hash_refresh_token(payload.refresh_token),
=======
    token_hash = hashlib.sha256(payload.refresh_token.encode()).hexdigest()
    db.execute(
        update(RefreshToken)
        .where(
            RefreshToken.token_hash == token_hash,
            RefreshToken.revoked_at.is_(None),
        )
        .values(revoked_at=datetime.now(UTC))
    )
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/forgot-password", status_code=status.HTTP_202_ACCEPTED)
def forgot_password(
    payload: EmailRequest,
    db: Annotated[Session, Depends(get_db)],
) -> dict[str, str]:
    _ensure_email_delivery()
    user = db.scalar(select(User).where(User.email == str(payload.email).lower()))
    if user is not None and user.password_hash is not None:
        token = _issue_email_token(db, user, "reset")
        _send_email_token(user, "reset", token)
    return {"message": "auth.password_reset_if_account_exists"}


@router.post("/resend-verification", status_code=status.HTTP_202_ACCEPTED)
def resend_verification(
    payload: EmailRequest,
    db: Annotated[Session, Depends(get_db)],
) -> dict[str, str]:
    _ensure_email_delivery()
    user = db.scalar(select(User).where(User.email == str(payload.email).lower()))
    if user is not None and not user.email_verified:
        token = _issue_email_token(db, user, "verify")
        _send_email_token(user, "verify", token)
    return {"message": "auth.verification_if_account_requires_it"}


def _ensure_email_delivery() -> None:
    try:
        ensure_auth_email_delivery_configured()
    except EmailDeliveryError as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="auth.email_delivery_unavailable",
        ) from error


@router.post("/verify-email")
def verify_email(
    payload: EmailTokenRequest,
    db: Annotated[Session, Depends(get_db)],
) -> dict[str, str]:
    stored_token = _find_active_email_token(db, payload.token, "verify")
    user = db.get(User, stored_token.user_id) if stored_token is not None else None
    if stored_token is None or user is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="auth.invalid_or_expired_email_token",
        )

    result = db.execute(
        update(EmailToken)
        .where(
            EmailToken.id == stored_token.id,
            EmailToken.used_at.is_(None),
            EmailToken.expires_at > datetime.now(UTC),
        )
        .values(used_at=datetime.now(UTC))
        .execution_options(synchronize_session=False)
    )
    if result.rowcount != 1:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="auth.invalid_or_expired_email_token",
        )
    user.email_verified = True
    db.commit()
    return {"message": "auth.email_verified"}


@router.post("/reset-password")
def reset_password(
    payload: PasswordResetRequest,
    db: Annotated[Session, Depends(get_db)],
) -> dict[str, str]:
    stored_token = _find_active_email_token(db, payload.token, "reset")
    user = db.get(User, stored_token.user_id) if stored_token is not None else None
    if stored_token is None or user is None:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="auth.invalid_or_expired_email_token",
        )

    result = db.execute(
        update(EmailToken)
        .where(
            EmailToken.id == stored_token.id,
            EmailToken.used_at.is_(None),
            EmailToken.expires_at > datetime.now(UTC),
        )
        .values(used_at=datetime.now(UTC))
        .execution_options(synchronize_session=False)
    )
    if result.rowcount != 1:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="auth.invalid_or_expired_email_token",
        )
    user.password_hash = hash_password(payload.password)
    db.execute(
        update(RefreshToken)
        .where(
            RefreshToken.user_id == user.id,
>>>>>>> 12899e6e553a1563cc224d5ccc910c29dc2ea331
            RefreshToken.revoked_at.is_(None),
        )
        .values(revoked_at=datetime.now(UTC))
        .execution_options(synchronize_session=False)
    )
    db.commit()
<<<<<<< HEAD
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
=======
    return {"message": "auth.password_reset"}
>>>>>>> 12899e6e553a1563cc224d5ccc910c29dc2ea331


def get_current_user(
    credentials: Annotated[
        HTTPAuthorizationCredentials | None, Depends(bearer_scheme)
    ],
    db: Annotated[Session, Depends(get_db)],
) -> User:
    user = _get_current_user(credentials, db)
    if user.needs_role:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="auth.role_selection_required",
        )
    return user


def get_current_user_allow_pending_role(
    credentials: Annotated[
        HTTPAuthorizationCredentials | None, Depends(bearer_scheme)
    ],
    db: Annotated[Session, Depends(get_db)],
) -> User:
    return _get_current_user(credentials, db)


def _get_current_user(
    credentials: HTTPAuthorizationCredentials | None,
    db: Session,
) -> User:
    # If no credentials were provided, respond with 401 regardless of server JWT secret
    # configuration so unauthenticated requests get the expected Unauthorized response.
    if credentials is None:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="auth.bearer_required",
            headers={"WWW-Authenticate": "Bearer"},
        )

    secret = get_settings().jwt_secret
    if not secret:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="auth.jwt_secret_missing",
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
    user: Annotated[User, Depends(get_current_user_allow_pending_role)],
) -> User:
    return user


<<<<<<< HEAD
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
=======
@router.patch("/me", response_model=UserResponse)
def update_my_role(
    payload: UpdateRoleRequest,
    user: Annotated[User, Depends(get_current_user_allow_pending_role)],
    db: Annotated[Session, Depends(get_db)],
) -> User:
    if user.needs_role and payload.role is None:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="auth.role_required",
        )
    if not user.needs_role and payload.role is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="auth.role_already_selected",
        )
    if user.needs_role:
        user.role = payload.role
        user.needs_role = False
    if payload.name is not None:
        user.name = payload.name
    if payload.locale is not None:
        user.locale = payload.locale
    if not payload.model_fields_set:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="auth.profile_update_empty",
        )
    db.commit()
    db.refresh(user)
    return user


@router.get("/me/accounts", response_model=list[OAuthAccountSummary])
def get_my_connected_accounts(
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> list[OAuthAccountSummary]:
    accounts = db.scalars(
        select(OAuthAccount)
        .where(OAuthAccount.user_id == user.id)
        .order_by(OAuthAccount.created_at)
    ).all()
    return [
        OAuthAccountSummary(provider=account.provider, connected_at=account.created_at)
        for account in accounts
    ]


@router.post("/me/password", status_code=status.HTTP_204_NO_CONTENT)
def change_my_password(
    payload: ChangePasswordRequest,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> Response:
    if user.password_hash is None or not verify_password(
        payload.current_password, user.password_hash
    ):
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="auth.current_password_incorrect",
        )
    user.password_hash = hash_password(payload.new_password)
    now = datetime.now(UTC)
    db.execute(
        update(RefreshToken)
        .where(
            RefreshToken.user_id == user.id,
            RefreshToken.revoked_at.is_(None),
        )
        .values(revoked_at=now)
        .execution_options(synchronize_session=False)
    )
    db.commit()
    return Response(status_code=status.HTTP_204_NO_CONTENT)


@router.post("/me/deletion-request", response_model=UserResponse)
def request_account_deletion(
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> User:
    if user.deletion_requested_at is None:
        user.deletion_requested_at = datetime.now(UTC)
        db.commit()
        db.refresh(user)
    return user
>>>>>>> 12899e6e553a1563cc224d5ccc910c29dc2ea331
