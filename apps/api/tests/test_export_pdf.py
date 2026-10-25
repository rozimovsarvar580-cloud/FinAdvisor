from io import BytesIO

import pytest
from pypdf import PdfReader

from finadvisor_api.documents import DOCUMENT_MESSAGES, PlanDocumentRequest, render_plan_pdf


@pytest.mark.parametrize("locale", ["uz", "ru", "en"])
def test_pdf_export_contains_localized_plan_and_appendix(locale: str) -> None:
    plan = {
        "summary": "A locally focused cafe.",
        "sections": [
            {"title": "Market overview", "content": "Local dishes are the focus."},
            {"title": "Operations", "content": "Daily cafe operations."},
            {"title": "Staffing", "content": "One cook is planned."},
            {"title": "Risks", "content": "Risks need regular review."},
        ],
        "markdown": "# A locally focused cafe.",
        "calculations": {
            "monthly_revenue": "1",
            "monthly_payroll": "1",
            "startup_capex": "1",
            "total_startup_cost": "1",
            "monthly_fixed_costs": "1",
            "monthly_variable_cost": "1",
            "monthly_operating_profit": "1",
            "annual_operating_profit": "1",
            "break_even_revenue": "1",
            "target_monthly_revenue": "1",
            "loan_first_payment": None,
            "loan_total_payment": None,
            "loan_total_interest": None,
            "loan_term_months": None,
            "annual_debt_service": None,
            "dscr": None,
        },
        "assumptions": {
            "locale": locale,
            "business_name": "PDF Test Cafe",
            "restaurant_format": "cafe",
            "location": "Tashkent",
            "seats": 12,
            "menu_summary": "Local dishes",
            "average_check": "100000",
            "daily_customers": 20,
            "operating_days_per_month": 25,
            "monthly_rent": "5000000",
            "monthly_utilities": "1000000",
            "variable_cost_ratio_percent": "30",
            "staff": [{"role": "Cook", "employee_count": 1, "monthly_salary": "2000000"}],
            "equipment": [{"name": "Oven", "quantity": "1", "unit_cost": "10000000"}],
            "other_startup_cost": "2000000",
            "loan_amount": "0",
            "annual_interest_rate_percent": "0",
            "loan_term_months": 0,
            "target_monthly_profit": "1000000",
        },
    }
    request = PlanDocumentRequest.model_validate({"locale": locale, "plan": plan})

    pdf = render_plan_pdf(request)
    reader = PdfReader(BytesIO(pdf))
    text = "\n".join(page.extract_text() or "" for page in reader.pages)
    messages = DOCUMENT_MESSAGES[locale]

    assert len(reader.pages) >= 3
    assert "PDF Test Cafe" in text
    assert "Local dishes are the focus." in text
    assert "Daily cafe operations." in text
    assert "One cook is planned." in text
    assert "Risks need regular review." in text
    assert messages["market"] in text
    assert messages["operations"] in text
    assert messages["staffing"] in text
    assert messages["risks"] in text
    assert messages["appendix"] in text
    assert "50,000,000.00 UZS" in text
