import hashlib
import secrets
from collections import defaultdict
from datetime import UTC, datetime, timedelta
from threading import Lock
from time import monotonic

import jwt
from argon2 import PasswordHasher
from argon2.exceptions import VerificationError

from finadvisor_api.config import get_settings

password_hasher = PasswordHasher()


class LoginAttemptLimiter:
    def __init__(self, limit: int = 5, window_seconds: int = 900) -> None:
        self.limit = limit
        self.window_seconds = window_seconds
        self._attempts: dict[str, list[float]] = defaultdict(list)
        self._lock = Lock()

    def _active_attempts(self, key: str, now: float) -> list[float]:
        active = [
            attempt
            for attempt in self._attempts[key]
            if now - attempt < self.window_seconds
        ]
        self._attempts[key] = active
        return active

    def is_allowed(self, email: str, client_ip: str) -> bool:
        now = monotonic()
        keys = (f"account:{email}", f"ip:{client_ip}")
        with self._lock:
            return all(
                len(self._active_attempts(key, now)) < self.limit for key in keys
            )

    def record_failure(self, email: str, client_ip: str) -> None:
        now = monotonic()
        with self._lock:
            for key in (f"account:{email}", f"ip:{client_ip}"):
                self._active_attempts(key, now).append(now)

    def reset_account(self, email: str) -> None:
        with self._lock:
            self._attempts.pop(f"account:{email}", None)

    def clear(self) -> None:
        with self._lock:
            self._attempts.clear()


login_attempt_limiter = LoginAttemptLimiter()


def hash_password(password: str) -> str:
    return password_hasher.hash(password)


def verify_password(password: str, password_hash: str) -> bool:
    try:
        return password_hasher.verify(password_hash, password)
    except VerificationError:
        return False


def hash_refresh_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def hash_email_token(token: str) -> str:
    return hashlib.sha256(token.encode("utf-8")).hexdigest()


def create_refresh_token() -> str:
    return secrets.token_urlsafe(48)


def create_email_token() -> str:
    return secrets.token_urlsafe(48)


def create_access_token(subject: str) -> str:
    secret = get_settings().jwt_secret
    if not secret:
        raise RuntimeError("JWT_SECRET must be configured before issuing tokens")
    expires_at = datetime.now(UTC) + timedelta(minutes=15)
    return jwt.encode({"sub": subject, "exp": expires_at}, secret, algorithm="HS256")
