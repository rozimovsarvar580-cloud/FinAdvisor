from fastapi import FastAPI

from finadvisor_api.agent import router as agent_router
from finadvisor_api.analysis import router as analysis_router
from finadvisor_api.auth import router as auth_router
from finadvisor_api.calculations import router as calculations_router
from finadvisor_api.chat import router as chat_router
from finadvisor_api.documents import router as documents_router
from finadvisor_api.plans import router as plans_router
from finadvisor_api.pricing import router as pricing_router

app = FastAPI(title="FinAdvisor API")
app.include_router(auth_router)
app.include_router(agent_router)
app.include_router(analysis_router)
app.include_router(chat_router)
app.include_router(documents_router)
app.include_router(calculations_router)
app.include_router(plans_router)
app.include_router(pricing_router)


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}
