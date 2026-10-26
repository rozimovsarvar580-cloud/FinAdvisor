from datetime import UTC, datetime
from decimal import Decimal

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from finadvisor_api.ai_metering import (
    daily_request_limit,
    record_ai_token_usage,
    reserve_ai_request,
)
from finadvisor_api.auth import get_current_user
from finadvisor_api.database import Base, get_db
from finadvisor_api.main import app
from finadvisor_api.models import AIUsageDaily, User


@pytest.fixture
def usage_database(monkeypatch: pytest.MonkeyPatch):
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    session_factory = sessionmaker(
        bind=engine,
        autoflush=False,
        autocommit=False,
        expire_on_commit=False,
    )
    user = User(
        id="usage-test-user",
        email="usage-test@example.com",
        name="Usage Test",
        role="tadbirkor",
        subscription_plan="free",
    )
    with session_factory() as db:
        db.add(user)
        db.commit()

    def override_get_db():
        with session_factory() as session:
            yield session

    monkeypatch.setitem(app.dependency_overrides, get_db, override_get_db)
    monkeypatch.setitem(app.dependency_overrides, get_current_user, lambda: user)
    yield session_factory, user
    Base.metadata.drop_all(bind=engine)
    engine.dispose()


@pytest.mark.parametrize(
    ("plan", "expected_limit", "upgrade_hint"),
    [
        ("free", 10, "pro"),
        ("pro", 100, "business"),
        ("business", 300, None),
    ],
)
def test_ai_request_limits_are_enforced_per_plan(
    usage_database,
    plan: str,
    expected_limit: int,
    upgrade_hint: str | None,
) -> None:
    session_factory, user = usage_database
    user.subscription_plan = plan
    today = datetime.now(UTC).date()
    with session_factory() as db:
        db.add(
            AIUsageDaily(
                user_id=user.id,
                usage_date=today,
                requests=expected_limit - 1,
            )
        )
        db.commit()

        assert reserve_ai_request(db, user) == today
        usage = db.scalar(select(AIUsageDaily))
        assert usage.requests == expected_limit
        with pytest.raises(HTTPException) as error:
            reserve_ai_request(db, user)

    assert error.value.status_code == 429
    assert error.value.detail == {
        "code": "ai.daily_limit_reached",
        "daily_limit": expected_limit,
        "upgrade_hint": upgrade_hint,
    }
    assert daily_request_limit(plan) == expected_limit


def test_ai_usage_records_reported_tokens_and_estimated_cost(usage_database) -> None:
    session_factory, user = usage_database
    with session_factory() as db:
        usage_date = reserve_ai_request(db, user)
        record_ai_token_usage(
            db,
            user.id,
            usage_date,
            "gpt-4o-mini",
            1_000,
            500,
        )
        usage = db.scalar(select(AIUsageDaily))

    assert usage.requests == 1
    assert usage.completed_requests == 1
    assert usage.input_tokens == 1_000
    assert usage.output_tokens == 500
    assert usage.token_usage_complete is True
    assert usage.estimated_cost_usd == Decimal("0.000450000000")
    assert usage.cost_pricing_complete is True
    assert usage.cost_pricing_verified is False


def test_unknown_model_price_is_not_reported_as_a_complete_cost(
    usage_database,
) -> None:
    session_factory, user = usage_database
    with session_factory() as db:
        usage_date = reserve_ai_request(db, user)
        record_ai_token_usage(
            db,
            user.id,
            usage_date,
            "unknown-model",
            100,
            20,
        )
        usage = db.scalar(select(AIUsageDaily))

    assert usage.input_tokens == 100
    assert usage.output_tokens == 20
    assert usage.cost_pricing_complete is False


def test_unavailable_provider_usage_is_marked_incomplete(usage_database) -> None:
    session_factory, user = usage_database
    with session_factory() as db:
        usage_date = reserve_ai_request(db, user)
        record_ai_token_usage(db, user.id, usage_date, "gpt-4o-mini", None, None)
        usage = db.scalar(select(AIUsageDaily))

    assert usage.requests == 1
    assert usage.completed_requests == 1
    assert usage.unknown_token_usage_requests == 1
    assert usage.token_usage_complete is False
    assert usage.cost_pricing_complete is False


def test_admin_can_view_usage_and_estimate_for_each_user(
    usage_database,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    session_factory, user = usage_database
    user.role = "admin"
    with session_factory() as db:
        usage_date = reserve_ai_request(db, user)
        record_ai_token_usage(db, user.id, usage_date, "gpt-4o-mini", 100, 50)

    response = TestClient(app).get("/admin/ai-usage")

    assert response.status_code == 200
    item = response.json()[0]
    assert item["email"] == user.email
    assert item["plan"] == "free"
    assert item["daily_limit"] == 10
    assert item["requests"] == 1
    assert item["estimated_cost_usd"] == "0.000045000000"
    assert item["cost_is_estimate"] is True


def test_ai_usage_admin_view_is_forbidden_to_non_admins(usage_database) -> None:
    response = TestClient(app).get("/admin/ai-usage")

    assert response.status_code == 403
    assert response.json()["detail"] == "admin.required"
