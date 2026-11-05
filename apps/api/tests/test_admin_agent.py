from fastapi.testclient import TestClient

from finadvisor_api.legacy.db import SessionLocal
from finadvisor_api.legacy.main import app
from finadvisor_api.legacy.session_repository import create_session

client = TestClient(app)


def test_admin_surfaces_are_available():
    token = "admin-surface-test-token"
    with SessionLocal() as db:
        create_session(db, token, "admin@finadvisor.uz", role="admin")
    headers = {"Authorization": f"Bearer {token}"}

    assert client.get("/api/v1/admin/users").status_code == 401
    assert client.get("/api/v1/admin/users", headers=headers).json()["items"]
    assert client.get("/api/v1/admin/moderation", headers=headers).json()["items"]
    assert (
        client.get("/api/v1/admin/audit", headers=headers).json()["items"][0][
            "request_id"
        ]
    )
    assert client.get("/api/v1/admin/feature-flags", headers=headers).status_code == 200


def test_agent_surfaces_are_available():
    token = "admin-agent-test-token"
    with SessionLocal() as db:
        create_session(db, token, "demo@finadvisor.uz")
    headers = {"Authorization": f"Bearer {token}"}
    assert client.get("/api/v1/agent/devices", headers=headers).json()["items"]
    assert client.get("/api/v1/agent/commands", headers=headers).json()["items"]
