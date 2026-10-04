import os
from typing import Annotated

import jwt
from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jwt import PyJWTError
from sqlalchemy import select
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from finadvisor_api.database import get_db
from finadvisor_api.models import User
from finadvisor_api.schemas import (
    LoginRequest,
    RegisterRequest,
    TokenResponse,
    UserResponse,
)
from finadvisor_api.security import create_access_token, hash_password, verify_password

router = APIRouter(prefix="/auth", tags=["auth"])
bearer_scheme = HTTPBearer(auto_error=False)


def _issue_response(user: User) -> TokenResponse:
    return TokenResponse(
        access_token=create_access_token(user.id),
        user=UserResponse.model_validate(user),
    )


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
    secret = os.getenv("JWT_SECRET")
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
