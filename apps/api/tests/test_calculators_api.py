import pytest
from fastapi.testclient import TestClient

from finadvisor_api.auth import get_current_user
from finadvisor_api.main import app
from finadvisor_api.models import User

client = TestClient(app)


@pytest.fixture(autouse=True)
def authenticated_business_user(monkeypatch: pytest.MonkeyPatch) -> None:
    user = User(
        id="calculator-business-user",
        email="calculator-business@example.com",
        name="Calculator Business",
        role="tadbirkor",
        subscription_plan="business",
    )
    monkeypatch.setitem(app.dependency_overrides, get_current_user, lambda: user)


@pytest.mark.parametrize(
    ("calculator", "payload"),
    [
        (
            "annuity",
            {
                "principal": "1000000",
                "annual_interest_rate_percent": "0",
                "term_months": 12,
            },
        ),
        (
            "differential",
            {
                "principal": "1000000",
                "annual_interest_rate_percent": "12",
                "term_months": 12,
            },
        ),
        ("capex", {"items": [{"name": "oven", "quantity": "1", "unit_cost": "10"}]}),
        (
            "payroll",
            {
                "positions": [
                    {"role": "cook", "employee_count": 2, "monthly_salary": "100"}
                ]
            },
        ),
        ("tax-comparison", {"annual_revenue": "1000000", "annual_expenses": "500000"}),
        ("break-even", {"fixed_costs": "100", "variable_cost_ratio_percent": "40"}),
        ("payback", {"initial_investment": "100", "monthly_net_cash_flow": "10"}),
        ("dscr", {"annual_operating_cash_flow": "120", "annual_debt_service": "100"}),
        (
            "reverse-revenue",
            {
                "target_profit": "100",
                "fixed_costs": "100",
                "variable_cost_ratio_percent": "40",
            },
        ),
        (
            "startup-cost",
            {
                "items": [
                    {
                        "category": "kitchen_equipment",
                        "name": "oven",
                        "quantity": "1",
                        "unit_cost": "1000",
                    }
                ]
            },
        ),
        (
            "loan-affordability",
            {
                "method": "differential",
                "monthly_available_cash": "1000",
                "principal": "1000",
                "annual_interest_rate_percent": "12",
                "term_months": 12,
            },
        ),
        (
            "revenue-projection",
            {
                "daily_revenue": "1000",
                "monthly_fixed_costs": "5000",
                "variable_cost_ratio_percent": "40",
                "operating_days_per_week": 6,
                "operating_days_per_month": 26,
                "operating_days_per_year": 312,
                "target_monthly_profit": "10000",
                "revenue_sensitivity_percentages": ["0"],
                "variable_cost_sensitivity_points": ["0"],
            },
        ),
    ],
)
def test_each_calculator_returns_typed_result_and_formula(
    calculator: str, payload: dict[str, object]
) -> None:
    response = client.post(f"/calc/{calculator}", json=payload)

    assert response.status_code == 200
    result = response.json()
    assert result["calculation_type"] == calculator
    assert result["explanation"]["formula"]
    assert result["explanation"]["inputs"]


def test_free_user_can_use_startup_cost_but_not_paid_calculators(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    user = User(
        id="calculator-free-user",
        email="calculator-free@example.com",
        name="Calculator Free",
        role="tadbirkor",
        subscription_plan="free",
    )
    monkeypatch.setitem(app.dependency_overrides, get_current_user, lambda: user)

    startup_cost = client.post(
        "/calc/startup-cost",
        json={
            "items": [
                {
                    "category": "kitchen_equipment",
                    "name": "tools",
                    "quantity": "1",
                    "unit_cost": "5",
                }
            ]
        },
    )
    loan = client.post(
        "/calc/annuity",
        json={
            "principal": "1000",
            "annual_interest_rate_percent": "0",
            "term_months": 12,
        },
    )

    assert startup_cost.status_code == 200
    assert loan.status_code == 403
    assert loan.json()["detail"]["code"] == "plans.calculator_not_included"


def test_new_calculator_inputs_enforce_numeric_ranges() -> None:
    invalid_startup = client.post(
        "/calc/startup-cost",
        json={
            "items": [
                {
                    "category": "other",
                    "name": "equipment",
                    "quantity": "1",
                    "unit_cost": "100",
                }
            ]
        },
    )
    invalid_loan = client.post(
        "/calc/loan-affordability",
        json={
            "method": "annuity",
            "monthly_available_cash": "90",
            "principal": "1000",
            "annual_interest_rate_percent": "10",
            "term_months": 601,
        },
    )
    invalid_projection = client.post(
        "/calc/revenue-projection",
        json={
            "daily_revenue": "100",
            "monthly_fixed_costs": "100",
            "variable_cost_ratio_percent": "100",
            "operating_days_per_week": 0,
            "operating_days_per_month": 30,
            "operating_days_per_year": 360,
            "target_monthly_profit": "0",
            "revenue_sensitivity_percentages": [],
            "variable_cost_sensitivity_points": [],
        },
    )

    assert invalid_startup.status_code == 422
    assert invalid_loan.status_code == 422
    assert invalid_projection.status_code == 422
    assert all(
        response.json()["detail"]["code"] == "calc.invalid_input"
        for response in (invalid_startup, invalid_loan, invalid_projection)
    )


def test_payroll_does_not_present_unverified_contribution_as_zero() -> None:
    response = client.post(
        "/calc/payroll",
        json={
            "positions": [
                {"role": "cook", "employee_count": 2, "monthly_salary": "100"}
            ]
        },
    )

    assert response.status_code == 200
    result = response.json()["result"]
    assert result["contributions_complete"] is False
    assert result["contributions_verified"] is False
    assert result["monthly_employer_contributions"] is None
    assert result["monthly_total_employer_cost"] is None
    assert result["employer_contributions"]
    assert result["employer_contributions"][0]["rate"] is None


def test_loan_affordability_uses_largest_scheduled_payment() -> None:
    response = client.post(
        "/calc/loan-affordability",
        json={
            "method": "differential",
            "monthly_available_cash": "90",
            "principal": "1000",
            "annual_interest_rate_percent": "12",
            "term_months": 12,
        },
    )

    assert response.status_code == 200
    result = response.json()["result"]
    assert result["affordable"] is False
    assert result["maximum_monthly_payment"] == "93.33"
    assert result["minimum_monthly_surplus"] == "-3.33"
    assert result["schedule"]["method"] == "differential"
    assert len(result["schedule"]["payments"]) == 12


def test_revenue_projection_exposes_periods_and_sensitivity() -> None:
    response = client.post(
        "/calc/revenue-projection",
        json={
            "daily_revenue": "1000",
            "monthly_fixed_costs": "5000",
            "variable_cost_ratio_percent": "40",
            "operating_days_per_week": 6,
            "operating_days_per_month": 26,
            "operating_days_per_year": 312,
            "target_monthly_profit": "10000",
            "revenue_sensitivity_percentages": ["10"],
            "variable_cost_sensitivity_points": ["5"],
        },
    )

    assert response.status_code == 200
    result = response.json()["result"]
    assert result["daily"]["revenue"] == "1000.00"
    assert result["monthly"]["operating_profit"] == "10600.00"
    assert result["break_even_revenue_monthly"] == "8333.333333333333333333333333"
    assert result["target_revenue_monthly"] == "25000"
    assert result["sensitivity"][0]["projected_monthly_profit"] == "10730.00"
