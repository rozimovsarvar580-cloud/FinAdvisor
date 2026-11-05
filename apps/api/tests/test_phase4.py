from io import BytesIO
from uuid import uuid4

from fastapi.testclient import TestClient
from openpyxl import load_workbook

from finadvisor_api.legacy.db import SessionLocal
from finadvisor_api.legacy.main import app
from finadvisor_api.legacy.session_repository import create_session

client = TestClient(app)


def auth_headers(role: str):
    token = f"phase4-{role}-{uuid4().hex}"
    with SessionLocal() as db:
        create_session(db, token, f"{token}@finadvisor.uz", role=role)
    return {"Authorization": f"Bearer {token}"}


def test_plan_export_has_download_headers():
    response = client.get(
        "/api/v1/plans/plan-001/export.csv", headers=auth_headers("entrepreneur")
    )
    assert response.status_code == 200
    assert response.headers["content-type"].startswith("text/csv")
    assert "monthly_revenue" in response.text


def test_plan_xlsx_export_is_a_valid_workbook():
    response = client.get(
        "/api/v1/plans/plan-001/export.xlsx", headers=auth_headers("entrepreneur")
    )
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
    investor = auth_headers("investor")
    assert client.get("/api/v1/investors/inbox", headers=investor).json()["items"]
    assert client.get("/api/v1/investors/kyc", headers=investor).json()["status"] == "pending"
    analysis = client.get(
        "/api/v1/analysis/plan-001", headers=auth_headers("entrepreneur")
    ).json()
    assert analysis["bank_readiness"]["currency"] == "UZS"
