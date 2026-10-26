import logging
from uuid import uuid4

from fastapi import Request

logger = logging.getLogger("finadvisor.audit")

_ACTIONS = (
    ("/auth/login", "login"),
    ("/admin/refunds", "refund"),
    ("/admin/users", "role_change"),
    ("/auth/role", "role_change"),
    ("/auth/me", "role_change"),
    ("/refund", "refund"),
    ("/export", "export"),
    ("/admin/", "admin_action"),
)


def _security_action(path: str, method: str) -> str | None:
    if method not in {"POST", "PATCH", "PUT", "DELETE"} and "export" not in path:
        return None
    return next((action for marker, action in _ACTIONS if marker in path), None)


async def audit_middleware(request: Request, call_next):
    response = await call_next(request)
    action = _security_action(request.url.path, request.method)
    if action and response.status_code < 400 and not request.url.path.startswith("/api/v1/"):
        # Import lazily to avoid coupling app startup to database model registration.
        from finadvisor_api.database import SessionLocal, get_db
        from finadvisor_api.models import AuditLog

        actor_id = getattr(request.state, "audit_actor_id", None)
        if action == "login":
            actor_id = getattr(request.state, "login_actor_id", None)
        client_ip = request.client.host if request.client else "unknown"
        override = request.app.dependency_overrides.get(get_db)
        if override:
            generator = override()
            db = next(generator)
        else:
            db = SessionLocal()
        try:
            db.add(AuditLog(id=str(uuid4()), actor_id=actor_id, action=action, ip_address=client_ip))
            db.commit()
        finally:
            if override:
                generator.close()
            else:
                db.close()
    if request.url.path.startswith("/api/v1"):
        logger.info(
            "api_request request_id=%s",
            getattr(request.state, "request_id", "unknown"),
            extra={
                "request_id": getattr(request.state, "request_id", "unknown"),
                "method": request.method,
                "path": request.url.path,
                "status_code": response.status_code,
            },
        )
    return response
