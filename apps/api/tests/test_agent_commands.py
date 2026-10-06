from fastapi.testclient import TestClient

from finadvisor_api.legacy.main import app

client = TestClient(app)


def test_agent_sync_command_requires_authenticated_operator():
    response = client.post("/api/v1/agent/commands/sync-statement")
    assert response.status_code == 401


def test_agent_sync_command_is_queued_for_entrepreneur():
    client.post("/api/v1/auth/login", json={"email": "demo@finadvisor.uz", "password": "secret123"})
    response = client.post(
        "/api/v1/agent/commands/sync-statement",
        headers={"Authorization": "Bearer demo-token"},
    )
    assert response.status_code == 200
    assert response.json()["status"] == "queued"
