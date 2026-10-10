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
from finadvisor_api.models import RefreshToken
from finadvisor_api.security import LoginAttemptLimiter, hash_refresh_token


@pytest.fixture
def client(monkeypatch: pytest.MonkeyPatch) -> Iterator[TestClient]:
    monkeypatch.setenv("JWT_SECRET", "unit-test-secret-key-at-least-32-bytes-long")
    auth_module.login_attempt_limiter.clear()
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
        auth_module.login_attempt_limiter.clear()


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


def test_register_returns_short_lived_access_and_refresh_tokens(
    client: TestClient,
) -> None:
    body = register(client)
    claims = jwt.decode(
        body["access_token"],
        "unit-test-secret-key-at-least-32-bytes-long",
        algorithms=["HS256"],
    )

    assert body["refresh_token"]
    expires_at = datetime.fromtimestamp(claims["exp"], UTC)
    assert datetime.now(UTC) + timedelta(minutes=14) <= expires_at
    assert expires_at <= datetime.now(UTC) + timedelta(minutes=16)


def test_refresh_rotates_hashed_token_and_logout_revokes_it(
    client: TestClient,
) -> None:
    initial = register(client)
    first_raw = initial["refresh_token"]
    first_hash = hash_refresh_token(first_raw)

    refreshed = client.post("/auth/refresh", json={"refresh_token": first_raw})

    assert refreshed.status_code == 200
    replacement = refreshed.json()["refresh_token"]
    assert replacement != first_raw
    session_generator = app.dependency_overrides[get_db]()
    session = next(session_generator)
    try:
        old_record = session.scalar(
            select(RefreshToken).where(RefreshToken.token_hash == first_hash)
        )
        new_record = session.scalar(
            select(RefreshToken).where(
                RefreshToken.token_hash == hash_refresh_token(replacement)
            )
        )
        assert old_record is not None and old_record.revoked_at is not None
        assert new_record is not None and new_record.revoked_at is None
    finally:
        session_generator.close()

    assert client.post("/auth/refresh", json={"refresh_token": first_raw}).status_code == 401
    logout_response = client.post(
        "/auth/logout", json={"refresh_token": replacement}
    )
    assert logout_response.status_code == 204
    assert client.post("/auth/refresh", json={"refresh_token": replacement}).status_code == 401
    assert client.post("/auth/logout", json={"refresh_token": replacement}).status_code == 204


def test_login_blocks_repeated_failures_for_account_and_ip(client: TestClient) -> None:
    register(client)
    for _ in range(5):
        response = client.post(
            "/auth/login",
            json={"email": "owner@example.com", "password": "WrongPass123!"},
        )
        assert response.status_code == 401

    blocked = client.post(
        "/auth/login",
        json={"email": "owner@example.com", "password": "StrongPass123!"},
    )
    assert blocked.status_code == 429


def test_login_attempt_limiter_tracks_account_and_ip_independently() -> None:
    limiter = LoginAttemptLimiter(limit=2, window_seconds=60)
    limiter.record_failure("owner@example.com", "192.0.2.1")
    limiter.record_failure("owner@example.com", "192.0.2.1")

    assert limiter.is_allowed("other@example.com", "192.0.2.2")
    assert not limiter.is_allowed("owner@example.com", "192.0.2.2")
    assert not limiter.is_allowed("other@example.com", "192.0.2.1")
