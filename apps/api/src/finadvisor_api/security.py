from datetime import UTC, datetime, timedelta

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import VerificationError

from finadvisor_api.config import get_settings

password_hasher = PasswordHasher()
ACCESS_TOKEN_LIFETIME_SECONDS = 15 * 60


def hash_password(password: str) -> str:
    return password_hasher.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return password_hasher.verify(password_hash, password)
    except VerificationError:
        return False


def create_access_token(
    subject: str,
    expires_in_seconds: int = ACCESS_TOKEN_LIFETIME_SECONDS,
) -> str:
    secret = get_settings().jwt_secret
    if not secret:
        raise RuntimeError("JWT_SECRET must be configured before issuing tokens")
    if expires_in_seconds <= 0:
        raise ValueError("Access token lifetime must be positive")
    expires_at = datetime.now(UTC) + timedelta(seconds=expires_in_seconds)
    return jwt.encode({"sub": subject, "exp": expires_at}, secret, algorithm="HS256")
