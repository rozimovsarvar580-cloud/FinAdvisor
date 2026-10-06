from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_wizard_steps_are_available():
    response = client.get("/api/v1/wizard/steps")
    assert response.status_code == 200
    steps = response.json()["steps"]
    assert len(steps) >= 4


def test_wizard_validation_runs():
    response = client.post("/api/v1/wizard/validate")
    assert response.status_code == 200
    body = response.json()
    assert body["valid"] is True
