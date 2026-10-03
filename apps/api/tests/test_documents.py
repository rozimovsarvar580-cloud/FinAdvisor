from decimal import Decimal
from io import BytesIO

import pytest
from fastapi.testclient import TestClient
from openpyxl import load_workbook

from finadvisor_api.documents import (
    PlanDocumentRequest,
    _excel_text,
    render_plan_excel,
    render_plan_pdf,
)
from finadvisor_api.main import app

client = TestClient(app)

plan_response = {
    "summary": "A restaurant serving local cuisine.",
    "sections": [{"title": "Operations", "content": "The restaurant will operate daily."}],
    "calculations": {
        "monthly_revenue": "150000000.00",
        "monthly_payroll": "70000000.00",
        "startup_capex": "50000000.00",
        "total_startup_cost": "60000000.00",
        "monthly_fixed_costs": "11000000.00",
        "monthly_variable_cost": "45000000.00",
        "monthly_operating_profit": "24000000.00",
        "annual_operating_profit": "288000000.00",
        "break_even_revenue": "15714285.71",
        "target_monthly_revenue": "130000000.00",
        "loan_first_payment": None,
        "loan_total_payment": None,
        "loan_total_interest": None,
        "loan_term_months": None,
        "annual_debt_service": None,
        "dscr": None,
    },
}
document_request = {"locale": "uz", "plan": plan_response}


@pytest.mark.parametrize("locale", ["uz", "ru", "en"])
def test_render_plan_pdf_returns_a_pdf_with_localized_document_content(locale: str) -> None:
    request = PlanDocumentRequest.model_validate({**document_request, "locale": locale})

    result = render_plan_pdf(request)

    assert result.startswith(b"%PDF-")
    assert len(result) > 1_000


def test_render_plan_excel_has_multiple_sheets_and_engine_linked_formulas() -> None:
    request = PlanDocumentRequest.model_validate(document_request)

    result = render_plan_excel(request)
    workbook = load_workbook(BytesIO(result), data_only=False)

    assert workbook.sheetnames == ["Xulosa", "Moliya", "Reja"]
    assert workbook["Xulosa"]["B2"].value == "='Moliya'!B2"
    assert Decimal(str(workbook["Moliya"]["B2"].value)) == Decimal("150000000.00")
    assert workbook["Reja"]["B2"].value == plan_response["summary"]


def test_excel_text_neutralizes_formula_like_plan_content() -> None:
    assert _excel_text('=HYPERLINK("https://example.invalid")').startswith("'=")
    assert _excel_text("ordinary text") == "ordinary text"


def test_document_request_rejects_non_decimal_financial_values() -> None:
    payload = {
        **document_request,
        "plan": {
            **plan_response,
            "calculations": {
                **plan_response["calculations"],
                "monthly_revenue": '=HYPERLINK("https://example.invalid")',
            },
        },
    }

    with pytest.raises(ValueError, match="monthly_revenue must be a decimal value"):
        PlanDocumentRequest.model_validate(payload)


def test_pdf_export_endpoint_sets_type_and_safe_attachment_name() -> None:
    response = client.post(
        "/documents/plan_123/pdf",
        json=document_request,
    )

    assert response.status_code == 200
    assert response.headers["content-type"] == "application/pdf"
    assert response.headers["content-disposition"] == (
        'attachment; filename="finadvisor-plan-plan_123.pdf"'
    )
    assert response.content.startswith(b"%PDF-")


def test_excel_export_endpoint_returns_workbook_attachment() -> None:
    response = client.post(
        "/documents/plan_123/excel",
        json=document_request,
    )

    assert response.status_code == 200
    assert response.headers["content-type"].startswith(
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )
    assert response.headers["content-disposition"].endswith('.xlsx"')
    workbook = load_workbook(BytesIO(response.content), data_only=False)
    assert workbook.sheetnames == ["Xulosa", "Moliya", "Reja"]


def test_export_rejects_unsafe_plan_id() -> None:
    response = client.post(
        "/documents/../pdf",
        json=document_request,
    )

    assert response.status_code in {404, 422}
