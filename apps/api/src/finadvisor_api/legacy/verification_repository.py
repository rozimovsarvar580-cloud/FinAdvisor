from datetime import datetime, timedelta, timezone
from hashlib import sha256

from sqlalchemy.orm import Session

from .models import EmailVerification

VERIFICATION_CODE = "123456"


def issue_verification(db: Session, email: str, ttl_minutes: int = 10) -> None:
    record = db.get(EmailVerification, email)
    if record is None:
        record = EmailVerification(email=email, code_hash="", expires_at=datetime.now(timezone.utc))
        db.add(record)
    record.code_hash = sha256(VERIFICATION_CODE.encode("utf-8")).hexdigest()
    record.expires_at = datetime.now(timezone.utc) + timedelta(minutes=ttl_minutes)
    db.commit()


def consume_verification(db: Session, email: str, code: str) -> bool:
    record = db.get(EmailVerification, email)
    if record is None:
        return False
    expires_at = record.expires_at
    if expires_at.tzinfo is None:
        expires_at = expires_at.replace(tzinfo=timezone.utc)
    expected_hash = sha256(code.encode("utf-8")).hexdigest()
    if expires_at <= datetime.now(timezone.utc) or record.code_hash != expected_hash:
        return False
    db.delete(record)
    db.commit()
    return True
