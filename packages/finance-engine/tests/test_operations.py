from decimal import Decimal

import pytest

from finance_engine.operations import (
    CapexItem,
    StaffPosition,
    estimate_capex,
    estimate_payroll,
)


def test_capex_estimate_sums_decimal_line_items() -> None:
    result = estimate_capex(
        [
            CapexItem("oven", Decimal(2), Decimal("1250.25")),
            CapexItem("tables", Decimal(4), Decimal(100)),
        ]
    )

    assert [item.total_cost for item in result.items] == [
        Decimal("2500.50"),
        Decimal("400.00"),
    ]
    assert result.total_cost == Decimal("2900.50")
    assert result.formula


def test_capex_estimate_accepts_empty_list() -> None:
    result = estimate_capex([])

    assert result.items == ()
    assert result.total_cost == Decimal(0)


def test_capex_estimate_rejects_negative_cost() -> None:
    with pytest.raises(ValueError):
        estimate_capex([CapexItem("oven", Decimal(1), Decimal(-1))])


def test_payroll_fund_supports_zero_employees_and_reports_annual_total() -> None:
    result = estimate_payroll(
        [
            StaffPosition("cook", 0, Decimal(1000)),
            StaffPosition("server", 2, Decimal("500.25")),
        ]
    )

    assert result.employee_count == 2
    assert result.monthly_payroll == Decimal("1000.50")
    assert result.annual_payroll == Decimal("12006.00")


def test_payroll_rejects_negative_employee_count() -> None:
    with pytest.raises(ValueError):
        estimate_payroll([StaffPosition("cook", -1, Decimal(1000))])
