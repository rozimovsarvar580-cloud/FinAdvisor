from datetime import datetime, timedelta, timezone

from sqlalchemy.orm import Session

from .models import AuthSession


def create_session(
    db: Session,
    token: str,
    user_email: str,
    role: str = "entrepreneur",
    ttl_hours: int = 24,
) -> AuthSession:
    existing = db.get(AuthSession, token)
    if existing is not None:
        existing.user_email = user_email
        existing.role = role
        existing.expires_at = datetime.now(timezone.utc) + timedelta(hours=ttl_hours)
        db.commit()
        db.refresh(existing)
        return existing
    session = AuthSession(
        token=token,
        user_email=user_email,
        role=role,
        expires_at=datetime.now(timezone.utc) + timedelta(hours=ttl_hours),
    )
    db.add(session)
    db.commit()
    db.refresh(session)
    return session


def get_active_session(db: Session, token: str) -> AuthSession | None:
    session = db.get(AuthSession, token)
    if session is None:
        return None
    expires_at = session.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    if expires_at <= datetime.now(timezone.utc):
        return None
    return session
