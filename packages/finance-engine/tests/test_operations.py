from decimal import Decimal
from pathlib import Path

import pytest
import yaml

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


def test_payroll_does_not_invent_unverified_employer_contributions() -> None:
    result = estimate_payroll(
        [
            StaffPosition("cook", 10, Decimal(1000)),
            StaffPosition("server", 20, Decimal(500)),
            StaffPosition("manager", 1, Decimal(1500)),
            StaffPosition("cleaner", 1, Decimal(300)),
            StaffPosition("accountant", 1, Decimal(800)),
            StaffPosition("cashier", 1, Decimal(400)),
            StaffPosition("delivery", 2, Decimal(600)),
        ]
    )

    assert result.employee_count == 36
    assert result.monthly_payroll == Decimal("24200.00")
    assert result.annual_payroll == Decimal("290400.00")
    assert result.contributions_complete is False
    assert result.contributions_verified is False
    assert result.monthly_employer_contributions is None
    assert result.annual_total_employer_cost is None
    assert result.employer_contributions[0].rate is None


def test_payroll_calculates_configured_contributions_and_marks_estimate(
    tmp_path: Path,
) -> None:
    rules_path = tmp_path / "tax_rules.yaml"
    rules_path.write_text(
        yaml.safe_dump(
            {
                "payroll": {
                    "employer_contributions": [
                        {
                            "key": "social",
                            "rate": "10",
                            "source_url": "TODO(VERIFY)",
                            "effective_date": "TODO(VERIFY)",
                            "verified": False,
                        },
                        {
                            "key": "other",
                            "rate": "5",
                            "source_url": "TODO(VERIFY)",
                            "effective_date": "TODO(VERIFY)",
                            "verified": False,
                        },
                    ]
                }
            }
        ),
        encoding="utf-8",
    )

    result = estimate_payroll(
        [
            StaffPosition("cook", 10, Decimal(1000)),
            StaffPosition("server", 20, Decimal(500)),
            StaffPosition("manager", 1, Decimal(1500)),
            StaffPosition("cleaner", 1, Decimal(300)),
            StaffPosition("accountant", 1, Decimal(800)),
            StaffPosition("cashier", 1, Decimal(400)),
            StaffPosition("delivery", 2, Decimal(600)),
        ],
        tax_rules_path=rules_path,
    )

    assert result.monthly_employer_contributions == Decimal("3630.00")
    assert result.annual_employer_contributions == Decimal("43560.00")
    assert result.monthly_total_employer_cost == Decimal("27830.00")
    assert result.annual_total_employer_cost == Decimal("333960.00")
    assert result.contributions_complete is True
    assert result.contributions_verified is False
    assert [line.verified for line in result.employer_contributions] == [False, False]


@pytest.mark.parametrize("rate", ["-1", "100.01", "NaN"])
def test_payroll_rejects_invalid_configured_contribution_rates(
    tmp_path: Path, rate: str
) -> None:
    rules_path = tmp_path / "tax_rules.yaml"
    rules_path.write_text(
        yaml.safe_dump(
            {
                "payroll": {
                    "employer_contributions": [
                        {
                            "key": "invalid",
                            "rate": rate,
                            "source_url": "TODO(VERIFY)",
                            "effective_date": "TODO(VERIFY)",
                            "verified": False,
                        }
                    ]
                }
            }
        ),
        encoding="utf-8",
    )

    with pytest.raises(ValueError):
        estimate_payroll([StaffPosition("cook", 1, Decimal(1000))], rules_path)
