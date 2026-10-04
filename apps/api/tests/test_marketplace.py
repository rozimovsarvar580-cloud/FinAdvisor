import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from finadvisor_api import plans
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
        "plan_id": name,
        "stage": "pilot",
        "funding_target": "250000000.00",
        "summary": "Owner-provided description of this restaurant project.",
    }


def generate_saved_plan(
    client: TestClient,
    headers: dict[str, str],
    monkeypatch: pytest.MonkeyPatch,
    business_name: str,
) -> str:
    async def fake_generate(prompt: str, context: dict[str, object]) -> str:
        return (
            '{"summary":"Owner-reviewed plan summary.",'
            '"sections":[{"title":"Operations","content":"Owner-reviewed operations plan."}]}'
        )

    monkeypatch.setattr(plans, "generate", fake_generate)
    payload = {
        "locale": "en",
        "business_name": business_name,
        "restaurant_format": "family",
        "location": "Samarqand",
        "seats": 40,
        "menu_summary": "Local menu details",
        "average_check": "100000",
        "daily_customers": 50,
        "operating_days_per_month": 30,
        "monthly_rent": "10000000",
        "monthly_utilities": "1000000",
        "variable_cost_ratio_percent": "30",
        "staff": [
            {"role": "Cook", "employee_count": 2, "monthly_salary": "3000000"}
        ],
        "equipment": [
            {"name": "Kitchen equipment", "quantity": "1", "unit_cost": "50000000"}
        ],
        "other_startup_cost": "10000000",
        "loan_amount": "0",
        "annual_interest_rate_percent": "0",
        "loan_term_months": 0,
        "target_monthly_profit": "10000000",
    }
    response = client.post(
        "/plans/generate-and-save",
        json=payload,
        headers=headers,
    )
    assert response.status_code == 200, response.text
    return response.json()["plan_id"]


def test_only_published_owner_listings_are_public(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    owner_headers = register_user(client, "owner@example.com")
    other_headers = register_user(client, "other@example.com")

    owner_plan_id = generate_saved_plan(
        client, owner_headers, monkeypatch, "Samarqand Oshxona"
    )
    other_plan_id = generate_saved_plan(
        client, other_headers, monkeypatch, "Another Restaurant"
    )
    first = client.post(
        "/marketplace/listings",
        json=listing_payload(owner_plan_id),
        headers=owner_headers,
    )
    second = client.post(
        "/marketplace/listings",
        json=listing_payload(other_plan_id),
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
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    investor_headers = register_user(client, "investor@example.com", role="investor")
    owner_headers = register_user(client, "owner@example.com")
    other_owner_headers = register_user(client, "other@example.com")

    denied_create = client.post(
        "/marketplace/listings",
        json=listing_payload(),
        headers=investor_headers,
    )
    owner_plan_id = generate_saved_plan(
        client, owner_headers, monkeypatch, "Samarqand Oshxona"
    )
    listing = client.post(
        "/marketplace/listings",
        json=listing_payload(owner_plan_id),
        headers=owner_headers,
    ).json()
    denied_visibility = client.patch(
        f"/marketplace/listings/{listing['id']}/visibility",
        json={"is_published": False},
        headers=other_owner_headers,
    )

    assert denied_create.status_code == 403
    assert denied_visibility.status_code == 404


def test_saved_plan_generation_requires_an_authenticated_business_owner(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    investor_headers = register_user(client, "investor@example.com", role="investor")
    owner_headers = register_user(client, "owner@example.com")
    payload = {
        "locale": "en",
        "business_name": "Samarqand Oshxona",
        "restaurant_format": "family",
        "location": "Samarqand",
        "seats": 40,
        "menu_summary": "Local menu details",
        "average_check": "100000",
        "daily_customers": 50,
        "operating_days_per_month": 30,
        "monthly_rent": "10000000",
        "monthly_utilities": "1000000",
        "variable_cost_ratio_percent": "30",
        "staff": [],
        "equipment": [],
        "other_startup_cost": "0",
        "loan_amount": "0",
        "annual_interest_rate_percent": "0",
        "loan_term_months": 0,
        "target_monthly_profit": "10000000",
    }

    async def fake_generate(prompt: str, context: dict[str, object]) -> str:
        return (
            '{"summary":"Owner-reviewed plan summary.",'
            '"sections":[{"title":"Operations","content":"Owner-reviewed operations plan."}]}'
        )

    monkeypatch.setattr(plans, "generate", fake_generate)

    assert client.post("/plans/generate-and-save", json=payload).status_code == 401
    denied = client.post(
        "/plans/generate-and-save",
        json=payload,
        headers=investor_headers,
    )
    assert denied.status_code == 403

    saved = client.post(
        "/plans/generate-and-save",
        json=payload,
        headers=owner_headers,
    )
    assert saved.status_code == 200
    assert saved.json()["plan_id"].startswith("plan-")


@pytest.mark.parametrize(
    "field,value",
    [
        ("funding_target", 1000.0),
        ("funding_target", "NaN"),
        ("funding_target", "0"),
        ("funding_target", "100000000000000000000"),
        ("funding_target", "1.001"),
        ("stage", "unknown"),
        ("summary", "  "),
    ],
)
def test_listing_rejects_invalid_or_untrusted_inputs(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
    field: str,
    value: object,
) -> None:
    headers = register_user(client, "owner@example.com")
    payload = listing_payload()
    plan_id = generate_saved_plan(
        client, headers, monkeypatch, "Samarqand Oshxona"
    )
    payload["plan_id"] = plan_id
    payload[field] = value

    response = client.post("/marketplace/listings", json=payload, headers=headers)

    assert response.status_code == 422


def test_marketplace_never_invents_return_or_risk_claims(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    headers = register_user(client, "owner@example.com")
    plan_id = generate_saved_plan(
        client, headers, monkeypatch, "Samarqand Oshxona"
    )
    response = client.post(
        "/marketplace/listings",
        json=listing_payload(plan_id),
        headers=headers,
    )

    assert "target_return" not in response.json()
    assert "risk" not in response.json()
    assert "raised" not in response.json()


def test_public_listing_detail_shows_linked_plan_but_not_original_inputs(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    headers = register_user(client, "owner@example.com")
    plan_id = generate_saved_plan(
        client, headers, monkeypatch, "Samarqand Oshxona"
    )
    response = client.post(
        "/marketplace/listings",
        json=listing_payload(plan_id),
        headers=headers,
    )
    listing_id = response.json()["id"]

    detail = client.get(f"/marketplace/listings/{listing_id}")
    assert detail.status_code == 200
    body = detail.json()
    assert body["plan_id"] == plan_id
    assert body["plan"]["summary"] == "Owner-reviewed plan summary."
    assert body["plan"]["calculations"]["monthly_revenue"] == "150000000.00"
    assert "request_payload" not in body

    client.patch(
        f"/marketplace/listings/{listing_id}/visibility",
        json={"is_published": False},
        headers=headers,
    )
    assert client.get(f"/marketplace/listings/{listing_id}").status_code == 404


def test_listing_cannot_reference_another_owners_saved_plan(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    owner_headers = register_user(client, "owner@example.com")
    other_headers = register_user(client, "other@example.com")
    other_plan_id = generate_saved_plan(
        client, other_headers, monkeypatch, "Other Owner Restaurant"
    )

    response = client.post(
        "/marketplace/listings",
        json=listing_payload(other_plan_id),
        headers=owner_headers,
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "marketplace.plan_not_found"


def test_listing_cannot_reference_a_missing_saved_plan(client: TestClient) -> None:
    headers = register_user(client, "owner@example.com")

    response = client.post(
        "/marketplace/listings",
        json=listing_payload("plan-missing"),
        headers=headers,
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "marketplace.plan_not_found"


def test_saved_plans_are_only_returned_to_the_owner(
    client: TestClient,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    owner_headers = register_user(client, "owner@example.com")
    other_headers = register_user(client, "other@example.com")
    plan_id = generate_saved_plan(
        client, owner_headers, monkeypatch, "Samarqand Oshxona"
    )

    owner_plans = client.get("/plans/mine", headers=owner_headers)
    other_plans = client.get("/plans/mine", headers=other_headers)

    assert [item["id"] for item in owner_plans.json()["items"]] == [plan_id]
    assert other_plans.json()["items"] == []
    assert "request_payload" not in owner_plans.json()["items"][0]
