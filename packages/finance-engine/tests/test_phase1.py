from decimal import Decimal

import pytest
from pydantic import ValidationError

from finance_engine import (
    BreakEvenInput,
    CapexInput,
    CapexItem,
    PaybackInput,
    RevenueProfitInput,
    RevenueStream,
    calculate_break_even,
    calculate_capex,
    calculate_payback,
    calculate_revenue_profit,
)


def test_capex_includes_contingency_and_working_capital():
    result = calculate_capex(
        CapexInput(
            items=[CapexItem(name="oven", amount=Decimal(1000))],
            contingency_rate=Decimal(10),
            working_capital=Decimal(250),
        )
    )
    assert result.total_capex == Decimal("1350.00")


def test_revenue_profit_and_zero_revenue_margin():
    result = calculate_revenue_profit(
        RevenueProfitInput(
            streams=[RevenueStream(name="meals", units=Decimal(100), price_per_unit=Decimal(5))],
            variable_cost_rate=Decimal(40),
            fixed_costs=Decimal(100),
        )
    )
    assert result.operating_profit == Decimal("200.00")
    assert result.profit_margin == Decimal("40.00")
    assert calculate_revenue_profit(
        RevenueProfitInput(
            streams=[RevenueStream(name="free", units=Decimal(1), price_per_unit=Decimal(0))]
        )
    ).profit_margin == Decimal("0.00")


def test_break_even_and_invalid_contribution():
    result = calculate_break_even(
        BreakEvenInput(
            fixed_costs=Decimal(1000),
            price_per_unit=Decimal(10),
            variable_cost_per_unit=Decimal(6),
        )
    )
    assert result.break_even_units == Decimal("250.00")
    with pytest.raises(ValidationError):
        BreakEvenInput(fixed_costs=1, price_per_unit=5, variable_cost_per_unit=5)


def test_payback_supports_fractional_period_and_unrecovered_case():
    result = calculate_payback(
        PaybackInput(initial_investment=Decimal(1000), cash_flows=[Decimal(400), Decimal(800)])
    )
    assert result.payback_periods == Decimal("1.75")
    assert calculate_payback(
        PaybackInput(initial_investment=Decimal(1000), cash_flows=[Decimal(300), Decimal(200)])
    ).recovered is False
