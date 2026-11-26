from decimal import Decimal

import pytest

from finance_engine.money import quantize_money
from finance_engine.multi_sector_model import (
    CapacityUtilizationRevenue,
    CapitalExpense,
    CostOfGoods,
    HeadcountCost,
    HourlyServiceRevenue,
    LoanRequest,
    MultiSectorModelInput,
    OperatingExpense,
    ProjectBasedRevenue,
    RecurringRevenue,
    UnitSalesRevenue,
    calculate_multi_sector_model,
)
from finance_engine.restaurant import calculate_restaurant_projection


def test_restaurant_cafe_capacity_model_golden() -> None:
    result = calculate_multi_sector_model(
        MultiSectorModelInput(
            revenue_drivers=(
                CapacityUtilizationRevenue(
                    "dining", Decimal(10), Decimal(2), 30, Decimal(50), Decimal(100)
                ),
            ),
            cost_of_goods=(CostOfGoods("ingredients", "percent_of_revenue", Decimal(30)),),
            operating_expenses=(OperatingExpense("rent", Decimal(10000)),),
            headcount=(HeadcountCost("cook", 2, Decimal(2000)),),
        )
    )

    first_month = result.monthly_profit_and_loss[0]
    assert first_month.revenue == Decimal("30000.00")
    assert first_month.cost_of_goods == Decimal("9000.00")
    assert first_month.operating_profit == Decimal("7000.00")
    assert result.break_even.monthly_break_even_revenue == Decimal("20000.00")
    assert len(result.monthly_cash_flow) == 12


def test_retail_unit_sales_supports_unit_cogs_and_startup_cash_golden() -> None:
    result = calculate_multi_sector_model(
        MultiSectorModelInput(
            revenue_drivers=(UnitSalesRevenue("goods", Decimal(100), Decimal(50)),),
            cost_of_goods=(CostOfGoods("stock", "per_unit", Decimal(20), Decimal(100)),),
            capital_expenses=(CapitalExpense("shelves", 2, Decimal(500)),),
            working_capital=Decimal(1000),
        )
    )

    assert result.monthly_profit_and_loss[0].revenue == Decimal("5000.00")
    assert result.monthly_profit_and_loss[0].cost_of_goods == Decimal("2000.00")
    assert result.monthly_cash_flow[0].capital_expenses == Decimal("1000.00")
    assert result.monthly_cash_flow[0].working_capital == Decimal("1000.00")
    assert result.monthly_cash_flow[0].closing_cash == Decimal("1000.00")


def test_service_and_recurring_models_apply_utilization_churn_and_seasonality() -> None:
    seasonality = (Decimal(1), Decimal("0.5")) + (Decimal(1),) * 10
    result = calculate_multi_sector_model(
        MultiSectorModelInput(
            revenue_drivers=(
                HourlyServiceRevenue("consulting", Decimal(100), Decimal(20), Decimal(50)),
                RecurringRevenue(
                    "memberships",
                    Decimal(10),
                    Decimal(100),
                    Decimal(10),
                    Decimal(2),
                ),
            ),
            seasonality=seasonality,
        )
    )

    assert result.monthly_revenue_by_stream["consulting"][:2] == (
        Decimal("1000.00"),
        Decimal("500.00"),
    )
    assert result.monthly_revenue_by_stream["memberships"][:3] == (
        Decimal("1000.00"),
        Decimal("550.00"),
        Decimal("1190.00"),
    )


def test_project_based_model_loads_tax_rules_and_checks_loan_fit() -> None:
    result = calculate_multi_sector_model(
        MultiSectorModelInput(
            revenue_drivers=(
                ProjectBasedRevenue("projects", Decimal(10), Decimal(1000), Decimal(50)),
            ),
            operating_expenses=(OperatingExpense("tools", Decimal(1000)),),
            tax_regime="turnover_tax",
            loan=LoanRequest(Decimal(1000), Decimal(0), 12),
        )
    )

    assert result.monthly_profit_and_loss[0].revenue == Decimal("5000.00")
    assert result.tax is not None
    assert result.tax.tax_amount == Decimal("2400.00")
    assert result.monthly_profit_and_loss[0].taxes == Decimal("200.00")
    assert result.loan_fit is not None and result.loan_fit.affordable
    assert result.monthly_cash_flow[0].loan_proceeds == Decimal("1000.00")


def test_monthly_tax_allocations_reconcile_to_annual_tax() -> None:
    result = calculate_multi_sector_model(
        MultiSectorModelInput(
            revenue_drivers=(UnitSalesRevenue("sales", Decimal(10), Decimal(100)),),
            operating_expenses=(OperatingExpense("rent", Decimal(100)),),
            tax_regime="profit_tax",
        )
    )

    assert result.tax is not None
    assert sum((row.taxes for row in result.monthly_profit_and_loss), Decimal(0)) == (
        quantize_money(result.tax.tax_amount)
    )


def test_model_rejects_bad_seasonality_and_cogs() -> None:
    with pytest.raises(ValueError, match="12 monthly"):
        calculate_multi_sector_model(
            MultiSectorModelInput(
                revenue_drivers=(UnitSalesRevenue("sales", Decimal(1), Decimal(1)),),
                seasonality=(Decimal(1),),
            )
        )
    with pytest.raises(ValueError, match="required for per_unit"):
        calculate_multi_sector_model(
            MultiSectorModelInput(
                revenue_drivers=(UnitSalesRevenue("sales", Decimal(1), Decimal(1)),),
                cost_of_goods=(CostOfGoods("stock", "per_unit", Decimal(1)),),
            )
        )


def test_invalid_tax_regime_and_impossible_loan_are_explicit() -> None:
    with pytest.raises(ValueError, match="Unknown tax regime"):
        calculate_multi_sector_model(
            MultiSectorModelInput(
                revenue_drivers=(UnitSalesRevenue("sales", Decimal(1), Decimal(1)),),
                tax_regime="invented_regime",
            )
        )
    result = calculate_multi_sector_model(
        MultiSectorModelInput(
            revenue_drivers=(UnitSalesRevenue("sales", Decimal(1), Decimal(1)),),
            loan=LoanRequest(Decimal(10000), Decimal(0), 12),
        )
    )
    assert result.loan_fit is not None and not result.loan_fit.affordable


def test_existing_restaurant_projection_results_remain_unchanged() -> None:
    result = calculate_restaurant_projection(
        average_check=Decimal(100),
        daily_customers=20,
        operating_days_per_month=30,
        monthly_rent=Decimal(10000),
        monthly_utilities=Decimal(1000),
        variable_cost_ratio_percent=Decimal(30),
        staff=[],
        equipment=[],
        other_startup_cost=Decimal(0),
        loan_amount=Decimal(0),
        annual_interest_rate_percent=Decimal(0),
        loan_term_months=0,
        target_monthly_profit=Decimal(0),
    )

    assert result.monthly_revenue == Decimal("60000.00")
    assert result.monthly_operating_profit == Decimal("31000.00")
