from fastapi import FastAPI

from finadvisor_api.auth import router as auth_router
from finadvisor_api.pricing import router as pricing_router

app = FastAPI(title="FinAdvisor API")
app.include_router(auth_router)
app.include_router(pricing_router)


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}
