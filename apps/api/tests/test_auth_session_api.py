from fastapi.testclient import TestClient

from finadvisor_api.legacy.db import SessionLocal
from finadvisor_api.legacy.main import app
from finadvisor_api.legacy.session_repository import create_session

client = TestClient(app)


def test_demo_credentials_are_rejected_and_sessions_can_access_me_endpoint():
    login = client.post(
        "/api/v1/auth/login",
        json={"email": "demo@finadvisor.uz", "password": "previous-demo-password"},
    )
    assert login.status_code == 401

    token = "auth-session-api-test-token"
    with SessionLocal() as db:
        create_session(db, token, "demo@finadvisor.uz")

    response = client.get("/api/v1/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    assert response.json()["email"] == "demo@finadvisor.uz"


def test_me_requires_valid_bearer_token():
    response = client.get("/api/v1/me")
    assert response.status_code == 401
    assert response.json()["code"] == "missing_token"
