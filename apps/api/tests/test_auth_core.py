from collections.abc import Iterator
from datetime import UTC, datetime, timedelta

import jwt
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from finadvisor_api import auth as auth_module
from finadvisor_api.database import Base, get_db
from finadvisor_api.main import app
from finadvisor_api.models import RefreshToken, User


@pytest.fixture
def client(monkeypatch: pytest.MonkeyPatch) -> Iterator[TestClient]:
    monkeypatch.setenv("JWT_SECRET", "unit-test-secret-key-at-least-32-bytes-long")
    monkeypatch.setattr(auth_module, "login_attempt_limiter", auth_module.LoginAttemptLimiter())
    monkeypatch.setattr(auth_module, "send_auth_email", lambda *args: None)
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    testing_session = sessionmaker(bind=engine, autoflush=False, autocommit=False)

    def override_get_db():
        with testing_session() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db
    try:
        with TestClient(app) as test_client:
            yield test_client
    finally:
        app.dependency_overrides.clear()
        Base.metadata.drop_all(bind=engine)
        engine.dispose()


def register(client: TestClient) -> dict[str, object]:
    response = client.post(
        "/auth/register",
        json={
            "email": "owner@example.com",
            "name": "Restaurant Owner",
            "password": "StrongPass123!",
        },
    )
    assert response.status_code == 201
    return response.json()


def test_register_issues_short_lived_access_and_hashed_refresh_token(
    client: TestClient,
) -> None:
    result = register(client)

    token_payload = jwt.decode(
        result["access_token"],
        "unit-test-secret-key-at-least-32-bytes-long",
        algorithms=["HS256"],
    )
    expires_at = datetime.fromtimestamp(token_payload["exp"], UTC)
    assert datetime.now(UTC) < expires_at <= datetime.now(UTC) + timedelta(minutes=16)

    db_generator = app.dependency_overrides[get_db]()
    db = next(db_generator)
    try:
        user = db.scalar(select(User).where(User.email == "owner@example.com"))
        stored = db.scalar(select(RefreshToken))
        assert user is not None
        assert user.password_hash is not None
        assert user.password_hash.startswith("$argon2")
        assert stored is not None
        assert stored.token_hash != result["refresh_token"]
        assert result["refresh_token"] not in stored.token_hash
    finally:
        db_generator.close()


def test_login_and_refresh_rotate_tokens_and_reject_replay(
    client: TestClient,
) -> None:
    register(client)

    login = client.post(
        "/auth/login",
        json={"email": "owner@example.com", "password": "StrongPass123!"},
    )
    assert login.status_code == 200
    original_refresh_token = login.json()["refresh_token"]

    refresh = client.post(
        "/auth/refresh", json={"refresh_token": original_refresh_token}
    )
    assert refresh.status_code == 200
    rotated_refresh_token = refresh.json()["refresh_token"]
    assert rotated_refresh_token != original_refresh_token

    replay = client.post(
        "/auth/refresh", json={"refresh_token": original_refresh_token}
    )
    assert replay.status_code == 401

    profile = client.get(
        "/auth/me",
        headers={"Authorization": f"Bearer {refresh.json()['access_token']}"},
    )
    assert profile.status_code == 200
    assert profile.json()["email"] == "owner@example.com"


def test_logout_revokes_refresh_token(client: TestClient) -> None:
    tokens = register(client)

    logout = client.post(
        "/auth/logout", json={"refresh_token": tokens["refresh_token"]}
    )

    assert logout.status_code == 204
    refresh = client.post(
        "/auth/refresh", json={"refresh_token": tokens["refresh_token"]}
    )
    assert refresh.status_code == 401


def test_user_can_update_own_name_and_locale(client: TestClient) -> None:
    tokens = register(client)
    headers = {"Authorization": f"Bearer {tokens['access_token']}"}

    response = client.patch(
        "/auth/me",
        json={"name": "New Name", "locale": "ru"},
        headers=headers,
    )

    assert response.status_code == 200
    assert response.json()["name"] == "New Name"
    assert response.json()["locale"] == "ru"
    assert response.json()["email"] == "owner@example.com"


def test_user_can_change_password_and_old_refresh_token_is_revoked(
    client: TestClient,
) -> None:
    tokens = register(client)
    headers = {"Authorization": f"Bearer {tokens['access_token']}"}

    changed = client.post(
        "/auth/me/password",
        json={
            "current_password": "StrongPass123!",
            "new_password": "AnotherStrong456!",
        },
        headers=headers,
    )

    assert changed.status_code == 204
    assert client.post(
        "/auth/refresh", json={"refresh_token": tokens["refresh_token"]}
    ).status_code == 401
    assert client.post(
        "/auth/login",
        json={"email": "owner@example.com", "password": "StrongPass123!"},
    ).status_code == 401
    assert client.post(
        "/auth/login",
        json={"email": "owner@example.com", "password": "AnotherStrong456!"},
    ).status_code == 200


def test_password_change_requires_the_current_password(client: TestClient) -> None:
    tokens = register(client)
    response = client.post(
        "/auth/me/password",
        json={
            "current_password": "incorrect",
            "new_password": "AnotherStrong456!",
        },
        headers={"Authorization": f"Bearer {tokens['access_token']}"},
    )

    assert response.status_code == 400
    assert response.json()["detail"] == "auth.current_password_incorrect"


def test_account_deletion_request_is_persisted_and_idempotent(
    client: TestClient,
) -> None:
    tokens = register(client)
    headers = {"Authorization": f"Bearer {tokens['access_token']}"}

    first = client.post("/auth/me/deletion-request", headers=headers)
    second = client.post("/auth/me/deletion-request", headers=headers)

    assert first.status_code == second.status_code == 200
    assert first.json()["deletion_requested_at"] is not None
    assert first.json()["deletion_requested_at"] == second.json()["deletion_requested_at"]


def test_login_throttles_repeated_failures_for_an_account_and_ip(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(
        auth_module, "login_attempt_limiter", auth_module.LoginAttemptLimiter(account_limit=2)
    )

    for _ in range(2):
        response = client.post(
            "/auth/login",
            json={"email": "owner@example.com", "password": "WrongPass123!"},
        )
        assert response.status_code == 401

    blocked = client.post(
        "/auth/login",
        json={"email": "owner@example.com", "password": "WrongPass123!"},
    )
    assert blocked.status_code == 429
    assert blocked.headers["Retry-After"] == "900"


def test_login_throttles_failures_from_a_single_ip(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    monkeypatch.setattr(
        auth_module,
        "login_attempt_limiter",
        auth_module.LoginAttemptLimiter(account_limit=10, ip_limit=2),
    )

    for email in ("first@example.com", "second@example.com"):
        response = client.post(
            "/auth/login", json={"email": email, "password": "WrongPass123!"}
        )
        assert response.status_code == 401

    blocked = client.post(
        "/auth/login",
        json={"email": "third@example.com", "password": "WrongPass123!"},
    )
    assert blocked.status_code == 429
