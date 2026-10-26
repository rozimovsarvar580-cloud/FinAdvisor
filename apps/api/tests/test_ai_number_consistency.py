import json
import re
from decimal import Decimal

import pytest

from finadvisor_api import plans
from finadvisor_api.plan_schemas import PlanGenerateRequest

NUMBER_PATTERN = re.compile(r"(?<![\w])[+-]?\d+(?:[.,]\d+)*(?![\w])")

plan_payload = {
    "locale": "en",
    "business_name": "Test Cafe",
    "restaurant_format": "cafe",
    "location": "Tashkent",
    "seats": 40,
    "menu_summary": "Cafe menu",
    "average_check": "100000",
    "daily_customers": 50,
    "operating_days_per_month": 30,
    "monthly_rent": "10000000",
    "monthly_utilities": "1000000",
    "variable_cost_ratio_percent": "30",
    "staff": [
        {"role": "cook", "employee_count": 10, "monthly_salary": "3000000"},
        {"role": "waiter", "employee_count": 20, "monthly_salary": "2000000"},
    ],
    "equipment": [{"name": "equipment", "quantity": "1", "unit_cost": "50000000"}],
    "other_startup_cost": "10000000",
    "loan_amount": "0",
    "annual_interest_rate_percent": "0",
    "loan_term_months": 0,
    "target_monthly_profit": "10000000",
}


def _extract_numbers(text: str) -> set[Decimal]:
    return {
        Decimal(number.replace(",", ""))
        for number in NUMBER_PATTERN.findall(text)
    }


def _assert_generated_numbers_are_engine_numbers(
    generated_text: str, calculations: dict[str, str | int | None]
) -> None:
    engine_numbers = {
        Decimal(str(value).replace(",", ""))
        for value in calculations.values()
        if value is not None
    }
    unexpected_numbers = _extract_numbers(generated_text) - engine_numbers
    assert not unexpected_numbers, (
        f"Generated text contains numbers not supplied by the finance engine: "
        f"{sorted(unexpected_numbers)}"
    )


@pytest.mark.anyio
async def test_generated_plan_numbers_match_finance_engine(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    async def fake_generate(prompt: str, context: dict[str, object]) -> str:
        prepared = context["prepared_finance_engine_results"]
        assert isinstance(prepared, dict)
        return json.dumps(
            {
                "summary": (
                    "The projected monthly revenue is "
                    f"{prepared['monthly_revenue']} UZS."
                ),
                "sections": [
                    {
                        "title": "Financial outlook",
                        "content": (
                            "The annual operating profit is "
                            f"{prepared['annual_operating_profit']} UZS."
                        ),
                    }
                ],
            }
        )

    monkeypatch.setattr(plans, "generate", fake_generate)
    generated = await plans._generate_plan(
        PlanGenerateRequest.model_validate(plan_payload)
    )

    _assert_generated_numbers_are_engine_numbers(
        generated.markdown,
        generated.calculations.model_dump(mode="json"),
    )


def test_number_consistency_evaluation_rejects_invented_values() -> None:
    with pytest.raises(AssertionError, match="not supplied by the finance engine"):
        _assert_generated_numbers_are_engine_numbers(
            "The projected revenue is 123456789 UZS.",
            {"monthly_revenue": "150000000.00"},
        )
