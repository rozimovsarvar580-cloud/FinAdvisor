import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from finadvisor_api.database import Base, get_db
from finadvisor_api.main import app


@pytest.fixture
def client(monkeypatch: pytest.MonkeyPatch) -> TestClient:
    monkeypatch.setenv("JWT_SECRET", "unit-test-secret-key-at-least-32-bytes-long")
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    testing_session_local = sessionmaker(bind=engine, autoflush=False, autocommit=False)

    def override_get_db():
        with testing_session_local() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db
    try:
        with TestClient(app) as test_client:
            yield test_client
    finally:
        app.dependency_overrides.clear()
        Base.metadata.drop_all(bind=engine)
        engine.dispose()


def register_user(
    client: TestClient,
    email: str,
    role: str = "tadbirkor",
) -> dict[str, str]:
    response = client.post(
        "/auth/register",
        json={
            "email": email,
            "name": "Restaurant Owner",
            "password": "StrongPass123!",
            "role": role,
        },
    )
    assert response.status_code == 201
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def test_agent_routes_require_a_valid_user_session(client: TestClient) -> None:
    assert client.get("/agent/devices").status_code == 401
    assert client.get("/agent/commands").status_code == 401
    assert client.post("/agent/devices", json={"name": "Office PC"}).status_code == 401
    assert (
        client.post(
            "/agent/commands/sync-statement",
            json={"device_id": "device-unknown"},
        ).status_code
        == 401
    )


def test_devices_and_sync_commands_persist_and_are_owner_scoped(
    client: TestClient,
) -> None:
    owner_headers = register_user(client, "owner@example.com")
    other_headers = register_user(client, "other@example.com")

    device_response = client.post(
        "/agent/devices",
        json={"name": "  Office PC  "},
        headers=owner_headers,
    )
    assert device_response.status_code == 201
    device = device_response.json()
    assert device["name"] == "Office PC"

    command_response = client.post(
        "/agent/commands/sync-statement",
        json={"device_id": device["id"]},
        headers=owner_headers,
    )
    assert command_response.status_code == 202
    command = command_response.json()
    assert command["name"] == "sync_statement"
    assert command["status"] == "queued"

    history = client.get("/agent/commands", headers=owner_headers)
    assert [item["id"] for item in history.json()["items"]] == [command["id"]]
    assert client.get("/agent/devices", headers=other_headers).json()["items"] == []

    cross_owner_sync = client.post(
        "/agent/commands/sync-statement",
        json={"device_id": device["id"]},
        headers=other_headers,
    )
    assert cross_owner_sync.status_code == 404


def test_only_business_owners_and_accountants_can_register_devices(
    client: TestClient,
) -> None:
    investor_headers = register_user(client, "investor@example.com", role="investor")

    response = client.post(
        "/agent/devices",
        json={"name": "Personal PC"},
        headers=investor_headers,
    )
    assert response.status_code == 403


def test_device_name_must_contain_non_whitespace_text(client: TestClient) -> None:
    headers = register_user(client, "blank@example.com")

    response = client.post(
        "/agent/devices",
        json={"name": "   "},
        headers=headers,
    )

    assert response.status_code == 422
