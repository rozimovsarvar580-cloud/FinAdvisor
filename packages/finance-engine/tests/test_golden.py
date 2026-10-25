from decimal import Decimal

import pytest

from finance_engine import calculate_progressive_commission
from finance_engine.loans import annuity_schedule, differential_schedule
from finance_engine.operations import StaffPosition, estimate_payroll
from finance_engine.profitability import (
    break_even,
    debt_service_coverage_ratio,
    payback_period,
    revenue_for_target_profit,
)
from finance_engine.tax import compare_tax_regimes


@pytest.mark.parametrize(
    ("revenue", "expenses", "turnover_tax", "profit_tax"),
    [
        ("0", "0", "0", "0"),
        ("100000000", "70000000", "4000000", "4500000"),
        ("100", "120", "4", "0"),
        ("150000000", "100000000", "6000000", "7500000"),
    ],
)
def test_tax_golden_vectors(
    revenue: str,
    expenses: str,
    turnover_tax: str,
    profit_tax: str,
) -> None:
    result = compare_tax_regimes(Decimal(revenue), Decimal(expenses))
    regimes = {regime.regime: regime for regime in result.regimes}

    assert result.pretax_profit == Decimal(revenue) - Decimal(expenses)
    assert regimes["turnover_tax"].tax_amount == Decimal(turnover_tax)
    assert regimes["profit_tax"].tax_amount == Decimal(profit_tax)


@pytest.mark.parametrize(
    ("principal", "months"),
    [
        ("1200", 12),
        ("1000", 10),
        ("500", 5),
        ("120", 12),
        ("100", 4),
        ("1", 1),
    ],
)
@pytest.mark.parametrize(
    ("method", "expected_name"),
    [
        (annuity_schedule, "annuity"),
        (differential_schedule, "differential"),
    ],
)
def test_zero_interest_loan_golden_vectors(
    method,
    expected_name: str,
    principal: str,
    months: int,
) -> None:
    amount = Decimal(principal)
    result = method(amount, Decimal(0), months)

    assert result.method == expected_name
    assert result.total_payment == amount.quantize(Decimal("0.01"))
    assert result.total_interest == Decimal("0.00")
    assert result.payments[-1].remaining_balance == Decimal("0.00")
    assert len(result.payments) == months


@pytest.mark.parametrize(
    ("positions", "employees", "monthly", "annual"),
    [
        ([], 0, "0", "0"),
        ([("owner", 1, "1000")], 1, "1000.00", "12000.00"),
        ([("cook", 2, "500"), ("server", 3, "300")], 5, "1900.00", "22800.00"),
        ([("cook", 10, "2000")], 10, "20000.00", "240000.00"),
        (
            [("manager", 1, "1000.33"), ("cashier", 2, "500.25")],
            3,
            "2000.83",
            "24009.96",
        ),
    ],
)
def test_payroll_golden_vectors(
    positions: list[tuple[str, int, str]],
    employees: int,
    monthly: str,
    annual: str,
) -> None:
    result = estimate_payroll(
        [
            StaffPosition(role, count, Decimal(salary))
            for role, count, salary in positions
        ]
    )

    assert result.employee_count == employees
    assert result.monthly_payroll == Decimal(monthly)
    assert result.annual_payroll == Decimal(annual)


@pytest.mark.parametrize(
    ("fixed_costs", "variable_percent", "expected"),
    [
        ("600", "40", "1000"),
        ("0", "0", "0"),
        ("5000", "50", "10000"),
    ],
)
def test_break_even_golden_vectors(
    fixed_costs: str, variable_percent: str, expected: str
) -> None:
    result = break_even(Decimal(fixed_costs), Decimal(variable_percent))

    assert result.break_even_revenue == Decimal(expected)


@pytest.mark.parametrize(
    ("investment", "cash_flow", "expected_months"),
    [("12000", "1000", "12"), ("50000", "2500", "20"), ("0", "0", "0")],
)
def test_payback_golden_vectors(
    investment: str, cash_flow: str, expected_months: str
) -> None:
    result = payback_period(Decimal(investment), Decimal(cash_flow))

    assert result.months_to_payback == Decimal(expected_months)


@pytest.mark.parametrize(
    ("cash_flow", "debt_service", "expected_dscr"),
    [("120000", "100000", "1.2"), ("-10000", "100000", "-0.1")],
)
def test_dscr_golden_vectors(
    cash_flow: str, debt_service: str, expected_dscr: str
) -> None:
    result = debt_service_coverage_ratio(Decimal(cash_flow), Decimal(debt_service))

    assert result.dscr == Decimal(expected_dscr)


@pytest.mark.parametrize(
    ("target", "fixed_costs", "variable_percent", "expected_revenue"),
    [("1000000", "1000000", "20", "2500000"), ("1000", "1000", "50", "4000")],
)
def test_target_profit_revenue_golden_vectors(
    target: str, fixed_costs: str, variable_percent: str, expected_revenue: str
) -> None:
    result = revenue_for_target_profit(
        Decimal(target), Decimal(fixed_costs), Decimal(variable_percent)
    )

    assert result.required_revenue == Decimal(expected_revenue)


@pytest.mark.parametrize(
    ("revenue", "expected_commission"),
    [
        ("0", "0.00"),
        ("99999999", "3999999.96"),
        ("100000000", "4000000.00"),
        ("100000001", "4000000.02"),
        ("150000000", "5000000.00"),
        ("999999999", "21999999.98"),
        ("1000000000", "22000000.00"),
        ("1000000001", "22000000.01"),
    ],
)
def test_progressive_commission_golden_vectors(
    revenue: str, expected_commission: str
) -> None:
    result = calculate_progressive_commission(Decimal(revenue))

    assert result.total_commission == Decimal(expected_commission)
