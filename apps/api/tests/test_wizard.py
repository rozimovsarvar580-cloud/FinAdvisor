from fastapi.testclient import TestClient

from finadvisor_api.legacy.db import SessionLocal
from finadvisor_api.legacy.main import app
from finadvisor_api.legacy.session_repository import create_session

client = TestClient(app)


def entrepreneur_headers():
    with SessionLocal() as db:
        create_session(db, "wizard-test-token", "wizard@finadvisor.uz")
    return {"Authorization": "Bearer wizard-test-token"}


def test_wizard_steps_are_available():
    response = client.get("/api/v1/wizard/steps", headers=entrepreneur_headers())
    assert response.status_code == 200
    steps = response.json()["steps"]
    assert len(steps) >= 4


def test_wizard_validation_runs():
    response = client.post("/api/v1/wizard/validate", headers=entrepreneur_headers())
    assert response.status_code == 200
    body = response.json()
    assert body["valid"] is True
