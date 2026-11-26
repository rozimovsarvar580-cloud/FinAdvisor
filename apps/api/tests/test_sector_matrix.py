import json
from decimal import Decimal
from io import BytesIO

import pytest
from finance_engine.sectors import load_sectors
from openpyxl import load_workbook
from pypdf import PdfReader

from finadvisor_api import plans
from finadvisor_api.documents import (
    PlanDocumentRequest,
    render_plan_excel,
    render_plan_pdf,
)
from finadvisor_api.plan_schemas import SectorPlanGenerateRequest

SECTORS = load_sectors()


def _revenue_inputs(revenue_model: str) -> dict[str, str]:
    if revenue_model == "capacity_utilization":
        return {
            "capacity_units": "10",
            "turns_or_occupancy_per_day": "2",
            "operating_days_per_month": "20",
            "utilization_percent": "50",
            "average_ticket": "10000",
        }
    if revenue_model == "unit_sales":
        return {"units_per_month": "100", "price_per_unit": "10000"}
    if revenue_model == "hourly_service":
        return {
            "staff_hours_per_month": "100",
            "rate_per_hour": "10000",
            "utilization_percent": "50",
        }
    if revenue_model == "recurring":
        return {
            "starting_subscribers": "100",
            "average_revenue_per_user": "10000",
            "monthly_churn_percent": "5",
        }
    return {
        "project_opportunities_per_month": "4",
        "average_project_value": "250000",
        "conversion_percent": "25",
    }


@pytest.mark.parametrize("sector", SECTORS, ids=lambda sector: sector.id)
@pytest.mark.anyio
async def test_every_sector_runs_wizard_inputs_engine_fake_ai_and_exports(
    monkeypatch: pytest.MonkeyPatch,
    sector,
) -> None:
    cost_category = sector.cost_categories[0]
    staff_role = sector.staff_roles[0]
    payload = SectorPlanGenerateRequest(
        locale="en",
        business_name=f"Matrix {sector.names['en']}",
        location="Tashkent",
        sector_id=sector.id,
        inputs={
            "stage": "operating",
            "description": f"A test {sector.names['en']} business.",
            "revenue_model_type": sector.revenue_model_type,
            "revenue": _revenue_inputs(sector.revenue_model_type),
            "staff": [
                {
                    "role": staff_role,
                    "employee_count": "1",
                    "monthly_salary": "1000",
                }
            ],
            "costs": [
                {"category": cost_category, "monthly_amount": "500"}
            ],
            "cost_of_goods": [],
            "custom_cost_lines": [],
            "working_capital": "0",
        },
        clarification_answers=(
            ["The numeric inputs above are complete."]
            if sector.id == "generic_other"
            else []
        ),
    )

    async def fake_generate(prompt: str, context: dict[str, object]) -> str:
        assert sector.names["en"] in prompt or sector.names["en"] in str(context)
        prepared = context["prepared_finance_engine_results"]
        assert isinstance(prepared, dict)
        assert prepared["monthly_revenue"] is not None
        return json.dumps(
            {
                "summary": f"Completed {sector.names['en']} plan.",
                "sections": [
                    {
                        "title": "Operations",
                        "content": "The supplied sector inputs were used.",
                    }
                ],
                "clarifying_questions": [],
                "stated_assumptions": ["Values come only from supplied inputs."],
            }
        )

    monkeypatch.setattr(plans, "generate", fake_generate)
    generated = await plans._generate_sector_plan(payload)

    assert generated.assumptions.sector_id == sector.id
    assert generated.calculations.monthly_revenue is not None
    assert Decimal(generated.calculations.monthly_revenue).is_finite()

    request = PlanDocumentRequest(
        locale="en",
        plan=generated,
    )
    pdf = render_plan_pdf(request)
    pdf_text = "\n".join(
        page.extract_text() or "" for page in PdfReader(BytesIO(pdf)).pages
    )
    assert sector.names["en"] in pdf_text

    workbook = load_workbook(BytesIO(render_plan_excel(request)), data_only=True)
    workbook_text = " ".join(
        str(cell.value)
        for sheet in workbook.worksheets
        for row in sheet.iter_rows()
        for cell in row
        if cell.value is not None
    )
    assert sector.names["en"] in workbook_text
