from collections.abc import Iterator

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from finadvisor_api import auth as auth_module
from finadvisor_api.database import Base, get_db
from finadvisor_api.main import app


@pytest.fixture
def client(monkeypatch: pytest.MonkeyPatch) -> Iterator[TestClient]:
    monkeypatch.setenv("JWT_SECRET", "unit-test-secret-key-at-least-32-bytes-long")
    monkeypatch.setattr(auth_module, "send_auth_email", lambda *args: None)
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(engine)
    sessions = sessionmaker(bind=engine, autoflush=False, autocommit=False)

    def override_db():
        with sessions() as db:
            yield db

    app.dependency_overrides[get_db] = override_db
    try:
        with TestClient(app) as test_client:
            yield test_client
    finally:
        app.dependency_overrides.clear()
        Base.metadata.drop_all(engine)
        engine.dispose()


def headers(client: TestClient, email: str) -> dict[str, str]:
    response = client.post(
        "/auth/register",
        json={
            "email": email,
            "name": "Accounting test",
            "password": "StrongPass123!",
            "role": "buxgalter",
        },
    )
    assert response.status_code == 201
    return {"Authorization": f"Bearer {response.json()['access_token']}"}


def sync(
    client: TestClient,
    auth: dict[str, str],
    resource: str,
    client_id: str,
    data: dict[str, object],
):
    return client.post(
        f"/accounting/sync/{resource}",
        headers=auth,
        json={"client_id": client_id, "data": data},
    )


def test_service_business_has_no_stock_and_stores_service_metadata(
    client: TestClient,
) -> None:
    accountant = headers(client, "service-accountant@example.com")
    other_accountant = headers(client, "other-accountant@example.com")

    updated = client.put(
        "/accounting/preferences",
        headers=accountant,
        json={"business_type": "services"},
    )
    assert updated.status_code == 200
    assert updated.json() == {"business_type": "services"}
    assert client.get("/accounting/preferences", headers=accountant).json() == {
        "business_type": "services"
    }
    assert client.get("/accounting/preferences", headers=other_accountant).json() == {
        "business_type": "goods"
    }

    service = sync(
        client,
        accountant,
        "inventory",
        "consultation-1",
        {
            "name": "Consultation",
            "item_type": "service",
            "unit": "session",
            "service_duration_minutes": "45",
        },
    )
    assert service.status_code == 200
    stored = client.get("/accounting/inventory", headers=accountant).json()["items"][0]
    assert stored["item_type"] == "service"
    assert stored["unit"] == "session"
    assert stored["service_duration_minutes"] == 45
    assert stored["tracks_inventory"] is False
    assert (
        sync(
            client,
            accountant,
            "stock-movements",
            "service-stock",
            {"product": "Consultation", "quantity": "1"},
        ).status_code
        == 422
    )


@pytest.mark.parametrize(
    "data",
    [
        {"item_type": "service", "unit": "", "service_duration_minutes": "30"},
        {"item_type": "service", "unit": "session", "service_duration_minutes": "0"},
        {"item_type": "service", "unit": "session", "service_duration_minutes": "30.5"},
        {"item_type": "other", "unit": "piece"},
    ],
)
def test_invalid_catalog_item_metadata_is_rejected(
    client: TestClient, data: dict[str, object]
) -> None:
    accountant = headers(client, f"invalid-{len(str(data))}@example.com")
    client.put(
        "/accounting/preferences",
        headers=accountant,
        json={"business_type": "mixed"},
    )
    assert sync(client, accountant, "inventory", "invalid-item", data).status_code == 422


def test_goods_catalog_and_custom_income_expense_categories(client: TestClient) -> None:
    accountant = headers(client, "goods-accountant@example.com")
    product = sync(
        client,
        accountant,
        "inventory",
        "rice-1",
        {"name": "Rice", "item_type": "goods", "unit": "kg"},
    )
    assert product.status_code == 200
    stored = client.get("/accounting/inventory", headers=accountant).json()["items"][0]
    assert stored["item_type"] == "goods"
    assert stored["unit"] == "kg"
    assert stored["tracks_inventory"] is True

    income = sync(
        client,
        accountant,
        "sales",
        "income-1",
        {"amount": "12500", "category": "Catering package"},
    )
    expense = sync(
        client,
        accountant,
        "expenses",
        "expense-1",
        {"amount": "2500", "category": "Equipment repair"},
    )
    assert income.status_code == expense.status_code == 200
    assert income.json()["data"]["category"] == "Catering package"
    assert expense.json()["data"]["category"] == "Equipment repair"
    assert (
        sync(
            client,
            accountant,
            "expenses",
            "invalid-category",
            {"category": "x" * 65},
        ).status_code
        == 422
    )
