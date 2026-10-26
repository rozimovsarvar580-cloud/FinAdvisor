from decimal import Decimal

import pytest

from finance_engine.money import monthly_recurring_minor_units, percentage_rate


@pytest.mark.parametrize(
    ("amount_minor", "period", "expected"),
    [
        (1000, "weekly", 4333),
        (1000, "monthly", 1000),
        (1000, "yearly", 83),
        (0, "weekly", 0),
    ],
)
def test_monthly_recurring_minor_units_normalizes_billing_periods(
    amount_minor: int, period: str, expected: int
) -> None:
    assert monthly_recurring_minor_units(amount_minor, period) == expected


def test_monthly_recurring_minor_units_rejects_invalid_amount_and_period() -> None:
    with pytest.raises(ValueError, match="non-negative"):
        monthly_recurring_minor_units(-1, "weekly")
    with pytest.raises(ValueError, match="Billing period"):
        monthly_recurring_minor_units(100, "daily")
    with pytest.raises(TypeError, match="integer"):
        monthly_recurring_minor_units(True, "weekly")


def test_percentage_rate_uses_decimal_rounding_and_handles_empty_base() -> None:
    assert percentage_rate(1, 3) == Decimal("33.33")
    assert percentage_rate(0, 0) is None
