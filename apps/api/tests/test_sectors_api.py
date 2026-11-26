import json
from pathlib import Path

import pytest
from alembic import command
from alembic.config import Config
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, text
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from finadvisor_api.auth import get_current_user
from finadvisor_api.database import Base, get_db
from finadvisor_api.main import app
from finadvisor_api.models import SavedBusinessPlan, User

client = TestClient(app)


@pytest.fixture
def business_owner(monkeypatch: pytest.MonkeyPatch) -> User:
    owner = User(
        id="sector-api-owner",
        email="sector-api-owner@example.com",
        name="Sector API Owner",
        role="tadbirkor",
        subscription_plan="business",
    )
    monkeypatch.setitem(app.dependency_overrides, get_current_user, lambda: owner)
    return owner


@pytest.fixture
def api_database(monkeypatch: pytest.MonkeyPatch):
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    testing_session_local = sessionmaker(
        bind=engine,
        autoflush=False,
        autocommit=False,
        expire_on_commit=False,
    )

    def override_get_db():
        with testing_session_local() as session:
            yield session

    monkeypatch.setitem(app.dependency_overrides, get_db, override_get_db)
    yield testing_session_local
    Base.metadata.drop_all(bind=engine)
    engine.dispose()


def test_sector_list_and_detail_are_registry_backed() -> None:
    sectors = client.get("/sectors")
    assert sectors.status_code == 200
    assert len(sectors.json()) == 13
    assert sectors.json()[0]["id"] == "restaurant_cafe"
    assert set(sectors.json()[0]["names"]) == {"en", "ru", "uz"}

    detail = client.get("/sectors/beauty_salon")
    assert detail.status_code == 200
    assert detail.json()["revenue_model_type"] == "hourly_service"
    assert detail.json()["questions"]["en"]


def test_unknown_sector_returns_not_found() -> None:
    response = client.get("/sectors/not_a_sector")
    assert response.status_code == 404
    assert response.json()["detail"] == "sectors.sector_not_found"


def test_plan_creation_requires_authentication() -> None:
    response = client.post(
        "/plans",
        json={
            "business_name": "Retail plan",
            "location": "Tashkent",
            "sector_id": "retail_shop",
            "inputs": {},
        },
    )
    assert response.status_code == 401


def test_plan_creation_validates_registry_inputs_and_persists_sector(
    business_owner: User,
    api_database,
) -> None:
    with api_database() as db:
        db.add(business_owner)
        db.commit()

    payload = {
        "business_name": "Retail plan",
        "location": "Tashkent",
        "sector_id": "retail_shop",
        "inputs": {
            "revenue_model_type": "unit_sales",
            "cost_categories": ["inventory_purchases"],
            "staff_roles": ["cashier"],
            "planned_units": "100",
        },
    }
    response = client.post("/plans", json=payload)

    assert response.status_code == 201
    body = response.json()
    assert body["sector_id"] == "retail_shop"
    assert body["inputs"] == payload["inputs"]
    with api_database() as db:
        saved = db.get(SavedBusinessPlan, body["id"])
        assert saved is not None
        assert saved.sector_id == "retail_shop"
        assert saved.inputs == payload["inputs"]

    listed = client.get("/plans/mine")
    assert listed.status_code == 200
    assert listed.json()["items"][0]["sector_id"] == "retail_shop"
    assert listed.json()["items"][0]["inputs"] == payload["inputs"]
    sharing = client.post(f"/plans/{body['id']}/share")
    assert sharing.status_code == 409
    assert sharing.json()["detail"] == "plans.plan_generation_required"


@pytest.mark.parametrize(
    "sector_id, inputs",
    [
        ("not_a_sector", {}),
        ("retail_shop", {"revenue_model_type": "hourly_service"}),
        ("retail_shop", {"cost_categories": ["unlisted_cost"]}),
        ("retail_shop", {"staff_roles": ["unlisted_role"]}),
    ],
)
def test_plan_creation_rejects_sector_mismatches(
    business_owner: User,
    api_database,
    sector_id: str,
    inputs: dict[str, object],
) -> None:
    with api_database() as db:
        db.add(business_owner)
        db.commit()

    response = client.post(
        "/plans",
        json={
            "business_name": "Invalid plan",
            "location": "Tashkent",
            "sector_id": sector_id,
            "inputs": inputs,
        },
    )

    assert response.status_code == 422


def test_sector_plan_fields_default_for_preexisting_rows(
    monkeypatch: pytest.MonkeyPatch,
    tmp_path: Path,
) -> None:
    api_root = Path(__file__).resolve().parents[1]
    config = Config(str(api_root / "alembic.ini"))
    config.set_main_option("script_location", str(api_root / "migrations"))
    database_path = tmp_path / "sector-migration.sqlite"
    config.set_main_option("sqlalchemy.url", f"sqlite:///{database_path.as_posix()}")
    monkeypatch.delenv("DATABASE_URL", raising=False)

    command.upgrade(config, "20261027_23")
    engine = create_engine(f"sqlite:///{database_path.as_posix()}")
    try:
        with engine.begin() as connection:
            connection.execute(
                text(
                    "INSERT INTO saved_business_plans "
                    "(id, owner_id, business_name, location, request_payload, generated_plan) "
                    "VALUES ('legacy-plan', 'legacy-owner', 'Legacy', 'Tashkent', '{}', '{}')"
                )
            )
        command.upgrade(config, "head")
        with engine.connect() as connection:
            row = connection.execute(
                text("SELECT sector_id, inputs FROM saved_business_plans WHERE id = 'legacy-plan'")
            ).one()
        assert row.sector_id == "restaurant_cafe"
        assert json.loads(row.inputs) == {}
    finally:
        engine.dispose()
