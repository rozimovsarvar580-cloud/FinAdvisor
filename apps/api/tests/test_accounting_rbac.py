from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from finadvisor_api import auth as auth_module
from finadvisor_api.database import Base, get_db
from finadvisor_api.main import app


@pytest.fixture
def client(monkeypatch: pytest.MonkeyPatch) -> Iterator[TestClient]:
    monkeypatch.setenv("JWT_SECRET", "unit-test-secret-key-at-least-32-bytes-long")
    monkeypatch.setattr(auth_module, "send_auth_email", lambda *args: None)
    engine = create_engine("sqlite://", connect_args={"check_same_thread": False}, poolclass=StaticPool)
    Base.metadata.create_all(engine)
    sessions = sessionmaker(bind=engine, autoflush=False, autocommit=False)

    def override_db():
        with sessions() as db:
            yield db

    app.dependency_overrides[get_db] = override_db
    try:
        with TestClient(app) as test_client:
            yield test_client
    finally:
        app.dependency_overrides.clear()
        Base.metadata.drop_all(engine)
        engine.dispose()


def headers(client: TestClient, email: str, role: str) -> dict[str, str]:
    response = client.post("/auth/register", json={
        "email": email, "name": "Accounting test", "password": "StrongPass123!", "role": role,
    })
    assert response.status_code == 201
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def test_accounting_resource_rbac_and_idempotent_sync(client: TestClient) -> None:
    owner = headers(client, "owner@example.com", "tadbirkor")
    accountant = headers(client, "accountant@example.com", "buxgalter")
    investor = headers(client, "investor@example.com", "investor")
    payload = {"client_id": "sale-1", "data": {"amount": "12500", "currency": "UZS"}}

    denied = client.post("/accounting/sync/sales", headers=owner, json=payload)
    assert denied.status_code == 403
    assert client.get("/accounting/sales", headers=investor).status_code == 403
    first = client.post("/accounting/sync/sales", headers=accountant, json=payload)
    again = client.post("/accounting/sync/sales", headers=accountant, json=payload)
    assert first.status_code == again.status_code == 200
    assert first.json()["id"] == again.json()["id"]
    assert len(client.get("/accounting/sales", headers=accountant).json()["items"]) == 1
    assert client.get("/accounting/sales", headers=owner).json()["items"] == []
    conflict = client.post("/accounting/sync/sales", headers=accountant,
                           json={"client_id": "sale-1", "data": {"amount": "999"}})
    assert conflict.status_code == 409


@pytest.mark.parametrize("resource", ["inventory", "stock-movements", "sales", "expenses", "employees"])
def test_accounting_resources_are_exposed(client: TestClient, resource: str) -> None:
    owner = headers(client, f"{resource}@example.com", "tadbirkor")
    assert client.get(f"/accounting/{resource}", headers=owner).status_code == 200
