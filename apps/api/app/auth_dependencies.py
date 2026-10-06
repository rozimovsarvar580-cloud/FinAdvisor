from fastapi import Depends, Header, HTTPException
from sqlalchemy.orm import Session

from .db import get_db
from .session_repository import get_active_session


def current_user(
    authorization: str | None = Header(default=None),
    db: Session = Depends(get_db),
) -> str:
    if not authorization or not authorization.startswith("Bearer "):
        raise HTTPException(
            status_code=401,
            detail={"code": "missing_token", "message": "Bearer token is required", "details": {}},
        )
    session = get_active_session(db, authorization.removeprefix("Bearer ").strip())
    if session is None:
        raise HTTPException(
            status_code=401,
            detail={"code": "invalid_token", "message": "Token is invalid or expired", "details": {}},
        )
    return session.user_email


def require_role(*allowed_roles: str):
    def dependency(
        authorization: str | None = Header(default=None),
        db: Session = Depends(get_db),
    ) -> str:
        if not authorization or not authorization.startswith("Bearer "):
            raise HTTPException(
                status_code=401,
                detail={"code": "missing_token", "message": "Bearer token is required", "details": {}},
            )
        session = get_active_session(db, authorization.removeprefix("Bearer ").strip())
        if session is None:
            raise HTTPException(
                status_code=401,
                detail={"code": "invalid_token", "message": "Token is invalid or expired", "details": {}},
            )
        if session.role not in allowed_roles:
            raise HTTPException(
                status_code=403,
                detail={"code": "forbidden", "message": "Insufficient role permissions", "details": {"required_roles": allowed_roles}},
            )
        return session.user_email

    return dependency
