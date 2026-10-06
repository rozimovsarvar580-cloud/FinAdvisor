"""Financial calculation primitives for FinAdvisor."""

from dataclasses import dataclass
from decimal import Decimal
from typing import Literal

from .capex import CapexInput, CapexItem, CapexResult, calculate_capex
from .metrics import (
    BreakEvenInput,
    BreakEvenResult,
    PaybackInput,
    PaybackResult,
    calculate_break_even,
    calculate_payback,
)
from .revenue_profit import (
    RevenueProfitInput,
    RevenueProfitResult,
    RevenueStream,
    calculate_revenue_profit,
)

CommissionTier = Literal["first_100m", "next_900m", "above_1b"]


@dataclass(frozen=True)
class CommissionBand:
    tier: CommissionTier
    revenue_portion: Decimal
    rate: Decimal
    commission: Decimal


@dataclass(frozen=True)
class CommissionResult:
    annual_revenue: Decimal
    total_commission: Decimal
    bands: tuple[CommissionBand, ...]


def calculate_progressive_commission(annual_revenue: Decimal) -> CommissionResult:
    if not annual_revenue.is_finite() or annual_revenue < 0:
        raise ValueError("Annual revenue must be a finite, non-negative amount")

    first_limit = Decimal(100000000)
    second_limit = Decimal(1000000000)
    tier_rules: tuple[tuple[CommissionTier, Decimal, Decimal | None, Decimal], ...] = (
        ("first_100m", Decimal(0), first_limit, Decimal("0.04")),
        ("next_900m", first_limit, second_limit, Decimal("0.02")),
        ("above_1b", second_limit, None, Decimal("0.01")),
    )

    bands_list: list[CommissionBand] = []
    for tier, lower_bound, upper_bound, rate in tier_rules:
        if annual_revenue <= lower_bound:
            revenue_portion = Decimal(0)
        elif upper_bound is None:
            revenue_portion = annual_revenue - lower_bound
        else:
            revenue_portion = min(annual_revenue, upper_bound) - lower_bound
        bands_list.append(
            CommissionBand(
                tier=tier,
                revenue_portion=revenue_portion,
                rate=rate,
                commission=revenue_portion * rate,
            )
        )
    bands = tuple(bands_list)

    return CommissionResult(
        annual_revenue=annual_revenue,
        total_commission=sum(
            (band.commission for band in bands),
            start=Decimal(0),
        ),
        bands=bands,
    )


__all__ = [
    "BreakEvenInput",
    "BreakEvenResult",
    "CapexInput",
    "CapexItem",
    "CapexResult",
    "CommissionBand",
    "CommissionResult",
    "CommissionTier",
    "PaybackInput",
    "PaybackResult",
    "RevenueProfitInput",
    "RevenueProfitResult",
    "RevenueStream",
    "calculate_break_even",
    "calculate_capex",
    "calculate_payback",
    "calculate_progressive_commission",
    "calculate_revenue_profit",
]
