from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
from typing import Annotated, Literal
from urllib.parse import urlencode
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Request, status
from finance_engine import calculate_progressive_commission
from finance_engine.money import (
    minor_units_to_decimal_string,
    usd_price_to_minor_units,
)
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import func, select
from sqlalchemy.exc import IntegrityError, SQLAlchemyError
from sqlalchemy.orm import Session

from finadvisor_api.auth import get_current_user
from finadvisor_api.config import get_settings
from finadvisor_api.database import get_db
from finadvisor_api.models import (
    CommissionLedger,
    CommissionStatement,
    Invoice,
    Payment,
    PaymentEvent,
    Refund,
    Subscription,
    User,
)
from finadvisor_api.payment_provider import (
    CheckoutRequest as ProviderCheckoutRequest,
)
from finadvisor_api.payment_provider import (
    PaymentProviderError,
    PaymentProviderUnavailable,
    PaymentSignatureError,
    get_payment_provider,
)
from finadvisor_api.pricing import PRICING_CATALOG

router = APIRouter(prefix="/billing", tags=["billing"])

BillingPlan = Literal["pro", "business"]
BillingPeriod = Literal["weekly", "monthly", "yearly"]
Locale = Literal["uz", "ru", "en"]


class BillingInvoiceSummary(BaseModel):
    invoice_number: str
    amount: str
    currency: str
    status: str
    created_at: datetime
    paid_at: datetime | None
    due_at: datetime | None


class BillingSummaryResponse(BaseModel):
    current_plan: str
    status: str
    billing_period: str | None
    price: str | None
    currency: str | None
    next_charge_at: datetime | None
    access_until: datetime | None
    cancel_at_period_end: bool
    pending_plan: str | None
    pending_plan_effective_at: datetime | None
    payment_method_available: bool
    invoices: list[BillingInvoiceSummary]


class CancelSubscriptionResponse(BaseModel):
    cancel_at_period_end: bool
    access_until: datetime | None


class PlanChangeRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    plan: BillingPlan


class PlanChangeResponse(BaseModel):
    pending_plan: BillingPlan
    effective_at: datetime


class PaymentMethodUpdateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    locale: Locale


class PaymentMethodUpdateResponse(BaseModel):
    update_url: str


class RefundRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    reason: str = Field(min_length=1, max_length=500)
    barely_used: Literal[True]


class RefundRequestResponse(BaseModel):
    refund_id: str
    amount_minor: int
    currency: str
    status: str
    marker: Literal["TODO(DECISION D5)"] = "TODO(DECISION D5)"


class RefundReviewRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    approved: bool
    review_note: str = Field(min_length=1, max_length=500)


class RefundReviewResponse(BaseModel):
    refund_id: str
    status: str
    provider_refund_id: str | None
    marker: Literal["TODO(DECISION D5)"] = "TODO(DECISION D5)"


class CheckoutCreateRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")

    plan: BillingPlan
    billing_period: BillingPeriod
    locale: Locale


class CheckoutCreateResponse(BaseModel):
    subscription_id: str
    invoice_id: str
    amount_minor: int
    currency: Literal["USD"]
    checkout_url: str


def _weekly_price_minor_units(plan: BillingPlan) -> int:
    plans = PRICING_CATALOG.get("plans")
    if not isinstance(plans, list):
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="billing.pricing_catalog_invalid",
        )
    matching_plan = next(
        (
            entry
            for entry in plans
            if isinstance(entry, dict) and entry.get("id") == plan
        ),
        None,
    )
    prices = matching_plan.get("priceByPeriod") if matching_plan else None
    price = prices.get("weekly") if isinstance(prices, dict) else None
    if not isinstance(price, str):
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="billing.pricing_catalog_invalid",
        )
    try:
        amount_minor = usd_price_to_minor_units(price)
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="billing.pricing_catalog_invalid",
        ) from error
    if amount_minor <= 0:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="billing.paid_plan_price_invalid",
        )
    return amount_minor


def _checkout_return_url(
    base_url: str,
    locale: Locale,
    outcome: Literal["success", "cancel"],
    invoice_id: str,
) -> str:
    return (
        f"{base_url.rstrip('/')}/{locale}/app/billing/checkout/{outcome}?"
        f"{urlencode({'invoice_id': invoice_id})}"
    )


def _event_payload_to_record(event_payload: dict[str, object]) -> dict[str, object]:
    if not isinstance(event_payload, dict):
        raise TypeError("Webhook payload must be an object")
    return event_payload


@router.post("/webhook", status_code=status.HTTP_200_OK)
async def receive_webhook(
    request: Request,
    db: Annotated[Session, Depends(get_db)],
) -> dict[str, str | bool]:
    payload = await request.body()
    signature = request.headers.get("x-webhook-signature") or request.headers.get(
        "x-signature"
    )
    if not signature:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="billing.webhook_missing_signature",
        )

    try:
        provider = get_payment_provider()
    except PaymentProviderUnavailable as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="billing.payment_unavailable",
        ) from error

    try:
        verified_event = provider.verify_webhook(payload, signature)
    except PaymentSignatureError as error:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="billing.webhook_invalid_signature",
        ) from error
    except PaymentProviderError as error:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="billing.webhook_invalid_payload",
        ) from error

    event_record = (
        db.query(PaymentEvent)
        .filter_by(
            provider=provider.name,
            provider_event_id=verified_event.event_id,
        )
        .one_or_none()
    )
    if event_record is not None and event_record.status != "unmatched":
        return {"received": True, "duplicate": True}
    if event_record is None:
        event_record = PaymentEvent(
            id=str(uuid4()),
            provider=provider.name,
            provider_event_id=verified_event.event_id,
            event_type=verified_event.event_type,
            raw_payload=_event_payload_to_record(verified_event.payload),
            signature_valid=True,
            status="received",
            attempts=0,
        )
        db.add(event_record)
        try:
            db.flush()
        except IntegrityError:
            db.rollback()
            return {"received": True, "duplicate": True}
    event_record.attempts += 1
    event_record.status = "received"
    event_record.last_error = None

    def reject_event(detail: str, *, http_status: int = status.HTTP_400_BAD_REQUEST):
        event_record.status = "failed"
        event_record.last_error = detail
        event_record.processed_at = datetime.now(UTC)
        db.commit()
        raise HTTPException(status_code=http_status, detail=detail)

    event_payload = verified_event.payload
    event_type = verified_event.event_type
    if event_type in {"refund.succeeded", "refund.failed"}:
        data = event_payload.get("data")
        if not isinstance(data, dict):
            reject_event("billing.webhook_invalid_payload")
        provider_refund_id = data.get("refund")
        amount_minor = data.get("amount_minor")
        currency = data.get("currency")
        if (
            not isinstance(provider_refund_id, str)
            or not provider_refund_id
            or isinstance(amount_minor, bool)
            or not isinstance(amount_minor, int)
            or amount_minor <= 0
            or not isinstance(currency, str)
        ):
            reject_event("billing.webhook_invalid_payload")
        refund = (
            db.query(Refund)
            .filter_by(provider_refund_id=provider_refund_id)
            .one_or_none()
        )
        if refund is None:
            event_record.status = "unmatched"
            event_record.last_error = "billing.webhook_refund_not_found"
            db.commit()
            return {"received": True, "duplicate": False}
        if refund.amount_minor != amount_minor or refund.currency != currency:
            reject_event("billing.webhook_refund_mismatch")
        if refund.status == "succeeded":
            event_record.status = "processed"
            event_record.processed_at = datetime.now(UTC)
            db.commit()
            return {"received": True, "duplicate": False}
        if refund.status in {"canceled", "failed"} and event_type == "refund.succeeded":
            reject_event("billing.webhook_refund_state_conflict")
        now = datetime.now(UTC)
        refund.status = "succeeded" if event_type == "refund.succeeded" else "failed"
        refund.processed_at = now
        if refund.status == "succeeded":
            db.flush()
            payment = db.get(Payment, refund.payment_id)
            if payment is None:
                reject_event("billing.webhook_payment_not_found")
            succeeded_total = (
                db.query(Refund)
                .filter(
                    Refund.payment_id == payment.id,
                    Refund.status == "succeeded",
                )
                .with_entities(func.sum(Refund.amount_minor))
                .scalar()
                or 0
            )
            payment.status = (
                "refunded"
                if succeeded_total >= payment.amount_minor
                else "partially_refunded"
            )
        event_record.status = "processed"
        event_record.processed_at = now
        db.commit()
        return {"received": True, "duplicate": False}

    if event_type == "subscription.plan_change_applied":
        data = event_payload.get("data")
        if not isinstance(data, dict):
            reject_event("billing.webhook_invalid_payload")
        provider_subscription_id = data.get("subscription")
        plan = data.get("plan")
        amount_minor = data.get("amount_minor")
        if (
            not isinstance(provider_subscription_id, str)
            or not provider_subscription_id
            or not isinstance(plan, str)
            or plan not in {"pro", "business"}
            or isinstance(amount_minor, bool)
            or not isinstance(amount_minor, int)
            or amount_minor < 0
        ):
            reject_event("billing.webhook_invalid_payload")
        subscription = (
            db.query(Subscription)
            .filter_by(
                provider=provider.name,
                provider_subscription_id=provider_subscription_id,
            )
            .one_or_none()
        )
        if subscription is None:
            event_record.status = "unmatched"
            event_record.last_error = "billing.webhook_subscription_not_found"
            db.commit()
            return {"received": True, "duplicate": False}
        if (
            subscription.pending_plan != plan
            or subscription.pending_amount_minor != amount_minor
        ):
            reject_event("billing.webhook_plan_change_mismatch")
        subscription.plan = plan
        subscription.amount_minor = amount_minor
        subscription.pending_plan = None
        subscription.pending_amount_minor = None
        user = db.get(User, subscription.user_id)
        if user is not None:
            user.subscription_plan = plan
        event_record.status = "processed"
        event_record.processed_at = datetime.now(UTC)
        db.commit()
        return {"received": True, "duplicate": False}

    if event_type not in {"payment.succeeded", "payment.failed"}:
        event_record.status = "ignored"
        event_record.processed_at = datetime.now(UTC)
        db.commit()
        return {"received": True, "duplicate": False}

    data = event_payload.get("data")
    if not isinstance(data, dict):
        reject_event("billing.webhook_invalid_payload")

    invoice_reference = data.get("invoice")
    provider_payment_id = data.get("payment")
    amount_minor = data.get("amount_minor")
    currency = data.get("currency")
    provider_subscription_id = data.get("subscription")
    provider_customer_id = data.get("customer")
    if (
        not isinstance(invoice_reference, str)
        or not invoice_reference
        or not isinstance(provider_payment_id, str)
        or not provider_payment_id
        or isinstance(amount_minor, bool)
        or not isinstance(amount_minor, int)
        or amount_minor < 0
        or not isinstance(currency, str)
    ):
        reject_event("billing.webhook_invalid_payload")

    invoice = db.get(Invoice, invoice_reference)
    if invoice is None:
        invoice = (
            db.query(Invoice)
            .filter_by(provider_checkout_id=invoice_reference)
            .one_or_none()
        )
    if invoice is None:
        event_record.status = "unmatched"
        event_record.last_error = "billing.webhook_invoice_not_found"
        db.commit()
        return {"received": True, "duplicate": False}
    if invoice.amount_minor != amount_minor or invoice.currency != currency:
        reject_event("billing.webhook_amount_mismatch")

    payment_record = (
        db.query(Payment)
        .filter_by(
            provider=provider.name,
            provider_payment_id=provider_payment_id,
        )
        .one_or_none()
    )
    if payment_record is not None and payment_record.invoice_id != invoice.id:
        reject_event("billing.webhook_payment_mismatch")
    if payment_record is None:
        payment_record = Payment(
            id=str(uuid4()),
            invoice_id=invoice.id,
            user_id=invoice.user_id,
            provider=provider.name,
            provider_payment_id=provider_payment_id,
            amount_minor=amount_minor,
            currency=currency,
            status="pending",
        )
        db.add(payment_record)

    now = datetime.now(UTC)
    if event_type == "payment.succeeded" and payment_record.status not in {
        "refunded",
        "partially_refunded",
    }:
        payment_record.status = "succeeded"
        payment_record.paid_at = payment_record.paid_at or now
        invoice.status = "paid"
        invoice.paid_at = invoice.paid_at or now
        subscription = db.get(Subscription, invoice.subscription_id)
        if subscription is not None and subscription.status not in {"canceled", "expired"}:
            subscription.status = "active"
            if (
                isinstance(provider_subscription_id, str)
                and provider_subscription_id
            ):
                subscription.provider_subscription_id = provider_subscription_id
            if isinstance(provider_customer_id, str) and provider_customer_id:
                subscription.provider_customer_id = provider_customer_id
            subscription.current_period_start = (
                invoice.period_start or subscription.current_period_start or now
            )
            if invoice.period_end is not None:
                subscription.current_period_end = invoice.period_end
            elif subscription.current_period_end is None:
                period_length = (
                    timedelta(days=7) if subscription.billing_period == "weekly" else None
                )
                if period_length is not None:
                    subscription.current_period_end = now + period_length
            if (
                subscription.pending_plan is not None
                and subscription.pending_amount_minor == invoice.amount_minor
            ):
                subscription.plan = subscription.pending_plan
                subscription.amount_minor = subscription.pending_amount_minor
                subscription.pending_plan = None
                subscription.pending_amount_minor = None
            user = db.get(User, subscription.user_id)
            if user is not None:
                user.subscription_plan = subscription.plan
    elif event_type == "payment.failed" and payment_record.status == "pending":
        payment_record.status = "failed"
        payment_record.failed_at = payment_record.failed_at or now
        subscription = db.get(Subscription, invoice.subscription_id)
        if subscription is not None and subscription.status == "active":
            subscription.status = "past_due"

    event_record.status = "processed"
    event_record.processed_at = now
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        return {"received": True, "duplicate": True}

    return {"received": True, "duplicate": False}


@router.get("/summary", response_model=BillingSummaryResponse)
def get_billing_summary(
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> BillingSummaryResponse:
    if user.role != "tadbirkor":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="billing.owner_required",
        )

    active_subscription = (
        db.query(Subscription)
        .filter(
            Subscription.user_id == user.id,
            Subscription.status.in_(("active", "past_due")),
        )
        .order_by(Subscription.created_at.desc())
        .first()
    )
    subscription = active_subscription or (
        db.query(Subscription)
        .filter_by(user_id=user.id)
        .order_by(Subscription.created_at.desc())
        .first()
    )
    invoices = (
        db.query(Invoice)
        .filter_by(user_id=user.id)
        .order_by(Invoice.created_at.desc())
        .limit(50)
        .all()
    )
    cancel_at_period_end = bool(
        subscription and subscription.cancel_at_period_end
    )
    return BillingSummaryResponse(
        current_plan=user.subscription_plan,
        status=subscription.status if subscription else "inactive",
        billing_period=subscription.billing_period if subscription else None,
        price=(
            minor_units_to_decimal_string(subscription.amount_minor)
            if subscription
            else None
        ),
        currency=subscription.currency if subscription else None,
        next_charge_at=(
            subscription.current_period_end
            if subscription
            and subscription.status == "active"
            and not cancel_at_period_end
            else None
        ),
        access_until=(
            subscription.current_period_end if cancel_at_period_end else None
        ),
        cancel_at_period_end=cancel_at_period_end,
        pending_plan=subscription.pending_plan if subscription else None,
        pending_plan_effective_at=(
            subscription.current_period_end
            if subscription and subscription.pending_plan
            else None
        ),
        payment_method_available=bool(
            subscription and subscription.provider_customer_id
        ),
        invoices=[
            BillingInvoiceSummary(
                invoice_number=invoice.invoice_number,
                amount=minor_units_to_decimal_string(invoice.amount_minor),
                currency=invoice.currency,
                status=invoice.status,
                created_at=invoice.created_at,
                paid_at=invoice.paid_at,
                due_at=invoice.due_at,
            )
            for invoice in invoices
        ],
    )


@router.post("/cancel", response_model=CancelSubscriptionResponse)
def cancel_subscription(
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> CancelSubscriptionResponse:
    if user.role != "tadbirkor":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="billing.owner_required",
        )
    subscription = (
        db.query(Subscription)
        .filter(
            Subscription.user_id == user.id,
            Subscription.status == "active",
        )
        .order_by(Subscription.created_at.desc())
        .first()
    )
    if subscription is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="billing.active_subscription_not_found",
        )
    if subscription.cancel_at_period_end:
        return CancelSubscriptionResponse(
            cancel_at_period_end=True,
            access_until=subscription.current_period_end,
        )
    if not subscription.provider_subscription_id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="billing.subscription_provider_unavailable",
        )
    try:
        provider = get_payment_provider()
        provider.cancel(subscription.provider_subscription_id, at_period_end=True)
    except PaymentProviderUnavailable as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="billing.payment_unavailable",
        ) from error
    except PaymentProviderError as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="billing.subscription_update_failed",
        ) from error

    subscription.cancel_at_period_end = True
    subscription.pending_plan = None
    subscription.pending_amount_minor = None
    try:
        db.commit()
    except SQLAlchemyError as error:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="billing.subscription_save_failed",
        ) from error
    return CancelSubscriptionResponse(
        cancel_at_period_end=True,
        access_until=subscription.current_period_end,
    )


@router.post("/plan-change", response_model=PlanChangeResponse)
def schedule_plan_change(
    payload: PlanChangeRequest,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> PlanChangeResponse:
    if user.role != "tadbirkor":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="billing.owner_required",
        )
    subscription = (
        db.query(Subscription)
        .filter(
            Subscription.user_id == user.id,
            Subscription.status == "active",
        )
        .order_by(Subscription.created_at.desc())
        .first()
    )
    if subscription is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="billing.active_subscription_not_found",
        )
    if subscription.cancel_at_period_end or subscription.current_period_end is None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="billing.plan_change_unavailable",
        )
    if payload.plan == subscription.plan:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="billing.plan_already_active",
        )
    if subscription.pending_plan:
        if subscription.pending_plan == payload.plan:
            return PlanChangeResponse(
                pending_plan=payload.plan,
                effective_at=subscription.current_period_end,
            )
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="billing.plan_change_already_scheduled",
        )
    if not subscription.provider_subscription_id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="billing.subscription_provider_unavailable",
        )

    amount_minor = _weekly_price_minor_units(payload.plan)
    effective_at = subscription.current_period_end
    if effective_at.tzinfo is None:
        effective_at = effective_at.replace(tzinfo=UTC)
    try:
        provider = get_payment_provider()
        provider.schedule_plan_change(
            subscription.provider_subscription_id,
            payload.plan,
            amount_minor,
            effective_at,
        )
    except PaymentProviderUnavailable as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="billing.payment_unavailable",
        ) from error
    except PaymentProviderError as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="billing.plan_change_failed",
        ) from error

    subscription.pending_plan = payload.plan
    subscription.pending_amount_minor = amount_minor
    try:
        db.commit()
    except SQLAlchemyError as error:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="billing.subscription_save_failed",
        ) from error
    return PlanChangeResponse(
        pending_plan=payload.plan,
        effective_at=effective_at,
    )


@router.post("/payment-method", response_model=PaymentMethodUpdateResponse)
def update_payment_method(
    payload: PaymentMethodUpdateRequest,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> PaymentMethodUpdateResponse:
    if user.role != "tadbirkor":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="billing.owner_required",
        )
    subscription = (
        db.query(Subscription)
        .filter(
            Subscription.user_id == user.id,
            Subscription.status.in_(("active", "past_due")),
        )
        .order_by(Subscription.created_at.desc())
        .first()
    )
    if subscription is None or not subscription.provider_customer_id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="billing.payment_method_unavailable",
        )
    settings = get_settings()
    if settings.environment in {"prod", "production"} and not settings.nextauth_url:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="billing.return_url_unconfigured",
        )
    base_url = settings.nextauth_url or "http://localhost:3000"
    return_url = (
        f"{base_url.rstrip('/')}/{payload.locale}/app/billing?"
        f"{urlencode({'payment_method': 'updated'})}"
    )
    try:
        provider = get_payment_provider()
        update_session = provider.create_payment_method_update(
            user.id,
            subscription.provider_customer_id,
            return_url,
        )
    except PaymentProviderUnavailable as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="billing.payment_unavailable",
        ) from error
    except PaymentProviderError as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="billing.payment_method_update_failed",
        ) from error
    return PaymentMethodUpdateResponse(update_url=update_session.update_url)


@router.post(
    "/payments/{payment_id}/refund-request",
    response_model=RefundRequestResponse,
    status_code=status.HTTP_201_CREATED,
)
def request_payment_refund(
    payment_id: str,
    payload: RefundRequest,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> RefundRequestResponse:
    if user.role != "tadbirkor":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="billing.owner_required",
        )
    if not payload.reason.strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="billing.refund_reason_required",
        )
    payment = (
        db.query(Payment)
        .filter_by(id=payment_id, user_id=user.id)
        .with_for_update()
        .one_or_none()
    )
    if payment is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="billing.payment_not_found",
        )
    invoice = db.get(Invoice, payment.invoice_id)
    paid_at = payment.paid_at or (invoice.paid_at if invoice else None)
    if (
        payment.status != "succeeded"
        or invoice is None
        or invoice.subscription_id is None
        or paid_at is None
    ):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="billing.refund_not_eligible",
        )
    now = datetime.now(UTC)
    normalized_paid_at = (
        paid_at.replace(tzinfo=UTC) if paid_at.tzinfo is None else paid_at
    )
    if normalized_paid_at > now or now - normalized_paid_at > timedelta(days=7):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="billing.refund_window_expired",
        )
    prior_subscription_payment = (
        db.query(Payment.id)
        .join(Invoice, Invoice.id == Payment.invoice_id)
        .filter(
            Payment.user_id == user.id,
            Payment.id != payment.id,
            Payment.status.in_(("succeeded", "partially_refunded", "refunded")),
            Invoice.subscription_id.is_not(None),
        )
        .first()
    )
    if prior_subscription_payment is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="billing.refund_first_purchase_only",
        )
    existing_refund = (
        db.query(Refund)
        .filter_by(payment_id=payment.id)
        .order_by(Refund.created_at.desc())
        .first()
    )
    if existing_refund is not None:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="billing.refund_already_requested",
        )
    refund = Refund(
        id=str(uuid4()),
        payment_id=payment.id,
        amount_minor=payment.amount_minor,
        currency=payment.currency,
        status="pending",
        reason=payload.reason.strip(),
    )
    db.add(refund)
    try:
        db.commit()
    except IntegrityError as error:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="billing.refund_already_requested",
        ) from error
    return RefundRequestResponse(
        refund_id=refund.id,
        amount_minor=refund.amount_minor,
        currency=refund.currency,
        status=refund.status,
    )


@router.post(
    "/admin/refunds/{refund_id}",
    response_model=RefundReviewResponse,
)
def review_payment_refund(
    refund_id: str,
    payload: RefundReviewRequest,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> RefundReviewResponse:
    if user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="admin.required",
        )
    refund = db.query(Refund).filter_by(id=refund_id).with_for_update().one_or_none()
    if refund is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="billing.refund_not_found",
        )
    if refund.status in {"succeeded", "canceled"}:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="billing.refund_already_processed",
        )
    payment = db.get(Payment, refund.payment_id)
    if payment is None or not payment.provider_payment_id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="billing.refund_payment_unavailable",
        )
    if not payload.approved:
        refund.status = "canceled"
        refund.reason = (
            f"{refund.reason or ''}\nAdmin review: {payload.review_note.strip()}"
        )[-500:]
        refund.processed_at = datetime.now(UTC)
        db.commit()
        return RefundReviewResponse(
            refund_id=refund.id,
            status=refund.status,
            provider_refund_id=refund.provider_refund_id,
        )

    invoice = db.get(Invoice, payment.invoice_id)
    subscription = (
        db.get(Subscription, invoice.subscription_id)
        if invoice is not None and invoice.subscription_id
        else None
    )
    if subscription is None or not subscription.provider_subscription_id:
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="billing.subscription_provider_unavailable",
        )
    try:
        provider = get_payment_provider()
        provider.cancel(subscription.provider_subscription_id, at_period_end=True)
    except PaymentProviderUnavailable as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="billing.payment_unavailable",
        ) from error
    except PaymentProviderError as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="billing.subscription_update_failed",
        ) from error
    subscription.cancel_at_period_end = True
    subscription.pending_plan = None
    subscription.pending_amount_minor = None
    db.commit()

    try:
        result = provider.refund(
            payment.provider_payment_id,
            refund.amount_minor,
            refund.currency,
            idempotency_key=refund.id,
        )
    except PaymentProviderUnavailable as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="billing.payment_unavailable",
        ) from error
    except PaymentProviderError as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="billing.refund_failed",
        ) from error
    if (
        not result.provider_refund_id
        or result.amount_minor != refund.amount_minor
        or result.currency != refund.currency
        or result.status not in {"pending", "succeeded"}
    ):
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="billing.refund_provider_response_invalid",
        )
    refund.provider_refund_id = result.provider_refund_id
    refund.status = result.status
    if result.status == "succeeded":
        refund.processed_at = datetime.now(UTC)
        payment.status = "refunded"
    db.commit()
    return RefundReviewResponse(
        refund_id=refund.id,
        status=refund.status,
        provider_refund_id=refund.provider_refund_id,
    )


@router.post("/checkout", response_model=CheckoutCreateResponse)
def create_checkout(
    payload: CheckoutCreateRequest,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> CheckoutCreateResponse:
    if user.role != "tadbirkor":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="billing.owner_required",
        )
    if payload.billing_period != "weekly":
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail={
                "code": "billing.placeholder_price",
                "marker": "TODO(DECISION D1)",
            },
        )
    if (
        db.query(Subscription)
        .filter(
            Subscription.user_id == user.id,
            Subscription.status.in_(("active", "past_due")),
        )
        .first()
        is not None
    ):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="billing.subscription_already_active",
        )

    try:
        provider = get_payment_provider()
    except PaymentProviderUnavailable as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="billing.payment_unavailable",
        ) from error

    settings = get_settings()
    if settings.environment in {"prod", "production"} and not settings.nextauth_url:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="billing.return_url_unconfigured",
        )
    base_url = settings.nextauth_url or "http://localhost:3000"
    amount_minor = _weekly_price_minor_units(payload.plan)
    subscription_id = str(uuid4())
    invoice_id = str(uuid4())
    subscription = Subscription(
        id=subscription_id,
        user_id=user.id,
        plan=payload.plan,
        status="incomplete",
        billing_period=payload.billing_period,
        amount_minor=amount_minor,
        currency="USD",
        provider=provider.name,
    )
    invoice = Invoice(
        id=invoice_id,
        user_id=user.id,
        subscription_id=subscription.id,
        invoice_number=f"INV-{uuid4().hex[:16].upper()}",
        amount_minor=amount_minor,
        currency="USD",
        status="open",
    )
    db.add_all((subscription, invoice))
    try:
        db.flush()
        checkout = provider.create_checkout(
            ProviderCheckoutRequest(
                user_id=user.id,
                invoice_id=invoice.id,
                amount_minor=invoice.amount_minor,
                currency=invoice.currency,
                success_url=_checkout_return_url(
                    base_url, payload.locale, "success", invoice.id
                ),
                cancel_url=_checkout_return_url(
                    base_url, payload.locale, "cancel", invoice.id
                ),
            )
        )
        invoice.provider_checkout_id = checkout.checkout_id
        db.commit()
    except PaymentProviderError as error:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="billing.payment_provider_error",
        ) from error
    except SQLAlchemyError as error:
        db.rollback()
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="billing.checkout_save_failed",
        ) from error

    return CheckoutCreateResponse(
        subscription_id=subscription.id,
        invoice_id=invoice.id,
        amount_minor=amount_minor,
        currency="USD",
        checkout_url=checkout.checkout_url,
    )
