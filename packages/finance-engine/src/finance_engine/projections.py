"""Period-based revenue and profit projections with explicit assumptions."""

from dataclasses import dataclass
from decimal import Decimal

from finance_engine.money import ONE_HUNDRED, quantize_money, validate_non_negative
from finance_engine.profitability import (
    BreakEvenResult,
    ReverseRevenueResult,
    break_even,
    revenue_for_target_profit,
)


@dataclass(frozen=True)
class RevenueProjectionInput:
    daily_revenue: Decimal
    monthly_fixed_costs: Decimal
    variable_cost_ratio_percent: Decimal
    operating_days_per_week: int
    operating_days_per_month: int
    operating_days_per_year: int
    target_monthly_profit: Decimal
    revenue_sensitivity_percentages: tuple[Decimal, ...]
    variable_cost_sensitivity_points: tuple[Decimal, ...]


@dataclass(frozen=True)
class PeriodProjection:
    operating_days: int
    revenue: Decimal
    variable_costs: Decimal
    fixed_costs: Decimal
    operating_profit: Decimal


@dataclass(frozen=True)
class SensitivityScenario:
    revenue_change_percent: Decimal
    variable_cost_change_points: Decimal
    projected_monthly_profit: Decimal


@dataclass(frozen=True)
class RevenueProjectionResult:
    daily: PeriodProjection
    weekly: PeriodProjection
    monthly: PeriodProjection
    yearly: PeriodProjection
    break_even: BreakEvenResult
    target_revenue: ReverseRevenueResult
    sensitivity: tuple[SensitivityScenario, ...]
    formula: str
    inputs: dict[str, str]


def _period_projection(
    daily_revenue: Decimal,
    monthly_fixed_costs: Decimal,
    variable_cost_ratio_percent: Decimal,
    days: int,
    monthly_operating_days: int,
) -> PeriodProjection:
    revenue = daily_revenue * Decimal(days)
    variable_costs = revenue * variable_cost_ratio_percent / ONE_HUNDRED
    fixed_costs = monthly_fixed_costs * Decimal(days) / Decimal(monthly_operating_days)
    return PeriodProjection(
        operating_days=days,
        revenue=quantize_money(revenue),
        variable_costs=quantize_money(variable_costs),
        fixed_costs=quantize_money(fixed_costs),
        operating_profit=quantize_money(revenue - variable_costs - fixed_costs),
    )


def calculate_revenue_projection(
    data: RevenueProjectionInput,
) -> RevenueProjectionResult:
    validate_non_negative("daily_revenue", data.daily_revenue)
    validate_non_negative("monthly_fixed_costs", data.monthly_fixed_costs)
    validate_non_negative(
        "variable_cost_ratio_percent", data.variable_cost_ratio_percent
    )
    if data.variable_cost_ratio_percent >= ONE_HUNDRED:
        raise ValueError("variable_cost_ratio_percent must be less than 100")
    if not data.target_monthly_profit.is_finite():
        raise ValueError("target_monthly_profit must be finite")
    if not 1 <= data.operating_days_per_week <= 7:
        raise ValueError("operating_days_per_week must be between 1 and 7")
    if not 1 <= data.operating_days_per_month <= 31:
        raise ValueError("operating_days_per_month must be between 1 and 31")
    if not 1 <= data.operating_days_per_year <= 366:
        raise ValueError("operating_days_per_year must be between 1 and 366")

    sensitivity: list[SensitivityScenario] = []
    monthly_revenue = data.daily_revenue * Decimal(data.operating_days_per_month)
    for revenue_change in data.revenue_sensitivity_percentages:
        if not revenue_change.is_finite() or revenue_change <= Decimal(-100):
            raise ValueError("revenue sensitivity must be finite and greater than -100%")
        adjusted_revenue = monthly_revenue * (
            Decimal(1) + revenue_change / ONE_HUNDRED
        )
        for variable_change in data.variable_cost_sensitivity_points:
            if not variable_change.is_finite():
                raise ValueError("variable cost sensitivity must be finite")
            adjusted_variable_rate = (
                data.variable_cost_ratio_percent + variable_change
            )
            if adjusted_variable_rate < 0 or adjusted_variable_rate >= ONE_HUNDRED:
                raise ValueError(
                    "sensitivity variable cost ratio must be between 0 and 100"
                )
            variable_costs = adjusted_revenue * adjusted_variable_rate / ONE_HUNDRED
            sensitivity.append(
                SensitivityScenario(
                    revenue_change_percent=revenue_change,
                    variable_cost_change_points=variable_change,
                    projected_monthly_profit=quantize_money(
                        adjusted_revenue
                        - variable_costs
                        - data.monthly_fixed_costs
                    ),
                )
            )

    return RevenueProjectionResult(
        daily=_period_projection(
            data.daily_revenue,
            data.monthly_fixed_costs,
            data.variable_cost_ratio_percent,
            1,
            data.operating_days_per_month,
        ),
        weekly=_period_projection(
            data.daily_revenue,
            data.monthly_fixed_costs,
            data.variable_cost_ratio_percent,
            data.operating_days_per_week,
            data.operating_days_per_month,
        ),
        monthly=_period_projection(
            data.daily_revenue,
            data.monthly_fixed_costs,
            data.variable_cost_ratio_percent,
            data.operating_days_per_month,
            data.operating_days_per_month,
        ),
        yearly=_period_projection(
            data.daily_revenue,
            data.monthly_fixed_costs,
            data.variable_cost_ratio_percent,
            data.operating_days_per_year,
            data.operating_days_per_month,
        ),
        break_even=break_even(
            data.monthly_fixed_costs, data.variable_cost_ratio_percent
        ),
        target_revenue=revenue_for_target_profit(
            data.target_monthly_profit,
            data.monthly_fixed_costs,
            data.variable_cost_ratio_percent,
        ),
        sensitivity=tuple(sensitivity),
        formula=(
            "period_revenue = daily_revenue * operating_days; "
            "fixed_costs = monthly_fixed_costs * operating_days / "
            "operating_days_per_month; operating_profit = revenue - "
            "variable_costs - fixed_costs"
        ),
        inputs={
            "daily_revenue": format(data.daily_revenue, "f"),
            "monthly_fixed_costs": format(data.monthly_fixed_costs, "f"),
            "variable_cost_ratio_percent": format(
                data.variable_cost_ratio_percent, "f"
            ),
            "operating_days_per_week": str(data.operating_days_per_week),
            "operating_days_per_month": str(data.operating_days_per_month),
            "operating_days_per_year": str(data.operating_days_per_year),
            "target_monthly_profit": format(data.target_monthly_profit, "f"),
        },
    )
