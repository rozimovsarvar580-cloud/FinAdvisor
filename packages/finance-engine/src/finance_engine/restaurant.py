from dataclasses import dataclass
from decimal import Decimal

from finance_engine.loans import LoanSchedule, annuity_schedule
from finance_engine.money import ONE_HUNDRED, ZERO, quantize_money, validate_non_negative
from finance_engine.operations import (
    CapexEstimate,
    CapexItem,
    PayrollEstimate,
    StaffPosition,
    estimate_capex,
    estimate_payroll,
)
from finance_engine.profitability import (
    BreakEvenResult,
    DscrResult,
    ReverseRevenueResult,
    break_even,
    debt_service_coverage_ratio,
    revenue_for_target_profit,
)


@dataclass(frozen=True)
class RestaurantProjection:
    monthly_revenue: Decimal
    monthly_payroll: PayrollEstimate
    startup_capex: CapexEstimate
    other_startup_cost: Decimal
    total_startup_cost: Decimal
    monthly_fixed_costs: Decimal
    monthly_variable_cost: Decimal
    monthly_operating_profit: Decimal
    annual_operating_profit: Decimal
    break_even: BreakEvenResult
    target_revenue: ReverseRevenueResult
    loan_schedule: LoanSchedule | None
    annual_debt_service: Decimal | None
    dscr: DscrResult | None
    formula: str
    inputs: dict[str, str]


def calculate_restaurant_projection(
    *,
    average_check: Decimal,
    daily_customers: int,
    operating_days_per_month: int,
    monthly_rent: Decimal,
    monthly_utilities: Decimal,
    variable_cost_ratio_percent: Decimal,
    staff: list[StaffPosition],
    equipment: list[CapexItem],
    other_startup_cost: Decimal,
    loan_amount: Decimal,
    annual_interest_rate_percent: Decimal,
    loan_term_months: int,
    target_monthly_profit: Decimal,
) -> RestaurantProjection:
    validate_non_negative("average_check", average_check)
    validate_non_negative("monthly_rent", monthly_rent)
    validate_non_negative("monthly_utilities", monthly_utilities)
    validate_non_negative("variable_cost_ratio_percent", variable_cost_ratio_percent)
    validate_non_negative("other_startup_cost", other_startup_cost)
    validate_non_negative("loan_amount", loan_amount)
    validate_non_negative("annual_interest_rate_percent", annual_interest_rate_percent)
    if daily_customers < 0:
        raise ValueError("daily_customers must not be negative")
    if operating_days_per_month < 1 or operating_days_per_month > 31:
        raise ValueError("operating_days_per_month must be between 1 and 31")
    if variable_cost_ratio_percent >= ONE_HUNDRED:
        raise ValueError("variable_cost_ratio_percent must be less than 100")
    if not target_monthly_profit.is_finite():
        raise ValueError("target_monthly_profit must be finite")

    monthly_revenue = quantize_money(
        average_check * Decimal(daily_customers) * Decimal(operating_days_per_month)
    )
    payroll = estimate_payroll(staff)
    capex = estimate_capex(equipment)
    monthly_fixed_costs = quantize_money(
        monthly_rent + monthly_utilities + payroll.monthly_payroll
    )
    monthly_variable_cost = quantize_money(
        monthly_revenue * variable_cost_ratio_percent / ONE_HUNDRED
    )
    monthly_operating_profit = quantize_money(
        monthly_revenue - monthly_variable_cost - monthly_fixed_costs
    )
    break_even_result = break_even(monthly_fixed_costs, variable_cost_ratio_percent)
    target_revenue = revenue_for_target_profit(
        target_monthly_profit, monthly_fixed_costs, variable_cost_ratio_percent
    )
    total_startup_cost = quantize_money(capex.total_cost + other_startup_cost)

    loan_schedule: LoanSchedule | None = None
    annual_debt_service: Decimal | None = None
    dscr_result: DscrResult | None = None
    if loan_amount > ZERO:
        if loan_term_months <= 0:
            raise ValueError("loan_term_months must be greater than zero for a loan")
        loan_schedule = annuity_schedule(
            loan_amount, annual_interest_rate_percent, loan_term_months
        )
        annual_debt_service = sum(
            (payment.payment for payment in loan_schedule.payments[:12]), start=ZERO
        )
        dscr_result = debt_service_coverage_ratio(
            monthly_operating_profit * Decimal(12), annual_debt_service
        )
    elif loan_term_months < 0:
        raise ValueError("loan_term_months must not be negative")

    return RestaurantProjection(
        monthly_revenue=monthly_revenue,
        monthly_payroll=payroll,
        startup_capex=capex,
        other_startup_cost=other_startup_cost,
        total_startup_cost=total_startup_cost,
        monthly_fixed_costs=monthly_fixed_costs,
        monthly_variable_cost=monthly_variable_cost,
        monthly_operating_profit=monthly_operating_profit,
        annual_operating_profit=quantize_money(monthly_operating_profit * Decimal(12)),
        break_even=break_even_result,
        target_revenue=target_revenue,
        loan_schedule=loan_schedule,
        annual_debt_service=annual_debt_service,
        dscr=dscr_result,
        formula="monthly_revenue = average_check * daily_customers * operating_days; "
        "monthly_profit = revenue - variable_cost - fixed_costs",
        inputs={
            "average_check": format(average_check, "f"),
            "daily_customers": str(daily_customers),
            "operating_days_per_month": str(operating_days_per_month),
            "monthly_rent": format(monthly_rent, "f"),
            "monthly_utilities": format(monthly_utilities, "f"),
            "variable_cost_ratio_percent": format(variable_cost_ratio_percent, "f"),
            "target_monthly_profit": format(target_monthly_profit, "f"),
        },
    )
