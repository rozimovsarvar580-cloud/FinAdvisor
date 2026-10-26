import hashlib
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
from finadvisor_api.models import EmailToken, RefreshToken, User


@pytest.fixture
def client(monkeypatch: pytest.MonkeyPatch) -> Iterator[TestClient]:
    monkeypatch.setenv("JWT_SECRET", "unit-test-secret-key-at-least-32-bytes-long")
    monkeypatch.setenv("EMAIL_PROVIDER", "console")
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


def get_db_session():
    generator = app.dependency_overrides[get_db]()
    return generator, next(generator)


def test_verification_tokens_are_hashed_single_use_and_expire_in_24_hours(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    sent_tokens: list[tuple[str, str]] = []
    monkeypatch.setattr(
        auth_module,
        "send_auth_email",
        lambda recipient, locale, purpose, token: sent_tokens.append((purpose, token)),
    )
    register(client)
    assert sent_tokens[0][0] == "verify"
    generator, db = get_db_session()
    try:
        stored_token = db.scalar(select(EmailToken).where(EmailToken.purpose == "verify"))
        assert stored_token is not None
        assert stored_token.token_hash != sent_tokens[0][1]
        expires_at = stored_token.expires_at.replace(tzinfo=UTC)
        now = datetime.now(UTC)
        assert now + timedelta(hours=23) < expires_at < now + timedelta(hours=25)
    finally:
        generator.close()

    verified = client.post("/auth/verify-email", json={"token": sent_tokens[0][1]})
    replay = client.post("/auth/verify-email", json={"token": sent_tokens[0][1]})

    assert verified.status_code == 200
    assert replay.status_code == 400
    generator, db = get_db_session()
    try:
        user = db.scalar(select(User).where(User.email == "owner@example.com"))
        assert user is not None
        assert user.email_verified is True
    finally:
        generator.close()


def test_expired_verification_token_is_rejected(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    sent_tokens: list[str] = []
    monkeypatch.setattr(
        auth_module,
        "send_auth_email",
        lambda recipient, locale, purpose, token: sent_tokens.append(token),
    )
    register(client)
    generator, db = get_db_session()
    try:
        stored_token = db.scalar(select(EmailToken).where(EmailToken.purpose == "verify"))
        assert stored_token is not None
        stored_token.expires_at = datetime.now(UTC) - timedelta(seconds=1)
        db.commit()
    finally:
        generator.close()

    response = client.post("/auth/verify-email", json={"token": sent_tokens[0]})

    assert response.status_code == 400


def test_password_reset_is_hashed_single_use_and_revokes_refresh_tokens(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    sent_tokens: list[tuple[str, str]] = []
    monkeypatch.setattr(
        auth_module,
        "send_auth_email",
        lambda recipient, locale, purpose, token: sent_tokens.append((purpose, token)),
    )
    register(client)
    session = client.post(
        "/auth/login",
        json={"email": "owner@example.com", "password": "StrongPass123!"},
    ).json()

    existing = client.post(
        "/auth/forgot-password", json={"email": "owner@example.com"}
    )
    unknown = client.post(
        "/auth/forgot-password", json={"email": "missing@example.com"}
    )
    assert existing.status_code == unknown.status_code == 202
    assert existing.json() == unknown.json()
    reset_token = sent_tokens[-1][1]
    generator, db = get_db_session()
    try:
        stored_token = db.scalar(select(EmailToken).where(EmailToken.purpose == "reset"))
        assert stored_token is not None
        assert stored_token.token_hash != reset_token
        expires_at = stored_token.expires_at.replace(tzinfo=UTC)
        now = datetime.now(UTC)
        assert now + timedelta(minutes=59) < expires_at < now + timedelta(hours=1, minutes=1)
    finally:
        generator.close()

    reset = client.post(
        "/auth/reset-password",
        json={"token": reset_token, "password": "AnotherPass456!"},
    )
    replay = client.post(
        "/auth/reset-password",
        json={"token": reset_token, "password": "AnotherPass456!"},
    )
    assert reset.status_code == 200
    assert replay.status_code == 400
    assert client.post(
        "/auth/login",
        json={"email": "owner@example.com", "password": "AnotherPass456!"},
    ).status_code == 200
    assert client.post(
        "/auth/refresh", json={"refresh_token": session["refresh_token"]}
    ).status_code == 401

    generator, db = get_db_session()
    try:
        old_token_hash = hashlib.sha256(session["refresh_token"].encode()).hexdigest()
        old_token = db.scalar(
            select(RefreshToken).where(RefreshToken.token_hash == old_token_hash)
        )
        assert old_token is not None
        assert old_token.revoked_at is not None
    finally:
        generator.close()


def test_resend_verification_does_not_enumerate_accounts(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    sent_tokens: list[tuple[str, str]] = []
    monkeypatch.setattr(
        auth_module,
        "send_auth_email",
        lambda recipient, locale, purpose, token: sent_tokens.append((purpose, token)),
    )
    register(client)

    existing = client.post(
        "/auth/resend-verification", json={"email": "owner@example.com"}
    )
    unknown = client.post(
        "/auth/resend-verification", json={"email": "missing@example.com"}
    )

    assert existing.status_code == unknown.status_code == 202
    assert existing.json() == unknown.json()
    assert sent_tokens[-1][0] == "verify"
    assert sent_tokens[0][1] != sent_tokens[-1][1]


def test_unconfigured_email_delivery_does_not_enumerate_accounts(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    register(client)
    monkeypatch.setenv("EMAIL_PROVIDER", "disabled")

    existing = client.post(
        "/auth/forgot-password", json={"email": "owner@example.com"}
    )
    unknown = client.post(
        "/auth/forgot-password", json={"email": "missing@example.com"}
    )

    assert existing.status_code == unknown.status_code == 503
    assert existing.json() == unknown.json()
