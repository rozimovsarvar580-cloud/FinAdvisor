from decimal import Decimal

import pytest

from finance_engine import calculate_progressive_commission


@pytest.mark.parametrize(
    ("revenue", "expected"),
    [
        ("0", "0.00"),
        ("100000000", "4000000.00"),
        ("1000000000", "22000000.00"),
        ("1100000000", "23000000.00"),
    ],
)
def test_commission_uses_progressive_tiers(revenue: str, expected: str) -> None:
    result = calculate_progressive_commission(Decimal(revenue))

    assert result.total_commission == Decimal(expected)


def test_commission_breakdown_reports_each_tier_base() -> None:
    result = calculate_progressive_commission(Decimal(1100000000))

    assert [band.revenue_portion for band in result.bands] == [
        Decimal(100000000),
        Decimal(900000000),
        Decimal(100000000),
    ]
    assert [band.rate for band in result.bands] == [
        Decimal("0.04"),
        Decimal("0.02"),
        Decimal("0.01"),
    ]


@pytest.mark.parametrize("revenue", [Decimal(-1), Decimal("NaN"), Decimal("Infinity")])
def test_commission_rejects_negative_or_non_finite_revenue(
    revenue: Decimal,
) -> None:
    with pytest.raises(ValueError):
        calculate_progressive_commission(revenue)
