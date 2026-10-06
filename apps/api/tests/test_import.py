from io import BytesIO

from fastapi.testclient import TestClient

from finadvisor_api.legacy.main import app

client = TestClient(app)
HEADERS = {"Authorization": "Bearer demo-token"}


def test_csv_import_counts_data_rows():
    response = client.post(
        "/api/v1/accounting/import",
        files={"file": ("statement.csv", BytesIO(b"date,amount\n2026-09-21,100"), "text/csv")},
        headers=HEADERS,
    )
    assert response.status_code == 200
    assert response.json()["rows_received"] == 1


def test_import_rejects_unknown_extension():
    response = client.post(
        "/api/v1/accounting/import",
        files={"file": ("statement.txt", BytesIO(b"data"), "text/plain")},
        headers=HEADERS,
    )
    assert response.status_code == 415
    assert response.json()["code"] == "unsupported_file"
