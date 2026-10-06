from fastapi import HTTPException, Request
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse
from fastapi.encoders import jsonable_encoder


def error_payload(request: Request, code: str, message: str, details: object) -> dict[str, object]:
    return {
        "code": code,
        "message": message,
        "details": details,
        "request_id": getattr(request.state, "request_id", "unknown"),
    }


async def http_exception_handler(request: Request, exc: HTTPException) -> JSONResponse:
    detail = exc.detail if isinstance(exc.detail, dict) else {}
    return JSONResponse(
        status_code=exc.status_code,
        content=error_payload(
            request,
            str(detail.get("code", "http_error")),
            str(detail.get("message", "Request failed")),
            detail.get("details", {}),
        ),
    )


async def validation_exception_handler(request: Request, exc: RequestValidationError) -> JSONResponse:
    return JSONResponse(
        status_code=422,
        content=error_payload(
            request,
            "validation_error",
            "Request validation failed",
            jsonable_encoder(exc.errors()),
        ),
    )
