import json
from decimal import Decimal

import pytest
from fastapi import HTTPException
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from finadvisor_api import analysis, chat, plans
from finadvisor_api.auth import get_current_user
from finadvisor_api.database import Base, get_db
from finadvisor_api.knowledge import KnowledgeResult
from finadvisor_api.main import app
from finadvisor_api.models import User
from finadvisor_api.plan_schemas import (
    SectorPlanCalculations,
    SectorPlanGenerateRequest,
    SectorPlanGenerateResponse,
)


@pytest.fixture
def sector_plan_api(monkeypatch: pytest.MonkeyPatch):
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    session_factory = sessionmaker(
        bind=engine,
        autoflush=False,
        autocommit=False,
        expire_on_commit=False,
    )
    user = User(
        id="multi-sector-owner",
        email="multi-sector-owner@example.com",
        name="Multi-sector Owner",
        role="tadbirkor",
        subscription_plan="business",
    )
    with session_factory() as db:
        db.add(user)
        db.commit()

    def override_get_db():
        with session_factory() as db:
            yield db

    monkeypatch.setitem(app.dependency_overrides, get_db, override_get_db)
    monkeypatch.setitem(app.dependency_overrides, get_current_user, lambda: user)
    with TestClient(app) as test_client:
        yield test_client
    Base.metadata.drop_all(bind=engine)
    engine.dispose()


def _payload(
    sector_id: str,
    revenue_model_type: str,
    revenue: dict[str, str],
    cost_category: str = "rent",
) -> SectorPlanGenerateRequest:
    return SectorPlanGenerateRequest(
        locale="en",
        business_name="Test business",
        location="Tashkent",
        sector_id=sector_id,
        inputs={
            "stage": "operating",
            "description": "A locally operated business.",
            "revenue_model_type": revenue_model_type,
            "revenue": revenue,
            "staff": [{"role": "owner", "employee_count": "1", "monthly_salary": "1000"}],
            "costs": [{"category": cost_category, "monthly_amount": "500"}],
            "custom_cost_lines": [],
        },
    )


@pytest.mark.parametrize(
    ("payload", "expected_revenue"),
    [
        (
            _payload(
                "restaurant_cafe",
                "capacity_utilization",
                {
                    "capacity_units": "10",
                    "turns_or_occupancy_per_day": "1",
                    "operating_days_per_month": "20",
                    "utilization_percent": "50",
                    "average_ticket": "8000",
                },
            ),
            Decimal(800000),
        ),
        (
            _payload(
                "retail_shop",
                "unit_sales",
                {"units_per_month": "2", "price_per_unit": "10000"},
            ),
            Decimal(20000),
        ),
        (
            _payload(
                "beauty_salon",
                "hourly_service",
                {
                    "staff_hours_per_month": "10",
                    "rate_per_hour": "10000",
                    "utilization_percent": "50",
                },
            ),
            Decimal(50000),
        ),
        (
            _payload(
                "fitness_studio",
                "recurring",
                {
                    "starting_subscribers": "20",
                    "average_revenue_per_user": "50000",
                    "monthly_churn_percent": "5",
                },
            ),
            Decimal(1000000),
        ),
        (
            _payload(
                "it_services",
                "project_based",
                {
                    "project_opportunities_per_month": "4",
                    "average_project_value": "250000",
                    "conversion_percent": "25",
                },
                "software",
            ),
            Decimal(250000),
        ),
    ],
)
@pytest.mark.anyio
async def test_sector_generation_uses_registry_and_engine_numbers(
    monkeypatch: pytest.MonkeyPatch,
    payload: SectorPlanGenerateRequest,
    expected_revenue: Decimal,
) -> None:
    captured: dict[str, object] = {}

    async def fake_generate(prompt: str, context: dict[str, object]) -> str:
        captured["prompt"] = prompt
        captured["context"] = context
        prepared = context["prepared_finance_engine_results"]
        assert isinstance(prepared, dict)
        return json.dumps(
            {
                "summary": (
                    "The engine-prepared monthly revenue is "
                    f"{prepared['monthly_revenue']} UZS."
                ),
                "sections": [
                    {"title": "Operations", "content": "Use the supplied sector inputs."}
                ],
                "clarifying_questions": [],
                "stated_assumptions": ["No seasonal factors were supplied."],
            }
        )

    monkeypatch.setattr(plans, "generate", fake_generate)

    generated = await plans._generate_sector_plan(payload)

    context = captured["context"]
    assert isinstance(context, dict)
    assert context["sector"]["id"] == payload.sector_id
    assert context["sector"]["name"]
    assert context["sector"]["kpis"]
    assert context["sector"]["questions"]
    assert Decimal(generated.calculations.monthly_revenue) == expected_revenue
    assert Decimal(generated.calculations.monthly_operating_profit) == (
        expected_revenue - Decimal(1500)
    )
    assert "restaurant business plan" not in captured["prompt"].casefold()


@pytest.mark.anyio
async def test_other_sector_starts_with_questions_and_explicit_assumptions(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    payload = _payload(
        "generic_other",
        "project_based",
        {
            "project_opportunities_per_month": "2",
            "average_project_value": "10000",
            "conversion_percent": "25",
        },
    )
    captured: dict[str, object] = {}

    async def fake_generate(prompt: str, context: dict[str, object]) -> str:
        captured["prompt"] = prompt
        return json.dumps(
            {
                "summary": "A few details are needed before preparing the plan.",
                "sections": [
                    {
                        "title": "Clarification",
                        "content": "Please answer the questions before treating this as a final plan.",
                    }
                ],
                "clarifying_questions": [
                    "Which customer group will the business serve?",
                    "What service will customers receive?",
                    "Which main operating costs should be included?",
                    "Which roles will deliver the service?",
                    "What makes the offer different?",
                ],
                "stated_assumptions": [
                    "The supplied project-based revenue model is provisional."
                ],
            }
        )

    monkeypatch.setattr(plans, "generate", fake_generate)

    generated = await plans._generate_sector_plan(payload)

    assert "without clarification answers" in captured["prompt"]
    assert len(generated.clarifying_questions) == 5
    assert generated.stated_assumptions
    assert generated.calculations.monthly_revenue is None


@pytest.mark.anyio
async def test_other_sector_uses_answers_before_financial_projection(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    base = _payload(
        "generic_other",
        "project_based",
        {
            "project_opportunities_per_month": "2",
            "average_project_value": "10000",
            "conversion_percent": "25",
        },
    )
    payload = base.model_copy(
        update={"clarification_answers": ["The service is equipment repair."]}
    )

    async def fake_generate(prompt: str, context: dict[str, object]) -> str:
        prepared = context["prepared_finance_engine_results"]
        assert isinstance(prepared, dict)
        return json.dumps(
            {
                "summary": f"Monthly revenue is {prepared['monthly_revenue']} UZS.",
                "sections": [{"title": "Operations", "content": "Use the supplied details."}],
                "clarifying_questions": [],
                "stated_assumptions": ["No seasonal factors were supplied."],
            }
        )

    monkeypatch.setattr(plans, "generate", fake_generate)

    generated = await plans._generate_sector_plan(payload)

    assert Decimal(generated.calculations.monthly_revenue) == Decimal(5000)
    assert generated.clarifying_questions == []


def test_sector_generation_endpoint_returns_generated_plan(
    monkeypatch: pytest.MonkeyPatch,
    sector_plan_api: TestClient,
) -> None:
    payload = _payload(
        "retail_shop",
        "unit_sales",
        {"units_per_month": "2", "price_per_unit": "10000"},
    )
    generated = SectorPlanGenerateResponse(
        summary="Sector plan",
        sections=[{"title": "Operations", "content": "Use the supplied inputs."}],
        markdown="# Sector plan\n\n## Operations\n\nUse the supplied inputs.",
        calculations=SectorPlanCalculations(
            monthly_revenue="20000.00",
            monthly_cost_of_goods="0.00",
            monthly_operating_expenses="500.00",
            monthly_payroll="1000.00",
            monthly_operating_profit="18500.00",
            annual_operating_profit="222000.00",
            break_even_revenue="1500.00",
            formula="Prepared by the finance engine.",
        ),
        assumptions=payload,
        clarifying_questions=[],
        stated_assumptions=["No seasonal factors were supplied."],
    )

    async def fake_generate_sector_plan(request, user, db):
        assert request.sector_id == "retail_shop"
        assert user.role == "tadbirkor"
        return generated

    monkeypatch.setattr(plans, "_generate_sector_plan", fake_generate_sector_plan)

    response = sector_plan_api.post(
        "/plans/generate-sector",
        json=payload.model_dump(mode="json"),
    )

    assert response.status_code == 200
    assert response.json()["summary"] == "Sector plan"
    assert response.json()["assumptions"]["sector_id"] == "retail_shop"


def test_generated_sector_narrative_rejects_numbers_not_from_engine() -> None:
    payload = _payload(
        "retail_shop",
        "unit_sales",
        {"units_per_month": "2", "price_per_unit": "10000"},
    )
    calculations, _ = plans._sector_plan_context(payload)
    with pytest.raises(HTTPException) as error:
        plans._sector_plan_response(
            json.dumps(
                {
                    "summary": "The monthly revenue is 123456789 UZS.",
                    "sections": [{"title": "Operations", "content": "Plan details."}],
                    "clarifying_questions": [],
                    "stated_assumptions": ["No seasonal factors were supplied."],
                }
            ),
            calculations,
            payload,
        )

    assert error.value.status_code == 502
    assert error.value.detail == "plans.ai_unsupported_number"


def test_analysis_prompt_context_uses_sector_and_localized_registry_data() -> None:
    context = analysis._sector_analysis_context(
        "retail_shop",
        "uz",
        json.dumps({"revenue": {"units_per_month": "20"}}),
    )

    assert context["id"] == "retail_shop"
    assert context["name"]
    assert context["kpis"]
    assert context["user_supplied_inputs"] == {"revenue": {"units_per_month": "20"}}
    assert "do not assume the business is a restaurant" in analysis.ANALYSIS_PROMPT


def test_chat_prompt_context_uses_sector_inputs() -> None:
    payload = chat.ChatRequest(
        locale="ru",
        message="How should I plan stock?",
        sector_id="retail_shop",
        sector_inputs={"stage": "operating", "revenue": {"units_per_month": "20"}},
    )

    context = chat._chat_context(
        payload,
        "general",
        [],
        [KnowledgeResult("reference", "https://example.test", "Excerpt", 1.0)],
    )

    assert context["sector"]["id"] == "retail_shop"
    assert context["sector"]["name"]
    assert context["user_supplied_sector_inputs"] == payload.sector_inputs
    assert "never assume the business is a restaurant" in chat.CHAT_PROMPT


def test_unknown_or_invalid_sector_inputs_are_rejected() -> None:
    with pytest.raises(HTTPException) as unknown_sector:
        plans._sector_plan_context(
            _payload(
                "not-a-sector",
                "unit_sales",
                {"units_per_month": "1", "price_per_unit": "1"},
            )
        )
    assert unknown_sector.value.status_code == 422

    with pytest.raises(HTTPException) as invalid_input:
        plans._sector_plan_context(
            _payload(
                "retail_shop",
                "unit_sales",
                {"units_per_month": "1.5", "price_per_unit": "-1"},
            )
        )
    assert invalid_input.value.detail == "plans.invalid_sector_inputs"
