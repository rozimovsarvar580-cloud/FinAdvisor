import pytest
from fastapi.testclient import TestClient

from finadvisor_api.auth import get_current_user
from finadvisor_api.main import app
from finadvisor_api.models import User

client = TestClient(app)


@pytest.fixture(autouse=True)
def authenticated_business_user(monkeypatch: pytest.MonkeyPatch) -> None:
    user = User(
        id="calculation-business-user",
        email="calculation-business@example.com",
        name="Calculation Business",
        role="tadbirkor",
        subscription_plan="business",
    )
    monkeypatch.setitem(app.dependency_overrides, get_current_user, lambda: user)


@pytest.mark.parametrize(
    ("calculation_type", "payload", "expected_type"),
    [
        (
            "annuity",
            {
                "principal": "1200",
                "annual_interest_rate_percent": "0",
                "term_months": 12,
            },
            "annuity",
        ),
        (
            "differential",
            {
                "principal": "1200",
                "annual_interest_rate_percent": "12",
                "term_months": 12,
            },
            "differential",
        ),
        (
            "capex",
            {"items": [{"name": "oven", "quantity": "2", "unit_cost": "100"}]},
            "capex",
        ),
        (
            "payroll",
            {
                "positions": [
                    {"role": "cook", "employee_count": 0, "monthly_salary": "1000"}
                ]
            },
            "payroll",
        ),
        (
            "tax-comparison",
            {"annual_revenue": "100000000", "annual_expenses": "70000000"},
            "tax-comparison",
        ),
        (
            "break-even",
            {"fixed_costs": "600", "variable_cost_ratio_percent": "40"},
            "break-even",
        ),
        (
            "payback",
            {"initial_investment": "1000", "monthly_net_cash_flow": "-10"},
            "payback",
        ),
        (
            "dscr",
            {"annual_operating_cash_flow": "-50", "annual_debt_service": "100"},
            "dscr",
        ),
        (
            "reverse-revenue",
            {
                "target_profit": "1000",
                "fixed_costs": "500",
                "variable_cost_ratio_percent": "20",
            },
            "reverse-revenue",
        ),
    ],
)
def test_calc_endpoint_returns_typed_result_and_formula(
    calculation_type: str,
    payload: dict[str, object],
    expected_type: str,
) -> None:
    response = client.post(f"/calc/{calculation_type}", json=payload)

    assert response.status_code == 200
    body = response.json()
    assert body["calculation_type"] == expected_type
    assert body["explanation"]["formula"]
    assert body["explanation"]["inputs"]


def test_calc_rejects_float_money_values() -> None:
    response = client.post(
        "/calc/annuity",
        json={
            "principal": 1000.0,
            "annual_interest_rate_percent": "0",
            "term_months": 12,
        },
    )

    assert response.status_code == 422
    assert response.json()["detail"]["code"] == "calc.invalid_input"


def test_calc_rejects_invalid_profitability_and_unknown_type() -> None:
    invalid_break_even = client.post(
        "/calc/break-even",
        json={"fixed_costs": "100", "variable_cost_ratio_percent": "100"},
    )
    unknown = client.post("/calc/unknown", json={})

    assert invalid_break_even.status_code == 422
    assert unknown.status_code == 404


def test_tax_rules_endpoint_exposes_unverified_provenance() -> None:
    response = client.get("/calc/tax-rules")

    assert response.status_code == 200
    payload = response.json()
    assert payload["source_name"] == "Uzbekistan Tax Code, LexUZ"
    assert {rule["key"] for rule in payload["rules"]} == {
        "turnover_tax",
        "profit_tax",
        "employer_social_contribution",
    }
    assert all(rule["verified"] is False for rule in payload["rules"])
    assert all(rule["verified_by"] is None for rule in payload["rules"])
    assert all(rule["source_url"] and rule["effective_date"] for rule in payload["rules"])


def test_tax_comparison_marks_unverified_rules_as_estimates() -> None:
    response = client.post(
        "/calc/tax-comparison",
        json={"annual_revenue": "100000000", "annual_expenses": "70000000"},
    )

    assert response.status_code == 200
    regimes = response.json()["result"]["regimes"]
    assert all(regime["verified"] is False for regime in regimes)
    assert all(regime["verified_by"] is None for regime in regimes)
