from uuid import uuid4

from fastapi import FastAPI, Request
from fastapi.exceptions import RequestValidationError
from fastapi import HTTPException
from fastapi.responses import JSONResponse

from .routers.auth import router as auth_router
from .routers.calculations import router as calculations_router
from .routers.dashboard import router as dashboard_router
from .routers.exports import router as exports_router
from .routers.investors import router as investors_router
from .routers.analysis import router as analysis_router
from .routers.accounting import router as accounting_router
from .routers.admin import router as admin_router
from .routers.agent import router as agent_router
from .routers.plans import router as plans_router
from .routers.me import router as me_router
from .routers.protected import router as protected_router
from .routers.wizard import router as wizard_router
from .errors import http_exception_handler, validation_exception_handler
from .rate_limit import rate_limit_middleware
from .audit import audit_middleware

app = FastAPI(title="FinAdvisor API", version="0.1.0")
app.add_exception_handler(HTTPException, http_exception_handler)
app.add_exception_handler(RequestValidationError, validation_exception_handler)
app.middleware("http")(rate_limit_middleware)
app.middleware("http")(audit_middleware)
app.include_router(auth_router, prefix="/api/v1")
app.include_router(calculations_router, prefix="/api/v1")
app.include_router(dashboard_router, prefix="/api/v1")
app.include_router(exports_router, prefix="/api/v1")
app.include_router(investors_router, prefix="/api/v1")
app.include_router(analysis_router, prefix="/api/v1")
app.include_router(accounting_router, prefix="/api/v1")
app.include_router(admin_router, prefix="/api/v1")
app.include_router(agent_router, prefix="/api/v1")
app.include_router(plans_router, prefix="/api/v1")
app.include_router(me_router, prefix="/api/v1")
app.include_router(protected_router, prefix="/api/v1")
app.include_router(wizard_router, prefix="/api/v1")


@app.middleware("http")
async def request_id_middleware(request: Request, call_next):
    request_id = request.headers.get("X-Request-ID", str(uuid4()))
    request.state.request_id = request_id
    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    return response


@app.exception_handler(Exception)
async def unhandled_exception(request: Request, exc: Exception):
    request_id = getattr(request.state, "request_id", "unknown")
    return JSONResponse(
        status_code=500,
        content={
            "code": "internal_error",
            "message": "Internal server error",
            "details": {},
            "request_id": request_id,
        },
    )


@app.get("/api/v1/health")
async def health(request: Request):
    return {"status": "ok", "request_id": request.state.request_id}
