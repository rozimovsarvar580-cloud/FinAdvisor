
from fastapi import APIRouter, HTTPException, status
from finance_engine.operations import CapexItem, StaffPosition
from finance_engine.restaurant import RestaurantProjection, calculate_restaurant_projection
from pydantic import ValidationError

from finadvisor_api.ai_client import AIClientError, generate
from finadvisor_api.plan_schemas import (
    GeneratedPlanContent,
    PlanCalculations,
    PlanGenerateRequest,
    PlanGenerateResponse,
)

router = APIRouter(prefix="/plans", tags=["plans"])

PLAN_PROMPT = """Write a concise, bank-oriented restaurant business plan in the requested language.
Use only the supplied business descriptions and the prepared finance-engine results.
Do not calculate, estimate, change, round, or invent any financial value or percentage.
Do not introduce numeric financial claims that are not present in the prepared calculations.
If a requested detail is missing, state that it was not supplied instead of guessing.
Return valid JSON only, matching {"summary": "string", "sections": [{"title": "string", "content": "string"}]}.
"""


def _format_calculations(projection: RestaurantProjection) -> PlanCalculations:
    result = projection
    return PlanCalculations(
        monthly_revenue=format(result.monthly_revenue, "f"),
        monthly_payroll=format(result.monthly_payroll.monthly_payroll, "f"),
        startup_capex=format(result.startup_capex.total_cost, "f"),
        total_startup_cost=format(result.total_startup_cost, "f"),
        monthly_fixed_costs=format(result.monthly_fixed_costs, "f"),
        monthly_variable_cost=format(result.monthly_variable_cost, "f"),
        monthly_operating_profit=format(result.monthly_operating_profit, "f"),
        annual_operating_profit=format(result.annual_operating_profit, "f"),
        break_even_revenue=format(result.break_even.break_even_revenue, "f"),
        target_monthly_revenue=format(result.target_revenue.required_revenue, "f"),
        loan_first_payment=(
            format(result.loan_schedule.monthly_payment, "f")
            if result.loan_schedule is not None
            else None
        ),
        loan_total_payment=(
            format(result.loan_schedule.total_payment, "f")
            if result.loan_schedule is not None
            else None
        ),
        loan_total_interest=(
            format(result.loan_schedule.total_interest, "f")
            if result.loan_schedule is not None
            else None
        ),
        loan_term_months=(
            result.loan_schedule.term_months
            if result.loan_schedule is not None
            else None
        ),
        annual_debt_service=(
            format(result.annual_debt_service, "f")
            if result.annual_debt_service is not None
            else None
        ),
        dscr=format(result.dscr.dscr, "f") if result.dscr is not None else None,
    )


@router.post("/generate", response_model=PlanGenerateResponse)
async def generate_plan(payload: PlanGenerateRequest) -> PlanGenerateResponse:
    try:
        projection = calculate_restaurant_projection(
            average_check=payload.average_check,
            daily_customers=payload.daily_customers,
            operating_days_per_month=payload.operating_days_per_month,
            monthly_rent=payload.monthly_rent,
            monthly_utilities=payload.monthly_utilities,
            variable_cost_ratio_percent=payload.variable_cost_ratio_percent,
            staff=[
                StaffPosition(item.role, item.employee_count, item.monthly_salary)
                for item in payload.staff
            ],
            equipment=[
                CapexItem(item.name, item.quantity, item.unit_cost)
                for item in payload.equipment
            ],
            other_startup_cost=payload.other_startup_cost,
            loan_amount=payload.loan_amount,
            annual_interest_rate_percent=payload.annual_interest_rate_percent,
            loan_term_months=payload.loan_term_months,
            target_monthly_profit=payload.target_monthly_profit,
        )
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="plans.invalid_financial_inputs",
        ) from error

    calculations = _format_calculations(projection)
    context: dict[str, object] = {
        "locale": payload.locale,
        "business": {
            "name": payload.business_name,
            "format": payload.restaurant_format,
            "location": payload.location,
            "menu_summary": payload.menu_summary,
        },
        "prepared_finance_engine_results": calculations.model_dump(),
    }
    try:
        raw_content = await generate(PLAN_PROMPT, context)
    except AIClientError as error:
        raise HTTPException(
            status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
            detail="plans.ai_unavailable",
        ) from error

    try:
        generated = GeneratedPlanContent.model_validate_json(raw_content)
    except (ValidationError, ValueError) as error:
        raise HTTPException(
            status_code=status.HTTP_502_BAD_GATEWAY,
            detail="plans.ai_invalid_response",
        ) from error

    return PlanGenerateResponse(
        summary=generated.summary,
        sections=generated.sections,
        calculations=calculations,
    )
