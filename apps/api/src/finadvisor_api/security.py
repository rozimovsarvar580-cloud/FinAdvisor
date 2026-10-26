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


def create_access_token(subject: str) -> str:
    secret = get_settings().jwt_secret
    if not secret:
        raise RuntimeError("JWT_SECRET must be configured before issuing tokens")
    expires_at = datetime.now(UTC) + timedelta(seconds=ACCESS_TOKEN_LIFETIME_SECONDS)
    return jwt.encode({"sub": subject, "exp": expires_at}, secret, algorithm="HS256")
