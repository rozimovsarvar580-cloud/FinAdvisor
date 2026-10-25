import hashlib
import hmac
import json
from dataclasses import dataclass
from datetime import datetime
from typing import Protocol, runtime_checkable
from urllib.parse import parse_qsl, urlencode, urlsplit, urlunsplit
from uuid import uuid4

from finadvisor_api.config import Settings, get_settings


class PaymentProviderError(RuntimeError):
    pass


class PaymentProviderUnavailable(PaymentProviderError):
    pass


class PaymentSignatureError(PaymentProviderError):
    pass


def _validate_amount_currency(amount_minor: int, currency: str) -> None:
    if (
        isinstance(amount_minor, bool)
        or not isinstance(amount_minor, int)
        or amount_minor <= 0
    ):
        raise ValueError("Payment amount must be a positive integer in minor units")
    if (
        len(currency) != 3
        or not currency.isascii()
        or not currency.isalpha()
        or not currency.isupper()
    ):
        raise ValueError("Payment currency must be a three-letter uppercase code")


def _validate_absolute_url(value: str, label: str) -> None:
    parsed = urlsplit(value)
    if parsed.scheme not in {"http", "https"} or not parsed.netloc:
        raise ValueError(f"{label} must be an absolute HTTP(S) URL")


@dataclass(frozen=True)
class CheckoutRequest:
    user_id: str
    invoice_id: str
    amount_minor: int
    currency: str
    success_url: str
    cancel_url: str

    def __post_init__(self) -> None:
        if not self.user_id or not self.invoice_id:
            raise ValueError("Payment checkout requires a user and invoice")
        _validate_amount_currency(self.amount_minor, self.currency)
        _validate_absolute_url(self.success_url, "success_url")
        _validate_absolute_url(self.cancel_url, "cancel_url")


@dataclass(frozen=True)
class CheckoutSession:
    provider: str
    checkout_id: str
    checkout_url: str


@dataclass(frozen=True)
class PaymentMethodUpdateSession:
    provider: str
    session_id: str
    update_url: str


@dataclass(frozen=True)
class RenewalChargeRequest:
    user_id: str
    subscription_id: str
    invoice_id: str
    amount_minor: int
    currency: str
    idempotency_key: str

    def __post_init__(self) -> None:
        if not all(
            (
                self.user_id,
                self.subscription_id,
                self.invoice_id,
                self.idempotency_key,
            )
        ):
            raise ValueError("A renewal charge requires user, subscription, invoice and key")
        _validate_amount_currency(self.amount_minor, self.currency)


@dataclass(frozen=True)
class RenewalCharge:
    provider_payment_id: str

    def __post_init__(self) -> None:
        if not self.provider_payment_id:
            raise ValueError("A renewal charge requires a provider payment ID")


@dataclass(frozen=True)
class VerifiedWebhookEvent:
    event_id: str
    event_type: str
    payload: dict[str, object]


@dataclass(frozen=True)
class RefundResult:
    provider_refund_id: str
    status: str
    amount_minor: int
    currency: str


@runtime_checkable
class PaymentProvider(Protocol):
    name: str

    def create_checkout(self, request: CheckoutRequest) -> CheckoutSession: ...

    def charge_renewal(self, request: RenewalChargeRequest) -> RenewalCharge: ...

    def create_payment_method_update(
        self, user_id: str, provider_customer_id: str, return_url: str
    ) -> PaymentMethodUpdateSession: ...

    def schedule_plan_change(
        self,
        provider_subscription_id: str,
        plan: str,
        amount_minor: int,
        effective_at: datetime,
    ) -> None: ...

    def verify_webhook(
        self, payload: bytes, signature: str
    ) -> VerifiedWebhookEvent: ...

    def cancel(self, provider_subscription_id: str, *, at_period_end: bool) -> None: ...

    def refund(
        self,
        provider_payment_id: str,
        amount_minor: int,
        currency: str,
        idempotency_key: str | None = None,
    ) -> RefundResult: ...


class FakePaymentProvider:
    name = "fake"

    def __init__(self, webhook_secret: str) -> None:
        if not webhook_secret:
            raise ValueError("A fake payment webhook secret is required")
        self._webhook_secret = webhook_secret.encode("utf-8")
        self.cancellations: list[tuple[str, bool]] = []
        self.scheduled_plan_changes: list[tuple[str, str, int, datetime]] = []
        self.refunds: list[RefundResult] = []
        self.renewal_charges: list[RenewalChargeRequest] = []
        self._renewal_charge_ids: dict[str, str] = {}
        self._refund_results: dict[str, RefundResult] = {}

    def create_checkout(self, request: CheckoutRequest) -> CheckoutSession:
        checkout_id = f"fake_checkout_{uuid4().hex}"
        success_url = urlsplit(request.success_url)
        query = urlencode(
            [
                *parse_qsl(success_url.query, keep_blank_values=True),
                ("checkout_id", checkout_id),
            ]
        )
        return CheckoutSession(
            provider=self.name,
            checkout_id=checkout_id,
            checkout_url=urlunsplit(
                (
                    success_url.scheme,
                    success_url.netloc,
                    success_url.path,
                    query,
                    success_url.fragment,
                )
            ),
        )

    def create_payment_method_update(
        self, user_id: str, provider_customer_id: str, return_url: str
    ) -> PaymentMethodUpdateSession:
        if not user_id or not provider_customer_id:
            raise ValueError("Payment method update requires a user and customer")
        _validate_absolute_url(return_url, "return_url")
        session_id = f"fake_payment_method_{uuid4().hex}"
        parsed = urlsplit(return_url)
        query = urlencode(
            [
                *parse_qsl(parsed.query, keep_blank_values=True),
                ("payment_method_session", session_id),
            ]
        )
        return PaymentMethodUpdateSession(
            provider=self.name,
            session_id=session_id,
            update_url=urlunsplit(
                (
                    parsed.scheme,
                    parsed.netloc,
                    parsed.path,
                    query,
                    parsed.fragment,
                )
            ),
        )

    def charge_renewal(self, request: RenewalChargeRequest) -> RenewalCharge:
        provider_payment_id = self._renewal_charge_ids.get(request.idempotency_key)
        if provider_payment_id is None:
            provider_payment_id = (
                "fake_payment_"
                + hashlib.sha256(request.idempotency_key.encode("utf-8")).hexdigest()[:24]
            )
            self._renewal_charge_ids[request.idempotency_key] = provider_payment_id
            self.renewal_charges.append(request)
        return RenewalCharge(provider_payment_id=provider_payment_id)

    def schedule_plan_change(
        self,
        provider_subscription_id: str,
        plan: str,
        amount_minor: int,
        effective_at: datetime,
    ) -> None:
        if not provider_subscription_id:
            raise ValueError("A provider subscription ID is required")
        if plan not in {"pro", "business"}:
            raise ValueError("A valid paid plan is required")
        _validate_amount_currency(amount_minor, "USD")
        if effective_at.tzinfo is None:
            raise ValueError("Plan changes require a timezone-aware effective date")
        self.scheduled_plan_changes.append(
            (provider_subscription_id, plan, amount_minor, effective_at)
        )

    def sign_webhook(self, payload: bytes) -> str:
        digest = hmac.new(self._webhook_secret, payload, hashlib.sha256).hexdigest()
        return f"sha256={digest}"

    def verify_webhook(
        self, payload: bytes, signature: str
    ) -> VerifiedWebhookEvent:
        expected_signature = self.sign_webhook(payload)
        if not hmac.compare_digest(expected_signature, signature):
            raise PaymentSignatureError("Payment webhook signature is invalid")
        try:
            event = json.loads(payload)
        except (UnicodeDecodeError, json.JSONDecodeError) as error:
            raise PaymentProviderError("Payment webhook payload is invalid JSON") from error
        if not isinstance(event, dict):
            raise PaymentProviderError("Payment webhook payload must be an object")
        event_id = event.get("id")
        event_type = event.get("type")
        if (
            not isinstance(event_id, str)
            or not event_id
            or not isinstance(event_type, str)
            or not event_type
        ):
            raise PaymentProviderError("Payment webhook event identity is invalid")
        return VerifiedWebhookEvent(
            event_id=event_id,
            event_type=event_type,
            payload=event,
        )

    def cancel(self, provider_subscription_id: str, *, at_period_end: bool) -> None:
        if not provider_subscription_id:
            raise ValueError("A provider subscription ID is required")
        self.cancellations.append((provider_subscription_id, at_period_end))
        self.scheduled_plan_changes = [
            change
            for change in self.scheduled_plan_changes
            if change[0] != provider_subscription_id
        ]

    def refund(
        self,
        provider_payment_id: str,
        amount_minor: int,
        currency: str,
        idempotency_key: str | None = None,
    ) -> RefundResult:
        if not provider_payment_id:
            raise ValueError("A provider payment ID is required")
        _validate_amount_currency(amount_minor, currency)
        key = idempotency_key or f"{provider_payment_id}:{amount_minor}:{currency}"
        existing = self._refund_results.get(key)
        if existing is not None:
            return existing
        result = RefundResult(
            provider_refund_id=f"fake_refund_{uuid4().hex}",
            status="pending",
            amount_minor=amount_minor,
            currency=currency,
        )
        self._refund_results[key] = result
        self.refunds.append(result)
        return result


def get_payment_provider(settings: Settings | None = None) -> PaymentProvider:
    configuration = settings or get_settings()
    if configuration.payment_provider == "fake":
        if configuration.environment in {"prod", "production"}:
            raise PaymentProviderUnavailable(
                "The fake payment provider is not allowed in production"
            )
        return FakePaymentProvider(
            configuration.payment_webhook_secret
            or "local-only-fake-payment-webhook-secret"
        )
    if configuration.payment_provider == "disabled":
        raise PaymentProviderUnavailable("Payment processing is not configured")
    raise PaymentProviderUnavailable(
        f"Unsupported payment provider: {configuration.payment_provider}"
    )
