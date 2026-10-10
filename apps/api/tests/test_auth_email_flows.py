from collections.abc import Iterator
from datetime import UTC, datetime, timedelta
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select, update
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from finadvisor_api import auth as auth_module
from finadvisor_api.database import Base, get_db
from finadvisor_api.email_sender import OutboundEmail
from finadvisor_api.main import app
from finadvisor_api.models import EmailToken, RefreshToken, User
from finadvisor_api.security import hash_email_token, hash_refresh_token


@pytest.fixture
def database(
    monkeypatch: pytest.MonkeyPatch,
) -> Iterator[tuple[TestClient, sessionmaker[Session]]]:
    monkeypatch.setenv("JWT_SECRET", "unit-test-secret-key-at-least-32-bytes-long")
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


def _register(client: TestClient) -> dict[str, Any]:
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


def _capture_email_token(monkeypatch: pytest.MonkeyPatch) -> str:
    token = "captured-email-token-value-that-is-long-enough-for-validation"
    monkeypatch.setattr(auth_module, "create_email_token", lambda: token)
    return token


class FakeEmailSender:
    def __init__(self) -> None:
        self.messages: list[OutboundEmail] = []

    def send(self, message: OutboundEmail) -> None:
        self.messages.append(message)


def test_forgot_password_is_non_enumerating_and_reset_is_single_use(
    database: tuple[TestClient, sessionmaker[Session]],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client, session_factory = database
    fake_sender = FakeEmailSender()
    monkeypatch.setattr(auth_module, "get_email_sender", lambda: fake_sender)
    registered = _register(client)
    refresh_token_hash = hash_refresh_token(registered["refresh_token"])
    token = _capture_email_token(monkeypatch)

    known = client.post(
        "/auth/forgot-password", json={"email": "owner@example.com"}
    )
    unknown = client.post(
        "/auth/forgot-password", json={"email": "missing@example.com"}
    )

    assert known.status_code == unknown.status_code == 200
    assert known.json() == unknown.json() == {
        "message": "auth.password_reset_requested"
    }
    assert token not in known.text
    assert len(fake_sender.messages) == 3
    assert fake_sender.messages[-1].recipient == "owner@example.com"
    assert token in fake_sender.messages[-1].text_body
    with session_factory() as session:
        record = session.scalar(
            select(EmailToken).where(
                EmailToken.token_hash == hash_email_token(token)
            )
        )
        assert record is not None
        assert record.purpose == "password_reset"
        expires_at = record.expires_at.replace(tzinfo=UTC)
        assert datetime.now(UTC) + timedelta(minutes=59) <= expires_at
        assert expires_at <= datetime.now(UTC) + timedelta(minutes=61)

    reset = client.post(
        "/auth/reset-password",
        json={"token": token, "password": "NewStrongPass456!"},
    )
    assert reset.status_code == 200
    assert reset.json() == {"message": "auth.password_reset"}
    assert (
        client.post(
            "/auth/reset-password",
            json={"token": token, "password": "AnotherStrongPass789!"},
        ).status_code
        == 400
    )

    with session_factory() as session:
        refresh_record = session.scalar(
            select(RefreshToken).where(
                RefreshToken.token_hash == refresh_token_hash
            )
        )
        assert refresh_record is not None and refresh_record.revoked_at is not None

    assert (
        client.post(
            "/auth/login",
            json={"email": "owner@example.com", "password": "NewStrongPass456!"},
        ).status_code
        == 200
    )

def test_resend_and_verify_email_are_non_enumerating_and_single_use(
    database: tuple[TestClient, sessionmaker[Session]],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client, session_factory = database
    fake_sender = FakeEmailSender()
    monkeypatch.setattr(auth_module, "get_email_sender", lambda: fake_sender)
    _register(client)
    token = _capture_email_token(monkeypatch)

    known = client.post("/auth/resend", json={"email": "owner@example.com"})
    unknown = client.post("/auth/resend", json={"email": "missing@example.com"})
    assert known.status_code == unknown.status_code == 200
    assert known.json() == unknown.json() == {
        "message": "auth.verification_requested"
    }
    assert len(fake_sender.messages) == 3
    assert token in fake_sender.messages[-1].text_body
    assert token not in known.text
    with session_factory() as session:
        record = session.scalar(
            select(EmailToken).where(EmailToken.token_hash == hash_email_token(token))
        )
        assert record is not None
        assert record.purpose == "email_verification"
        expires_at = record.expires_at.replace(tzinfo=UTC)
        assert datetime.now(UTC) + timedelta(hours=23) <= expires_at
        assert expires_at <= datetime.now(UTC) + timedelta(hours=25)

    verified = client.post("/auth/verify-email", json={"token": token})
    assert verified.status_code == 200
    assert verified.json() == {"message": "auth.email_verified"}
    assert client.post("/auth/verify-email", json={"token": token}).status_code == 400
    with session_factory() as session:
        user = session.scalar(select(User).where(User.email == "owner@example.com"))
        assert user is not None and user.email_verified

    no_longer_needed = client.post(
        "/auth/resend", json={"email": "owner@example.com"}
    )
    assert no_longer_needed.json() == known.json()


def test_email_tokens_cannot_be_reused_for_another_purpose_or_after_expiry(
    database: tuple[TestClient, sessionmaker[Session]],
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    client, session_factory = database
    monkeypatch.setattr(auth_module, "get_email_sender", lambda: FakeEmailSender())
    _register(client)
    token = _capture_email_token(monkeypatch)
    client.post("/auth/forgot-password", json={"email": "owner@example.com"})

    wrong_purpose = client.post("/auth/verify-email", json={"token": token})
    assert wrong_purpose.status_code == 400
    with session_factory() as session:
        session.execute(
            update(EmailToken)
            .where(EmailToken.token_hash == hash_email_token(token))
            .values(expires_at=datetime.now(UTC) - timedelta(minutes=1))
        )
        session.commit()

    expired = client.post(
        "/auth/reset-password",
        json={"token": token, "password": "NewStrongPass456!"},
    )
    assert expired.status_code == 400
    assert expired.json()["detail"] == "auth.invalid_or_expired_reset_token"
