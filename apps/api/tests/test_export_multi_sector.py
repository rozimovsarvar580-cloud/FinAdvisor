from decimal import Decimal
from io import BytesIO

import pytest
from fastapi import HTTPException
from openpyxl import load_workbook
from pypdf import PdfReader

from finadvisor_api.documents import (
    DOCUMENT_MESSAGES,
    PlanDocumentRequest,
    render_bank_pack_pdf,
    render_plan_excel,
    render_plan_pdf,
    render_synergy_pdf,
)
from finadvisor_api.sectors import find_sector

SECTORS = ("retail_shop", "it_services", "beauty_salon")
LOCALES = ("uz", "ru", "en")


def _request(sector_id: str, locale: str) -> PlanDocumentRequest:
    return PlanDocumentRequest.model_validate(
        {
            "locale": locale,
            "plan": {
                "summary": "A concise sector business plan.",
                "sections": [
                    {"title": "Market", "content": "Demand and competitors are assessed."},
                    {"title": "Operations", "content": "The operating capacity is documented."},
                ],
                "markdown": "# A concise sector business plan.",
                "calculations": {
                    "monthly_revenue": "15000000.00",
                    "monthly_cost_of_goods": "4000000.00",
                    "monthly_operating_expenses": "2000000.00",
                    "monthly_payroll": "3000000.00",
                    "monthly_operating_profit": "6000000.00",
                    "annual_operating_profit": "72000000.00",
                    "break_even_revenue": "8000000.00",
                    "formula": "Prepared finance-engine result",
                },
                "assumptions": {
                    "locale": locale,
                    "business_name": "Sector Test Business",
                    "location": "Tashkent",
                    "sector_id": sector_id,
                    "inputs": {
                        "description": "A local business.",
                        "revenue": {"monthly_target": "15000000"},
                    },
                    "clarification_answers": [],
                },
                "clarifying_questions": [],
                "stated_assumptions": ["Finance-engine results are supplied."],
            },
        }
    )


@pytest.mark.parametrize("sector_id", SECTORS)
@pytest.mark.parametrize("locale", LOCALES)
def test_sector_pdf_excel_and_bank_pack_exports_use_sector_and_plan_data(
    sector_id: str,
    locale: str,
) -> None:
    request = _request(sector_id, locale)
    sector = find_sector(sector_id)
    assert sector is not None
    sector_name = sector.names[locale]
    messages = DOCUMENT_MESSAGES[locale]["sector_exports"]

    pdf = render_plan_pdf(request)
    plan_text = "\n".join(
        page.extract_text() or "" for page in PdfReader(BytesIO(pdf)).pages
    )
    assert sector_name in plan_text
    assert "Demand and competitors are assessed." in plan_text
    assert "15,000,000.00 UZS" in plan_text
    assert "restaurant" not in plan_text.casefold()

    bank_pack = render_bank_pack_pdf(request)
    bank_text = "\n".join(
        page.extract_text() or "" for page in PdfReader(BytesIO(bank_pack)).pages
    )
    assert sector_name in bank_text
    if locale == "en":
        assert str(messages["bank_readiness"]) in bank_text
        assert str(messages["readiness_disclaimer"]) in bank_text
    assert "100" in bank_text
    assert "restaurant" not in bank_text.casefold()

    workbook = load_workbook(BytesIO(render_plan_excel(request)), data_only=False)
    assert workbook.sheetnames == [
        messages["sheet_summary"],
        messages["sheet_financials"],
        messages["sheet_assumptions"],
        messages["sheet_plan"],
    ]
    assert workbook[workbook.sheetnames[0]]["B3"].value == sector_name
    assert Decimal(str(workbook[workbook.sheetnames[1]]["B2"].value)) == Decimal(
        "15000000.00"
    )
    workbook_text = " ".join(
        str(cell.value)
        for sheet in workbook.worksheets
        for row in sheet.iter_rows()
        for cell in row
        if cell.value is not None
    )
    assert "restaurant" not in workbook_text.casefold()


def test_sector_export_rejects_clarification_only_plan() -> None:
    payload = {
        "locale": "en",
        "plan": {
            "summary": "More information is needed.",
            "sections": [{"title": "Questions", "content": "Provide revenue details."}],
            "markdown": "More information is needed.",
            "calculations": {
                "monthly_revenue": None,
                "monthly_cost_of_goods": None,
                "monthly_operating_expenses": None,
                "monthly_payroll": None,
                "monthly_operating_profit": None,
                "annual_operating_profit": None,
                "break_even_revenue": None,
                "formula": None,
            },
            "assumptions": {
                "locale": "en",
                "business_name": "Unfinished business",
                "location": "Tashkent",
                "sector_id": "generic_other",
                "inputs": {},
                "clarification_answers": [],
            },
            "clarifying_questions": ["What is the expected monthly revenue?"],
            "stated_assumptions": ["No financial projection is available."],
        },
    }

    with pytest.raises(ValueError, match="finance-engine projection"):
        PlanDocumentRequest.model_validate(payload)


def test_sector_plan_is_not_available_for_restaurant_synergy_export() -> None:
    with pytest.raises(HTTPException) as error:
        render_synergy_pdf(_request("it_services", "en"))
    assert getattr(error.value, "status_code", None) == 422
