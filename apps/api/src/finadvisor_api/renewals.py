from collections.abc import Callable
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from uuid import uuid4

from finance_engine.money import minor_units_to_decimal_string
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from finadvisor_api.database import SessionLocal
from finadvisor_api.email_sender import send_payment_retry_email
from finadvisor_api.models import Invoice, Payment, Subscription, User
from finadvisor_api.payment_provider import (
    PaymentProvider,
    RenewalChargeRequest,
    get_payment_provider,
)

RETRY_DAYS = (1, 3, 5)
GRACE_DAYS = 7
_UTC = UTC


@dataclass(frozen=True)
class RenewalRunResult:
    invoices_created: int
    payment_attempts_started: int
    retry_emails_sent: int
    subscriptions_downgraded: int


def _as_utc(value: datetime) -> datetime:
    if value.tzinfo is None:
        return value.replace(tzinfo=_UTC)
    return value.astimezone(_UTC)


def _expire_subscription(db: Session, subscription: Subscription) -> None:
    subscription.status = "expired"
    user = db.get(User, subscription.user_id)
    if user is not None:
        user.subscription_plan = "free"
    for invoice in (
        db.query(Invoice)
        .filter_by(subscription_id=subscription.id, status="open")
        .all()
    ):
        invoice.status = "uncollectible"
    db.commit()


def _create_due_invoices(db: Session, now: datetime) -> int:
    created = 0
    subscriptions = (
        db.query(Subscription)
        .filter(
            Subscription.status == "active",
            Subscription.billing_period == "weekly",
            Subscription.current_period_end.is_not(None),
        )
        .all()
    )
    for subscription in subscriptions:
        period_start = _as_utc(subscription.current_period_end)
        if period_start > now:
            continue
        if subscription.cancel_at_period_end:
            _expire_subscription(db, subscription)
            continue

        invoice_number = (
            f"REN-{subscription.id}-{period_start.strftime('%Y%m%d%H%M%S')}"
        )
        invoice = (
            db.query(Invoice)
            .filter_by(user_id=subscription.user_id, invoice_number=invoice_number)
            .one_or_none()
        )
        if invoice is not None:
            continue
        invoice = Invoice(
            id=str(uuid4()),
            user_id=subscription.user_id,
            subscription_id=subscription.id,
            invoice_number=invoice_number,
            amount_minor=(
                subscription.pending_amount_minor
                if subscription.pending_amount_minor is not None
                else subscription.amount_minor
            ),
            currency=subscription.currency,
            status="open",
            period_start=period_start,
            period_end=period_start + timedelta(days=7),
            due_at=period_start,
        )
        db.add(invoice)
        try:
            db.commit()
        except IntegrityError:
            db.rollback()
            if (
                db.query(Invoice)
                .filter_by(
                    user_id=subscription.user_id,
                    invoice_number=invoice_number,
                )
                .one_or_none()
                is None
            ):
                raise
        else:
            created += 1
    return created


def _get_or_create_attempt(
    db: Session,
    invoice: Invoice,
    subscription: Subscription,
    attempt_number: int,
    now: datetime,
    provider: PaymentProvider,
) -> tuple[Payment, bool]:
    attempt = (
        db.query(Payment)
        .filter_by(invoice_id=invoice.id, attempt_number=attempt_number)
        .one_or_none()
    )
    if attempt is not None:
        return attempt, False
    attempt = Payment(
        id=str(uuid4()),
        invoice_id=invoice.id,
        user_id=invoice.user_id,
        provider=provider.name,
        amount_minor=invoice.amount_minor,
        currency=invoice.currency,
        status="pending",
        attempt_number=attempt_number,
        created_at=now,
    )
    db.add(attempt)
    try:
        db.commit()
    except IntegrityError:
        db.rollback()
        existing = (
            db.query(Payment)
            .filter_by(invoice_id=invoice.id, attempt_number=attempt_number)
            .one_or_none()
        )
        if existing is None:
            raise
        return existing, False
    return attempt, True


def _start_or_resume_attempt(
    db: Session,
    invoice: Invoice,
    subscription: Subscription,
    attempt: Payment,
    now: datetime,
    provider: PaymentProvider,
    send_retry_email: Callable[[str, str, str, str], None],
) -> tuple[bool, bool]:
    if attempt.status != "pending":
        return False, False
    if subscription.provider and subscription.provider != provider.name:
        raise ValueError("Renewal provider does not match the subscription provider")
    charge_started = False
    if attempt.provider_payment_id is None:
        result = provider.charge_renewal(
            RenewalChargeRequest(
                user_id=invoice.user_id,
                subscription_id=subscription.id,
                invoice_id=invoice.id,
                amount_minor=invoice.amount_minor,
                currency=invoice.currency,
                idempotency_key=attempt.id,
            )
        )
        attempt.provider_payment_id = result.provider_payment_id
        db.commit()
        charge_started = True

    email_sent = False
    if (
        attempt.attempt_number
        and attempt.attempt_number > 1
        and attempt.retry_email_sent_at is None
    ):
        user = db.get(User, invoice.user_id)
        if user is None:
            raise RuntimeError("Renewal invoice references a missing user")
        send_retry_email(
            user.email,
            user.locale,
            minor_units_to_decimal_string(invoice.amount_minor),
            invoice.currency,
        )
        attempt.retry_email_sent_at = now
        db.commit()
        email_sent = True
    return charge_started, email_sent


def run_renewals(
    db: Session,
    *,
    now: datetime,
    provider: PaymentProvider,
    send_retry_email: Callable[[str, str, str, str], None] = send_payment_retry_email,
) -> RenewalRunResult:
    if now.tzinfo is None:
        raise ValueError("Renewal job clock must be timezone-aware")
    now = _as_utc(now)
    invoices_created = _create_due_invoices(db, now)
    attempts_started = 0
    emails_sent = 0
    downgraded = 0

    invoices = (
        db.query(Invoice)
        .join(Subscription, Invoice.subscription_id == Subscription.id)
        .filter(
            Invoice.status == "open",
            Subscription.status.in_(("active", "past_due")),
            Subscription.billing_period == "weekly",
        )
        .all()
    )
    for invoice in invoices:
        if invoice.due_at is not None and _as_utc(invoice.due_at) > now:
            continue
        subscription = db.get(Subscription, invoice.subscription_id)
        if subscription is None:
            continue
        attempts = (
            db.query(Payment)
            .filter(
                Payment.invoice_id == invoice.id,
                Payment.attempt_number.is_not(None),
            )
            .order_by(Payment.attempt_number)
            .all()
        )
        pending_attempt = next(
            (attempt for attempt in reversed(attempts) if attempt.status == "pending"),
            None,
        )
        if pending_attempt is not None:
            started, emailed = _start_or_resume_attempt(
                db,
                invoice,
                subscription,
                pending_attempt,
                now,
                provider,
                send_retry_email,
            )
            attempts_started += int(started)
            emails_sent += int(emailed)
            continue

        failed_attempts = [attempt for attempt in attempts if attempt.status == "failed"]
        if not failed_attempts:
            attempt, _created = _get_or_create_attempt(
                db, invoice, subscription, 1, now, provider
            )
            started, emailed = _start_or_resume_attempt(
                db,
                invoice,
                subscription,
                attempt,
                now,
                provider,
                send_retry_email,
            )
            attempts_started += int(started)
            emails_sent += int(emailed)
            continue

        first_failure = min(
            _as_utc(attempt.failed_at or attempt.created_at)
            for attempt in failed_attempts
        )
        if now >= first_failure + timedelta(days=GRACE_DAYS):
            _expire_subscription(db, subscription)
            downgraded += 1
            continue

        failure_count = len(failed_attempts)
        if failure_count > len(RETRY_DAYS):
            continue
        retry_at = first_failure + timedelta(days=RETRY_DAYS[failure_count - 1])
        if now < retry_at:
            continue
        attempt, _created = _get_or_create_attempt(
            db, invoice, subscription, failure_count + 1, now, provider
        )
        started, emailed = _start_or_resume_attempt(
            db,
            invoice,
            subscription,
            attempt,
            now,
            provider,
            send_retry_email,
        )
        attempts_started += int(started)
        emails_sent += int(emailed)

    return RenewalRunResult(
        invoices_created=invoices_created,
        payment_attempts_started=attempts_started,
        retry_emails_sent=emails_sent,
        subscriptions_downgraded=downgraded,
    )


def main() -> None:
    provider = get_payment_provider()
    with SessionLocal() as db:
        result = run_renewals(db, now=datetime.now(UTC), provider=provider)
    print(
        "Renewals complete: "
        f"invoices={result.invoices_created}, "
        f"attempts={result.payment_attempts_started}, "
        f"retry_emails={result.retry_emails_sent}, "
        f"downgraded={result.subscriptions_downgraded}"
    )


if __name__ == "__main__":
    main()
