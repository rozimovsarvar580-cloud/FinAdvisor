import logging

from fastapi import Request

logger = logging.getLogger("finadvisor.audit")


async def audit_middleware(request: Request, call_next):
    response = await call_next(request)
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
