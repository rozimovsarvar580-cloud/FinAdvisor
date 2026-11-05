import json
from datetime import UTC, datetime

import pytest
from fastapi.testclient import TestClient
from sqlalchemy import create_engine
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from finadvisor_api import plans
from finadvisor_api.ai_client import AIClientError
from finadvisor_api.auth import get_current_user
from finadvisor_api.database import Base, get_db
from finadvisor_api.main import app
from finadvisor_api.models import SavedBusinessPlan, User
from finadvisor_api.plan_schemas import (
    PlanCalculations,
    PlanGenerateRequest,
    PlanGenerateResponse,
    PlanSection,
)

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


@pytest.fixture
def business_owner(monkeypatch: pytest.MonkeyPatch) -> User:
    user = User(
        id="test-plan-owner",
        email="plan-owner@example.com",
        name="Plan Owner",
        role="tadbirkor",
        subscription_plan="business",
    )
    monkeypatch.setitem(app.dependency_overrides, get_current_user, lambda: user)
    return user


@pytest.fixture
def api_database(monkeypatch: pytest.MonkeyPatch):
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    testing_session_local = sessionmaker(
        bind=engine,
        autoflush=False,
        autocommit=False,
        expire_on_commit=False,
    )

    def override_get_db():
        with testing_session_local() as session:
            yield session

    monkeypatch.setitem(app.dependency_overrides, get_db, override_get_db)
    yield testing_session_local
    Base.metadata.drop_all(bind=engine)
    engine.dispose()


def _save_plan(session_factory, owner: User, plan_id: str = "plan-investor-qa") -> None:
    generated_plan = {
        "summary": "Restaurant plan",
        "sections": [{"title": "Operations", "content": "Family restaurant."}],
        "markdown": "# Restaurant plan",
        "calculations": {
            "monthly_revenue": "150000000.00",
            "monthly_operating_profit": "25000000.00",
        },
    }
    with session_factory() as db:
        db.add(owner)
        db.add(
            SavedBusinessPlan(
                id=plan_id,
                owner_id=owner.id,
                business_name="Oshxona",
                location="Toshkent",
                request_payload=plan_payload,
                generated_plan=generated_plan,
            )
        )
        db.commit()


def _save_plan_with_history(session_factory, owner: User, plan_id: str) -> None:
    assumptions = PlanGenerateRequest.model_validate(plan_payload)
    calculations = PlanCalculations(
        monthly_revenue="150000000.00",
        monthly_payroll="70000000.00",
        startup_capex="50000000.00",
        total_startup_cost="60000000.00",
        monthly_fixed_costs="81000000.00",
        monthly_variable_cost="45000000.00",
        monthly_operating_profit="24000000.00",
        annual_operating_profit="288000000.00",
        break_even_revenue="115714285.71",
        target_monthly_revenue="130000000.00",
        loan_first_payment=None,
        loan_total_payment=None,
        loan_total_interest=None,
        loan_term_months=None,
        annual_debt_service=None,
        dscr=None,
    )
    versions = [
        {
            "version": 1,
            "created_at": datetime.now(UTC).isoformat(),
            "summary": "Original summary",
            "sections": [{"title": "Operations", "content": "Original operation."}],
            "markdown": "# Original summary\n\n## Operations\n\nOriginal operation.",
        },
        {
            "version": 2,
            "created_at": datetime.now(UTC).isoformat(),
            "summary": "Current summary",
            "sections": [{"title": "Operations", "content": "Current operation."}],
            "markdown": "# Current summary\n\n## Operations\n\nCurrent operation.",
        },
    ]
    with session_factory() as db:
        db.add(owner)
        db.add(
            SavedBusinessPlan(
                id=plan_id,
                owner_id=owner.id,
                business_name="Oshxona",
                location="Toshkent",
                request_payload=plan_payload,
                generated_plan={
                    **PlanGenerateResponse(
                        summary="Current summary",
                        sections=[
                            PlanSection(
                                title="Operations",
                                content="Current operation.",
                            )
                        ],
                        markdown="# Current summary\n\n## Operations\n\nCurrent operation.",
                        assumptions=assumptions,
                        calculations=calculations,
                    ).model_dump(mode="json"),
                    "version": 2,
                    "versions": versions,
                },
            )
        )
        db.commit()


def test_plan_generation_passes_only_calculated_financial_values_to_ai(
    monkeypatch: pytest.MonkeyPatch, business_owner: User, api_database
) -> None:
    _save_plan(api_database, business_owner, "plan-metering-test")
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
    assert body["markdown"] == "# Loyiha xulosasi\n\n## Bozor\n\nTavsif"
    assert body["calculations"]["monthly_revenue"] == "150000000.00"
    ai_context = captured["context"]
    assert ai_context["business"]["name"] == "Oshxona"
    assert ai_context["business"]["seats"] == 40
    assert ai_context["business"]["staff"] == [
        {"role": "oshpaz", "employee_count": 10},
        {"role": "ofitsiant", "employee_count": 20},
    ]
    assert ai_context["prepared_finance_engine_results"]["monthly_revenue"] == "150000000.00"
    assert "average_check" not in ai_context
    assert "Do not calculate" in captured["prompt"]


def test_plan_generation_surfaces_ai_provider_failure(
    monkeypatch: pytest.MonkeyPatch, business_owner: User, api_database
) -> None:
    _save_plan(api_database, business_owner, "plan-metering-test")

    async def unavailable(prompt: str, context: dict[str, object]) -> str:
        raise AIClientError("provider unavailable")

    monkeypatch.setattr(plans, "generate", unavailable)

    response = client.post("/plans/generate", json=plan_payload)

    assert response.status_code == 503
    assert response.json()["detail"] == "plans.ai_unavailable"


def test_saved_plan_edits_create_owner_scoped_revisions(
    monkeypatch: pytest.MonkeyPatch,
    business_owner: User,
    api_database,
) -> None:
    generated = PlanGenerateResponse(
        summary="Initial summary",
        sections=[PlanSection(title="Operations", content="Initial details.")],
        markdown="# Initial summary\n\n## Operations\n\nInitial details.",
        assumptions=PlanGenerateRequest.model_validate(plan_payload),
        calculations=PlanCalculations(
            monthly_revenue="100000",
            monthly_payroll="20000",
            startup_capex="30000",
            total_startup_cost="30000",
            monthly_fixed_costs="10000",
            monthly_variable_cost="20000",
            monthly_operating_profit="50000",
            annual_operating_profit="600000",
            break_even_revenue="25000",
            target_monthly_revenue="50000",
            loan_first_payment=None,
            loan_total_payment=None,
            loan_total_interest=None,
            loan_term_months=None,
            annual_debt_service=None,
            dscr=None,
        ),
    )

    async def generate_for_test(payload, user, db):
        return generated

    monkeypatch.setattr(plans, "_generate_plan", generate_for_test)
    with api_database() as db:
        db.add(business_owner)
        db.commit()

    created = client.post("/plans/generate-and-save", json=plan_payload)

    assert created.status_code == 200
    created_body = created.json()
    assert created_body["version"] == 1

    calculator_result = client.post(
        f"/plans/{created_body['plan_id']}/calculations",
        json={
            "calculation_type": "break-even",
            "inputs": {
                "fixed_costs": "600",
                "variable_cost_ratio_percent": "40",
            },
        },
    )
    assert calculator_result.status_code == 200

    updated = client.put(
        f"/plans/{created_body['plan_id']}",
        json={
            "summary": "Revised summary",
            "sections": [{"title": "Operations", "content": "Revised details."}],
        },
    )

    assert updated.status_code == 200, updated.text
    updated_body = updated.json()
    assert updated_body["version"] == 2
    assert updated_body["summary"] == "Revised summary"
    assert updated_body["markdown"] == ("# Revised summary\n\n## Operations\n\nRevised details.")
    assert updated_body["calculations"] == created_body["calculations"]
    with api_database() as db:
        saved = db.get(SavedBusinessPlan, created_body["plan_id"])
        assert saved is not None
        assert saved.generated_plan["version"] == 2
        assert len(saved.generated_plan["calculator_results"]) == 1
        assert [item["summary"] for item in saved.generated_plan["versions"]] == [
            "Initial summary",
            "Revised summary",
        ]


def test_plan_history_restore_duplicate_and_share_are_revocable(
    business_owner: User,
    api_database,
) -> None:
    business_owner.subscription_plan = "business"
    _save_plan_with_history(api_database, business_owner, "plan-history")

    history = client.get("/plans/plan-history/versions")
    assert history.status_code == 200, history.text
    assert history.json()["current_version"] == 2
    assert [item["summary"] for item in history.json()["versions"]] == [
        "Original summary",
        "Current summary",
    ]
    assert history.json()["share_enabled"] is False

    restored = client.post("/plans/plan-history/restore/1")
    assert restored.status_code == 200
    assert restored.json()["version"] == 3
    assert restored.json()["summary"] == "Original summary"
    assert restored.json()["calculations"]["monthly_revenue"] == "150000000.00"

    share = client.post("/plans/plan-history/share")
    assert share.status_code == 200
    token = share.json()["token"]
    assert len(token) == 43
    with api_database() as db:
        saved = db.get(SavedBusinessPlan, "plan-history")
        assert saved is not None
        assert saved.share_token_hash != token

    shared = client.get(f"/plans/shared/{token}")
    assert shared.status_code == 200
    assert shared.headers["cache-control"] == "no-store"
    assert shared.json()["plan"]["summary"] == "Original summary"
    assert "owner_id" not in shared.json()

    duplicate = client.post("/plans/plan-history/duplicate")
    assert duplicate.status_code == 200
    duplicate_body = duplicate.json()
    assert duplicate_body["plan_id"] != "plan-history"
    assert duplicate_body["version"] == 1
    assert duplicate_body["summary"] == "Original summary"
    with api_database() as db:
        copied = db.get(SavedBusinessPlan, duplicate_body["plan_id"])
        assert copied is not None
        assert copied.owner_id == business_owner.id
        assert copied.share_token_hash is None
        assert copied.generated_plan["versions"][0]["version"] == 1

    revoked = client.delete("/plans/plan-history/share")
    assert revoked.status_code == 204
    assert client.get(f"/plans/shared/{token}").status_code == 404


def test_plan_history_and_sharing_are_owner_scoped(
    business_owner: User,
    api_database,
) -> None:
    other_owner = User(
        id="private-plan-owner",
        email="private-plan-owner@example.com",
        name="Private Plan Owner",
        role="tadbirkor",
    )
    _save_plan_with_history(api_database, other_owner, "private-plan")

    history = client.get("/plans/private-plan/versions")
    restore = client.post("/plans/private-plan/restore/1")
    duplicate = client.post("/plans/private-plan/duplicate")
    share = client.post("/plans/private-plan/share")
    revoke = client.delete("/plans/private-plan/share")

    assert [response.status_code for response in (history, restore, duplicate, share, revoke)] == [
        404,
        404,
        404,
        404,
        404,
    ]


def test_saved_plan_edits_cannot_access_another_owners_plan(
    business_owner: User,
    api_database,
) -> None:
    other_owner = User(
        id="other-edit-owner",
        email="other-edit-owner@example.com",
        name="Other Owner",
        role="tadbirkor",
    )
    with api_database() as db:
        db.add(other_owner)
        db.add(
            SavedBusinessPlan(
                id="other-edit-plan",
                owner_id=other_owner.id,
                business_name="Private plan",
                location="Toshkent",
                request_payload=plan_payload,
                generated_plan={"summary": "Private"},
            )
        )
        db.commit()

    response = client.put(
        "/plans/other-edit-plan",
        json={
            "summary": "Attempted edit",
            "sections": [{"title": "Operations", "content": "Private details."}],
        },
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "plans.plan_not_found"


def test_plan_generation_rejects_non_decimal_money_input(
    business_owner: User,
    api_database,
) -> None:
    _save_plan(api_database, business_owner, "plan-metering-test")
    payload = {**plan_payload, "average_check": 100000.0}

    response = client.post("/plans/generate", json=payload)

    assert response.status_code == 422


def test_plan_generation_requires_a_business_owner(
    monkeypatch: pytest.MonkeyPatch, api_database
) -> None:
    generated = False

    async def fake_generate(prompt: str, context: dict[str, object]) -> str:
        nonlocal generated
        generated = True
        return "{}"

    monkeypatch.setattr(plans, "generate", fake_generate)
    unauthenticated = client.post("/plans/generate", json=plan_payload)
    assert unauthenticated.status_code == 401

    investor = User(
        id="test-plan-investor",
        email="plan-investor@example.com",
        name="Investor",
        role="investor",
    )
    monkeypatch.setitem(app.dependency_overrides, get_current_user, lambda: investor)
    forbidden = client.post("/plans/generate", json=plan_payload)

    assert forbidden.status_code == 403
    assert not generated


def test_investor_qa_uses_saved_plan_and_returns_grounded_answers(
    monkeypatch: pytest.MonkeyPatch,
    business_owner: User,
    api_database,
) -> None:
    _save_plan(api_database, business_owner)
    captured: dict[str, object] = {}
    ai_response = {
        "items": [
            {
                "question": question,
                "answer": ("The prepared plan projects monthly revenue of 150000000.00 UZS."),
            }
            for question in (
                "What revenue does the plan project?",
                "Which operating costs are included?",
                "How does the plan describe its target customers?",
                "What operational risks are identified?",
                "What details would strengthen the investment case?",
            )
        ]
    }

    async def fake_generate(prompt: str, context: dict[str, object]) -> str:
        captured["prompt"] = prompt
        captured["context"] = context
        return json.dumps(ai_response)

    monkeypatch.setattr(plans, "generate", fake_generate)

    response = client.post("/plans/plan-investor-qa/investor-qa")

    assert response.status_code == 200
    assert response.json()["plan_id"] == "plan-investor-qa"
    assert len(response.json()["items"]) == 5
    assert response.json()["items"][0]["answer"] == ai_response["items"][0]["answer"]
    assert captured["context"]["plan_inputs"]["business_name"] == "Oshxona"
    assert (
        captured["context"]["prepared_finance_engine_results"]["monthly_revenue"] == "150000000.00"
    )
    assert "Do not calculate, estimate, invent" in captured["prompt"]


def test_save_calculator_result_recalculates_and_attaches_to_owned_plan(
    business_owner: User, api_database
) -> None:
    business_owner.subscription_plan = "pro"
    _save_plan(api_database, business_owner, "plan-calculator-save")

    response = client.post(
        "/plans/plan-calculator-save/calculations",
        json={
            "calculation_type": "break-even",
            "inputs": {
                "fixed_costs": "600",
                "variable_cost_ratio_percent": "40",
            },
        },
    )

    assert response.status_code == 200
    body = response.json()
    assert body["plan_id"] == "plan-calculator-save"
    assert body["result"]["calculation_type"] == "break-even"
    assert body["result"]["calculation"]["result"]["break_even_revenue"] == "1000"
    with api_database() as db:
        stored = db.get(SavedBusinessPlan, "plan-calculator-save")
        assert stored is not None
        saved_results = stored.generated_plan["calculator_results"]
        assert len(saved_results) == 1
        assert saved_results[0]["calculation"]["calculation_type"] == "break-even"


def test_free_plan_cannot_save_an_unavailable_calculator_result(
    business_owner: User, api_database
) -> None:
    business_owner.subscription_plan = "free"
    _save_plan(api_database, business_owner, "plan-calculator-free")

    response = client.post(
        "/plans/plan-calculator-free/calculations",
        json={
            "calculation_type": "break-even",
            "inputs": {
                "fixed_costs": "600",
                "variable_cost_ratio_percent": "40",
            },
        },
    )

    assert response.status_code == 403
    assert response.json()["detail"]["code"] == "plans.calculator_not_included"


def test_save_calculator_result_does_not_accept_another_owners_plan(
    business_owner: User, api_database
) -> None:
    other_owner = User(
        id="other-calculator-owner",
        email="other-calculator-owner@example.com",
        name="Other Owner",
        role="tadbirkor",
    )
    with api_database() as db:
        db.add(other_owner)
        db.add(
            SavedBusinessPlan(
                id="other-owner-plan",
                owner_id=other_owner.id,
                business_name="Private plan",
                location="Toshkent",
                request_payload=plan_payload,
                generated_plan={"summary": "Private"},
            )
        )
        db.commit()

    response = client.post(
        "/plans/other-owner-plan/calculations",
        json={
            "calculation_type": "break-even",
            "inputs": {
                "fixed_costs": "600",
                "variable_cost_ratio_percent": "40",
            },
        },
    )

    assert response.status_code == 404
    assert response.json()["detail"] == "plans.plan_not_found"


def test_investor_qa_rejects_unprovided_numbers(
    monkeypatch: pytest.MonkeyPatch,
    business_owner: User,
    api_database,
) -> None:
    _save_plan(api_database, business_owner)
    response_payload = {
        "items": [
            {
                "question": question,
                "answer": "The projected revenue is 987654321 UZS.",
            }
            for question in (
                "What revenue does the plan project?",
                "Which operating costs are included?",
                "How does the plan describe its target customers?",
                "What operational risks are identified?",
                "What details would strengthen the investment case?",
            )
        ]
    }

    async def fake_generate(prompt: str, context: dict[str, object]) -> str:
        return json.dumps(response_payload)

    monkeypatch.setattr(plans, "generate", fake_generate)

    response = client.post("/plans/plan-investor-qa/investor-qa")

    assert response.status_code == 502
    assert response.json()["detail"] == "plans.investor_qa_unsupported_number"


def test_investor_qa_rejects_invalid_ai_response(
    monkeypatch: pytest.MonkeyPatch,
    business_owner: User,
    api_database,
) -> None:
    _save_plan(api_database, business_owner)

    async def invalid_response(prompt: str, context: dict[str, object]) -> str:
        return json.dumps({"items": []})

    monkeypatch.setattr(plans, "generate", invalid_response)

    response = client.post("/plans/plan-investor-qa/investor-qa")

    assert response.status_code == 502
    assert response.json()["detail"] == "plans.investor_qa_invalid_response"


def test_investor_qa_surfaces_ai_provider_failures(
    monkeypatch: pytest.MonkeyPatch,
    business_owner: User,
    api_database,
) -> None:
    _save_plan(api_database, business_owner)

    async def unavailable(prompt: str, context: dict[str, object]) -> str:
        raise AIClientError("provider unavailable")

    monkeypatch.setattr(plans, "generate", unavailable)

    response = client.post("/plans/plan-investor-qa/investor-qa")

    assert response.status_code == 503
    assert response.json()["detail"] == "plans.ai_unavailable"


def test_investor_qa_does_not_expose_another_owners_plan(
    monkeypatch: pytest.MonkeyPatch,
    business_owner: User,
    api_database,
) -> None:
    other_owner = User(
        id="other-plan-owner",
        email="other-plan-owner@example.com",
        name="Other Owner",
        role="tadbirkor",
    )
    _save_plan(api_database, other_owner)
    ai_called = False

    async def fake_generate(prompt: str, context: dict[str, object]) -> str:
        nonlocal ai_called
        ai_called = True
        return "{}"

    monkeypatch.setattr(plans, "generate", fake_generate)

    response = client.post("/plans/plan-investor-qa/investor-qa")

    assert response.status_code == 404
    assert response.json()["detail"] == "plans.plan_not_found"
    assert not ai_called
