from decimal import Decimal

import pytest

from finance_engine.operations import CapexItem, StaffPosition
from finance_engine.restaurant import calculate_restaurant_projection


def test_restaurant_projection_calculates_revenue_costs_and_target() -> None:
    result = calculate_restaurant_projection(
        average_check=Decimal(100),
        daily_customers=20,
        operating_days_per_month=30,
        monthly_rent=Decimal(10000),
        monthly_utilities=Decimal(1000),
        variable_cost_ratio_percent=Decimal(30),
        staff=[StaffPosition("cook", 2, Decimal(2000))],
        equipment=[CapexItem("oven", Decimal(1), Decimal(5000))],
        other_startup_cost=Decimal(1000),
        loan_amount=Decimal(10000),
        annual_interest_rate_percent=Decimal(0),
        loan_term_months=12,
        target_monthly_profit=Decimal(10000),
    )

    assert result.monthly_revenue == Decimal("60000.00")
    assert result.monthly_payroll.monthly_payroll == Decimal("4000.00")
    assert result.startup_capex.total_cost == Decimal("5000.00")
    assert result.monthly_fixed_costs == Decimal("15000.00")
    assert result.monthly_variable_cost == Decimal("18000.00")
    assert result.monthly_operating_profit == Decimal("27000.00")
    assert result.target_revenue.required_revenue == Decimal("35714.28571428571428571428571")
    assert result.dscr is not None
    assert result.formula


def test_restaurant_projection_supports_zero_staff_and_reports_negative_profit() -> None:
    result = calculate_restaurant_projection(
        average_check=Decimal(0),
        daily_customers=0,
        operating_days_per_month=30,
        monthly_rent=Decimal(1000),
        monthly_utilities=Decimal(100),
        variable_cost_ratio_percent=Decimal(0),
        staff=[StaffPosition("cook", 0, Decimal(500))],
        equipment=[],
        other_startup_cost=Decimal(0),
        loan_amount=Decimal(0),
        annual_interest_rate_percent=Decimal(0),
        loan_term_months=0,
        target_monthly_profit=Decimal(-100),
    )

    assert result.monthly_payroll.employee_count == 0
    assert result.monthly_operating_profit == Decimal("-1100.00")
    assert result.dscr is None


def test_restaurant_projection_rejects_impossible_variable_cost_ratio() -> None:
    with pytest.raises(ValueError):
        calculate_restaurant_projection(
            average_check=Decimal(100),
            daily_customers=1,
            operating_days_per_month=30,
            monthly_rent=Decimal(1000),
            monthly_utilities=Decimal(0),
            variable_cost_ratio_percent=Decimal(100),
            staff=[],
            equipment=[],
            other_startup_cost=Decimal(0),
            loan_amount=Decimal(0),
            annual_interest_rate_percent=Decimal(0),
            loan_term_months=0,
            target_monthly_profit=Decimal(0),
        )
