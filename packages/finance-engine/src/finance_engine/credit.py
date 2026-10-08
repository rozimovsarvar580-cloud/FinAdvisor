"""Credit schedule calculations using Decimal arithmetic only."""

from decimal import ROUND_HALF_UP, Decimal

from pydantic import BaseModel, Field

CENT = Decimal("0.01")


class CreditInput(BaseModel):
    principal: Decimal = Field(gt=0)
    annual_rate: Decimal = Field(ge=0)
    months: int = Field(gt=0)


class CreditScheduleRow(BaseModel):
    month: int
    payment: Decimal
    principal: Decimal
    interest: Decimal
    balance: Decimal


class ReverseCreditInput(BaseModel):
    monthly_payment: Decimal = Field(gt=0)
    annual_rate: Decimal = Field(ge=0)
    months: int = Field(gt=0)


class ReverseCreditResult(BaseModel):
    principal: Decimal
    formula: str


def _money(value: Decimal) -> Decimal:
    return value.quantize(CENT, rounding=ROUND_HALF_UP)


def annuity_schedule(data: CreditInput) -> list[CreditScheduleRow]:
    """Return an auditable monthly annuity schedule."""
    monthly_rate = data.annual_rate / Decimal(1200)
    if monthly_rate == 0:
        payment = data.principal / data.months
    else:
        factor = (Decimal(1) + monthly_rate) ** data.months
        payment = data.principal * monthly_rate * factor / (factor - Decimal(1))

    balance = data.principal
    rows: list[CreditScheduleRow] = []
    for month in range(1, data.months + 1):
        interest = balance * monthly_rate
        principal = payment - interest
        if month == data.months:
            principal = balance
            payment = principal + interest
        balance = max(Decimal(0), balance - principal)
        rows.append(
            CreditScheduleRow(
                month=month,
                payment=_money(payment),
                principal=_money(principal),
                interest=_money(interest),
                balance=_money(balance),
            )
        )
    return rows


def reverse_annuity(data: ReverseCreditInput) -> ReverseCreditResult:
    """Calculate the principal supported by a fixed monthly payment."""
    monthly_rate = data.annual_rate / Decimal(1200)
    if monthly_rate == 0:
        principal = data.monthly_payment * data.months
    else:
        factor = (Decimal(1) + monthly_rate) ** data.months
        principal = data.monthly_payment * (factor - Decimal(1)) / (monthly_rate * factor)
    return ReverseCreditResult(
        principal=_money(principal),
        formula="principal = payment × ((1 + r)^n - 1) / (r × (1 + r)^n)",
    )
