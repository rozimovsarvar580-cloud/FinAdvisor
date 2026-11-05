from decimal import Decimal

import pytest

from finance_engine import (
    RecurringRevenueMinor,
    calculate_cancellation_rate_percent,
    decimal_amount_to_string,
    normalize_recurring_revenue_minor,
    sum_decimal_amounts,
    sum_minor_units,
)


@pytest.mark.parametrize(
    ("period", "weekly", "monthly"),
    [
        ("weekly", 100, 433),
        ("monthly", 277, 1200),
        ("yearly", 231, 1000),
    ],
)
def test_recurring_revenue_normalizes_to_weekly_and_monthly_minor_units(
    period: str, weekly: int, monthly: int
) -> None:
    amount = {"weekly": 100, "monthly": 1200, "yearly": 12000}[period]
    assert normalize_recurring_revenue_minor(amount, period) == RecurringRevenueMinor(
        weekly=weekly, monthly=monthly
    )


def test_recurring_revenue_rejects_invalid_amounts_and_periods() -> None:
    with pytest.raises(ValueError, match="non-negative"):
        normalize_recurring_revenue_minor(-1, "weekly")
    with pytest.raises(TypeError, match="integer"):
        normalize_recurring_revenue_minor(True, "weekly")
    with pytest.raises(ValueError, match="Unsupported"):
        normalize_recurring_revenue_minor(100, "quarterly")  # type: ignore[arg-type]


def test_admin_metric_sums_preserve_exact_money_values() -> None:
    assert sum_minor_units([1, 2, 3]) == 6
    assert sum_decimal_amounts([Decimal("0.1"), Decimal("0.02")]) == Decimal("0.12")
    assert decimal_amount_to_string(Decimal("0.120000")) == "0.12"
    assert decimal_amount_to_string(Decimal(0)) == "0"
    with pytest.raises(ValueError, match="finite and non-negative"):
        sum_decimal_amounts([Decimal("NaN")])


def test_cancellation_rate_uses_the_active_and_canceled_cohort() -> None:
    assert calculate_cancellation_rate_percent(8, 2) == Decimal("20.00")
    assert calculate_cancellation_rate_percent(0, 0) is None
    with pytest.raises(ValueError, match="non-negative"):
        calculate_cancellation_rate_percent(1, -1)
