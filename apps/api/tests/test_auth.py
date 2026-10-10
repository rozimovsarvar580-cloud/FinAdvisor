from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from finadvisor_api.database import Base, get_db
from finadvisor_api.main import app
from finadvisor_api.models import OAuthAccount, User


@pytest.fixture
def client(monkeypatch: pytest.MonkeyPatch) -> Iterator[TestClient]:
    monkeypatch.setenv("JWT_SECRET", "unit-test-secret-key-at-least-32-bytes-long")
    monkeypatch.setenv("INTERNAL_API_KEY", "oauth-internal-test-key")
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    TestingSessionLocal = sessionmaker(bind=engine, autoflush=False, autocommit=False)

    def override_get_db():
        with TestingSessionLocal() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db
    try:
        with TestClient(app) as test_client:
            yield test_client
    finally:
        app.dependency_overrides.clear()
        Base.metadata.drop_all(bind=engine)
        engine.dispose()


def test_register_creates_hashed_user_and_returns_token(client: TestClient) -> None:
    response = client.post(
        "/auth/register",
        json={
            "email": "owner@example.com",
            "name": "Restaurant Owner",
            "password": "StrongPass123!",
            "role": "tadbirkor",
        },
    )

    assert response.status_code == 201
    body = response.json()
    assert body["access_token"]
    assert body["user"]["email"] == "owner@example.com"
    assert "password_hash" not in body["user"]


def test_login_accepts_correct_password_and_me_returns_user(
    client: TestClient,
) -> None:
    client.post(
        "/auth/register",
        json={
            "email": "owner@example.com",
            "name": "Restaurant Owner",
            "password": "StrongPass123!",
        },
    )

    response = client.post(
        "/auth/login",
        json={"email": "owner@example.com", "password": "StrongPass123!"},
    )
    profile = client.get(
        "/auth/me",
        headers={"Authorization": f"Bearer {response.json()['access_token']}"},
    )

    assert response.status_code == 200
    assert profile.status_code == 200
    assert profile.json()["email"] == "owner@example.com"


def test_authenticated_user_can_update_their_role(client: TestClient) -> None:
    registration = client.post(
        "/auth/register",
        json={
            "email": "owner@example.com",
            "name": "Restaurant Owner",
            "password": "StrongPass123!",
        },
    )
    headers = {"Authorization": f"Bearer {registration.json()['access_token']}"}

    response = client.patch("/me", json={"role": "investor"}, headers=headers)
    profile = client.get("/auth/me", headers=headers)

    assert response.status_code == 200
    assert response.json()["role"] == "investor"
    assert profile.json()["role"] == "investor"


def test_role_update_requires_authentication_and_a_supported_role(
    client: TestClient,
) -> None:
    unauthenticated = client.patch("/me", json={"role": "investor"})
    registration = client.post(
        "/auth/register",
        json={
            "email": "owner@example.com",
            "name": "Restaurant Owner",
            "password": "StrongPass123!",
        },
    )
    invalid_role = client.patch(
        "/me",
        json={"role": "admin"},
        headers={
            "Authorization": f"Bearer {registration.json()['access_token']}"
        },
    )

    assert unauthenticated.status_code == 401
    assert invalid_role.status_code == 422


def test_login_rejects_incorrect_password(client: TestClient) -> None:
    client.post(
        "/auth/register",
        json={
            "email": "owner@example.com",
            "name": "Restaurant Owner",
            "password": "StrongPass123!",
        },
    )

    response = client.post(
        "/auth/login",
        json={"email": "owner@example.com", "password": "WrongPass123!"},
    )

    assert response.status_code == 401


def test_register_rejects_email_already_in_use(client: TestClient) -> None:
    payload = {
        "email": "owner@example.com",
        "name": "Restaurant Owner",
        "password": "StrongPass123!",
    }
    client.post("/auth/register", json=payload)

    response = client.post("/auth/register", json=payload)

    assert response.status_code == 409


def test_user_password_is_stored_as_argon2_hash(client: TestClient) -> None:
    client.post(
        "/auth/register",
        json={
            "email": "owner@example.com",
            "name": "Restaurant Owner",
            "password": "StrongPass123!",
        },
    )
    db_generator = app.dependency_overrides[get_db]()
    db = next(db_generator)
    try:
        user = db.scalar(select(User).where(User.email == "owner@example.com"))
        assert user is not None
        assert user.password_hash is not None
        assert user.password_hash.startswith("$argon2")
    finally:
        db_generator.close()


def _oauth_payload(**overrides: object) -> dict[str, object]:
    payload: dict[str, object] = {
        "provider": "google",
        "provider_account_id": "google-user-123",
        "email": "owner@example.com",
        "name": "Restaurant Owner",
        "avatar_url": "https://example.com/avatar.png",
        "email_verified": True,
    }
    payload.update(overrides)
    return payload


def test_oauth_exchange_creates_and_reuses_provider_identity(
    client: TestClient,
) -> None:
    headers = {"X-Internal-Key": "oauth-internal-test-key"}
    first = client.post(
        "/auth/oauth",
        json=_oauth_payload(role="investor"),
        headers=headers,
    )
    second = client.post(
        "/auth/oauth",
        json=_oauth_payload(name="Updated Owner", role="tadbirkor"),
        headers=headers,
    )

    assert first.status_code == second.status_code == 200
    assert first.json()["is_new"] is True
    assert second.json()["is_new"] is False
    assert first.json()["user"]["id"] == second.json()["user"]["id"]
    assert second.json()["user"]["role"] == "investor"
    assert second.json()["user"]["email_verified"] is True
    assert second.json()["user"]["name"] == "Updated Owner"


def test_oauth_exchange_requires_internal_key_and_rejects_access_tokens(
    client: TestClient,
) -> None:
    payload = _oauth_payload()
    missing_key = client.post("/auth/oauth", json=payload)
    invalid_key = client.post(
        "/auth/oauth", json=payload, headers={"X-Internal-Key": "wrong-key"}
    )
    old_contract = client.post(
        "/auth/oauth",
        json={"provider": "google", "access_token": "untrusted-token"},
        headers={"X-Internal-Key": "oauth-internal-test-key"},
    )

    assert missing_key.status_code == invalid_key.status_code == 401
    assert missing_key.json()["detail"] == "auth.invalid_internal_key"
    assert old_contract.status_code == 422


def test_oauth_exchange_creates_facebook_identity_with_avatar(client: TestClient) -> None:
    response = client.post(
        "/auth/oauth",
        json=_oauth_payload(
            provider="facebook",
            provider_account_id="facebook-user-123",
            email="facebook@example.com",
            email_verified=False,
            avatar_url="https://example.com/facebook-avatar.png",
            role="buxgalter",
        ),
        headers={"X-Internal-Key": "oauth-internal-test-key"},
    )

    assert response.status_code == 200
    assert response.json()["is_new"] is True
    assert response.json()["user"]["auth_provider"] == "facebook"
    assert response.json()["user"]["role"] == "buxgalter"
    assert response.json()["user"]["avatar_url"] == "https://example.com/facebook-avatar.png"
    assert response.json()["user"]["email_verified"] is False


def test_oauth_links_existing_email_only_when_verified(client: TestClient) -> None:
    registration = client.post(
        "/auth/register",
        json={
            "email": "owner@example.com",
            "name": "Existing Owner",
            "password": "StrongPass123!",
        },
    )
    headers = {"X-Internal-Key": "oauth-internal-test-key"}
    unverified = client.post(
        "/auth/oauth",
        json=_oauth_payload(email_verified=False),
        headers=headers,
    )
    linked = client.post(
        "/auth/oauth",
        json=_oauth_payload(),
        headers=headers,
    )

    assert registration.status_code == 201
    assert unverified.status_code == 409
    assert linked.status_code == 200
    assert linked.json()["is_new"] is False
    assert linked.json()["user"]["id"] == registration.json()["user"]["id"]
    assert linked.json()["user"]["auth_provider"] == "credentials"
    assert linked.json()["user"]["email_verified"] is True

    session_generator = app.dependency_overrides[get_db]()
    session = next(session_generator)
    try:
        linked_account = session.scalar(
            select(OAuthAccount).where(
                OAuthAccount.provider == "google",
                OAuthAccount.provider_account_id == "google-user-123",
            )
        )
        assert linked_account is not None
        assert linked_account.user_id == registration.json()["user"]["id"]
    finally:
        session_generator.close()
