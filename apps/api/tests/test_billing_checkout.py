import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine, select
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from finadvisor_api import billing
from finadvisor_api.auth import get_current_user
from finadvisor_api.config import load_settings
from finadvisor_api.database import Base, get_db
from finadvisor_api.main import app
from finadvisor_api.models import Invoice, Subscription, User
from finadvisor_api.payment_provider import (
    CheckoutRequest,
    CheckoutSession,
    FakePaymentProvider,
    PaymentProviderError,
)

client = TestClient(app)


@pytest.fixture
def checkout_context(monkeypatch: pytest.MonkeyPatch):
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
        id="checkout-user",
        email="checkout@example.com",
        name="Checkout User",
        role="tadbirkor",
    )
    with session_factory() as session:
        session.add(user)
        session.commit()

    def override_get_db():
        with session_factory() as session:
            yield session

    provider = FakePaymentProvider("checkout-test-webhook-secret")
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


@pytest.mark.parametrize(
    ("plan", "expected_amount_minor"),
    [("pro", 1000), ("business", 2000)],
)
def test_checkout_uses_server_catalog_price_and_keeps_subscription_incomplete(
    checkout_context,
    plan: str,
    expected_amount_minor: int,
) -> None:
    session_factory, user, _provider = checkout_context

    response = client.post(
        "/billing/checkout",
        json={"plan": plan, "billing_period": "weekly", "locale": "en"},
    )

    assert response.status_code == 200, response.text
    body = response.json()
    assert body["amount_minor"] == expected_amount_minor
    assert body["currency"] == "USD"
    assert body["checkout_url"].startswith(
        "https://web.finadvisor.test/en/app/billing/checkout/success?"
    )
    with session_factory() as session:
        subscription = session.get(Subscription, body["subscription_id"])
        invoice = session.get(Invoice, body["invoice_id"])
        stored_user = session.get(User, user.id)
        assert subscription is not None
        assert subscription.plan == plan
        assert subscription.status == "incomplete"
        assert subscription.amount_minor == expected_amount_minor
        assert subscription.provider == "fake"
        assert invoice is not None
        assert invoice.subscription_id == subscription.id
        assert invoice.status == "open"
        assert invoice.amount_minor == expected_amount_minor
        assert invoice.provider_checkout_id is not None
        assert stored_user is not None
        assert stored_user.subscription_plan == "free"


@pytest.mark.parametrize("billing_period", ["monthly", "yearly"])
def test_checkout_rejects_unfinalized_price_periods_without_writing_records(
    checkout_context,
    billing_period: str,
) -> None:
    session_factory, _user, _provider = checkout_context

    response = client.post(
        "/billing/checkout",
        json={"plan": "pro", "billing_period": billing_period, "locale": "uz"},
    )

    assert response.status_code == 409
    assert response.json()["detail"] == {
        "code": "billing.placeholder_price",
        "marker": "TODO(DECISION D1)",
    }
    with session_factory() as session:
        assert session.scalars(select(Subscription)).all() == []
        assert session.scalars(select(Invoice)).all() == []


def test_checkout_rejects_non_owner_and_free_plan(checkout_context) -> None:
    _session_factory, user, _provider = checkout_context
    user.role = "investor"

    forbidden = client.post(
        "/billing/checkout",
        json={"plan": "pro", "billing_period": "weekly", "locale": "en"},
    )
    invalid_plan = client.post(
        "/billing/checkout",
        json={"plan": "free", "billing_period": "weekly", "locale": "en"},
    )

    assert forbidden.status_code == 403
    assert forbidden.json()["detail"] == "billing.owner_required"
    assert invalid_plan.status_code == 422


def test_checkout_requires_authentication(
    checkout_context,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.delitem(app.dependency_overrides, get_current_user)

    response = client.post(
        "/billing/checkout",
        json={"plan": "pro", "billing_period": "weekly", "locale": "en"},
    )

    assert response.status_code == 401


def test_webhook_rejects_forged_signature_and_duplicate_events(
    checkout_context,
) -> None:
    session_factory, _user, provider = checkout_context
    invoice = Invoice(
        id="webhook-invoice",
        user_id="checkout-user",
        subscription_id="webhook-subscription",
        invoice_number="INV-WEBHOOK",
        amount_minor=1000,
        currency="USD",
        status="open",
    )
    subscription = Subscription(
        id="webhook-subscription",
        user_id="checkout-user",
        plan="pro",
        status="incomplete",
        billing_period="weekly",
        amount_minor=1000,
        currency="USD",
        provider=provider.name,
    )
    with client as app_client:
        with session_factory() as session:
            session.add_all((invoice, subscription))
            session.commit()

        raw = b'{"id":"evt-1","type":"payment.succeeded","data":{"invoice":"webhook-invoice","payment":"pay-1","subscription":"webhook-subscription","amount_minor":1000,"currency":"USD"}}'
        forged = app_client.post(
            "/billing/webhook",
            headers={"x-webhook-signature": "sha256=invalid"},
            content=raw,
        )
        assert forged.status_code == 401

        valid = app_client.post(
            "/billing/webhook",
            headers={"x-webhook-signature": provider.sign_webhook(raw)},
            content=raw,
        )
        assert valid.status_code == 200, valid.text
        assert valid.json() == {"received": True, "duplicate": False}

        replay = app_client.post(
            "/billing/webhook",
            headers={"x-webhook-signature": provider.sign_webhook(raw)},
            content=raw,
        )
        assert replay.status_code == 200, replay.text
        assert replay.json() == {"received": True, "duplicate": True}

    with session_factory() as session:
        stored = session.query(Subscription).filter_by(id="webhook-subscription").one()
        assert stored.status == "active"
        invoice_record = session.query(Invoice).filter_by(id="webhook-invoice").one()
        assert invoice_record.status == "paid"
        assert invoice_record.paid_at is not None


def test_checkout_returns_unavailable_when_provider_is_disabled(
    checkout_context,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    session_factory, _user, _provider = checkout_context

    def raise_unavailable():
        raise billing.PaymentProviderUnavailable("disabled")

    monkeypatch.setattr(billing, "get_payment_provider", raise_unavailable)

    response = client.post(
        "/billing/checkout",
        json={"plan": "pro", "billing_period": "weekly", "locale": "en"},
    )

    assert response.status_code == 503
    assert response.json()["detail"] == "billing.payment_unavailable"
    with session_factory() as session:
        assert session.scalars(select(Subscription)).all() == []
        assert session.scalars(select(Invoice)).all() == []


def test_checkout_rolls_back_records_when_provider_rejects_checkout(
    checkout_context,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    session_factory, _user, _provider = checkout_context

    class FailingPaymentProvider(FakePaymentProvider):
        def create_checkout(self, request: CheckoutRequest) -> CheckoutSession:
            raise PaymentProviderError("provider unavailable")

    monkeypatch.setattr(
        billing,
        "get_payment_provider",
        lambda: FailingPaymentProvider("checkout-test-webhook-secret"),
    )

    response = client.post(
        "/billing/checkout",
        json={"plan": "pro", "billing_period": "weekly", "locale": "en"},
    )

    assert response.status_code == 503
    assert response.json()["detail"] == "billing.payment_provider_error"
    with session_factory() as session:
        assert session.scalars(select(Subscription)).all() == []
        assert session.scalars(select(Invoice)).all() == []
