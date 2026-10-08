"""Capital expenditure models and deterministic calculations."""

from decimal import ROUND_HALF_UP, Decimal

from pydantic import BaseModel, Field

CENT = Decimal("0.01")


class CapexItem(BaseModel):
    """A one-time capital purchase."""

    name: str = Field(min_length=1)
    amount: Decimal = Field(gt=0)


class CapexInput(BaseModel):
    """Inputs for a capital expenditure plan."""

    items: list[CapexItem] = Field(min_length=1)
    working_capital: Decimal = Field(default=Decimal(0), ge=0)
    contingency_rate: Decimal = Field(default=Decimal(0), ge=0, le=100)


class CapexResult(BaseModel):
    """Auditable capital expenditure total."""

    item_total: Decimal
    contingency: Decimal
    working_capital: Decimal
    total_capex: Decimal
    formula: str


def _money(value: Decimal) -> Decimal:
    return value.quantize(CENT, rounding=ROUND_HALF_UP)


def calculate_capex(data: CapexInput) -> CapexResult:
    """Calculate item costs, contingency, and total funding required."""
    item_total = sum((item.amount for item in data.items), Decimal(0))
    contingency = item_total * data.contingency_rate / Decimal(100)
    total = item_total + contingency + data.working_capital
    return CapexResult(
        item_total=_money(item_total),
        contingency=_money(contingency),
        working_capital=_money(data.working_capital),
        total_capex=_money(total),
        formula="total_capex = item_total + (item_total × contingency_rate / 100) + working_capital",
    )


__all__ = ["CapexInput", "CapexItem", "CapexResult", "calculate_capex"]
