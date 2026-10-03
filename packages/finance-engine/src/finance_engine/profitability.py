from dataclasses import dataclass
from decimal import Decimal

from finance_engine.money import ONE_HUNDRED, ZERO, validate_non_negative


@dataclass(frozen=True)
class BreakEvenResult:
    break_even_revenue: Decimal
    contribution_margin_ratio: Decimal
    formula: str
    inputs: dict[str, str]


@dataclass(frozen=True)
class PaybackResult:
    months_to_payback: Decimal | None
    formula: str
    inputs: dict[str, str]


@dataclass(frozen=True)
class DscrResult:
    dscr: Decimal
    formula: str
    inputs: dict[str, str]


@dataclass(frozen=True)
class ReverseRevenueResult:
    required_revenue: Decimal
    contribution_margin_ratio: Decimal
    formula: str
    inputs: dict[str, str]


def break_even(
    fixed_costs: Decimal, variable_cost_ratio_percent: Decimal
) -> BreakEvenResult:
    validate_non_negative("fixed_costs", fixed_costs)
    validate_non_negative("variable_cost_ratio_percent", variable_cost_ratio_percent)
    if variable_cost_ratio_percent >= ONE_HUNDRED:
        raise ValueError("variable_cost_ratio_percent must be less than 100")
    contribution_margin = Decimal(1) - variable_cost_ratio_percent / ONE_HUNDRED
    revenue = fixed_costs / contribution_margin
    return BreakEvenResult(
        break_even_revenue=revenue,
        contribution_margin_ratio=contribution_margin,
        formula="break_even_revenue = fixed_costs / (1 - variable_cost_ratio)",
        inputs={
            "fixed_costs": format(fixed_costs, "f"),
            "variable_cost_ratio_percent": format(variable_cost_ratio_percent, "f"),
        },
    )


def payback_period(
    initial_investment: Decimal, monthly_net_cash_flow: Decimal
) -> PaybackResult:
    validate_non_negative("initial_investment", initial_investment)
    if not monthly_net_cash_flow.is_finite():
        raise ValueError("monthly_net_cash_flow must be finite")
    if initial_investment == ZERO:
        months: Decimal | None = ZERO
    elif monthly_net_cash_flow <= ZERO:
        months = None
    else:
        months = initial_investment / monthly_net_cash_flow
    return PaybackResult(
        months_to_payback=months,
        formula="payback_months = initial_investment / positive_monthly_net_cash_flow",
        inputs={
            "initial_investment": format(initial_investment, "f"),
            "monthly_net_cash_flow": format(monthly_net_cash_flow, "f"),
        },
    )


def debt_service_coverage_ratio(
    annual_operating_cash_flow: Decimal, annual_debt_service: Decimal
) -> DscrResult:
    if not annual_operating_cash_flow.is_finite():
        raise ValueError("annual_operating_cash_flow must be finite")
    validate_non_negative("annual_debt_service", annual_debt_service)
    if annual_debt_service == ZERO:
        raise ValueError("annual_debt_service must be greater than zero")
    return DscrResult(
        dscr=annual_operating_cash_flow / annual_debt_service,
        formula="DSCR = annual_operating_cash_flow / annual_debt_service",
        inputs={
            "annual_operating_cash_flow": format(annual_operating_cash_flow, "f"),
            "annual_debt_service": format(annual_debt_service, "f"),
        },
    )


def revenue_for_target_profit(
    target_profit: Decimal, fixed_costs: Decimal, variable_cost_ratio_percent: Decimal
) -> ReverseRevenueResult:
    if not target_profit.is_finite():
        raise ValueError("target_profit must be finite")
    validate_non_negative("fixed_costs", fixed_costs)
    validate_non_negative("variable_cost_ratio_percent", variable_cost_ratio_percent)
    if variable_cost_ratio_percent >= ONE_HUNDRED:
        raise ValueError("variable_cost_ratio_percent must be less than 100")
    contribution_margin = Decimal(1) - variable_cost_ratio_percent / ONE_HUNDRED
    numerator = fixed_costs + target_profit
    if numerator < ZERO:
        raise ValueError("target_profit cannot be lower than negative fixed_costs")
    return ReverseRevenueResult(
        required_revenue=numerator / contribution_margin,
        contribution_margin_ratio=contribution_margin,
        formula="required_revenue = (fixed_costs + target_profit) / "
        "(1 - variable_cost_ratio)",
        inputs={
            "target_profit": format(target_profit, "f"),
            "fixed_costs": format(fixed_costs, "f"),
            "variable_cost_ratio_percent": format(variable_cost_ratio_percent, "f"),
        },
    )
