from io import BytesIO

from fastapi.testclient import TestClient

from finadvisor_api.legacy.db import SessionLocal
from finadvisor_api.legacy.main import app
from finadvisor_api.legacy.session_repository import create_session

client = TestClient(app)
HEADERS = {"Authorization": "Bearer import-test-token"}


def _authenticate() -> None:
    with SessionLocal() as db:
        create_session(db, "import-test-token", "demo@finadvisor.uz")


def test_csv_import_counts_data_rows():
    _authenticate()
    response = client.post(
        "/api/v1/accounting/import",
        files={"file": ("statement.csv", BytesIO(b"date,amount\n2026-09-21,100"), "text/csv")},
        headers=HEADERS,
    )
    assert response.status_code == 200
    assert response.json()["rows_received"] == 1


def test_import_rejects_unknown_extension():
    _authenticate()
    response = client.post(
        "/api/v1/accounting/import",
        files={"file": ("statement.txt", BytesIO(b"data"), "text/plain")},
        headers=HEADERS,
    )
    assert response.status_code == 415
    assert response.json()["code"] == "unsupported_file"
