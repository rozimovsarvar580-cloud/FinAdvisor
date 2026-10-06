from fastapi.testclient import TestClient
from io import BytesIO
from openpyxl import load_workbook

from app.main import app

client = TestClient(app)


def test_plan_export_has_download_headers():
    response = client.get("/api/v1/plans/plan-001/export.csv")
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/csv")
    assert "monthly_revenue" in response.text


def test_plan_xlsx_export_is_a_valid_workbook():
    response = client.get("/api/v1/plans/plan-001/export.xlsx")
    assert response.status_code == 200
    assert response.headers["content-type"].startswith(
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
    )
    workbook = load_workbook(BytesIO(response.content), read_only=True)
    rows = list(workbook["Summary"].values)
    assert rows[0] == ("Metric", "Value", "Currency")
    assert ("monthly_profit", "42700000", "UZS") in rows


def test_investor_surfaces_and_analysis_are_available():
    assert client.get("/api/v1/investors/discover").json()["items"]
    assert client.get("/api/v1/investors/inbox").json()["items"]
    assert client.get("/api/v1/investors/kyc").json()["status"] == "pending"
    analysis = client.get("/api/v1/analysis/plan-001").json()
    assert analysis["bank_readiness"]["currency"] == "UZS"
