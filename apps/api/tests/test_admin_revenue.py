from datetime import UTC, datetime, timedelta
from decimal import Decimal

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from finadvisor_api.auth import get_current_user
from finadvisor_api.database import Base, get_db
from finadvisor_api.main import app
from finadvisor_api.models import (
    AIUsageDaily,
    CommissionLedger,
    Invoice,
    Payment,
    Subscription,
    User,
)


@pytest.fixture
def admin_revenue_context(monkeypatch: pytest.MonkeyPatch):
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
    admin = User(
        id="revenue-admin",
        email="admin@example.com",
        name="Revenue Admin",
        role="admin",
    )
    weekly_owner = User(
        id="weekly-owner",
        email="weekly@example.com",
        name="Weekly Owner",
        role="tadbirkor",
        subscription_plan="pro",
    )
    monthly_owner = User(
        id="monthly-owner",
        email="monthly@example.com",
        name="Monthly Owner",
        role="tadbirkor",
        subscription_plan="business",
    )
    canceled_owner = User(
        id="canceled-owner",
        email="canceled@example.com",
        name="Canceled Owner",
        role="tadbirkor",
        subscription_plan="free",
    )
    now = datetime.now(UTC)
    current_period_start = now - timedelta(days=1)
    current_period_end = now + timedelta(days=6)
    weekly_subscription = Subscription(
        id="weekly-subscription",
        user_id=weekly_owner.id,
        plan="pro",
        status="active",
        billing_period="weekly",
        amount_minor=1000,
        currency="USD",
        current_period_start=current_period_start,
        current_period_end=current_period_end,
    )
    monthly_subscription = Subscription(
        id="monthly-subscription",
        user_id=monthly_owner.id,
        plan="business",
        status="active",
        billing_period="monthly",
        amount_minor=2000,
        currency="USD",
        current_period_start=current_period_start,
        current_period_end=current_period_end,
    )
    canceled_subscription = Subscription(
        id="canceled-subscription",
        user_id=canceled_owner.id,
        plan="pro",
        status="canceled",
        billing_period="weekly",
        amount_minor=1000,
        currency="USD",
        updated_at=now,
    )
    paid_invoice = Invoice(
        id="paid-invoice",
        user_id=weekly_owner.id,
        subscription_id=weekly_subscription.id,
        invoice_number="INV-PAID",
        amount_minor=1000,
        currency="USD",
        status="paid",
        paid_at=now,
    )
    failed_invoice = Invoice(
        id="failed-invoice",
        user_id=monthly_owner.id,
        subscription_id=monthly_subscription.id,
        invoice_number="INV-FAILED",
        amount_minor=2000,
        currency="USD",
        status="open",
    )
    paid_payment = Payment(
        id="paid-payment",
        invoice_id=paid_invoice.id,
        user_id=weekly_owner.id,
        provider="fake",
        amount_minor=1000,
        currency="USD",
        status="succeeded",
        paid_at=now,
        created_at=now,
    )
    failed_payment = Payment(
        id="failed-payment",
        invoice_id=failed_invoice.id,
        user_id=monthly_owner.id,
        provider="fake",
        amount_minor=2000,
        currency="USD",
        status="failed",
        failed_at=now,
        created_at=now,
    )
    usage = AIUsageDaily(
        user_id=weekly_owner.id,
        usage_date=now.date(),
        requests=2,
        completed_requests=2,
        input_tokens=100,
        output_tokens=50,
        token_usage_complete=True,
        estimated_cost_usd=Decimal("0.03"),
        cost_pricing_complete=True,
        cost_pricing_verified=True,
    )
    commission = CommissionLedger(
        id="accrued-commission",
        user_id=weekly_owner.id,
        source_entry_id="revenue-entry-1",
        revenue_year=now.year,
        revenue_minor=100000,
        commission_minor=2500,
        revenue_date=now.date(),
        currency="UZS",
        status="accrued",
    )
    with session_factory() as session:
        session.add_all(
            (
                admin,
                weekly_owner,
                monthly_owner,
                canceled_owner,
                weekly_subscription,
                monthly_subscription,
                canceled_subscription,
                paid_invoice,
                failed_invoice,
                paid_payment,
                failed_payment,
                usage,
                commission,
            )
        )
        session.commit()

    def override_get_db():
        with session_factory() as session:
            yield session

    current_user = {"user": admin}
    monkeypatch.setitem(app.dependency_overrides, get_current_user, lambda: current_user["user"])
    monkeypatch.setitem(app.dependency_overrides, get_db, override_get_db)
    yield current_user
    app.dependency_overrides.pop(get_current_user, None)
    app.dependency_overrides.pop(get_db, None)
    Base.metadata.drop_all(bind=engine)
    engine.dispose()


def test_admin_revenue_dashboard_aggregates_billing_commission_and_ai_cost(
    admin_revenue_context,
) -> None:
    response = TestClient(app).get("/admin/revenue")

    assert response.status_code == 200
    body = response.json()
    assert body["mrr"] == [
        {"currency": "USD", "amount_minor": 6333, "amount_decimal": "63.33"}
    ]
    assert body["weekly_revenue"] == [
        {"currency": "USD", "amount_minor": 1000, "amount_decimal": "10.00"}
    ]
    assert body["active_subscribers_by_plan"] == {"business": 1, "pro": 1}
    assert body["current_active_subscribers"] == 2
    assert body["churned_subscribers"] == 1
    assert body["churn_rate_percent"] == "33.33"
    assert body["failed_payment_count"] == 1
    assert body["accrued_commission"] == [
        {"currency": "UZS", "amount_minor": 2500, "amount_decimal": "25.00"}
    ]
    assert body["ai_financials_by_user"] == [
        {
            "user_id": "weekly-owner",
            "email": "weekly@example.com",
            "plan": "pro",
            "subscription_revenue_minor_usd": 1000,
            "subscription_revenue_usd": "10.00",
            "estimated_ai_cost_usd": "0.03",
            "token_usage_complete": True,
            "cost_pricing_complete": True,
        }
    ]


def test_admin_revenue_csv_is_exported_and_non_admin_is_forbidden(
    admin_revenue_context,
) -> None:
    client = TestClient(app)
    export = client.get("/admin/revenue/export")
    assert export.status_code == 200
    assert export.headers["content-type"].startswith("text/csv")
    assert 'filename="revenue_dashboard_' in export.headers["content-disposition"]
    assert "weekly_revenue" in export.text
    assert "weekly@example.com" in export.text

    admin_revenue_context["user"] = User(
        id="not-admin",
        email="owner@example.com",
        name="Owner",
        role="tadbirkor",
    )
    forbidden = client.get("/admin/revenue")
    assert forbidden.status_code == 403


def test_admin_user_search_update_and_subscriptions_are_admin_only(admin_revenue_context) -> None:
    client = TestClient(app)
    users = client.get("/admin/users", params={"q": "weekly@example.com"})
    assert users.status_code == 200
    assert [row["email"] for row in users.json()["items"]] == ["weekly@example.com"]
    user_id = users.json()["items"][0]["id"]
    updated = client.patch(f"/admin/users/{user_id}", json={"role": "buxgalter", "is_suspended": True})
    assert updated.status_code == 200
    assert updated.json()["role"] == "buxgalter"
    assert updated.json()["is_suspended"] is True
    assert client.get("/admin/subscriptions").status_code == 200
    admin_revenue_context["user"] = User(id="non-admin", email="user@example.com", name="User", role="tadbirkor")
    assert client.get("/admin/users").status_code == 403
