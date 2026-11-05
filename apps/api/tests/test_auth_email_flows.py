<<<<<<< HEAD
from collections.abc import Iterator
from datetime import UTC, datetime, timedelta
from typing import Any

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select, update
from sqlalchemy.orm import Session, sessionmaker
=======
import hashlib
from collections.abc import Iterator
from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
>>>>>>> 12899e6e553a1563cc224d5ccc910c29dc2ea331
from sqlalchemy.pool import StaticPool

from finadvisor_api import auth as auth_module
from finadvisor_api.database import Base, get_db
<<<<<<< HEAD
from finadvisor_api.email_sender import OutboundEmail
from finadvisor_api.main import app
from finadvisor_api.models import EmailToken, RefreshToken, User
from finadvisor_api.security import hash_email_token, hash_refresh_token


@pytest.fixture
def database(
    monkeypatch: pytest.MonkeyPatch,
) -> Iterator[tuple[TestClient, sessionmaker[Session]]]:
    monkeypatch.setenv("JWT_SECRET", "unit-test-secret-key-at-least-32-bytes-long")
=======
from finadvisor_api.main import app
from finadvisor_api.models import EmailToken, RefreshToken, User


@pytest.fixture
def client(monkeypatch: pytest.MonkeyPatch) -> Iterator[TestClient]:
    monkeypatch.setenv("JWT_SECRET", "unit-test-secret-key-at-least-32-bytes-long")
    monkeypatch.setenv("EMAIL_PROVIDER", "console")
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
def _register(client: TestClient) -> dict[str, Any]:
=======
def register(client: TestClient) -> dict[str, object]:
>>>>>>> 12899e6e553a1563cc224d5ccc910c29dc2ea331
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


<<<<<<< HEAD
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
=======
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
>>>>>>> 12899e6e553a1563cc224d5ccc910c29dc2ea331
        "/auth/forgot-password", json={"email": "owner@example.com"}
    )
    unknown = client.post(
        "/auth/forgot-password", json={"email": "missing@example.com"}
    )

<<<<<<< HEAD
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
=======
    assert existing.status_code == unknown.status_code == 503
    assert existing.json() == unknown.json()
>>>>>>> 12899e6e553a1563cc224d5ccc910c29dc2ea331
