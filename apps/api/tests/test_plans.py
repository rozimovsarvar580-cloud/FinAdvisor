import json

import pytest
from fastapi.testclient import TestClient

from finadvisor_api import plans
from finadvisor_api.ai_client import AIClientError
from finadvisor_api.main import app

client = TestClient(app)

plan_payload = {
    "locale": "uz",
    "business_name": "Oshxona",
    "restaurant_format": "family",
    "location": "Toshkent",
    "seats": 40,
    "menu_summary": "Milliy taomlar",
    "average_check": "100000",
    "daily_customers": 50,
    "operating_days_per_month": 30,
    "monthly_rent": "10000000",
    "monthly_utilities": "1000000",
    "variable_cost_ratio_percent": "30",
    "staff": [
        {"role": "oshpaz", "employee_count": 10, "monthly_salary": "3000000"},
        {"role": "ofitsiant", "employee_count": 20, "monthly_salary": "2000000"},
    ],
    "equipment": [{"name": "jihozlar", "quantity": "1", "unit_cost": "50000000"}],
    "other_startup_cost": "10000000",
    "loan_amount": "0",
    "annual_interest_rate_percent": "0",
    "loan_term_months": 0,
    "target_monthly_profit": "10000000",
}


def test_plan_generation_passes_only_calculated_financial_values_to_ai(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    captured: dict[str, object] = {}

    async def fake_generate(prompt: str, context: dict[str, object]) -> str:
        captured["prompt"] = prompt
        captured["context"] = context
        return json.dumps(
            {
                "summary": "Loyiha xulosasi",
                "sections": [{"title": "Bozor", "content": "Tavsif"}],
            }
        )

    monkeypatch.setattr(plans, "generate", fake_generate)

    response = client.post("/plans/generate", json=plan_payload)

    assert response.status_code == 200
    body = response.json()
    assert body["summary"] == "Loyiha xulosasi"
    assert body["calculations"]["monthly_revenue"] == "150000000.00"
    ai_context = captured["context"]
    assert ai_context["business"]["name"] == "Oshxona"
    assert ai_context["prepared_finance_engine_results"]["monthly_revenue"] == "150000000.00"
    assert "average_check" not in ai_context
    assert "Do not calculate" in captured["prompt"]


def test_plan_generation_surfaces_ai_provider_failure(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def unavailable(prompt: str, context: dict[str, object]) -> str:
        raise AIClientError("provider unavailable")

    monkeypatch.setattr(plans, "generate", unavailable)

    response = client.post("/plans/generate", json=plan_payload)

    assert response.status_code == 503
    assert response.json()["detail"] == "plans.ai_unavailable"


def test_plan_generation_rejects_non_decimal_money_input() -> None:
    payload = {**plan_payload, "average_check": 100000.0}

    response = client.post("/plans/generate", json=payload)

    assert response.status_code == 422
