from fastapi import FastAPI

from finadvisor_api.agent import router as agent_router
from finadvisor_api.analysis import router as analysis_router
from finadvisor_api.auth import router as auth_router
from finadvisor_api.calculations import router as calculations_router
from finadvisor_api.chat import router as chat_router
from finadvisor_api.documents import router as documents_router
from finadvisor_api.legacy.routers.accounting import router as accounting_router
from finadvisor_api.legacy.routers.admin import router as admin_router
from finadvisor_api.legacy.routers.dashboard import router as dashboard_router
from finadvisor_api.legacy.routers.exports import router as exports_router
from finadvisor_api.legacy.routers.investors import router as investors_router
from finadvisor_api.legacy.routers.wizard import router as wizard_router
from finadvisor_api.marketplace import router as marketplace_router
from finadvisor_api.plans import router as plans_router
from finadvisor_api.pricing import router as pricing_router

app = FastAPI(title="FinAdvisor API")
app.include_router(auth_router)
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
):
    app.include_router(router, prefix="/api/v1")


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}
