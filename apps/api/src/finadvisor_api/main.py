from fastapi import FastAPI

from finadvisor_api.auth import router as auth_router

app = FastAPI(title="FinAdvisor API")
app.include_router(auth_router)


@app.get("/health")
def health_check() -> dict[str, str]:
    return {"status": "ok"}
