from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)
HEADERS = {"Authorization": "Bearer demo-token"}


def test_accounting_surfaces_return_currency_and_data():
    client.post("/api/v1/auth/login", json={"email": "demo@finadvisor.uz", "password": "secret123"})
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
    client.post("/api/v1/auth/login", json={"email": "demo@finadvisor.uz", "password": "secret123"})
    response = client.post("/api/v1/accounting/import", headers=HEADERS)
    assert response.status_code == 200
    assert response.json()["status"] == "accepted"
