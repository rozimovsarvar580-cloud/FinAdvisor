from fastapi import APIRouter, HTTPException, status
from finance_engine.loans import LoanSchedule, annuity_schedule, differential_schedule
from finance_engine.operations import (
    CapexItem,
    StaffPosition,
    estimate_capex,
    estimate_payroll,
)
from finance_engine.profitability import (
    break_even,
    debt_service_coverage_ratio,
    payback_period,
    revenue_for_target_profit,
)
from finance_engine.tax import compare_tax_regimes
from pydantic import BaseModel, ValidationError

from finadvisor_api.calc_schemas import (
    AnnuityResponse,
    BreakEvenInput,
    BreakEvenResponse,
    CalculationResponse,
    CapexInput,
    CapexResponse,
    DifferentialResponse,
    DscrInput,
    DscrResponse,
    ExplanationResponse,
    LoanInput,
    LoanPaymentResponse,
    LoanResultResponse,
    PaybackInput,
    PaybackResponse,
    PayrollInput,
    PayrollResponse,
    ReverseRevenueInput,
    ReverseRevenueResponse,
    TaxComparisonInput,
    TaxResponse,
)

router = APIRouter(prefix="/calc", tags=["calculations"])

INPUT_MODELS: dict[str, type[BaseModel]] = {
    "annuity": LoanInput,
    "differential": LoanInput,
    "capex": CapexInput,
    "payroll": PayrollInput,
    "tax-comparison": TaxComparisonInput,
    "break-even": BreakEvenInput,
    "payback": PaybackInput,
    "dscr": DscrInput,
    "reverse-revenue": ReverseRevenueInput,
}


def _validate_payload(
    calculation_type: str, payload: dict[str, object]
) -> BaseModel:
    model = INPUT_MODELS.get(calculation_type)
    if model is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="calc.unsupported_type",
        )
    try:
        return model.model_validate(payload)
    except ValidationError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail={
                "code": "calc.invalid_input",
                "errors": error.errors(include_input=False, include_context=False),
            },
        ) from error


def _explanation(formula: str, inputs: dict[str, str]) -> ExplanationResponse:
    return ExplanationResponse(formula=formula, inputs=inputs)


def _loan_response(schedule: LoanSchedule) -> LoanResultResponse:
    return LoanResultResponse(
        method=schedule.method,
        principal=format(schedule.principal, "f"),
        annual_interest_rate_percent=format(schedule.annual_interest_rate_percent, "f"),
        term_months=schedule.term_months,
        first_payment=format(schedule.payments[0].payment, "f"),
        total_payment=format(schedule.total_payment, "f"),
        total_interest=format(schedule.total_interest, "f"),
        payments=[
            LoanPaymentResponse(
                month=payment.month,
                payment=format(payment.payment, "f"),
                principal=format(payment.principal, "f"),
                interest=format(payment.interest, "f"),
                remaining_balance=format(payment.remaining_balance, "f"),
            )
            for payment in schedule.payments
        ],
    )


@router.post("/{calculation_type}", response_model=CalculationResponse)
def calculate(
    calculation_type: str, payload: dict[str, object]
) -> CalculationResponse:
    validated = _validate_payload(calculation_type, payload)

    try:
        if calculation_type in {"annuity", "differential"}:
            if not isinstance(validated, LoanInput):
                raise RuntimeError("Calculation input dispatch is inconsistent")
            loan_input = validated
            calculator = (
                annuity_schedule if calculation_type == "annuity" else differential_schedule
            )
            schedule = calculator(
                loan_input.principal,
                loan_input.annual_interest_rate_percent,
                loan_input.term_months,
            )
            response_type = (
                AnnuityResponse if calculation_type == "annuity" else DifferentialResponse
            )
            return response_type(
                calculation_type=calculation_type,
                result=_loan_response(schedule),
                explanation=_explanation(schedule.formula, schedule.inputs),
            )

        if calculation_type == "capex":
            if not isinstance(validated, CapexInput):
                raise RuntimeError("Calculation input dispatch is inconsistent")
            capex_input = validated
            result = estimate_capex(
                [
                    CapexItem(item.name, item.quantity, item.unit_cost)
                    for item in capex_input.items
                ]
            )
            return CapexResponse(
                calculation_type="capex",
                result={
                    "items": [
                        {
                            "name": item.name,
                            "quantity": format(item.quantity, "f"),
                            "unit_cost": format(item.unit_cost, "f"),
                            "total_cost": format(item.total_cost, "f"),
                        }
                        for item in result.items
                    ],
                    "total_cost": format(result.total_cost, "f"),
                },
                explanation=_explanation(result.formula, result.inputs),
            )

        if calculation_type == "payroll":
            if not isinstance(validated, PayrollInput):
                raise RuntimeError("Calculation input dispatch is inconsistent")
            payroll_input = validated
            result = estimate_payroll(
                [
                    StaffPosition(item.role, item.employee_count, item.monthly_salary)
                    for item in payroll_input.positions
                ]
            )
            return PayrollResponse(
                calculation_type="payroll",
                result={
                    "employee_count": result.employee_count,
                    "monthly_payroll": format(result.monthly_payroll, "f"),
                    "annual_payroll": format(result.annual_payroll, "f"),
                    "positions": [
                        {
                            "role": position.role,
                            "employee_count": position.employee_count,
                            "monthly_salary": format(position.monthly_salary, "f"),
                            "monthly_payroll": format(position.monthly_payroll, "f"),
                        }
                        for position in result.positions
                    ],
                },
                explanation=_explanation(result.formula, result.inputs),
            )

        if calculation_type == "tax-comparison":
            if not isinstance(validated, TaxComparisonInput):
                raise RuntimeError("Calculation input dispatch is inconsistent")
            tax_input = validated
            result = compare_tax_regimes(
                tax_input.annual_revenue, tax_input.annual_expenses
            )
            return TaxResponse(
                calculation_type="tax-comparison",
                result={
                    "annual_revenue": format(result.annual_revenue, "f"),
                    "annual_expenses": format(result.annual_expenses, "f"),
                    "pretax_profit": format(result.pretax_profit, "f"),
                    "regimes": [
                        {
                            "regime": regime.regime,
                            "taxable_base": format(regime.taxable_base, "f"),
                            "rate": format(regime.rate, "f"),
                            "tax_amount": format(regime.tax_amount, "f"),
                            "profit_after_tax": format(regime.profit_after_tax, "f"),
                            "source_article": regime.source_article,
                            "source_name": regime.source_name,
                            "source_url": regime.source_url,
                            "effective_from": regime.effective_from,
                            "published_at": regime.published_at,
                            "eligibility_note": regime.eligibility_note,
                        }
                        for regime in result.regimes
                    ],
                },
                explanation=_explanation(result.formula, result.inputs),
            )

        if calculation_type == "break-even":
            if not isinstance(validated, BreakEvenInput):
                raise RuntimeError("Calculation input dispatch is inconsistent")
            break_even_input = validated
            result = break_even(
                break_even_input.fixed_costs,
                break_even_input.variable_cost_ratio_percent,
            )
            return BreakEvenResponse(
                calculation_type="break-even",
                result={
                    "break_even_revenue": format(result.break_even_revenue, "f"),
                    "contribution_margin_ratio": format(
                        result.contribution_margin_ratio, "f"
                    ),
                },
                explanation=_explanation(result.formula, result.inputs),
            )

        if calculation_type == "payback":
            if not isinstance(validated, PaybackInput):
                raise RuntimeError("Calculation input dispatch is inconsistent")
            payback_input = validated
            result = payback_period(
                payback_input.initial_investment,
                payback_input.monthly_net_cash_flow,
            )
            return PaybackResponse(
                calculation_type="payback",
                result={
                    "months_to_payback": (
                        format(result.months_to_payback, "f")
                        if result.months_to_payback is not None
                        else None
                    )
                },
                explanation=_explanation(result.formula, result.inputs),
            )

        if calculation_type == "dscr":
            if not isinstance(validated, DscrInput):
                raise RuntimeError("Calculation input dispatch is inconsistent")
            dscr_input = validated
            result = debt_service_coverage_ratio(
                dscr_input.annual_operating_cash_flow,
                dscr_input.annual_debt_service,
            )
            return DscrResponse(
                calculation_type="dscr",
                result={"dscr": format(result.dscr, "f")},
                explanation=_explanation(result.formula, result.inputs),
            )

        assert isinstance(validated, ReverseRevenueInput)
        reverse_input = validated
        result = revenue_for_target_profit(
            reverse_input.target_profit,
            reverse_input.fixed_costs,
            reverse_input.variable_cost_ratio_percent,
        )
        return ReverseRevenueResponse(
            calculation_type="reverse-revenue",
            result={
                "required_revenue": format(result.required_revenue, "f"),
                "contribution_margin_ratio": format(
                    result.contribution_margin_ratio, "f"
                ),
            },
            explanation=_explanation(result.formula, result.inputs),
        )
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_CONTENT,
            detail="calc.invalid_input",
        ) from error
