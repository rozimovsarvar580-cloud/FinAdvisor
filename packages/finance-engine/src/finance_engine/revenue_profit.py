"""Revenue and operating profit calculations using Decimal arithmetic."""

from decimal import ROUND_HALF_UP, Decimal

from pydantic import BaseModel, Field

CENT = Decimal("0.01")


class RevenueStream(BaseModel):
    """A recurring revenue stream for one period."""

    name: str = Field(min_length=1)
    units: Decimal = Field(gt=0)
    price_per_unit: Decimal = Field(ge=0)


class RevenueProfitInput(BaseModel):
    """Revenue and cost assumptions for one reporting period."""

    streams: list[RevenueStream] = Field(min_length=1)
    fixed_costs: Decimal = Field(default=Decimal(0), ge=0)
    variable_cost_rate: Decimal = Field(default=Decimal(0), ge=0, le=100)
    other_costs: Decimal = Field(default=Decimal(0), ge=0)


class RevenueProfitResult(BaseModel):
    """Auditable revenue, cost, and profit outputs."""

    revenue: Decimal
    variable_costs: Decimal
    fixed_costs: Decimal
    other_costs: Decimal
    total_costs: Decimal
    operating_profit: Decimal
    profit_margin: Decimal
    formula: str


def _money(value: Decimal) -> Decimal:
    return value.quantize(CENT, rounding=ROUND_HALF_UP)


def calculate_revenue_profit(data: RevenueProfitInput) -> RevenueProfitResult:
    """Calculate revenue and operating profit for the supplied period."""
    revenue = sum(
        (stream.units * stream.price_per_unit for stream in data.streams),
        Decimal(0),
    )
    variable_costs = revenue * data.variable_cost_rate / Decimal(100)
    total_costs = variable_costs + data.fixed_costs + data.other_costs
    operating_profit = revenue - total_costs
    margin = (
        operating_profit / revenue * Decimal(100)
        if revenue
        else Decimal(0)
    )
    return RevenueProfitResult(
        revenue=_money(revenue),
        variable_costs=_money(variable_costs),
        fixed_costs=_money(data.fixed_costs),
        other_costs=_money(data.other_costs),
        total_costs=_money(total_costs),
        operating_profit=_money(operating_profit),
        profit_margin=margin.quantize(Decimal("0.01"), rounding=ROUND_HALF_UP),
        formula="operating_profit = revenue - (variable_costs + fixed_costs + other_costs)",
    )


__all__ = [
    "RevenueProfitInput",
    "RevenueProfitResult",
    "RevenueStream",
    "calculate_revenue_profit",
]
