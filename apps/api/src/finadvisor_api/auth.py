from typing import Annotated, Literal

import httpx
import jwt
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import PyJWTError
from pydantic import BaseModel, ConfigDict, EmailStr, Field, ValidationError
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from finadvisor_api.config import get_settings
from finadvisor_api.database import get_db
from finadvisor_api.models import User
from finadvisor_api.schemas import (
    LoginRequest,
    OAuthExchangeRequest,
    RegisterRequest,
    TokenResponse,
    UserResponse,
)
from finadvisor_api.security import create_access_token, hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])
bearer_scheme = HTTPBearer(auto_error=False)


class OAuthIdentity(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    subject: str = Field(min_length=1, max_length=255)
    email: EmailStr
    name: str = Field(min_length=1, max_length=200)
    avatar_url: str | None = Field(default=None, max_length=2048)
    email_verified: bool = False


def _issue_response(user: User) -> TokenResponse:
    return TokenResponse(
        access_token=create_access_token(user.id),
        user=UserResponse.model_validate(user),
    )


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


@router.post("/oauth", response_model=TokenResponse)
async def oauth_exchange(
    payload: OAuthExchangeRequest,
    db: Annotated[Session, Depends(get_db)],
) -> TokenResponse:
    identity = await fetch_oauth_identity(payload.provider, payload.access_token)
    email = str(identity.email).lower()
    user = db.scalar(
        select(User).where(
            User.auth_provider == payload.provider,
            User.provider_user_id == identity.subject,
        )
    )

    if user is None:
        existing_email = db.scalar(select(User).where(User.email == email))
        if existing_email is not None:
            raise HTTPException(
                status_code=status.HTTP_409_CONFLICT,
                detail="auth.account_exists",
            )
        user = User(
            email=email,
            name=identity.name,
            avatar_url=identity.avatar_url,
            role=payload.role,
            auth_provider=payload.provider,
            provider_user_id=identity.subject,
            email_verified=identity.email_verified,
        )
        db.add(user)
    else:
        user.email = email
        user.name = identity.name
        user.avatar_url = identity.avatar_url
        user.email_verified = identity.email_verified

    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="auth.account_exists",
        ) from error
    db.refresh(user)
    return _issue_response(user)


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
    return _issue_response(user)


@router.post("/login", response_model=TokenResponse)
def login(
    payload: LoginRequest, db: Annotated[Session, Depends(get_db)]
) -> TokenResponse:
    email = str(payload.email).lower()
    user = db.scalar(select(User).where(User.email == email))
    if (
        user is None
        or user.password_hash is None
        or not verify_password(payload.password, user.password_hash)
    ):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="auth.invalid_credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )

    return _issue_response(user)


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
