from typing import Literal

from pydantic import Field

from finadvisor_api.calc_schemas import (
    CapexItemInput,
    NonNegativeDecimal,
    PercentDecimal,
    SignedDecimal,
    StaffPositionInput,
    StrictInput,
)


class PlanGenerateRequest(StrictInput):
    locale: Literal["uz", "ru", "en"]
    business_name: str = Field(min_length=1, max_length=200)
    restaurant_format: Literal["cafe", "family", "fast_casual", "fine_dining"]
    location: str = Field(min_length=1, max_length=300)
    seats: int = Field(ge=1, le=10_000)
    menu_summary: str = Field(min_length=1, max_length=5_000)
    average_check: NonNegativeDecimal
    daily_customers: int = Field(ge=0, le=100_000)
    operating_days_per_month: int = Field(ge=1, le=31)
    monthly_rent: NonNegativeDecimal
    monthly_utilities: NonNegativeDecimal
    variable_cost_ratio_percent: PercentDecimal
    staff: list[StaffPositionInput] = Field(max_length=100)
    equipment: list[CapexItemInput] = Field(max_length=200)
    other_startup_cost: NonNegativeDecimal
    loan_amount: NonNegativeDecimal
    annual_interest_rate_percent: NonNegativeDecimal
    loan_term_months: int = Field(ge=0, le=600)
    target_monthly_profit: SignedDecimal


class PlanSection(StrictInput):
    title: str = Field(min_length=1, max_length=200)
    content: str = Field(min_length=1, max_length=10_000)


class GeneratedPlanContent(StrictInput):
    summary: str = Field(min_length=1, max_length=5_000)
    sections: list[PlanSection] = Field(min_length=1, max_length=20)


class PlanCalculations(StrictInput):
    monthly_revenue: str
    monthly_payroll: str
    startup_capex: str
    total_startup_cost: str
    monthly_fixed_costs: str
    monthly_variable_cost: str
    monthly_operating_profit: str
    annual_operating_profit: str
    break_even_revenue: str
    target_monthly_revenue: str
    loan_first_payment: str | None
    loan_total_payment: str | None
    loan_total_interest: str | None
    loan_term_months: int | None
    annual_debt_service: str | None
    dscr: str | None


class PlanGenerateResponse(StrictInput):
    summary: str
    sections: list[PlanSection]
    calculations: PlanCalculations
