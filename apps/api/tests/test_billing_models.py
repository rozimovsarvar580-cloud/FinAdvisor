from datetime import UTC, datetime

import pytest
from sqlalchemy import create_engine, event
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from finadvisor_api.database import Base
from finadvisor_api.models import (
    CommissionLedger,
    Invoice,
    Payment,
    PaymentEvent,
    Refund,
    Subscription,
    User,
)


@pytest.fixture
def billing_session():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    event.listen(
        engine,
        "connect",
        lambda connection, _: connection.execute("PRAGMA foreign_keys=ON"),
    )
    Base.metadata.create_all(bind=engine)
    session_factory = sessionmaker(bind=engine, expire_on_commit=False)
    with session_factory() as session:
        session.add(
            User(
                id="billing-user",
                email="billing-user@example.com",
                name="Billing User",
            )
        )
        session.commit()
    yield session_factory
    Base.metadata.drop_all(bind=engine)
    engine.dispose()


def test_billing_records_use_minor_units_and_keep_event_identity(billing_session) -> None:
    now = datetime.now(UTC)
    with billing_session() as session:
        subscription = Subscription(
            id="subscription-1",
            user_id="billing-user",
            plan="pro",
            status="active",
            billing_period="weekly",
            amount_minor=1000,
            currency="USD",
        )
        session.add(subscription)
        session.flush()

        invoice = Invoice(
            id="invoice-1",
            user_id="billing-user",
            subscription_id=subscription.id,
            invoice_number="INV-1",
            amount_minor=1000,
            currency="USD",
            status="paid",
            paid_at=now,
        )
        session.add(invoice)
        session.flush()

        payment = Payment(
            id="payment-1",
            invoice_id=invoice.id,
            user_id="billing-user",
            provider="fake",
            provider_payment_id="provider-payment-1",
            amount_minor=1000,
            currency="USD",
            status="succeeded",
            paid_at=now,
        )
        session.add(payment)
        session.add(
            PaymentEvent(
                id="event-1",
                provider="fake",
                provider_event_id="provider-event-1",
                event_type="payment.succeeded",
                raw_payload={"id": "provider-event-1"},
                signature_valid=True,
                status="processed",
                attempts=1,
                processed_at=now,
            )
        )
        session.add(
            Refund(
                id="refund-1",
                payment_id=payment.id,
                amount_minor=500,
                currency="USD",
                status="succeeded",
                provider_refund_id="provider-refund-1",
                processed_at=now,
            )
        )
        session.add(
            CommissionLedger(
                id="commission-1",
                user_id="billing-user",
                source_entry_id="revenue-entry-1",
                revenue_year=2026,
                revenue_minor=100_000_000,
                commission_minor=4_000_000,
                currency="UZS",
            )
        )
        session.commit()

        assert subscription.amount_minor == 1000
        assert invoice.currency == payment.currency == "USD"
        assert payment.amount_minor == 1000
        assert session.get(PaymentEvent, "event-1").raw_payload == {
            "id": "provider-event-1"
        }
        assert session.get(Refund, "refund-1").amount_minor == 500
        assert session.get(CommissionLedger, "commission-1").currency == "UZS"


def test_billing_constraints_reject_negative_money_and_duplicate_webhook(
    billing_session,
) -> None:
    with billing_session() as session:
        session.add(
            Subscription(
                id="negative-subscription",
                user_id="billing-user",
                plan="pro",
                status="active",
                billing_period="weekly",
                amount_minor=-1,
                currency="USD",
            )
        )
        with pytest.raises(IntegrityError):
            session.commit()
        session.rollback()

        event = PaymentEvent(
            id="event-1",
            provider="fake",
            provider_event_id="same-event",
            event_type="payment.succeeded",
            raw_payload={"id": "same-event"},
            signature_valid=True,
        )
        session.add(event)
        session.commit()
        session.add(
            PaymentEvent(
                id="event-2",
                provider="fake",
                provider_event_id="same-event",
                event_type="payment.succeeded",
                raw_payload={"id": "same-event"},
                signature_valid=True,
            )
        )
        with pytest.raises(IntegrityError):
            session.commit()


def test_payment_cannot_be_associated_with_another_users_invoice(billing_session) -> None:
    with billing_session() as session:
        session.add(
            User(
                id="other-billing-user",
                email="other-billing-user@example.com",
                name="Other Billing User",
            )
        )
        session.add(
            Invoice(
                id="owner-invoice",
                user_id="billing-user",
                invoice_number="INV-OWNER",
                amount_minor=1000,
                currency="USD",
            )
        )
        session.commit()
        session.add(
            Payment(
                id="misattributed-payment",
                invoice_id="owner-invoice",
                user_id="other-billing-user",
                provider="fake",
                amount_minor=1000,
                currency="USD",
            )
        )

        with pytest.raises(IntegrityError):
            session.commit()
