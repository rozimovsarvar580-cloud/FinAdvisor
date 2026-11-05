from collections.abc import Iterator
from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from finadvisor_api import auth as auth_module
from finadvisor_api.database import Base, get_db
from finadvisor_api.main import app
from finadvisor_api.models import (
    LedgerEntry,
    MarketplaceContactRequest,
    MarketplaceListing,
    MarketplaceMessage,
    SavedBusinessPlan,
    User,
)
from finadvisor_api.personal_data import (
    DELETION_GRACE_PERIOD,
    purge_expired_account_deletions,
)


@pytest.fixture
def personal_data_client(monkeypatch: pytest.MonkeyPatch) -> Iterator[TestClient]:
    monkeypatch.setenv("JWT_SECRET", "unit-test-secret-key-at-least-32-bytes-long")
    monkeypatch.setattr(auth_module, "send_auth_email", lambda *args: None)
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    factory = sessionmaker(bind=engine, autoflush=False, expire_on_commit=False)

    def override_get_db():
        with factory() as session:
            yield session

    monkeypatch.setitem(app.dependency_overrides, get_db, override_get_db)
    with TestClient(app) as client:
        yield client
    app.dependency_overrides.clear()
    Base.metadata.drop_all(bind=engine)
    engine.dispose()


def _register(client: TestClient, email: str) -> dict[str, str]:
    response = client.post(
        "/auth/register",
        json={
            "email": email,
            "name": "Data Subject",
            "password": "StrongPass123!",
        },
    )
    assert response.status_code == 201
    return response.json()


def test_account_export_is_owner_scoped_and_excludes_auth_secrets(
    personal_data_client: TestClient,
) -> None:
    tokens = _register(personal_data_client, "export-owner@example.com")
    owner_id = personal_data_client.get(
        "/auth/me",
        headers={"Authorization": f"Bearer {tokens['access_token']}"},
    ).json()["id"]
    factory = app.dependency_overrides[get_db]
    generator = factory()
    session = next(generator)
    session.add(
        SavedBusinessPlan(
            id="owner-plan",
            owner_id=owner_id,
            business_name="Owner plan",
            location="Tashkent",
            request_payload={"inputs": "owner"},
            generated_plan={"summary": "owner data"},
        )
    )
    session.add(
        LedgerEntry(
            id="owner-entry",
            owner_id=owner_id,
            entry_date=datetime.now(UTC).date(),
            category="sales",
            amount="100",
            currency="UZS",
        )
    )
    session.commit()
    generator.close()

    response = personal_data_client.get(
        "/auth/me/export",
        headers={"Authorization": f"Bearer {tokens['access_token']}"},
    )

    assert response.status_code == 200
    assert response.headers["content-disposition"].endswith(
        'filename="finadvisor-data-export.json"'
    )
    exported = response.json()
    assert [plan["id"] for plan in exported["plans"]] == ["owner-plan"]
    assert [entry["id"] for entry in exported["ledger_entries"]] == ["owner-entry"]
    assert "password_hash" not in exported["account"]
    assert "provider_user_id" not in exported["account"]
    assert "refresh_tokens" not in exported


def test_account_export_includes_messages_for_owned_listings(
    personal_data_client: TestClient,
) -> None:
    owner_tokens = _register(personal_data_client, "listing-owner@example.com")
    investor_tokens = _register(personal_data_client, "listing-investor@example.com")
    owner_id = personal_data_client.get(
        "/auth/me",
        headers={"Authorization": f"Bearer {owner_tokens['access_token']}"},
    ).json()["id"]
    investor_id = personal_data_client.get(
        "/auth/me",
        headers={"Authorization": f"Bearer {investor_tokens['access_token']}"},
    ).json()["id"]
    factory = app.dependency_overrides[get_db]
    generator = factory()
    session = next(generator)
    session.add(
        MarketplaceListing(
            id="owner-listing",
            owner_id=owner_id,
            business_name="Owner business",
            city="Tashkent",
            stage="operating",
            funding_target="1000",
            currency="UZS",
            summary="Owner listing",
        )
    )
    session.add(
        MarketplaceContactRequest(
            id="investor-request",
            listing_id="owner-listing",
            investor_id=investor_id,
            message="Investor contact",
        )
    )
    session.add(
        MarketplaceMessage(
            id="investor-message",
            request_id="investor-request",
            sender_id=investor_id,
            content="Message about the owner's listing",
        )
    )
    session.commit()
    generator.close()

    response = personal_data_client.get(
        "/auth/me/export",
        headers={"Authorization": f"Bearer {owner_tokens['access_token']}"},
    )

    assert response.status_code == 200
    assert [
        message["id"] for message in response.json()["marketplace_messages"]
    ] == ["investor-message"]


def test_deletion_request_can_be_canceled_during_grace_period(
    personal_data_client: TestClient,
) -> None:
    tokens = _register(personal_data_client, "cancel-owner@example.com")
    headers = {"Authorization": f"Bearer {tokens['access_token']}"}

    requested = personal_data_client.post("/auth/me/deletion-request", headers=headers)
    canceled = personal_data_client.post(
        "/auth/me/deletion-request/cancel",
        headers=headers,
    )

    assert requested.status_code == canceled.status_code == 200
    assert requested.json()["deletion_requested_at"] is not None
    assert canceled.json()["deletion_requested_at"] is None


def test_purge_removes_expired_account_and_owned_data() -> None:
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    factory = sessionmaker(bind=engine, expire_on_commit=False)
    cutoff = datetime.now(UTC) - DELETION_GRACE_PERIOD - timedelta(seconds=1)
    with factory() as db:
        user = User(
            id="expired-user",
            email="expired@example.com",
            name="Expired user",
            deletion_requested_at=cutoff,
        )
        db.add(user)
        db.flush()
        db.add(
            LedgerEntry(
                id="expired-entry",
                owner_id=user.id,
                entry_date=datetime.now(UTC).date(),
                category="sales",
                amount="100",
                currency="UZS",
            )
        )
        db.commit()

        assert purge_expired_account_deletions(db, now=datetime.now(UTC)) == 1
        assert db.get(User, user.id) is None
        assert db.scalar(select(LedgerEntry).where(LedgerEntry.id == "expired-entry")) is None
    Base.metadata.drop_all(bind=engine)
    engine.dispose()
