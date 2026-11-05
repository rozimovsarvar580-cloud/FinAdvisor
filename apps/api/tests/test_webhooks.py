import json

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from finadvisor_api import billing
from finadvisor_api.auth import get_current_user
from finadvisor_api.database import Base, get_db
from finadvisor_api.main import app
from finadvisor_api.models import Invoice, Payment, PaymentEvent, Subscription, User
from finadvisor_api.payment_provider import FakePaymentProvider

client = TestClient(app)


@pytest.fixture
def webhook_context(monkeypatch: pytest.MonkeyPatch):
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
        id="webhook-user",
        email="webhook@example.com",
        name="Webhook User",
        role="tadbirkor",
    )
    with session_factory() as session:
        session.add(user)
        session.commit()

    def override_get_db():
        with session_factory() as session:
            yield session

    provider = FakePaymentProvider("webhook-test-secret")
    monkeypatch.setitem(app.dependency_overrides, get_current_user, lambda: user)
    monkeypatch.setitem(app.dependency_overrides, get_db, override_get_db)
    monkeypatch.setattr(billing, "get_payment_provider", lambda: provider)
    yield session_factory, user, provider
    Base.metadata.drop_all(bind=engine)
    engine.dispose()


def seed_open_invoice(session_factory) -> tuple[Invoice, Subscription]:
    subscription = Subscription(
        id="webhook-subscription",
        user_id="webhook-user",
        plan="pro",
        status="incomplete",
        billing_period="weekly",
        amount_minor=1000,
        currency="USD",
        provider="fake",
    )
    invoice = Invoice(
        id="webhook-invoice",
        user_id="webhook-user",
        subscription_id=subscription.id,
        invoice_number="INV-WEBHOOK",
        amount_minor=1000,
        currency="USD",
        status="open",
        provider_checkout_id="checkout-webhook",
    )
    with session_factory() as session:
        session.add_all((subscription, invoice))
        session.commit()
    return invoice, subscription


def signed_event(provider: FakePaymentProvider, event_id: str, event_type: str) -> bytes:
    return json.dumps(
        {
            "id": event_id,
            "type": event_type,
            "data": {
                "invoice": "webhook-invoice",
                "payment": "provider-payment",
                "subscription": "provider-subscription",
                "customer": "provider-customer",
                "amount_minor": 1000,
                "currency": "USD",
            },
        },
        separators=(",", ":"),
    ).encode()


def post_event(provider: FakePaymentProvider, payload: bytes, signature: str | None = None):
    return client.post(
        "/billing/webhook",
        content=payload,
        headers={
            "x-webhook-signature": signature or provider.sign_webhook(payload),
        },
    )


def test_webhook_rejects_forged_signature_without_recording_event(webhook_context) -> None:
    session_factory, _user, provider = webhook_context
    seed_open_invoice(session_factory)
    payload = signed_event(provider, "forged-event", "payment.succeeded")

    missing_signature = client.post("/billing/webhook", content=payload)
    assert missing_signature.status_code == 401

    response = post_event(provider, payload, "sha256=invalid")

    assert response.status_code == 401
    with session_factory() as session:
        assert session.query(PaymentEvent).count() == 0
        assert session.query(Payment).count() == 0


def test_webhook_stores_signed_events_without_billing_side_effects(webhook_context) -> None:
    session_factory, _user, provider = webhook_context
    payload = signed_event(provider, "unknown-event", "subscription.updated")

    response = post_event(provider, payload)

    assert response.status_code == 200
    assert response.json() == {"received": True, "duplicate": False}
    with session_factory() as session:
        event_record = session.query(PaymentEvent).one()
        assert event_record.event_type == "subscription.updated"
        assert event_record.raw_payload == json.loads(payload)
        assert event_record.signature_valid is True
        assert event_record.status == "ignored"
        assert event_record.processed_at is not None
        assert session.query(Payment).count() == 0


def test_webhook_records_event_and_activates_subscription_once(webhook_context) -> None:
    session_factory, _user, provider = webhook_context
    seed_open_invoice(session_factory)
    payload = signed_event(provider, "success-event", "payment.succeeded")

    response = post_event(provider, payload)

    assert response.status_code == 200, response.text
    assert response.json() == {"received": True, "duplicate": False}
    with session_factory() as session:
        event_record = session.query(PaymentEvent).one()
        payment = session.query(Payment).one()
        invoice = session.query(Invoice).one()
        subscription = session.query(Subscription).one()
        user = session.query(User).filter_by(id="webhook-user").one()

        assert event_record.provider_event_id == "success-event"
        assert event_record.signature_valid is True
        assert event_record.raw_payload == json.loads(payload)
        assert event_record.status == "processed"
        assert event_record.attempts == 1
        assert payment.status == "succeeded"
        assert payment.paid_at is not None
        assert invoice.status == "paid"
        assert invoice.paid_at is not None
        assert subscription.status == "active"
        assert subscription.provider_subscription_id == "provider-subscription"
        assert subscription.provider_customer_id == "provider-customer"
        assert subscription.current_period_start is not None
        assert subscription.current_period_end is not None
        assert (
            subscription.current_period_end - subscription.current_period_start
        ).days == 7
        assert user.subscription_plan == "pro"

        original_paid_at = invoice.paid_at
        original_period_end = subscription.current_period_end

    replay = post_event(provider, payload)

    assert replay.status_code == 200
    assert replay.json() == {"received": True, "duplicate": True}
    with session_factory() as session:
        assert session.query(PaymentEvent).count() == 1
        assert session.query(Payment).count() == 1
        assert session.query(Invoice).one().paid_at == original_paid_at
        assert session.query(Subscription).one().current_period_end == original_period_end


def test_webhook_payment_state_is_tolerant_of_out_of_order_events(webhook_context) -> None:
    session_factory, _user, provider = webhook_context
    seed_open_invoice(session_factory)
    failed = signed_event(provider, "failed-event", "payment.failed")
    succeeded = signed_event(provider, "succeeded-event", "payment.succeeded")
    late_failed = signed_event(provider, "late-failed-event", "payment.failed")

    assert post_event(provider, failed).status_code == 200
    with session_factory() as session:
        assert session.query(Payment).one().status == "failed"
        assert session.query(Subscription).one().status == "incomplete"

    assert post_event(provider, succeeded).status_code == 200
    with session_factory() as session:
        payment = session.query(Payment).one()
        assert payment.status == "succeeded"
        assert payment.paid_at is not None
        assert session.query(Subscription).one().status == "active"
        original_paid_at = payment.paid_at

    assert post_event(provider, late_failed).status_code == 200
    with session_factory() as session:
        assert session.query(Payment).one().status == "succeeded"
        assert session.query(Payment).one().paid_at == original_paid_at
        assert session.query(Invoice).one().status == "paid"
        assert session.query(Subscription).one().status == "active"
        assert session.query(PaymentEvent).count() == 3


def test_webhook_persists_unmatched_event_and_retries_when_invoice_arrives(
    webhook_context,
) -> None:
    session_factory, _user, provider = webhook_context
    payload = signed_event(provider, "early-event", "payment.succeeded")

    early = post_event(provider, payload)

    assert early.status_code == 200
    with session_factory() as session:
        event_record = session.query(PaymentEvent).one()
        assert event_record.status == "unmatched"
        assert event_record.attempts == 1
        assert session.query(Payment).count() == 0

    seed_open_invoice(session_factory)
    retried = post_event(provider, payload)

    assert retried.status_code == 200
    assert retried.json() == {"received": True, "duplicate": False}
    with session_factory() as session:
        event_record = session.query(PaymentEvent).one()
        assert event_record.status == "processed"
        assert event_record.attempts == 2
        assert session.query(Payment).one().status == "succeeded"
        assert session.query(Subscription).one().status == "active"


def test_webhook_rejects_amount_mismatch_and_keeps_failed_event_log(webhook_context) -> None:
    session_factory, _user, provider = webhook_context
    seed_open_invoice(session_factory)
    event_data = json.loads(signed_event(provider, "mismatch-event", "payment.succeeded"))
    event_data["data"]["amount_minor"] = 999
    payload = json.dumps(event_data, separators=(",", ":")).encode()

    response = post_event(provider, payload)

    assert response.status_code == 400
    with session_factory() as session:
        event_record = session.query(PaymentEvent).one()
        assert event_record.status == "failed"
        assert event_record.signature_valid is True
        assert event_record.last_error == "billing.webhook_amount_mismatch"
        assert session.query(Payment).count() == 0
        assert session.query(Invoice).one().status == "open"
        assert session.query(Subscription).one().status == "incomplete"
