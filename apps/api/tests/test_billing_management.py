import json
from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from finadvisor_api import billing
from finadvisor_api.auth import get_current_user
from finadvisor_api.config import load_settings
from finadvisor_api.database import Base, get_db
from finadvisor_api.main import app
from finadvisor_api.models import Invoice, Subscription, User
from finadvisor_api.payment_provider import FakePaymentProvider

client = TestClient(app)


@pytest.fixture
def billing_context(monkeypatch: pytest.MonkeyPatch):
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
        id="billing-owner",
        email="owner@example.com",
        name="Billing Owner",
        role="tadbirkor",
        subscription_plan="pro",
    )
    with session_factory() as session:
        session.add(user)
        session.commit()

    def override_get_db():
        with session_factory() as session:
            yield session

    provider = FakePaymentProvider("billing-management-secret")
    monkeypatch.setitem(app.dependency_overrides, get_current_user, lambda: user)
    monkeypatch.setitem(app.dependency_overrides, get_db, override_get_db)
    monkeypatch.setattr(billing, "get_payment_provider", lambda: provider)
    monkeypatch.setattr(
        billing,
        "get_settings",
        lambda: load_settings(
            {
                "APP_ENV": "development",
                "NEXTAUTH_URL": "https://web.finadvisor.test",
            }
        ),
    )
    yield session_factory, user, provider
    Base.metadata.drop_all(bind=engine)
    engine.dispose()


def seed_active_subscription(session_factory, user_id: str = "billing-owner"):
    now = datetime.now(UTC)
    subscription = Subscription(
        id=f"subscription-{user_id}",
        user_id=user_id,
        plan="pro",
        status="active",
        billing_period="weekly",
        amount_minor=1000,
        currency="USD",
        provider="fake",
        provider_customer_id=f"customer-{user_id}",
        provider_subscription_id=f"provider-subscription-{user_id}",
        current_period_start=now,
        current_period_end=now + timedelta(days=7),
    )
    invoice = Invoice(
        id=f"invoice-{user_id}",
        user_id=user_id,
        subscription_id=subscription.id,
        invoice_number=f"INV-{user_id}",
        amount_minor=1000,
        currency="USD",
        status="paid",
        paid_at=now,
    )
    with session_factory() as session:
        session.add_all((subscription, invoice))
        session.commit()
    return subscription


def test_billing_summary_returns_owner_subscription_and_invoice_history(
    billing_context,
) -> None:
    session_factory, _user, _provider = billing_context
    seed_active_subscription(session_factory)
    other_user = User(
        id="other-owner",
        email="other@example.com",
        name="Other Owner",
        role="tadbirkor",
    )
    with session_factory() as session:
        session.add(other_user)
        session.flush()
        session.add(
            Invoice(
                id="other-invoice",
                user_id=other_user.id,
                invoice_number="INV-OTHER",
                amount_minor=9999,
                currency="USD",
                status="paid",
            )
        )
        session.commit()

    response = client.get("/billing/summary")

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["current_plan"] == "pro"
    assert body["status"] == "active"
    assert body["price"] == "10.00"
    assert body["currency"] == "USD"
    assert body["next_charge_at"] is not None
    assert body["access_until"] is None
    assert body["payment_method_available"] is True
    assert [invoice["invoice_number"] for invoice in body["invoices"]] == [
        "INV-billing-owner"
    ]
    assert body["invoices"][0]["amount"] == "10.00"


def test_active_subscription_uses_plan_change_instead_of_new_checkout(
    billing_context,
) -> None:
    _session_factory, _user, _provider = billing_context
    seed_active_subscription(_session_factory)

    response = client.post(
        "/billing/checkout",
        json={"plan": "business", "billing_period": "weekly", "locale": "en"},
    )

    assert response.status_code == 409
    assert response.json()["detail"] == "billing.subscription_already_active"


def test_billing_cancel_keeps_access_until_period_end_and_is_idempotent(
    billing_context,
) -> None:
    session_factory, _user, provider = billing_context
    seed_active_subscription(session_factory)
    scheduled = client.post("/billing/plan-change", json={"plan": "business"})
    assert scheduled.status_code == 200

    response = client.post("/billing/cancel")

    assert response.status_code == 200, response.text
    assert response.json()["cancel_at_period_end"] is True
    assert response.json()["access_until"] is not None
    assert provider.cancellations == [
        ("provider-subscription-billing-owner", True)
    ]
    with session_factory() as session:
        subscription = session.query(Subscription).one()
        assert subscription.status == "active"
        assert subscription.cancel_at_period_end is True
        assert subscription.pending_plan is None
        assert subscription.pending_amount_minor is None
    assert provider.scheduled_plan_changes == []

    repeated = client.post("/billing/cancel")

    assert repeated.status_code == 200
    assert provider.cancellations == [
        ("provider-subscription-billing-owner", True)
    ]
    summary = client.get("/billing/summary").json()
    assert summary["next_charge_at"] is None
    assert summary["access_until"] is not None


def test_plan_change_is_scheduled_at_next_renewal_without_changing_current_plan(
    billing_context,
) -> None:
    session_factory, _user, provider = billing_context
    initial = seed_active_subscription(session_factory)

    response = client.post("/billing/plan-change", json={"plan": "business"})

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["pending_plan"] == "business"
    assert body["effective_at"] is not None
    assert provider.scheduled_plan_changes == [
        (
            "provider-subscription-billing-owner",
            "business",
            2000,
            initial.current_period_end,
        )
    ]
    with session_factory() as session:
        subscription = session.query(Subscription).one()
        assert subscription.plan == "pro"
        assert subscription.amount_minor == 1000
        assert subscription.pending_plan == "business"
        assert subscription.pending_amount_minor == 2000

    repeated = client.post("/billing/plan-change", json={"plan": "business"})
    assert repeated.status_code == 200
    assert len(provider.scheduled_plan_changes) == 1


def test_plan_change_applies_only_after_verified_provider_event(billing_context) -> None:
    session_factory, _user, provider = billing_context
    seed_active_subscription(session_factory)
    scheduled = client.post("/billing/plan-change", json={"plan": "business"})
    assert scheduled.status_code == 200
    raw = json.dumps(
        {
            "id": "plan-change-applied",
            "type": "subscription.plan_change_applied",
            "data": {
                "subscription": "provider-subscription-billing-owner",
                "plan": "business",
                "amount_minor": 2000,
            },
        },
        separators=(",", ":"),
    ).encode()

    response = client.post(
        "/billing/webhook",
        content=raw,
        headers={"x-webhook-signature": provider.sign_webhook(raw)},
    )

    assert response.status_code == 200, response.text
    with session_factory() as session:
        subscription = session.query(Subscription).one()
        user = session.query(User).filter_by(id="billing-owner").one()
        assert subscription.plan == "business"
        assert subscription.amount_minor == 2000
        assert subscription.pending_plan is None
        assert subscription.pending_amount_minor is None
        assert user.subscription_plan == "business"


def test_payment_method_update_uses_provider_hosted_session(billing_context) -> None:
    session_factory, _user, _provider = billing_context
    seed_active_subscription(session_factory)

    response = client.post(
        "/billing/payment-method",
        json={"locale": "uz"},
    )

    assert response.status_code == 200, response.text
    assert response.json()["update_url"].startswith(
        "https://web.finadvisor.test/uz/app/billing?payment_method=updated&"
    )
    assert "payment_method_session=fake_payment_method_" in response.json()[
        "update_url"
    ]


def test_billing_management_endpoints_require_business_owner(billing_context) -> None:
    _session_factory, user, _provider = billing_context
    user.role = "investor"

    summary = client.get("/billing/summary")
    cancel = client.post("/billing/cancel")
    plan_change = client.post("/billing/plan-change", json={"plan": "business"})
    payment_method = client.post(
        "/billing/payment-method",
        json={"locale": "en"},
    )

    assert [
        summary.status_code,
        cancel.status_code,
        plan_change.status_code,
        payment_method.status_code,
    ] == [403, 403, 403, 403]
