import json
from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from finadvisor_api import billing
from finadvisor_api.auth import get_current_user
from finadvisor_api.database import Base, get_db
from finadvisor_api.main import app
from finadvisor_api.models import Invoice, Payment, Refund, Subscription, User
from finadvisor_api.payment_provider import FakePaymentProvider

client = TestClient(app)
PAID_AT = datetime.now(UTC) - timedelta(hours=1)


@pytest.fixture
def refund_context(monkeypatch: pytest.MonkeyPatch):
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
    owner = User(
        id="refund-owner",
        email="refund-owner@example.test",
        name="Refund Owner",
        role="tadbirkor",
        subscription_plan="pro",
    )
    admin = User(
        id="refund-admin",
        email="refund-admin@example.test",
        name="Refund Admin",
        role="admin",
    )
    subscription = Subscription(
        id="refund-subscription",
        user_id=owner.id,
        plan="pro",
        status="active",
        billing_period="weekly",
        amount_minor=1000,
        currency="USD",
        provider="fake",
        provider_subscription_id="provider-refund-subscription",
        current_period_start=PAID_AT - timedelta(days=1),
        current_period_end=PAID_AT + timedelta(days=6),
    )
    invoice = Invoice(
        id="refund-invoice",
        user_id=owner.id,
        subscription_id=subscription.id,
        invoice_number="INV-REFUND",
        amount_minor=1000,
        currency="USD",
        status="paid",
        paid_at=PAID_AT,
    )
    payment = Payment(
        id="refund-payment",
        invoice_id=invoice.id,
        user_id=owner.id,
        provider="fake",
        provider_payment_id="provider-refund-payment",
        amount_minor=1000,
        currency="USD",
        status="succeeded",
        paid_at=PAID_AT,
    )
    with session_factory() as session:
        session.add_all((owner, admin, subscription, invoice, payment))
        session.commit()

    current_user = owner
    provider = FakePaymentProvider("refund-test-secret")

    def override_get_current_user():
        return current_user

    def override_get_db():
        with session_factory() as session:
            yield session

    def set_current_user(user: User) -> None:
        nonlocal current_user
        current_user = user

    monkeypatch.setitem(app.dependency_overrides, get_current_user, override_get_current_user)
    monkeypatch.setitem(app.dependency_overrides, get_db, override_get_db)
    monkeypatch.setattr(billing, "get_payment_provider", lambda: provider)
    yield session_factory, owner, admin, provider, set_current_user

    app.dependency_overrides.pop(get_current_user, None)
    app.dependency_overrides.pop(get_db, None)
    Base.metadata.drop_all(bind=engine)
    engine.dispose()


def _request_refund():
    return client.post(
        "/billing/payments/refund-payment/refund-request",
        json={"reason": "Accidental first purchase", "barely_used": True},
    )


def test_owner_can_request_first_purchase_refund_and_duplicates_are_rejected(
    refund_context,
) -> None:
    session_factory, _owner, _admin, _provider, _set_current_user = refund_context

    response = _request_refund()
    duplicate = _request_refund()

    assert response.status_code == 201, response.text
    assert response.json()["amount_minor"] == 1000
    assert response.json()["currency"] == "USD"
    assert response.json()["status"] == "pending"
    assert response.json()["marker"] == "TODO(DECISION D5)"
    assert duplicate.status_code == 409
    assert duplicate.json()["detail"] == "billing.refund_already_requested"
    with session_factory() as session:
        refunds = session.query(Refund).all()
        assert len(refunds) == 1
        assert refunds[0].amount_minor == 1000


def test_refund_request_is_owner_scoped_and_requires_barely_used_attestation(
    refund_context,
) -> None:
    _session_factory, _owner, _admin, _provider, set_current_user = refund_context
    set_current_user(
        User(
            id="another-owner",
            email="another@example.test",
            name="Another Owner",
            role="tadbirkor",
        )
    )
    response = _request_refund()
    invalid_attestation = client.post(
        "/billing/payments/refund-payment/refund-request",
        json={"reason": "Reason", "barely_used": False},
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "billing.payment_not_found"
    assert invalid_attestation.status_code == 422


def test_refund_request_rejects_commission_or_other_non_subscription_payments(
    refund_context,
) -> None:
    session_factory, _owner, _admin, _provider, _set_current_user = refund_context
    with session_factory() as session:
        invoice = Invoice(
            id="commission-invoice",
            user_id="refund-owner",
            invoice_number="INV-COMMISSION",
            amount_minor=500,
            currency="UZS",
            status="paid",
            paid_at=PAID_AT,
        )
        payment = Payment(
            id="commission-payment",
            invoice_id=invoice.id,
            user_id="refund-owner",
            provider="fake",
            provider_payment_id="provider-commission-payment",
            amount_minor=500,
            currency="UZS",
            status="succeeded",
            paid_at=PAID_AT,
        )
        session.add_all((invoice, payment))
        session.commit()

    response = client.post(
        "/billing/payments/commission-payment/refund-request",
        json={"reason": "Commission dispute", "barely_used": True},
    )

    assert response.status_code == 409
    assert response.json()["detail"] == "billing.refund_not_eligible"


def test_refund_request_rejects_non_first_subscription_purchase(refund_context) -> None:
    session_factory, _owner, _admin, _provider, _set_current_user = refund_context
    with session_factory() as session:
        previous_invoice = Invoice(
            id="previous-invoice",
            user_id="refund-owner",
            subscription_id="refund-subscription",
            invoice_number="INV-PREVIOUS",
            amount_minor=1000,
            currency="USD",
            status="paid",
            paid_at=PAID_AT - timedelta(days=30),
        )
        previous_payment = Payment(
            id="previous-payment",
            invoice_id=previous_invoice.id,
            user_id="refund-owner",
            provider="fake",
            provider_payment_id="provider-previous-payment",
            amount_minor=1000,
            currency="USD",
            status="succeeded",
            paid_at=PAID_AT - timedelta(days=30),
        )
        session.add_all((previous_invoice, previous_payment))
        session.commit()

    response = _request_refund()

    assert response.status_code == 409
    assert response.json()["detail"] == "billing.refund_first_purchase_only"


@pytest.mark.parametrize("paid_age", [timedelta(days=8), -timedelta(minutes=1)])
def test_refund_request_rejects_out_of_window_payment(refund_context, paid_age) -> None:
    session_factory, _owner, _admin, _provider, _set_current_user = refund_context
    with session_factory() as session:
        payment = session.get(Payment, "refund-payment")
        invoice = session.get(Invoice, "refund-invoice")
        assert payment is not None and invoice is not None
        payment.paid_at = datetime.now(UTC) - paid_age
        invoice.paid_at = payment.paid_at
        session.commit()

    response = _request_refund()

    assert response.status_code == 409
    assert response.json()["detail"] == "billing.refund_window_expired"


def test_only_admin_can_review_and_denial_is_persisted(refund_context) -> None:
    session_factory, _owner, admin, _provider, set_current_user = refund_context
    request = _request_refund()
    refund_id = request.json()["refund_id"]

    forbidden = client.post(
        f"/billing/admin/refunds/{refund_id}",
        json={"approved": False, "review_note": "Not eligible"},
    )
    set_current_user(admin)
    denied = client.post(
        f"/billing/admin/refunds/{refund_id}",
        json={"approved": False, "review_note": "Usage exceeded policy"},
    )

    assert forbidden.status_code == 403
    assert denied.status_code == 200
    assert denied.json()["status"] == "canceled"
    with session_factory() as session:
        refund = session.get(Refund, refund_id)
        assert refund is not None and refund.status == "canceled"
        assert "Usage exceeded policy" in (refund.reason or "")
        payment = session.get(Payment, "refund-payment")
        subscription = session.get(Subscription, "refund-subscription")
        assert payment is not None and payment.status == "succeeded"
        assert subscription is not None and not subscription.cancel_at_period_end


def test_admin_approval_schedules_cancellation_and_webhook_updates_refund_ledger(
    refund_context,
) -> None:
    session_factory, _owner, admin, provider, set_current_user = refund_context
    request = _request_refund()
    refund_id = request.json()["refund_id"]
    set_current_user(admin)

    approved = client.post(
        f"/billing/admin/refunds/{refund_id}",
        json={"approved": True, "review_note": "Verified first purchase and low usage"},
    )
    refund_id_from_result = approved.json()["refund_id"]
    provider_refund_id = approved.json()["provider_refund_id"]

    assert approved.status_code == 200, approved.text
    assert approved.json()["status"] == "pending"
    assert approved.json()["marker"] == "TODO(DECISION D5)"
    assert provider.cancellations == [("provider-refund-subscription", True)]
    assert len(provider.refunds) == 1
    event_payload = json.dumps(
        {
            "id": "refund-succeeded-1",
            "type": "refund.succeeded",
            "data": {
                "refund": provider_refund_id,
                "amount_minor": 1000,
                "currency": "USD",
            },
        }
    ).encode()
    webhook = client.post(
        "/billing/webhook",
        headers={"x-webhook-signature": provider.sign_webhook(event_payload)},
        content=event_payload,
    )

    assert webhook.status_code == 200, webhook.text
    payment_event = json.dumps(
        {
            "id": "late-payment-succeeded",
            "type": "payment.succeeded",
            "data": {
                "invoice": "refund-invoice",
                "payment": "provider-refund-payment",
                "subscription": "provider-refund-subscription",
                "amount_minor": 1000,
                "currency": "USD",
            },
        }
    ).encode()
    late_payment = client.post(
        "/billing/webhook",
        headers={"x-webhook-signature": provider.sign_webhook(payment_event)},
        content=payment_event,
    )
    assert late_payment.status_code == 200, late_payment.text
    with session_factory() as session:
        refund = session.get(Refund, refund_id_from_result)
        payment = session.get(Payment, "refund-payment")
        invoice = session.get(Invoice, "refund-invoice")
        subscription = session.get(Subscription, "refund-subscription")
        assert refund is not None and refund.status == "succeeded"
        assert payment is not None and payment.status == "refunded"
        assert invoice is not None and invoice.status == "paid"
        assert subscription is not None and subscription.cancel_at_period_end
        assert subscription.pending_plan is None
        assert subscription.pending_amount_minor is None


def test_duplicate_signed_refund_webhook_is_idempotent(refund_context) -> None:
    _session_factory, _owner, admin, provider, set_current_user = refund_context
    request = _request_refund()
    set_current_user(admin)
    approval = client.post(
        f"/billing/admin/refunds/{request.json()['refund_id']}",
        json={"approved": True, "review_note": "Approved after review"},
    )
    payload = json.dumps(
        {
            "id": "refund-succeeded-duplicate",
            "type": "refund.succeeded",
            "data": {
                "refund": approval.json()["provider_refund_id"],
                "amount_minor": 1000,
                "currency": "USD",
            },
        }
    ).encode()
    headers = {"x-webhook-signature": provider.sign_webhook(payload)}

    first = client.post("/billing/webhook", headers=headers, content=payload)
    replay = client.post("/billing/webhook", headers=headers, content=payload)

    assert first.json()["duplicate"] is False
    assert replay.json()["duplicate"] is True
