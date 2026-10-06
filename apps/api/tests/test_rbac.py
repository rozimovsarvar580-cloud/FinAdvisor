from fastapi.testclient import TestClient

from app.main import app
from app.db import SessionLocal
from app.session_repository import create_session

client = TestClient(app)


def test_entrepreneur_can_access_accounting_but_not_admin():
    with SessionLocal() as db:
        create_session(db, "rbac-entrepreneur", "owner@finadvisor.uz", role="entrepreneur")
    headers = {"Authorization": "Bearer rbac-entrepreneur"}
    assert client.get("/api/v1/protected/accounting", headers=headers).status_code == 200
    assert client.get("/api/v1/protected/admin", headers=headers).status_code == 403


def test_investor_can_access_investor_area():
    with SessionLocal() as db:
        create_session(db, "rbac-investor", "investor@finadvisor.uz", role="investor")
    response = client.get("/api/v1/protected/investor", headers={"Authorization": "Bearer rbac-investor"})
    assert response.status_code == 200
