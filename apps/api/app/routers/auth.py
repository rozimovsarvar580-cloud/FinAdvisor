from fastapi import APIRouter, HTTPException
from fastapi import Depends
from sqlalchemy.orm import Session

from ..db import get_db
from ..session_repository import create_session
from ..verification_repository import consume_verification, issue_verification
from ..schemas import (
    AuthResponse,
    LoginRequest,
    PasswordResetRequest,
    RegisterRequest,
    VerificationRequest,
)

router = APIRouter(prefix="/auth", tags=["auth"])


@router.post("/login", response_model=AuthResponse)
async def login(data: LoginRequest, db: Session = Depends(get_db)) -> AuthResponse:
    if data.email == "demo@finadvisor.uz" and data.password == "secret123":
        create_session(db, "demo-token", str(data.email))
        return AuthResponse(message="Login successful", email=data.email, token="demo-token")
    raise HTTPException(status_code=401, detail={"code": "invalid_credentials", "message": "Invalid email or password", "details": {}})


@router.post("/register", response_model=AuthResponse)
async def register(data: RegisterRequest, db: Session = Depends(get_db)) -> AuthResponse:
    issue_verification(db, str(data.email))
    return AuthResponse(
        message="Registration received. Please confirm your email.",
        email=data.email,
        token="pending-confirmation",
    )


@router.post("/verify", response_model=AuthResponse)
async def verify_email(data: VerificationRequest, db: Session = Depends(get_db)) -> AuthResponse:
    if not consume_verification(db, str(data.email), data.code):
        raise HTTPException(
            status_code=400,
            detail={
                "code": "invalid_verification_code",
                "message": "Invalid or expired verification code",
                "details": {},
            },
        )
    return AuthResponse(message="Email verified successfully", email=data.email)


@router.post("/password-reset", response_model=AuthResponse)
async def password_reset(data: PasswordResetRequest) -> AuthResponse:
    return AuthResponse(message="Password reset link sent", email=data.email)
