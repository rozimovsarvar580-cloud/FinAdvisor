from fastapi.testclient import TestClient

from finadvisor_api.legacy.main import app

client = TestClient(app)


def test_admin_surfaces_are_available():
    assert client.get("/api/v1/admin/users").json()["items"]
    assert client.get("/api/v1/admin/moderation").json()["items"]
    assert client.get("/api/v1/admin/audit").json()["items"][0]["request_id"]
    assert client.get("/api/v1/admin/feature-flags").status_code == 200


def test_agent_surfaces_are_available():
    client.post("/api/v1/auth/login", json={"email": "demo@finadvisor.uz", "password": "secret123"})
    headers = {"Authorization": "Bearer demo-token"}
    assert client.get("/api/v1/agent/devices", headers=headers).json()["items"]
    assert client.get("/api/v1/agent/commands", headers=headers).json()["items"]
