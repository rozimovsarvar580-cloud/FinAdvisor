from decimal import Decimal

import pytest

from finance_engine.projections import (
    RevenueProjectionInput,
    calculate_revenue_projection,
)


def projection_input(
    *,
    operating_days_per_week: int = 5,
    operating_days_per_month: int = 22,
    operating_days_per_year: int = 264,
    revenue_sensitivity_percentages: tuple[Decimal, ...] = (
        Decimal(-10),
        Decimal(0),
        Decimal(10),
    ),
    variable_cost_sensitivity_points: tuple[Decimal, ...] = (
        Decimal(-5),
        Decimal(0),
        Decimal(5),
    ),
) -> RevenueProjectionInput:
    return RevenueProjectionInput(
        daily_revenue=Decimal(10000),
        monthly_fixed_costs=Decimal(30000),
        variable_cost_ratio_percent=Decimal(40),
        operating_days_per_week=operating_days_per_week,
        operating_days_per_month=operating_days_per_month,
        operating_days_per_year=operating_days_per_year,
        target_monthly_profit=Decimal(100000000),
        revenue_sensitivity_percentages=revenue_sensitivity_percentages,
        variable_cost_sensitivity_points=variable_cost_sensitivity_points,
    )


def test_revenue_projection_reports_daily_weekly_monthly_and_yearly_values() -> None:
    result = calculate_revenue_projection(projection_input())

    assert (result.daily.revenue, result.daily.operating_profit) == (
        Decimal("10000.00"),
        Decimal("4636.36"),
    )
    assert (result.weekly.revenue, result.weekly.operating_profit) == (
        Decimal("50000.00"),
        Decimal("23181.82"),
    )
    assert (result.monthly.revenue, result.monthly.operating_profit) == (
        Decimal("220000.00"),
        Decimal("102000.00"),
    )
    assert (result.yearly.revenue, result.yearly.operating_profit) == (
        Decimal("2640000.00"),
        Decimal("1224000.00"),
    )
    assert result.break_even.break_even_revenue == Decimal(50000)
    assert result.target_revenue.required_revenue == Decimal(
        "166716666.6666666666666666667"
    )


def test_sensitivity_table_uses_only_requested_scenarios() -> None:
    result = calculate_revenue_projection(projection_input())

    assert len(result.sensitivity) == 9
    assert result.sensitivity[4].revenue_change_percent == Decimal(0)
    assert result.sensitivity[4].variable_cost_change_points == Decimal(0)
    assert result.sensitivity[4].projected_monthly_profit == Decimal("102000.00")
    assert result.sensitivity[-1].projected_monthly_profit == Decimal("103100.00")


@pytest.mark.parametrize(
    "data",
    [
        projection_input(operating_days_per_week=0),
        projection_input(operating_days_per_month=32),
        projection_input(operating_days_per_year=367),
        projection_input(revenue_sensitivity_percentages=(Decimal(-100),)),
        projection_input(variable_cost_sensitivity_points=(Decimal(60),)),
    ],
)
def test_revenue_projection_rejects_invalid_assumptions(
    data: RevenueProjectionInput,
) -> None:
    with pytest.raises(ValueError):
        calculate_revenue_projection(data)
