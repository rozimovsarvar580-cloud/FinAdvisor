from collections.abc import Iterator
from uuid import uuid4

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from finadvisor_api import ai_client
from finadvisor_api import auth as auth_module
from finadvisor_api.database import Base as ApiBase
from finadvisor_api.database import get_db as get_api_db
from finadvisor_api.legacy import db as legacy_db
from finadvisor_api.legacy.session_repository import create_session
from finadvisor_api.main import app
from finadvisor_api.models import AgentCommand, AgentDevice, SavedBusinessPlan, User


@pytest.fixture
def client(monkeypatch: pytest.MonkeyPatch) -> Iterator[TestClient]:
    monkeypatch.setenv("JWT_SECRET", "unit-test-secret-key-at-least-32-bytes-long")
    monkeypatch.setattr(auth_module, "send_auth_email", lambda *args: None)
    api_engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    legacy_engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    ApiBase.metadata.create_all(bind=api_engine)
    legacy_db.Base.metadata.create_all(bind=legacy_engine)
    api_sessions = sessionmaker(bind=api_engine, autoflush=False, autocommit=False)
    legacy_sessions = sessionmaker(
        bind=legacy_engine, autoflush=False, autocommit=False
    )

    def override_api_db():
        with api_sessions() as session:
            yield session

    def override_legacy_db():
        with legacy_sessions() as session:
            yield session

    app.dependency_overrides[get_api_db] = override_api_db
    app.dependency_overrides[legacy_db.get_db] = override_legacy_db
    try:
        with TestClient(app) as test_client:
            yield test_client
    finally:
        app.dependency_overrides.clear()
        ApiBase.metadata.drop_all(bind=api_engine)
        legacy_db.Base.metadata.drop_all(bind=legacy_engine)
        api_engine.dispose()
        legacy_engine.dispose()


def register(
    client: TestClient, email: str, role: str = "tadbirkor"
) -> dict[str, str]:
    response = client.post(
        "/auth/register",
        json={
            "email": email,
            "name": "Authorization Test",
            "password": "StrongPass123!",
            "role": role,
        },
    )
    assert response.status_code == 201
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def add_legacy_session(role: str) -> dict[str, str]:
    token = f"matrix-{role}-{uuid4().hex}"
    dependency = app.dependency_overrides[legacy_db.get_db]()
    db = next(dependency)
    try:
        create_session(
            db,
            token,
            f"{role}-{uuid4().hex}@example.com",
            role=role,
        )
    finally:
        dependency.close()
    return {"Authorization": f"Bearer {token}"}


def test_authenticated_router_role_matrix(client: TestClient) -> None:
    principals = {
        "owner": register(client, "owner@example.com"),
        "accountant": register(client, "accountant@example.com", "buxgalter"),
        "investor": register(client, "investor@example.com", "investor"),
    }
    dependency = app.dependency_overrides[get_api_db]()
    api_db = next(dependency)
    try:
        business_users = api_db.scalars(
            select(User).where(User.email.in_(("owner@example.com", "accountant@example.com")))
        )
        for user in business_users:
            user.subscription_plan = "business"
        api_db.commit()
    finally:
        dependency.close()

    routes = {
        "/auth/me": {"owner": 200, "accountant": 200, "investor": 200},
        "/plans/mine": {"owner": 200, "accountant": 403, "investor": 403},
        "/marketplace/listings/mine": {
            "owner": 200,
            "accountant": 403,
            "investor": 403,
        },
        "/accounting/entries": {
            "owner": 200,
            "accountant": 200,
            "investor": 403,
        },
        "/agent/devices": {
            "owner": 200,
            "accountant": 200,
            "investor": 403,
        },
    }

    for path in routes:
        assert client.get(path).status_code == 401, path

    ledger_payload = {
        "entry_date": "2026-10-14",
        "category": "sales",
        "amount": "125000.00",
    }
    assert (
        client.post("/accounting/entries", json=ledger_payload).status_code == 401
    )
    investor_ledger_response = client.post(
        "/accounting/entries",
        json=ledger_payload,
        headers=principals["investor"],
    )
    assert investor_ledger_response.status_code == 403, investor_ledger_response.text

    for path, expected_statuses in routes.items():
        for role, headers in principals.items():
            response = client.get(path, headers=headers)
            assert response.status_code == expected_statuses[role], (
                path,
                role,
                response.text,
            )


def test_admin_ai_status_is_admin_only_and_never_exposes_api_key(
    client: TestClient, monkeypatch: pytest.MonkeyPatch, tmp_path
) -> None:
    headers = register(client, "ai-status-admin@example.com")
    assert client.get("/admin/ai-status").status_code == 401
    assert client.get("/admin/ai-status", headers=headers).status_code == 403

    dependency = app.dependency_overrides[get_api_db]()
    db = next(dependency)
    try:
        user = db.scalar(
            select(User).where(User.email == "ai-status-admin@example.com")
        )
        assert user is not None
        user.role = "admin"
        db.commit()
    finally:
        dependency.close()

    api_key = "temporary-status-test-key"
    config_path = tmp_path / "ai-config.json"
    config_path.write_text(
        f'{{"provider":"openai","api_key":"{api_key}","model":"test-model"}}',
        encoding="utf-8",
    )
    monkeypatch.setattr(ai_client, "AI_CONFIG_PATH", config_path)
    ai_client.get_ai_provider_config.cache_clear()
    try:
        response = client.get("/admin/ai-status", headers=headers)
    finally:
        ai_client.get_ai_provider_config.cache_clear()

    assert response.status_code == 200
    assert response.json() == {
        "connected": True,
        "provider": "openai",
        "model": "test-model",
    }
    assert api_key not in response.text
    assert "api_key" not in response.text


def test_saved_plans_devices_and_commands_are_scoped_to_their_owner(
    client: TestClient,
) -> None:
    owner_headers = register(client, "resource-owner@example.com")
    other_headers = register(client, "other-owner@example.com")
    owner_ledger = client.post(
        "/accounting/entries",
        json={
            "entry_date": "2026-10-14",
            "category": "sales",
            "amount": "250000.00",
            "description": "Owner daily sales",
        },
        headers=owner_headers,
    )
    other_ledger = client.post(
        "/accounting/entries",
        json={
            "entry_date": "2026-10-14",
            "category": "supplies",
            "amount": "-75000.00",
            "description": "Other owner's supplies",
        },
        headers=other_headers,
    )
    assert owner_ledger.status_code == other_ledger.status_code == 201, (
        owner_ledger.text,
        other_ledger.text,
    )

    dependency = app.dependency_overrides[get_api_db]()
    db = next(dependency)
    try:
        owner = db.scalar(
            select(User).where(User.email == "resource-owner@example.com")
        )
        other = db.scalar(select(User).where(User.email == "other-owner@example.com"))
        assert owner is not None and other is not None
        owner.subscription_plan = "business"
        other.subscription_plan = "business"
        owner_plan = SavedBusinessPlan(
            id="owner-plan",
            owner_id=owner.id,
            business_name="Owner restaurant",
            location="Tashkent",
            request_payload={},
            generated_plan={},
        )
        other_plan = SavedBusinessPlan(
            id="other-plan",
            owner_id=other.id,
            business_name="Other restaurant",
            location="Samarkand",
            request_payload={},
            generated_plan={},
        )
        owner_device = AgentDevice(
            id="owner-device",
            owner_email=owner.email,
            name="Owner device",
        )
        other_device = AgentDevice(
            id="other-device",
            owner_email=other.email,
            name="Other device",
        )
        db.add_all(
            [
                owner_plan,
                other_plan,
                owner_device,
                other_device,
                AgentCommand(
                    id="owner-command",
                    owner_email=owner.email,
                    device_id=owner_device.id,
                    name="sync_statement",
                    status="queued",
                ),
                AgentCommand(
                    id="other-command",
                    owner_email=other.email,
                    device_id=other_device.id,
                    name="sync_statement",
                    status="queued",
                ),
            ]
        )
        db.commit()
    finally:
        dependency.close()

    owner_plans = client.get("/plans/mine", headers=owner_headers).json()["items"]
    other_plans = client.get("/plans/mine", headers=other_headers).json()["items"]
    assert [item["id"] for item in owner_plans] == ["owner-plan"]
    assert [item["id"] for item in other_plans] == ["other-plan"]

    owner_devices = client.get("/agent/devices", headers=owner_headers).json()["items"]
    other_devices = client.get("/agent/devices", headers=other_headers).json()["items"]
    owner_commands = client.get("/agent/commands", headers=owner_headers).json()["items"]
    other_commands = client.get("/agent/commands", headers=other_headers).json()["items"]
    assert [item["id"] for item in owner_devices] == ["owner-device"]
    assert [item["id"] for item in other_devices] == ["other-device"]
    assert [item["id"] for item in owner_commands] == ["owner-command"]
    assert [item["id"] for item in other_commands] == ["other-command"]

    owner_entries = client.get(
        "/accounting/entries", headers=owner_headers
    ).json()["items"]
    other_entries = client.get(
        "/accounting/entries", headers=other_headers
    ).json()["items"]
    assert [item["id"] for item in owner_entries] == [owner_ledger.json()["id"]]
    assert [item["id"] for item in other_entries] == [other_ledger.json()["id"]]
    assert owner_entries[0]["amount"] == "250000.00"
    assert other_entries[0]["amount"] == "-75000.00"


def test_legacy_protected_and_accounting_role_matrix(client: TestClient) -> None:
    principals = {
        "owner": add_legacy_session("entrepreneur"),
        "accountant": add_legacy_session("accountant"),
        "investor": add_legacy_session("investor"),
        "admin": add_legacy_session("admin"),
    }
    routes = {
        "/api/v1/protected/accounting": {
            "owner": 200,
            "accountant": 200,
            "investor": 403,
            "admin": 200,
        },
        "/api/v1/accounting/daily": {
            "owner": 200,
            "accountant": 200,
            "investor": 403,
            "admin": 200,
        },
        "/api/v1/agent/devices": {
            "owner": 200,
            "accountant": 200,
            "investor": 403,
            "admin": 200,
        },
        "/api/v1/protected/investor": {
            "owner": 403,
            "accountant": 403,
            "investor": 200,
            "admin": 200,
        },
        "/api/v1/protected/admin": {
            "owner": 403,
            "accountant": 403,
            "investor": 403,
            "admin": 200,
        },
        "/api/v1/admin/users": {
            "owner": 403,
            "accountant": 403,
            "investor": 403,
            "admin": 200,
        },
        "/api/v1/admin/audit": {
            "owner": 403,
            "accountant": 403,
            "investor": 403,
            "admin": 200,
        },
        "/api/v1/admin/moderation": {
            "owner": 403,
            "accountant": 403,
            "investor": 403,
            "admin": 200,
        },
        "/api/v1/workspace/dashboard": {
            "owner": 200,
            "accountant": 200,
            "investor": 403,
            "admin": 200,
        },
        "/api/v1/wizard/steps": {
            "owner": 200,
            "accountant": 200,
            "investor": 403,
            "admin": 200,
        },
        "/api/v1/plans/": {
            "owner": 200,
            "accountant": 200,
            "investor": 403,
            "admin": 200,
        },
        "/api/v1/plans/plan-001/export.csv": {
            "owner": 200,
            "accountant": 200,
            "investor": 403,
            "admin": 200,
        },
        "/api/v1/plans/plan-001/export.xlsx": {
            "owner": 200,
            "accountant": 200,
            "investor": 403,
            "admin": 200,
        },
        "/api/v1/analysis/plan-001": {
            "owner": 200,
            "accountant": 200,
            "investor": 403,
            "admin": 200,
        },
        "/api/v1/investors/saved": {
            "owner": 403,
            "accountant": 403,
            "investor": 200,
            "admin": 200,
        },
        "/api/v1/investors/inbox": {
            "owner": 403,
            "accountant": 403,
            "investor": 200,
            "admin": 200,
        },
        "/api/v1/investors/kyc": {
            "owner": 403,
            "accountant": 403,
            "investor": 200,
            "admin": 200,
        },
        "/api/v1/me": {
            "owner": 200,
            "accountant": 200,
            "investor": 200,
            "admin": 200,
        },
    }

    for path in routes:
        assert client.get(path).status_code == 401, path

    for path, expected_statuses in routes.items():
        for role, headers in principals.items():
            response = client.get(path, headers=headers)
            assert response.status_code == expected_statuses[role], (
                path,
                role,
                response.text,
            )

    assert client.get("/api/v1/investors/discover").status_code == 200
