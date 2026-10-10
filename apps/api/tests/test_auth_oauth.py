from collections.abc import Iterator
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from finadvisor_api.database import Base, get_db
from finadvisor_api.main import app
from finadvisor_api.models import OAuthAccount

INTERNAL_KEY = "oauth-internal-test-key"
INTERNAL_HEADER = {"X-Internal-Key": INTERNAL_KEY}


@pytest.fixture
def database(
    monkeypatch: pytest.MonkeyPatch,
) -> Iterator[tuple[TestClient, sessionmaker[Session]]]:
    monkeypatch.setenv("JWT_SECRET", "unit-test-secret-key-at-least-32-bytes-long")
    monkeypatch.setenv("INTERNAL_API_KEY", INTERNAL_KEY)
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    testing_session = sessionmaker(bind=engine, autoflush=False, autocommit=False)

    def override_get_db() -> Iterator[Session]:
        with testing_session() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db
    try:
        with TestClient(app) as test_client:
            yield test_client, testing_session
    finally:
        app.dependency_overrides.clear()
        Base.metadata.drop_all(bind=engine)
        engine.dispose()


def _identity(**overrides: Any) -> dict[str, Any]:
    identity: dict[str, Any] = {
        "provider": "google",
        "provider_account_id": "google-user-123",
        "email": "owner@example.com",
        "name": "Restaurant Owner",
        "avatar_url": "https://example.com/avatar.png",
        "email_verified": True,
        "role": "tadbirkor",
    }
    identity.update(overrides)
    return identity


def test_oauth_requires_the_configured_internal_key(
    database: tuple[TestClient, sessionmaker[Session]],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client, _ = database
    missing = client.post("/auth/oauth", json=_identity())
    wrong = client.post(
        "/auth/oauth",
        json=_identity(),
        headers={"X-Internal-Key": "not-the-configured-key"},
    )
    assert missing.status_code == wrong.status_code == 401
    assert missing.json()["detail"] == wrong.json()["detail"] == "auth.invalid_internal_key"

    monkeypatch.delenv("INTERNAL_API_KEY")
    unconfigured = client.post(
        "/auth/oauth", json=_identity(), headers=INTERNAL_HEADER
    )
    assert unconfigured.status_code == 500
    assert unconfigured.json()["detail"] == "auth.internal_key_missing"


def test_oauth_creates_and_reuses_normalized_provider_accounts(
    database: tuple[TestClient, sessionmaker[Session]],
) -> None:
    client, session_factory = database
    created = client.post(
        "/auth/oauth", json=_identity(), headers=INTERNAL_HEADER
    )
    reused = client.post(
        "/auth/oauth",
        json=_identity(name="Updated Owner"),
        headers=INTERNAL_HEADER,
    )

    assert created.status_code == reused.status_code == 200
    assert created.json()["is_new"] is True
    assert reused.json()["is_new"] is False
    assert created.json()["access_token"]
    assert created.json()["refresh_token"]
    assert created.json()["user"]["id"] == reused.json()["user"]["id"]
    assert reused.json()["user"]["name"] == "Updated Owner"

    with session_factory() as session:
        accounts = session.scalars(select(OAuthAccount)).all()
        assert len(accounts) == 1
        assert accounts[0].provider == "google"
        assert accounts[0].provider_account_id == "google-user-123"


def test_oauth_links_only_verified_email_and_preserves_existing_account(
    database: tuple[TestClient, sessionmaker[Session]],
) -> None:
    client, session_factory = database
    registration = client.post(
        "/auth/register",
        json={
            "email": "owner@example.com",
            "name": "Existing Owner",
            "password": "StrongPass123!",
        },
    )
    unverified = client.post(
        "/auth/oauth",
        json=_identity(email_verified=False),
        headers=INTERNAL_HEADER,
    )
    linked = client.post(
        "/auth/oauth", json=_identity(), headers=INTERNAL_HEADER
    )

    assert registration.status_code == 201
    assert unverified.status_code == 409
    assert linked.status_code == 200
    assert linked.json()["is_new"] is False
    assert linked.json()["user"]["id"] == registration.json()["user"]["id"]
    assert linked.json()["user"]["auth_provider"] == "credentials"
    assert linked.json()["user"]["email_verified"] is True

    with session_factory() as session:
        account = session.scalar(
            select(OAuthAccount).where(
                OAuthAccount.provider == "google",
                OAuthAccount.provider_account_id == "google-user-123",
            )
        )
        assert account is not None
        assert account.user_id == registration.json()["user"]["id"]


def test_oauth_identity_cannot_be_moved_to_another_existing_email(
    database: tuple[TestClient, sessionmaker[Session]],
) -> None:
    client, _ = database
    client.post("/auth/oauth", json=_identity(), headers=INTERNAL_HEADER)
    client.post(
        "/auth/register",
        json={
            "email": "other@example.com",
            "name": "Other Owner",
            "password": "StrongPass123!",
        },
    )

    moved = client.post(
        "/auth/oauth",
        json=_identity(email="other@example.com"),
        headers=INTERNAL_HEADER,
    )

    assert moved.status_code == 409
    assert moved.json()["detail"] == "auth.account_exists"
