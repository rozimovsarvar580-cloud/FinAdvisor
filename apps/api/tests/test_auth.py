from collections.abc import Iterator

import httpx
import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from finadvisor_api import auth as auth_module
from finadvisor_api.database import Base, get_db
from finadvisor_api.main import app
from finadvisor_api.models import User


@pytest.fixture
def client(monkeypatch: pytest.MonkeyPatch) -> Iterator[TestClient]:
    monkeypatch.setenv("JWT_SECRET", "unit-test-secret-key-at-least-32-bytes-long")
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


def test_oauth_exchange_validates_google_token_and_reuses_provider_identity(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    requests: list[httpx.Request] = []
    async_client = httpx.AsyncClient

    def provider_response(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return httpx.Response(
            200,
            json={
                "sub": "google-user-123",
                "email": "owner@example.com",
                "email_verified": True,
                "name": "Restaurant Owner",
                "picture": "https://example.com/avatar.png",
            },
            request=request,
        )

    monkeypatch.setattr(
        auth_module.httpx,
        "AsyncClient",
        lambda **kwargs: async_client(
            transport=httpx.MockTransport(provider_response), **kwargs
        ),
    )

    first = client.post(
        "/auth/oauth",
        json={
            "provider": "google",
            "access_token": "provider-access-token",
            "role": "investor",
        },
    )
    second = client.post(
        "/auth/oauth",
        json={
            "provider": "google",
            "access_token": "provider-access-token",
            "role": "tadbirkor",
        },
    )

    assert first.status_code == 200
    assert second.status_code == 200
    assert first.json()["user"]["id"] == second.json()["user"]["id"]
    assert second.json()["user"]["role"] == "investor"
    assert second.json()["user"]["email_verified"] is True
    assert requests[0].url.host == "www.googleapis.com"
    assert requests[0].headers["authorization"] == "Bearer provider-access-token"


def test_oauth_exchange_rejects_invalid_provider_tokens(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    async_client = httpx.AsyncClient

    def provider_response(request: httpx.Request) -> httpx.Response:
        return httpx.Response(401, json={"error": "invalid_token"}, request=request)

    monkeypatch.setattr(
        auth_module.httpx,
        "AsyncClient",
        lambda **kwargs: async_client(
            transport=httpx.MockTransport(provider_response), **kwargs
        ),
    )

    response = client.post(
        "/auth/oauth",
        json={"provider": "facebook", "access_token": "invalid-provider-token"},
    )

    assert response.status_code == 401
    assert response.json()["detail"] == "auth.invalid_provider_token"


def test_oauth_exchange_reads_facebook_profile(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    requests: list[httpx.Request] = []
    async_client = httpx.AsyncClient

    def provider_response(request: httpx.Request) -> httpx.Response:
        requests.append(request)
        return httpx.Response(
            200,
            json={
                "id": "facebook-user-123",
                "email": "owner@example.com",
                "name": "Restaurant Owner",
                "picture": {"data": {"url": "https://example.com/avatar.png"}},
            },
            request=request,
        )

    monkeypatch.setattr(
        auth_module.httpx,
        "AsyncClient",
        lambda **kwargs: async_client(
            transport=httpx.MockTransport(provider_response), **kwargs
        ),
    )

    response = client.post(
        "/auth/oauth",
        json={
            "provider": "facebook",
            "access_token": "provider-access-token",
            "role": "buxgalter",
        },
    )

    assert response.status_code == 200
    assert response.json()["user"]["auth_provider"] == "facebook"
    assert response.json()["user"]["role"] == "buxgalter"
    assert response.json()["user"]["avatar_url"] == "https://example.com/avatar.png"
    assert response.json()["user"]["email_verified"] is False
    assert requests[0].url.host == "graph.facebook.com"
    assert requests[0].url.params["fields"] == "id,name,email,picture"


def test_oauth_exchange_does_not_link_an_existing_email_implicitly(
    client: TestClient, monkeypatch: pytest.MonkeyPatch
) -> None:
    async_client = httpx.AsyncClient

    def provider_response(request: httpx.Request) -> httpx.Response:
        return httpx.Response(
            200,
            json={
                "sub": "google-user-456",
                "email": "owner@example.com",
                "email_verified": True,
                "name": "Another Owner",
            },
            request=request,
        )

    monkeypatch.setattr(
        auth_module.httpx,
        "AsyncClient",
        lambda **kwargs: async_client(
            transport=httpx.MockTransport(provider_response), **kwargs
        ),
    )
    client.post(
        "/auth/register",
        json={
            "email": "owner@example.com",
            "name": "Existing Owner",
            "password": "StrongPass123!",
        },
    )

    response = client.post(
        "/auth/oauth",
        json={"provider": "google", "access_token": "provider-access-token"},
    )

    assert response.status_code == 409
    assert response.json()["detail"] == "auth.account_exists"
