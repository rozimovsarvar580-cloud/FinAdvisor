import json
from datetime import UTC, datetime, timedelta

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from finadvisor_api import billing
from finadvisor_api.database import Base, get_db
from finadvisor_api.main import app
from finadvisor_api.models import Invoice, Payment, Subscription, User
from finadvisor_api.payment_provider import (
    FakePaymentProvider,
    RenewalChargeRequest,
)
from finadvisor_api.renewals import run_renewals

client = TestClient(app)
NOW = datetime(2026, 1, 1, 12, 0, tzinfo=UTC)


@pytest.fixture
def renewal_context(monkeypatch: pytest.MonkeyPatch):
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
        id="renewal-user",
        email="renewal@example.test",
        name="Renewal User",
        role="tadbirkor",
        subscription_plan="pro",
        locale="ru",
    )
    subscription = Subscription(
        id="renewal-subscription",
        user_id=user.id,
        plan="pro",
        status="active",
        billing_period="weekly",
        amount_minor=1000,
        currency="USD",
        provider="fake",
        provider_subscription_id="provider-renewal-subscription",
        current_period_start=NOW - timedelta(days=7),
        current_period_end=NOW - timedelta(minutes=1),
    )
    with session_factory() as session:
        session.add_all((user, subscription))
        session.commit()

    provider = FakePaymentProvider("renewal-test-secret")
    monkeypatch.setattr(billing, "get_payment_provider", lambda: provider)

    def override_get_db():
        with session_factory() as session:
            yield session

    monkeypatch.setitem(app.dependency_overrides, get_db, override_get_db)
    yield session_factory, user.id, subscription.id, provider
    app.dependency_overrides.pop(get_db, None)
    Base.metadata.drop_all(bind=engine)
    engine.dispose()


def _run(context, now: datetime, emails: list[tuple[str, str, str, str]] | None = None):
    session_factory, _user_id, _subscription_id, provider = context
    sent_emails = emails if emails is not None else []
    with session_factory() as session:
        return run_renewals(
            session,
            now=now,
            provider=provider,
            send_retry_email=lambda *details: sent_emails.append(details),
        )


def _fail_attempt(context, failed_at: datetime) -> None:
    session_factory, _user_id, subscription_id, _provider = context
    with session_factory() as session:
        subscription = session.get(Subscription, subscription_id)
        invoice = (
            session.query(Invoice)
            .filter_by(subscription_id=subscription_id)
            .one()
        )
        payment = (
            session.query(Payment)
            .filter_by(invoice_id=invoice.id)
            .order_by(Payment.attempt_number.desc())
            .first()
        )
        assert subscription is not None
        assert payment is not None
        payment.status = "failed"
        payment.failed_at = failed_at
        subscription.status = "past_due"
        session.commit()


def test_due_weekly_subscription_creates_one_idempotent_invoice_and_charge(
    renewal_context,
) -> None:
    result = _run(renewal_context, NOW)
    duplicate = _run(renewal_context, NOW + timedelta(minutes=1))
    session_factory, _user_id, subscription_id, provider = renewal_context

    assert result.invoices_created == 1
    assert result.payment_attempts_started == 1
    assert duplicate.invoices_created == 0
    assert duplicate.payment_attempts_started == 0
    assert len(provider.renewal_charges) == 1
    with session_factory() as session:
        invoice = session.query(Invoice).filter_by(subscription_id=subscription_id).one()
        payment = session.query(Payment).filter_by(invoice_id=invoice.id).one()
        assert invoice.amount_minor == 1000
        assert invoice.period_start.replace(tzinfo=UTC) == NOW - timedelta(minutes=1)
        assert (
            invoice.period_end.replace(tzinfo=UTC)
            == NOW - timedelta(minutes=1) + timedelta(days=7)
        )
        assert payment.attempt_number == 1
        assert payment.status == "pending"
        assert payment.provider_payment_id is not None


def test_retries_follow_d6_schedule_and_downgrade_after_grace(renewal_context) -> None:
    emails: list[tuple[str, str, str, str]] = []
    _run(renewal_context, NOW, emails)
    _fail_attempt(renewal_context, NOW)

    early = _run(renewal_context, NOW + timedelta(hours=23), emails)
    assert early.payment_attempts_started == 0
    for day, expected_attempt in ((1, 2), (3, 3), (5, 4)):
        result = _run(renewal_context, NOW + timedelta(days=day), emails)
        assert result.payment_attempts_started == 1
        _fail_attempt(renewal_context, NOW + timedelta(days=day))
        if day < 5:
            between = _run(
                renewal_context, NOW + timedelta(days=day + 1), emails
            )
            assert between.payment_attempts_started == 0
        session_factory, _user_id, _subscription_id, _provider = renewal_context
        with session_factory() as session:
            assert (
                session.query(Payment)
                .filter(Payment.attempt_number == expected_attempt)
                .count()
                == 1
            )

    grace_result = _run(renewal_context, NOW + timedelta(days=7), emails)
    session_factory, user_id, subscription_id, provider = renewal_context
    with session_factory() as session:
        user = session.get(User, user_id)
        subscription = session.get(Subscription, subscription_id)
        invoice = session.query(Invoice).filter_by(subscription_id=subscription_id).one()
        assert user is not None and user.subscription_plan == "free"
        assert subscription is not None and subscription.status == "expired"
        assert invoice.status == "uncollectible"
        assert (
            session.query(Payment)
            .filter(Payment.invoice_id == invoice.id)
            .count()
            == 4
        )
    assert grace_result.subscriptions_downgraded == 1
    assert len(provider.renewal_charges) == 4
    assert len(emails) == 3
    assert all(
        recipient == "renewal@example.test"
        and locale == "ru"
        and amount == "10.00"
        and currency == "USD"
        for recipient, locale, amount, currency in emails
    )
    assert _run(renewal_context, NOW + timedelta(days=8)).subscriptions_downgraded == 0


def test_failed_payment_webhook_starts_dunning_clock(
    renewal_context, monkeypatch: pytest.MonkeyPatch
) -> None:
    class FrozenDateTime:
        @staticmethod
        def now(tz=None):
            return NOW

    monkeypatch.setattr(billing, "datetime", FrozenDateTime)
    emails: list[tuple[str, str, str, str]] = []
    _run(renewal_context, NOW, emails)
    session_factory, user_id, subscription_id, provider = renewal_context
    charge = provider.renewal_charges[0]
    payment = provider.charge_renewal(
        RenewalChargeRequest(
            user_id=user_id,
            subscription_id=subscription_id,
            invoice_id=charge.invoice_id,
            amount_minor=1000,
            currency="USD",
            idempotency_key=charge.idempotency_key,
        )
    )
    payload = json.dumps(
        {
            "id": "renewal-failure",
            "type": "payment.failed",
            "data": {
                "invoice": charge.invoice_id,
                "payment": payment.provider_payment_id,
                "subscription": "provider-renewal-subscription",
                "amount_minor": 1000,
                "currency": "USD",
            },
        }
    ).encode()
    response = client.post(
        "/billing/webhook",
        headers={"x-webhook-signature": provider.sign_webhook(payload)},
        content=payload,
    )

    assert response.status_code == 200, response.text
    with session_factory() as session:
        subscription = session.get(Subscription, subscription_id)
        attempt = session.query(Payment).filter_by(invoice_id=charge.invoice_id).one()
        assert subscription is not None and subscription.status == "past_due"
        assert attempt.status == "failed"
        assert attempt.failed_at is not None

    assert _run(renewal_context, NOW + timedelta(hours=23), emails).payment_attempts_started == 0
    retry = _run(renewal_context, NOW + timedelta(days=1), emails)
    assert retry.payment_attempts_started == 1
    assert retry.retry_emails_sent == 1


def test_successful_renewal_applies_scheduled_plan_and_advances_period(
    renewal_context,
) -> None:
    session_factory, user_id, subscription_id, provider = renewal_context
    with session_factory() as session:
        subscription = session.get(Subscription, subscription_id)
        assert subscription is not None
        subscription.pending_plan = "business"
        subscription.pending_amount_minor = 2000
        session.commit()

    _run(renewal_context, NOW)
    charge = provider.renewal_charges[0]
    payment = provider.charge_renewal(
        RenewalChargeRequest(
            user_id=user_id,
            subscription_id=subscription_id,
            invoice_id=charge.invoice_id,
            amount_minor=2000,
            currency="USD",
            idempotency_key=charge.idempotency_key,
        )
    )
    payload = json.dumps(
        {
            "id": "renewal-success",
            "type": "payment.succeeded",
            "data": {
                "invoice": charge.invoice_id,
                "payment": payment.provider_payment_id,
                "subscription": "provider-renewal-subscription",
                "amount_minor": 2000,
                "currency": "USD",
            },
        }
    ).encode()
    response = client.post(
        "/billing/webhook",
        headers={"x-webhook-signature": provider.sign_webhook(payload)},
        content=payload,
    )

    assert response.status_code == 200, response.text
    with session_factory() as session:
        subscription = session.get(Subscription, subscription_id)
        user = session.get(User, user_id)
        invoice = session.get(Invoice, charge.invoice_id)
        payment = (
            session.query(Payment)
            .filter_by(invoice_id=charge.invoice_id)
            .one()
        )
        assert subscription is not None
        assert subscription.plan == "business"
        assert subscription.amount_minor == 2000
        assert subscription.pending_plan is None
        assert subscription.current_period_start.replace(tzinfo=UTC) == invoice.period_start.replace(
            tzinfo=UTC
        )
        assert subscription.current_period_end.replace(tzinfo=UTC) == invoice.period_end.replace(
            tzinfo=UTC
        )
        assert user is not None and user.subscription_plan == "business"
        assert invoice.status == "paid"
        assert payment.status == "succeeded"


def test_cancel_at_period_end_downgrades_without_creating_renewal_invoice(
    renewal_context,
) -> None:
    session_factory, user_id, subscription_id, provider = renewal_context
    with session_factory() as session:
        subscription = session.get(Subscription, subscription_id)
        assert subscription is not None
        subscription.cancel_at_period_end = True
        session.commit()

    result = _run(renewal_context, NOW)

    assert result.invoices_created == 0
    assert result.payment_attempts_started == 0
    assert provider.renewal_charges == []
    with session_factory() as session:
        subscription = session.get(Subscription, subscription_id)
        user = session.get(User, user_id)
        assert subscription is not None and subscription.status == "expired"
        assert user is not None and user.subscription_plan == "free"


def test_renewal_job_rejects_naive_clock(renewal_context) -> None:
    _session_factory, _user_id, _subscription_id, provider = renewal_context

    with pytest.raises(ValueError, match="timezone-aware"), renewal_context[0]() as session:
        run_renewals(
            session,
            now=datetime.fromisoformat("2026-01-01T00:00:00"),
            provider=provider,
        )
