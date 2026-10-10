from uuid import uuid4

from fastapi import FastAPI, HTTPException, Request
from fastapi.exception_handlers import (
    http_exception_handler as default_http_exception_handler,
)
from fastapi.exception_handlers import (
    request_validation_exception_handler as default_validation_exception_handler,
)
from fastapi.exceptions import RequestValidationError
from fastapi.responses import JSONResponse, Response

from finadvisor_api.agent import router as agent_router
from finadvisor_api.analysis import router as analysis_router
from finadvisor_api.auth import profile_router
from finadvisor_api.auth import router as auth_router
from finadvisor_api.calculations import router as calculations_router
from finadvisor_api.chat import router as chat_router
from finadvisor_api.documents import router as documents_router
from finadvisor_api.legacy.audit import audit_middleware
from finadvisor_api.legacy.errors import http_exception_handler, validation_exception_handler
from finadvisor_api.legacy.rate_limit import rate_limit_middleware
from finadvisor_api.legacy.routers.accounting import router as accounting_router
from finadvisor_api.legacy.routers.admin import router as admin_router
from finadvisor_api.legacy.routers.agent import router as legacy_agent_router
from finadvisor_api.legacy.routers.analysis import router as legacy_analysis_router
from finadvisor_api.legacy.routers.auth import router as legacy_auth_router
from finadvisor_api.legacy.routers.calculations import router as legacy_calculations_router
from finadvisor_api.legacy.routers.dashboard import router as dashboard_router
from finadvisor_api.legacy.routers.exports import router as exports_router
from finadvisor_api.legacy.routers.investors import router as investors_router
from finadvisor_api.legacy.routers.me import router as me_router
from finadvisor_api.legacy.routers.plans import router as legacy_plans_router
from finadvisor_api.legacy.routers.protected import router as protected_router
from finadvisor_api.legacy.routers.wizard import router as wizard_router
from finadvisor_api.marketplace import router as marketplace_router
from finadvisor_api.plans import router as plans_router
from finadvisor_api.pricing import router as pricing_router

app = FastAPI(title="FinAdvisor API", version="0.1.0")


async def handle_http_exception(request: Request, exc: HTTPException) -> Response:
    if request.url.path.startswith("/api/v1/"):
        return await http_exception_handler(request, exc)
    return await default_http_exception_handler(request, exc)


async def handle_validation_exception(request: Request, exc: RequestValidationError) -> Response:
    if request.url.path.startswith("/api/v1/"):
        return await validation_exception_handler(request, exc)
    return await default_validation_exception_handler(request, exc)


app.add_exception_handler(HTTPException, handle_http_exception)
app.add_exception_handler(RequestValidationError, handle_validation_exception)
app.middleware("http")(rate_limit_middleware)
app.middleware("http")(audit_middleware)
app.include_router(auth_router)
app.include_router(profile_router)
app.include_router(agent_router)
app.include_router(analysis_router)
app.include_router(chat_router)
app.include_router(documents_router)
app.include_router(marketplace_router)
app.include_router(calculations_router)
app.include_router(plans_router)
app.include_router(pricing_router)
for router in (
    accounting_router,
    admin_router,
    dashboard_router,
    exports_router,
    investors_router,
    wizard_router,
    legacy_auth_router,
    legacy_calculations_router,
    legacy_agent_router,
    legacy_analysis_router,
    legacy_plans_router,
    me_router,
    protected_router,
):
    app.include_router(router, prefix="/api/v1")


@app.middleware("http")
async def request_id_middleware(request: Request, call_next):
    request_id = request.headers.get("X-Request-ID", str(uuid4()))
    request.state.request_id = request_id
    response = await call_next(request)
    response.headers["X-Request-ID"] = request_id
    return response


@app.exception_handler(Exception)
async def unhandled_exception(request: Request, exc: Exception):
    if not request.url.path.startswith("/api/v1/"):
        raise exc
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


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}


@app.get("/api/v1/health")
async def health(request: Request):
    return {"status": "ok", "request_id": request.state.request_id}
