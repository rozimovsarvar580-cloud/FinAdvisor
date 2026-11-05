from fastapi.testclient import TestClient

from finadvisor_api.legacy.db import SessionLocal
from finadvisor_api.legacy.main import app
from finadvisor_api.legacy.session_repository import create_session

client = TestClient(app)


def _authenticate() -> None:
    with SessionLocal() as db:
        create_session(db, "agent-commands-test-token", "demo@finadvisor.uz")


def test_agent_sync_command_requires_authenticated_operator():
    response = client.post("/api/v1/agent/commands/sync-statement")
    assert response.status_code == 401


def test_agent_sync_command_is_queued_for_entrepreneur():
    _authenticate()
    response = client.post(
        "/api/v1/agent/commands/sync-statement",
        headers={"Authorization": "Bearer agent-commands-test-token"},
    )
    assert response.status_code == 200
    assert response.json()["status"] == "queued"
