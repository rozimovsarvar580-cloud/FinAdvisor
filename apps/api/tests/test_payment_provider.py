import json
from datetime import UTC, datetime

import pytest

from finadvisor_api.config import load_settings
from finadvisor_api.payment_provider import (
    CheckoutRequest,
    FakePaymentProvider,
    PaymentProvider,
    PaymentProviderError,
    PaymentProviderUnavailable,
    PaymentSignatureError,
    get_payment_provider,
)


def test_fake_provider_implements_checkout_webhook_cancel_and_refund_contract() -> None:
    provider = FakePaymentProvider("test-webhook-secret")
    assert isinstance(provider, PaymentProvider)

    checkout = provider.create_checkout(
        CheckoutRequest(
            user_id="billing-user",
            invoice_id="invoice-1",
            amount_minor=1000,
            currency="USD",
            success_url="https://app.example.test/billing/success",
            cancel_url="https://app.example.test/billing/cancel",
        )
    )
    assert checkout.provider == "fake"
    assert checkout.checkout_id.startswith("fake_checkout_")
    assert checkout.checkout_url.endswith(checkout.checkout_id)

    update_session = provider.create_payment_method_update(
        "billing-user",
        "provider-customer-1",
        "https://app.example.test/en/app/billing",
    )
    assert update_session.provider == "fake"
    assert update_session.session_id.startswith("fake_payment_method_")
    assert update_session.update_url.endswith(update_session.session_id)

    effective_at = datetime(2026, 11, 1, tzinfo=UTC)
    provider.schedule_plan_change(
        "provider-subscription-1", "business", 2000, effective_at
    )
    assert provider.scheduled_plan_changes == [
        ("provider-subscription-1", "business", 2000, effective_at)
    ]

    raw_event = json.dumps(
        {"id": "event-1", "type": "payment.succeeded", "data": {"invoice": "invoice-1"}}
    ).encode()
    event = provider.verify_webhook(raw_event, provider.sign_webhook(raw_event))
    assert event.event_id == "event-1"
    assert event.event_type == "payment.succeeded"
    assert event.payload["data"] == {"invoice": "invoice-1"}

    provider.cancel("provider-subscription-1", at_period_end=True)
    assert provider.cancellations == [("provider-subscription-1", True)]

    refund = provider.refund("provider-payment-1", 500, "USD")
    assert refund.provider_refund_id.startswith("fake_refund_")
    assert refund.status == "pending"
    assert (refund.amount_minor, refund.currency) == (500, "USD")
    assert provider.refunds == [refund]
    assert provider.refund(
        "provider-payment-1", 500, "USD", idempotency_key="refund-1"
    ) == provider.refund(
        "provider-payment-1", 500, "USD", idempotency_key="refund-1"
    )
    assert len(provider.refunds) == 2


def test_fake_provider_rejects_invalid_signature_and_event_payload() -> None:
    provider = FakePaymentProvider("test-webhook-secret")
    raw_event = b'{"id":"event-1","type":"payment.succeeded"}'

    with pytest.raises(PaymentSignatureError):
        provider.verify_webhook(raw_event, "sha256=invalid")

    invalid_event = b'{"type":"payment.succeeded"}'
    with pytest.raises(PaymentProviderError, match="event identity"):
        provider.verify_webhook(invalid_event, provider.sign_webhook(invalid_event))


@pytest.mark.parametrize(
    ("amount_minor", "currency"),
    [(0, "USD"), (-1, "USD"), (1.5, "USD"), (True, "USD"), (1, "usd"), (1, "US1")],
)
def test_checkout_rejects_invalid_minor_units_and_currency(
    amount_minor: int, currency: str
) -> None:
    with pytest.raises(ValueError):
        CheckoutRequest(
            user_id="billing-user",
            invoice_id="invoice-1",
            amount_minor=amount_minor,
            currency=currency,
            success_url="https://app.example.test/success",
            cancel_url="https://app.example.test/cancel",
        )


def test_fake_provider_rejects_invalid_refund_requests() -> None:
    provider = FakePaymentProvider("test-webhook-secret")

    with pytest.raises(ValueError):
        provider.refund("provider-payment-1", 0, "USD")
    with pytest.raises(ValueError):
        provider.refund("", 100, "USD")


def test_fake_provider_rejects_invalid_billing_management_requests() -> None:
    provider = FakePaymentProvider("test-webhook-secret")

    with pytest.raises(ValueError):
        provider.create_payment_method_update(
            "billing-user", "", "https://app.example.test/billing"
        )
    with pytest.raises(ValueError):
        provider.create_payment_method_update(
            "billing-user", "customer-1", "javascript:alert(1)"
        )
    with pytest.raises(ValueError):
        provider.schedule_plan_change(
            "subscription-1",
            "free",
            1000,
            datetime(2026, 11, 1, tzinfo=UTC),
        )
    with pytest.raises(ValueError):
        provider.schedule_plan_change(
            "subscription-1",
            "pro",
            1000,
            datetime.fromisoformat("2026-11-01T00:00:00"),
        )


def test_payment_provider_factory_selects_fake_only_outside_production() -> None:
    settings = load_settings(
        {
            "APP_ENV": "development",
            "PAYMENT_PROVIDER": "fake",
            "PAYMENT_WEBHOOK_SECRET": "configured-fake-webhook-secret",
        }
    )
    provider = get_payment_provider(settings)
    assert isinstance(provider, FakePaymentProvider)
    assert provider.name == "fake"

    production = load_settings(
        {
            "APP_ENV": "production",
            "DATABASE_URL": "postgresql+psycopg://db.example/finadvisor",
            "JWT_SECRET": "placeholder-production-jwt-secret-not-real",
            "PAYMENT_PROVIDER": "fake",
        }
    )
    with pytest.raises(PaymentProviderUnavailable, match="not allowed in production"):
        get_payment_provider(production)


@pytest.mark.parametrize("provider_name", ["disabled", "unknown-provider"])
def test_payment_provider_factory_rejects_unavailable_providers(
    provider_name: str,
) -> None:
    settings = load_settings({"PAYMENT_PROVIDER": provider_name})

    with pytest.raises(PaymentProviderUnavailable):
        get_payment_provider(settings)
