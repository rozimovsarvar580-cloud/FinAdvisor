"""Exact money helpers for administrative subscription reporting."""

from collections.abc import Iterable
from dataclasses import dataclass
from decimal import ROUND_HALF_UP, Decimal
from typing import Literal

BillingPeriod = Literal["weekly", "monthly", "yearly"]


@dataclass(frozen=True)
class RecurringRevenueMinor:
    weekly: int
    monthly: int


def _rounded_minor_units(amount: Decimal) -> int:
    return int(amount.quantize(Decimal(1), rounding=ROUND_HALF_UP))


def normalize_recurring_revenue_minor(
    amount_minor: int, billing_period: BillingPeriod
) -> RecurringRevenueMinor:
    if isinstance(amount_minor, bool) or not isinstance(amount_minor, int):
        raise TypeError("Recurring revenue must be an integer number of minor units")
    if amount_minor < 0:
        raise ValueError("Recurring revenue must be non-negative")

    amount = Decimal(amount_minor)
    if billing_period == "weekly":
        weekly = amount
        monthly = amount * Decimal(52) / Decimal(12)
    elif billing_period == "monthly":
        weekly = amount * Decimal(12) / Decimal(52)
        monthly = amount
    elif billing_period == "yearly":
        weekly = amount / Decimal(52)
        monthly = amount / Decimal(12)
    else:
        raise ValueError("Unsupported billing period")

    return RecurringRevenueMinor(
        weekly=_rounded_minor_units(weekly),
        monthly=_rounded_minor_units(monthly),
    )


def sum_minor_units(amounts: Iterable[int]) -> int:
    total = 0
    for amount in amounts:
        if isinstance(amount, bool) or not isinstance(amount, int):
            raise TypeError("Money amounts must be integers in minor units")
        total += amount
    return total


def sum_decimal_amounts(amounts: Iterable[Decimal]) -> Decimal:
    total = Decimal(0)
    for amount in amounts:
        if not amount.is_finite() or amount < 0:
            raise ValueError("Money amounts must be finite and non-negative")
        total += amount
    return total


def calculate_cancellation_rate_percent(
    active_subscribers: int, canceled_subscribers: int
) -> Decimal | None:
    if active_subscribers < 0 or canceled_subscribers < 0:
        raise ValueError("Subscriber counts must be non-negative")
    cohort_size = active_subscribers + canceled_subscribers
    if cohort_size == 0:
        return None
    return (
        Decimal(canceled_subscribers)
        * Decimal(100)
        / Decimal(cohort_size)
    ).quantize(Decimal("0.01"), rounding=ROUND_HALF_UP)
