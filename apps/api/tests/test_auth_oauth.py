from collections.abc import Iterator
<<<<<<< HEAD
from typing import Any
=======
>>>>>>> 12899e6e553a1563cc224d5ccc910c29dc2ea331

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
<<<<<<< HEAD
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

=======
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from finadvisor_api import auth as auth_module
>>>>>>> 12899e6e553a1563cc224d5ccc910c29dc2ea331
from finadvisor_api.database import Base, get_db
from finadvisor_api.main import app
from finadvisor_api.models import OAuthAccount

<<<<<<< HEAD
INTERNAL_KEY = "oauth-internal-test-key"
INTERNAL_HEADER = {"X-Internal-Key": INTERNAL_KEY}


@pytest.fixture
def database(
    monkeypatch: pytest.MonkeyPatch,
) -> Iterator[tuple[TestClient, sessionmaker[Session]]]:
    monkeypatch.setenv("JWT_SECRET", "unit-test-secret-key-at-least-32-bytes-long")
    monkeypatch.setenv("INTERNAL_API_KEY", INTERNAL_KEY)
=======
INTERNAL_KEY = "internal-test-key-at-least-32-characters"


@pytest.fixture
def client(monkeypatch: pytest.MonkeyPatch) -> Iterator[TestClient]:
    monkeypatch.setenv("JWT_SECRET", "unit-test-secret-key-at-least-32-bytes-long")
    monkeypatch.setenv("INTERNAL_API_KEY", INTERNAL_KEY)
    monkeypatch.setattr(auth_module, "send_auth_email", lambda *args: None)
>>>>>>> 12899e6e553a1563cc224d5ccc910c29dc2ea331
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    testing_session = sessionmaker(bind=engine, autoflush=False, autocommit=False)

<<<<<<< HEAD
    def override_get_db() -> Iterator[Session]:
=======
    def override_get_db():
>>>>>>> 12899e6e553a1563cc224d5ccc910c29dc2ea331
        with testing_session() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db
    try:
        with TestClient(app) as test_client:
<<<<<<< HEAD
            yield test_client, testing_session
=======
            yield test_client
>>>>>>> 12899e6e553a1563cc224d5ccc910c29dc2ea331
    finally:
        app.dependency_overrides.clear()
        Base.metadata.drop_all(bind=engine)
        engine.dispose()


<<<<<<< HEAD
def _identity(**overrides: Any) -> dict[str, Any]:
    identity: dict[str, Any] = {
=======
def oauth_payload(**overrides: object) -> dict[str, object]:
    return {
>>>>>>> 12899e6e553a1563cc224d5ccc910c29dc2ea331
        "provider": "google",
        "provider_account_id": "google-user-123",
        "email": "owner@example.com",
        "name": "Restaurant Owner",
        "avatar_url": "https://example.com/avatar.png",
        "email_verified": True,
<<<<<<< HEAD
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
=======
        "role": "investor",
        **overrides,
    }


def test_oauth_requires_a_valid_internal_api_key(client: TestClient) -> None:
    payload = oauth_payload()

    missing = client.post("/auth/oauth", json=payload)
    invalid = client.post(
        "/auth/oauth",
        json=payload,
        headers={"X-Internal-Key": "wrong-internal-key"},
    )

    assert missing.status_code == 401
    assert invalid.status_code == 401
    assert missing.json()["detail"] == "auth.invalid_internal_key"


def test_oauth_creates_user_and_returns_tokens_and_is_new(
    client: TestClient,
) -> None:
    response = client.post(
        "/auth/oauth",
        json=oauth_payload(),
        headers={"X-Internal-Key": INTERNAL_KEY},
    )

    assert response.status_code == 200
    body = response.json()
    assert body["access_token"]
    assert body["refresh_token"]
    assert body["is_new"] is True
    assert body["user"]["email"] == "owner@example.com"
    assert body["user"]["role"] == "investor"
    assert body["user"]["needs_role"] is True
    assert body["user"]["email_verified"] is True


def test_new_oauth_user_must_select_role_before_using_protected_routes(
    client: TestClient,
) -> None:
    oauth = client.post(
        "/auth/oauth",
        json=oauth_payload(),
        headers={"X-Internal-Key": INTERNAL_KEY},
    )
    access_token = oauth.json()["access_token"]
    headers = {"Authorization": f"Bearer {access_token}"}

    profile = client.get("/auth/me", headers=headers)
    protected = client.get("/plans/mine", headers=headers)

    assert profile.status_code == 200
    assert profile.json()["needs_role"] is True
    assert protected.status_code == 403
    assert protected.json()["detail"] == "auth.role_selection_required"

    selected = client.patch(
        "/auth/me",
        json={"role": "tadbirkor"},
        headers=headers,
    )
    assert selected.status_code == 200
    assert selected.json()["role"] == "tadbirkor"
    assert selected.json()["needs_role"] is False

    repeated = client.patch(
        "/auth/me",
        json={"role": "investor"},
        headers=headers,
    )
    assert repeated.status_code == 409
    assert client.get("/plans/mine", headers=headers).status_code == 200


def test_role_update_requires_auth_and_rejects_invalid_roles(
    client: TestClient,
) -> None:
    missing_auth = client.patch("/auth/me", json={"role": "investor"})
    oauth = client.post(
        "/auth/oauth",
        json=oauth_payload(),
        headers={"X-Internal-Key": INTERNAL_KEY},
    )
    invalid_role = client.patch(
        "/auth/me",
        json={"role": "admin"},
        headers={"Authorization": f"Bearer {oauth.json()['access_token']}"},
    )

    assert missing_auth.status_code == 401
    assert invalid_role.status_code == 422


def test_oauth_reuses_provider_account_without_changing_role(
    client: TestClient,
) -> None:
    first = client.post(
        "/auth/oauth",
        json=oauth_payload(),
        headers={"X-Internal-Key": INTERNAL_KEY},
    )
    second = client.post(
        "/auth/oauth",
        json=oauth_payload(role="buxgalter", name="Updated Provider Name"),
        headers={"X-Internal-Key": INTERNAL_KEY},
    )

    assert first.status_code == second.status_code == 200
    assert first.json()["user"]["id"] == second.json()["user"]["id"]
    assert first.json()["is_new"] is True
    assert second.json()["is_new"] is False
    assert second.json()["user"]["role"] == "investor"
    assert second.json()["user"]["needs_role"] is True
    assert second.json()["user"]["name"] == "Restaurant Owner"


def test_oauth_links_existing_user_only_with_verified_email(
    client: TestClient,
) -> None:
    registered = client.post(
        "/auth/register",
        json={
            "email": "owner@example.com",
            "name": "Existing Owner",
            "password": "StrongPass123!",
            "role": "tadbirkor",
        },
    )
    assert registered.status_code == 201
    linked = client.post(
        "/auth/oauth",
        json=oauth_payload(provider="facebook", provider_account_id="fb-123"),
        headers={"X-Internal-Key": INTERNAL_KEY},
    )

    assert linked.status_code == 200
    assert linked.json()["is_new"] is False
    assert linked.json()["user"]["id"] == registered.json()["user"]["id"]
    assert linked.json()["user"]["role"] == "tadbirkor"
    assert linked.json()["user"]["needs_role"] is False

    db_generator = app.dependency_overrides[get_db]()
    db = next(db_generator)
    try:
        account = db.scalar(
            select(OAuthAccount).where(
                OAuthAccount.provider == "facebook",
                OAuthAccount.provider_account_id == "fb-123",
            )
        )
        assert account is not None
        assert account.user_id == registered.json()["user"]["id"]
    finally:
        db_generator.close()


def test_connected_accounts_are_scoped_to_the_authenticated_user(
    client: TestClient,
) -> None:
    first = client.post(
        "/auth/oauth",
        json=oauth_payload(),
        headers={"X-Internal-Key": INTERNAL_KEY},
    )
    second = client.post(
        "/auth/oauth",
        json=oauth_payload(
            provider="facebook",
            provider_account_id="facebook-456",
            email="other@example.com",
            role="tadbirkor",
        ),
        headers={"X-Internal-Key": INTERNAL_KEY},
    )
    client.patch(
        "/auth/me",
        json={"role": "tadbirkor"},
        headers={
            "Authorization": "Bearer " + first.json()["access_token"]
        },
    )
    client.patch(
        "/auth/me",
        json={"role": "tadbirkor"},
        headers={
            "Authorization": "Bearer " + second.json()["access_token"]
        },
    )
    first_accounts = client.get(
        "/auth/me/accounts",
        headers={"Authorization": f"Bearer {first.json()['access_token']}"},
    )
    second_accounts = client.get(
        "/auth/me/accounts",
        headers={"Authorization": f"Bearer {second.json()['access_token']}"},
    )

    assert first_accounts.status_code == second_accounts.status_code == 200
    assert [account["provider"] for account in first_accounts.json()] == ["google"]
    assert [account["provider"] for account in second_accounts.json()] == [
        "facebook"
    ]


def test_oauth_refuses_to_link_existing_user_when_email_is_unverified(
    client: TestClient,
) -> None:
    registered = client.post(
>>>>>>> 12899e6e553a1563cc224d5ccc910c29dc2ea331
        "/auth/register",
        json={
            "email": "owner@example.com",
            "name": "Existing Owner",
            "password": "StrongPass123!",
        },
    )
<<<<<<< HEAD
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
=======
    response = client.post(
        "/auth/oauth",
        json=oauth_payload(email_verified=False),
        headers={"X-Internal-Key": INTERNAL_KEY},
    )

    assert registered.status_code == 201
    assert response.status_code == 409
    assert response.json()["detail"] == "auth.account_exists"


def test_oauth_fails_explicitly_when_internal_key_is_unconfigured(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.delenv("INTERNAL_API_KEY")

    response = client.post(
        "/auth/oauth",
        json=oauth_payload(),
        headers={"X-Internal-Key": INTERNAL_KEY},
    )

    assert response.status_code == 503
    assert response.json()["detail"] == "auth.internal_api_key_missing"
>>>>>>> 12899e6e553a1563cc224d5ccc910c29dc2ea331
