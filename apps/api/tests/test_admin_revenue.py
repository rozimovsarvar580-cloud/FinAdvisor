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

client = TestClient(app)


@pytest.fixture
def admin_revenue_context(monkeypatch):
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    session_factory = sessionmaker(bind=engine, expire_on_commit=False)

    def override_get_db():
        with session_factory() as session:
            yield session

    admin = User(
        id="revenue-admin",
        email="admin@example.test",
        name="Admin",
        role="admin",
    )
    monkeypatch.setitem(app.dependency_overrides, get_db, override_get_db)
    monkeypatch.setitem(app.dependency_overrides, get_current_user, lambda: admin)
    yield session_factory, admin
    app.dependency_overrides.pop(get_db, None)
    app.dependency_overrides.pop(get_current_user, None)
    Base.metadata.drop_all(bind=engine)
    engine.dispose()


def _insert_paid_invoice(session, *, user_id: str, suffix: str, currency: str) -> str:
    invoice = Invoice(
        id=f"invoice-{suffix}",
        user_id=user_id,
        invoice_number=f"INV-{suffix}",
        amount_minor=2000,
        currency=currency,
        status="paid",
    )
    session.add(invoice)
    session.flush()
    session.add(
        Payment(
            id=f"payment-{suffix}",
            invoice_id=invoice.id,
            user_id=user_id,
            provider="test",
            amount_minor=2000,
            currency=currency,
            status="succeeded",
            paid_at=datetime.now(UTC) - timedelta(days=2),
        )
    )
    return invoice.id


def test_admin_revenue_dashboard_reports_currency_safe_metrics(
    admin_revenue_context,
):
    session_factory, _admin = admin_revenue_context
    now = datetime.now(UTC)
    with session_factory() as session:
        session.add_all(
            [
                User(
                    id="pro-owner",
                    email="pro@example.test",
                    name="Pro",
                    subscription_plan="pro",
                ),
                User(
                    id="business-owner",
                    email="business@example.test",
                    name="Business",
                    subscription_plan="business",
                ),
                User(
                    id="canceled-owner",
                    email="canceled@example.test",
                    name="Canceled",
                ),
                User(
                    id="expired-owner",
                    email="expired@example.test",
                    name="Expired",
                ),
            ]
        )
        session.flush()
        session.add_all(
            [
                Subscription(
                    id="pro-weekly",
                    user_id="pro-owner",
                    plan="pro",
                    status="active",
                    billing_period="weekly",
                    amount_minor=1000,
                    currency="USD",
                    current_period_end=now + timedelta(days=5),
                ),
                Subscription(
                    id="business-monthly",
                    user_id="business-owner",
                    plan="business",
                    status="active",
                    billing_period="monthly",
                    amount_minor=5200,
                    currency="USD",
                    current_period_end=now + timedelta(days=20),
                ),
                Subscription(
                    id="recently-canceled",
                    user_id="canceled-owner",
                    plan="pro",
                    status="canceled",
                    billing_period="weekly",
                    amount_minor=1000,
                    currency="USD",
                    updated_at=now - timedelta(days=3),
                ),
                Subscription(
                    id="expired-active",
                    user_id="expired-owner",
                    plan="business",
                    status="active",
                    billing_period="yearly",
                    amount_minor=52000,
                    currency="USD",
                    current_period_end=now - timedelta(days=1),
                ),
            ]
        )
        _insert_paid_invoice(
            session, user_id="pro-owner", suffix="pro", currency="USD"
        )
        _insert_paid_invoice(
            session, user_id="business-owner", suffix="business", currency="UZS"
        )
        session.add(
            Payment(
                id="failed-payment",
                invoice_id="invoice-pro",
                user_id="pro-owner",
                provider="test",
                amount_minor=2000,
                currency="USD",
                status="failed",
                failed_at=now - timedelta(days=1),
            )
        )
        session.add_all(
            [
                AIUsageDaily(
                    user_id="pro-owner",
                    usage_date=now.date(),
                    requests=2,
                    completed_requests=2,
                    input_tokens=100,
                    output_tokens=80,
                    token_usage_complete=True,
                    estimated_cost_usd=Decimal("0.12"),
                    cost_pricing_complete=True,
                    cost_pricing_verified=True,
                ),
                AIUsageDaily(
                    user_id="business-owner",
                    usage_date=now.date(),
                    requests=1,
                    completed_requests=1,
                    unknown_token_usage_requests=1,
                    token_usage_complete=False,
                    estimated_cost_usd=Decimal(0),
                    cost_pricing_complete=False,
                    cost_pricing_verified=False,
                ),
                CommissionLedger(
                    id="accrued-commission",
                    user_id="business-owner",
                    source_entry_id="revenue-entry-1",
                    revenue_year=now.year,
                    revenue_minor=10000,
                    commission_minor=400,
                    currency="UZS",
                    status="accrued",
                ),
                CommissionLedger(
                    id="paid-commission",
                    user_id="business-owner",
                    source_entry_id="revenue-entry-2",
                    revenue_year=now.year,
                    revenue_minor=5000,
                    commission_minor=200,
                    currency="UZS",
                    status="paid",
                ),
            ]
        )
        session.commit()

    response = client.get("/admin/revenue")
    assert response.status_code == 200, response.text
    report = response.json()
    assert report["active_subscribers_total"] == 2
    assert report["active_subscribers_by_plan"] == {"pro": 1, "business": 1}
    assert report["cancellations_30d"] == 1
    assert report["cancellation_rate_percent_30d"] == "33.33"
    assert report["failed_payment_attempts_30d"] == 1
    assert report["weekly_recurring_revenue"] == [
        {"currency": "USD", "amount_minor": 2200, "amount": "22.00"}
    ]
    assert report["monthly_recurring_revenue"] == [
        {"currency": "USD", "amount_minor": 9533, "amount": "95.33"}
    ]
    assert report["gross_subscription_payments_7d"] == [
        {"currency": "USD", "amount_minor": 2000, "amount": "20.00"},
        {"currency": "UZS", "amount_minor": 2000, "amount": "20.00"},
    ]
    assert report["accrued_commission"] == [
        {"currency": "UZS", "amount_minor": 400, "amount": "4.00"}
    ]
    assert Decimal(report["ai_cost_usd_30d"]) == Decimal("0.12")
    assert report["ai_cost_complete_30d"] is False
    assert report["ai_cost_is_estimate_30d"] is True
    users_by_id = {user["user_id"]: user for user in report["users"]}
    assert (
        users_by_id["pro-owner"]["subscription_revenue_30d"][0]["currency"]
        == "USD"
    )
    assert (
        users_by_id["business-owner"]["subscription_revenue_30d"][0]["currency"]
        == "UZS"
    )
    assert users_by_id["business-owner"]["ai_cost_complete"] is False


def test_admin_revenue_csv_is_admin_only_and_escapes_spreadsheet_formulas(
    admin_revenue_context,
):
    session_factory, _admin = admin_revenue_context
    with session_factory() as session:
        session.add(
            User(
                id="csv-user",
                email="=HYPERLINK(\"https://example.test\")@example.test",
                name="CSV User",
            )
        )
        session.flush()
        session.add(
            AIUsageDaily(
                user_id="csv-user",
                usage_date=datetime.now(UTC).date(),
                requests=1,
                completed_requests=1,
                input_tokens=100,
                output_tokens=50,
                token_usage_complete=True,
                estimated_cost_usd=Decimal("0.12"),
                cost_pricing_complete=True,
                cost_pricing_verified=True,
            )
        )
        session.commit()

    response = client.get("/admin/revenue/export")
    assert response.status_code == 200, response.text
    assert response.headers["content-type"].startswith("text/csv")
    assert "attachment; filename=admin_revenue.csv" in response.headers[
        "content-disposition"
    ]
    assert "'=HYPERLINK" in response.text
    assert "active_subscribers_total" in response.text
    assert "ai_cost_vs_subscription_revenue_30d" in response.text
    assert "ai_cost_usd" in response.text
    assert "0.12" in response.text


def test_non_admin_cannot_read_or_export_revenue(admin_revenue_context, monkeypatch):
    _session_factory, _admin = admin_revenue_context
    owner = User(
        id="revenue-owner",
        email="owner@example.test",
        name="Owner",
        role="tadbirkor",
    )
    monkeypatch.setitem(app.dependency_overrides, get_current_user, lambda: owner)

    assert client.get("/admin/revenue").status_code == 403
    assert client.get("/admin/revenue/export").status_code == 403
