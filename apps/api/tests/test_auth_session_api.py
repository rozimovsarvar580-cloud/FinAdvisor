from fastapi.testclient import TestClient

from finadvisor_api.legacy.main import app

client = TestClient(app)


def test_login_token_can_access_me_endpoint():
    login = client.post(
        "/api/v1/auth/login",
        json={"email": "demo@finadvisor.uz", "password": "secret123"},
    )
    token = login.json()["token"]
    response = client.get("/api/v1/me", headers={"Authorization": f"Bearer {token}"})
    assert response.status_code == 200
    assert response.json()["email"] == "demo@finadvisor.uz"


def test_me_requires_valid_bearer_token():
    response = client.get("/api/v1/me")
    assert response.status_code == 401
    assert response.json()["code"] == "missing_token"
