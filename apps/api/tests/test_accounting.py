from fastapi.testclient import TestClient

from finadvisor_api.legacy.db import SessionLocal
from finadvisor_api.legacy.main import app
from finadvisor_api.legacy.session_repository import create_session

client = TestClient(app)
HEADERS = {"Authorization": "Bearer accounting-test-token"}


def _authenticate() -> None:
    with SessionLocal() as db:
        create_session(db, "accounting-test-token", "demo@finadvisor.uz")


def test_accounting_surfaces_return_currency_and_data():
    _authenticate()
    daily = client.get("/api/v1/accounting/daily", headers=HEADERS)
    inventory = client.get("/api/v1/accounting/inventory", headers=HEADERS)
    payroll = client.get("/api/v1/accounting/payroll", headers=HEADERS)
    tax = client.get("/api/v1/accounting/tax", headers=HEADERS)
    loans = client.get("/api/v1/accounting/loans", headers=HEADERS)

    assert daily.status_code == 200
    assert daily.json()["items"][0]["currency"] == "UZS"
    assert inventory.json()["items"]
    assert payroll.json()["currency"] == "UZS"
    assert tax.json()["source"] == "tax_rules_2026.yaml"
    assert loans.json()["items"]


def test_statement_import_is_explicitly_accepted():
    _authenticate()
    response = client.post("/api/v1/accounting/import", headers=HEADERS)
    assert response.status_code == 200
    assert response.json()["status"] == "accepted"
