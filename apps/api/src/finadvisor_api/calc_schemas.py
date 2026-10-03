from decimal import Decimal, InvalidOperation
from typing import Annotated, Literal, TypeAlias

from pydantic import BaseModel, BeforeValidator, ConfigDict, Field


def _parse_decimal_string(value: object) -> Decimal:
    if not isinstance(value, str):
        raise ValueError("Decimal values must be provided as strings")  # noqa: TRY004
    try:
        amount = Decimal(value)
    except InvalidOperation as error:
        raise ValueError("Value must be a valid decimal string") from error
    if not amount.is_finite():
        raise ValueError("Decimal values must be finite")
    return amount


DecimalString: TypeAlias = Annotated[Decimal, BeforeValidator(_parse_decimal_string)]
NonNegativeDecimal: TypeAlias = Annotated[DecimalString, Field(ge=0)]
PercentDecimal: TypeAlias = Annotated[DecimalString, Field(ge=0, lt=100)]
SignedDecimal: TypeAlias = DecimalString


class StrictInput(BaseModel):
    model_config = ConfigDict(strict=True, str_strip_whitespace=True)


class LoanInput(StrictInput):
    principal: NonNegativeDecimal
    annual_interest_rate_percent: NonNegativeDecimal
    term_months: int = Field(gt=0, le=600)


class CapexItemInput(StrictInput):
    name: str = Field(min_length=1, max_length=200)
    quantity: NonNegativeDecimal
    unit_cost: NonNegativeDecimal


class CapexInput(StrictInput):
    items: list[CapexItemInput] = Field(max_length=500)


class StaffPositionInput(StrictInput):
    role: str = Field(min_length=1, max_length=200)
    employee_count: int = Field(ge=0, le=100_000)
    monthly_salary: NonNegativeDecimal


class PayrollInput(StrictInput):
    positions: list[StaffPositionInput] = Field(max_length=500)


class TaxComparisonInput(StrictInput):
    annual_revenue: NonNegativeDecimal
    annual_expenses: NonNegativeDecimal


class BreakEvenInput(StrictInput):
    fixed_costs: NonNegativeDecimal
    variable_cost_ratio_percent: PercentDecimal


class PaybackInput(StrictInput):
    initial_investment: NonNegativeDecimal
    monthly_net_cash_flow: SignedDecimal


class DscrInput(StrictInput):
    annual_operating_cash_flow: SignedDecimal
    annual_debt_service: NonNegativeDecimal


class ReverseRevenueInput(StrictInput):
    target_profit: SignedDecimal
    fixed_costs: NonNegativeDecimal
    variable_cost_ratio_percent: PercentDecimal


class ExplanationResponse(BaseModel):
    formula: str
    inputs: dict[str, str]


class LoanPaymentResponse(BaseModel):
    month: int
    payment: str
    principal: str
    interest: str
    remaining_balance: str


class LoanResultResponse(BaseModel):
    method: Literal["annuity", "differential"]
    principal: str
    annual_interest_rate_percent: str
    term_months: int
    first_payment: str
    total_payment: str
    total_interest: str
    payments: list[LoanPaymentResponse]


class AnnuityResponse(BaseModel):
    calculation_type: Literal["annuity"]
    result: LoanResultResponse
    explanation: ExplanationResponse


class DifferentialResponse(BaseModel):
    calculation_type: Literal["differential"]
    result: LoanResultResponse
    explanation: ExplanationResponse


class CapexLineResponse(BaseModel):
    name: str
    quantity: str
    unit_cost: str
    total_cost: str


class CapexResultResponse(BaseModel):
    items: list[CapexLineResponse]
    total_cost: str


class CapexResponse(BaseModel):
    calculation_type: Literal["capex"]
    result: CapexResultResponse
    explanation: ExplanationResponse


class PayrollPositionResponse(BaseModel):
    role: str
    employee_count: int
    monthly_salary: str
    monthly_payroll: str


class PayrollResultResponse(BaseModel):
    employee_count: int
    monthly_payroll: str
    annual_payroll: str
    positions: list[PayrollPositionResponse]


class PayrollResponse(BaseModel):
    calculation_type: Literal["payroll"]
    result: PayrollResultResponse
    explanation: ExplanationResponse


class TaxRegimeResponse(BaseModel):
    regime: str
    taxable_base: str
    rate: str
    tax_amount: str
    profit_after_tax: str
    source_article: str
    source_name: str
    source_url: str
    effective_from: str
    published_at: str
    eligibility_note: str


class TaxResultResponse(BaseModel):
    annual_revenue: str
    annual_expenses: str
    pretax_profit: str
    regimes: list[TaxRegimeResponse]


class TaxResponse(BaseModel):
    calculation_type: Literal["tax-comparison"]
    result: TaxResultResponse
    explanation: ExplanationResponse


class BreakEvenResultResponse(BaseModel):
    break_even_revenue: str
    contribution_margin_ratio: str


class BreakEvenResponse(BaseModel):
    calculation_type: Literal["break-even"]
    result: BreakEvenResultResponse
    explanation: ExplanationResponse


class PaybackResultResponse(BaseModel):
    months_to_payback: str | None


class PaybackResponse(BaseModel):
    calculation_type: Literal["payback"]
    result: PaybackResultResponse
    explanation: ExplanationResponse


class DscrResultResponse(BaseModel):
    dscr: str


class DscrResponse(BaseModel):
    calculation_type: Literal["dscr"]
    result: DscrResultResponse
    explanation: ExplanationResponse


class ReverseRevenueResultResponse(BaseModel):
    required_revenue: str
    contribution_margin_ratio: str


class ReverseRevenueResponse(BaseModel):
    calculation_type: Literal["reverse-revenue"]
    result: ReverseRevenueResultResponse
    explanation: ExplanationResponse


CalculationResponse: TypeAlias = Annotated[
    AnnuityResponse
    | DifferentialResponse
    | CapexResponse
    | PayrollResponse
    | TaxResponse
    | BreakEvenResponse
    | PaybackResponse
    | DscrResponse
    | ReverseRevenueResponse,
    Field(discriminator="calculation_type"),
]
