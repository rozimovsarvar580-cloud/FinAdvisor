"""Core investment and operating metrics."""

from decimal import ROUND_HALF_UP, Decimal

from pydantic import BaseModel, Field, model_validator


class BreakEvenInput(BaseModel):
    """Assumptions for a unit and revenue break-even calculation."""

    fixed_costs: Decimal = Field(ge=0)
    price_per_unit: Decimal = Field(gt=0)
    variable_cost_per_unit: Decimal = Field(ge=0)

    @model_validator(mode="after")
    def positive_contribution(self) -> "BreakEvenInput":
        if self.price_per_unit <= self.variable_cost_per_unit:
            raise ValueError("price_per_unit must exceed variable_cost_per_unit")
        return self


class BreakEvenResult(BaseModel):
    break_even_units: Decimal
    break_even_revenue: Decimal
    formula: str


def calculate_break_even(data: BreakEvenInput) -> BreakEvenResult:
    contribution = data.price_per_unit - data.variable_cost_per_unit
    units = data.fixed_costs / contribution
    revenue = units * data.price_per_unit
    return BreakEvenResult(
        break_even_units=units.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP),
        break_even_revenue=revenue.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP),
        formula="break_even_units = fixed_costs / (price_per_unit - variable_cost_per_unit)",
    )


class PaybackInput(BaseModel):
    """Initial investment and sequential period cash flows."""

    initial_investment: Decimal = Field(gt=0)
    cash_flows: list[Decimal] = Field(min_length=1)


class PaybackResult(BaseModel):
    payback_periods: Decimal | None
    recovered: bool
    unrecovered_amount: Decimal
    formula: str


def calculate_payback(data: PaybackInput) -> PaybackResult:
    """Return fractional periods to recover an investment, when achievable."""
    remaining = data.initial_investment
    for period, cash_flow in enumerate(data.cash_flows, start=1):
        if cash_flow <= 0:
            continue
        if cash_flow >= remaining:
            payback = Decimal(period - 1) + remaining / cash_flow
            return PaybackResult(
                payback_periods=payback.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP),
                recovered=True,
                unrecovered_amount=Decimal(0),
                formula="payback_periods = completed_periods + remaining_investment / current_period_cash_flow",
            )
        remaining -= cash_flow
    return PaybackResult(
        payback_periods=None,
        recovered=False,
        unrecovered_amount=remaining.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP),
        formula="payback_periods = completed_periods + remaining_investment / current_period_cash_flow",
    )


__all__ = [
    "BreakEvenInput",
    "BreakEvenResult",
    "PaybackInput",
    "PaybackResult",
    "calculate_break_even",
    "calculate_payback",
]
