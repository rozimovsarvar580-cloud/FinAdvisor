from decimal import Decimal

import pytest

from finance_engine.profitability import (
    break_even,
    debt_service_coverage_ratio,
    payback_period,
    revenue_for_target_profit,
)


def test_break_even_uses_contribution_margin() -> None:
    result = break_even(Decimal(600), Decimal(40))

    assert result.break_even_revenue == Decimal(1000)
    assert result.contribution_margin_ratio == Decimal("0.6")
    assert result.formula


def test_break_even_supports_zero_variable_costs_and_rejects_full_ratio() -> None:
    assert break_even(Decimal(600), Decimal(0)).break_even_revenue == Decimal(600)
    with pytest.raises(ValueError):
        break_even(Decimal(600), Decimal(100))


def test_payback_period_handles_nonpositive_cash_flow_and_zero_investment() -> None:
    assert payback_period(Decimal(0), Decimal(-10)).months_to_payback == Decimal(0)
    assert payback_period(Decimal(100), Decimal(0)).months_to_payback is None
    assert payback_period(Decimal(100), Decimal(-10)).months_to_payback is None


def test_dscr_preserves_negative_profitability() -> None:
    result = debt_service_coverage_ratio(Decimal(-50), Decimal(100))

    assert result.dscr == Decimal("-0.5")
    assert result.formula


def test_dscr_rejects_zero_debt_service() -> None:
    with pytest.raises(ValueError):
        debt_service_coverage_ratio(Decimal(100), Decimal(0))


def test_reverse_revenue_calculates_revenue_for_negative_target_profit() -> None:
    result = revenue_for_target_profit(
        Decimal(-100), Decimal(1000), Decimal(20)
    )

    assert result.required_revenue == Decimal(1125)


def test_reverse_revenue_rejects_unreachable_negative_target() -> None:
    with pytest.raises(ValueError):
        revenue_for_target_profit(Decimal(-1001), Decimal(1000), Decimal(0))
