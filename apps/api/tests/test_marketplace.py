import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from finadvisor_api.database import Base, get_db
from finadvisor_api.main import app


@pytest.fixture
def client(monkeypatch: pytest.MonkeyPatch) -> TestClient:
    monkeypatch.setenv("JWT_SECRET", "unit-test-secret-key-at-least-32-bytes-long")
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    testing_session_local = sessionmaker(bind=engine, autoflush=False, autocommit=False)

    def override_get_db():
        with testing_session_local() as session:
            yield session

    app.dependency_overrides[get_db] = override_get_db
    try:
        with TestClient(app) as test_client:
            yield test_client
    finally:
        app.dependency_overrides.clear()
        Base.metadata.drop_all(bind=engine)
        engine.dispose()


def register_user(
    client: TestClient, email: str, role: str = "tadbirkor"
) -> dict[str, str]:
    response = client.post(
        "/auth/register",
        json={
            "email": email,
            "name": "Business Owner",
            "password": "StrongPass123!",
            "role": role,
        },
    )
    assert response.status_code == 201
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def listing_payload(name: str = "Samarqand Oshxona") -> dict[str, object]:
    return {
        "business_name": name,
        "city": "Samarqand",
        "stage": "pilot",
        "funding_target": "250000000.00",
        "summary": "Owner-provided description of this restaurant project.",
    }


def test_only_published_owner_listings_are_public(client: TestClient) -> None:
    owner_headers = register_user(client, "owner@example.com")
    other_headers = register_user(client, "other@example.com")

    first = client.post(
        "/marketplace/listings",
        json=listing_payload(),
        headers=owner_headers,
    )
    second = client.post(
        "/marketplace/listings",
        json=listing_payload("Another Restaurant"),
        headers=other_headers,
    )
    assert first.status_code == second.status_code == 201
    listing_id = first.json()["id"]

    assert len(client.get("/marketplace/listings").json()["items"]) == 2
    assert client.patch(
        f"/marketplace/listings/{listing_id}/visibility",
        json={"is_published": False},
        headers=owner_headers,
    ).status_code == 200
    public_ids = {
        item["id"] for item in client.get("/marketplace/listings").json()["items"]
    }
    assert listing_id not in public_ids
    assert [
        item["id"]
        for item in client.get(
            "/marketplace/listings/mine",
            headers=owner_headers,
        ).json()["items"]
    ] == [listing_id]


def test_marketplace_requires_business_owner_and_only_owner_can_manage_listing(
    client: TestClient,
) -> None:
    investor_headers = register_user(client, "investor@example.com", role="investor")
    owner_headers = register_user(client, "owner@example.com")
    other_owner_headers = register_user(client, "other@example.com")

    denied_create = client.post(
        "/marketplace/listings",
        json=listing_payload(),
        headers=investor_headers,
    )
    listing = client.post(
        "/marketplace/listings",
        json=listing_payload(),
        headers=owner_headers,
    ).json()
    denied_visibility = client.patch(
        f"/marketplace/listings/{listing['id']}/visibility",
        json={"is_published": False},
        headers=other_owner_headers,
    )

    assert denied_create.status_code == 403
    assert denied_visibility.status_code == 404


@pytest.mark.parametrize(
    "field,value",
    [
        ("funding_target", 1000.0),
        ("funding_target", "NaN"),
        ("funding_target", "0"),
        ("funding_target", "100000000000000000000"),
        ("funding_target", "1.001"),
        ("stage", "unknown"),
        ("business_name", "  "),
    ],
)
def test_listing_rejects_invalid_or_untrusted_inputs(
    client: TestClient, field: str, value: object
) -> None:
    headers = register_user(client, "owner@example.com")
    payload = listing_payload()
    payload[field] = value

    response = client.post("/marketplace/listings", json=payload, headers=headers)

    assert response.status_code == 422


def test_marketplace_never_invents_return_or_risk_claims(client: TestClient) -> None:
    headers = register_user(client, "owner@example.com")
    response = client.post(
        "/marketplace/listings",
        json=listing_payload(),
        headers=headers,
    )

    assert "target_return" not in response.json()
    assert "risk" not in response.json()
    assert "raised" not in response.json()
