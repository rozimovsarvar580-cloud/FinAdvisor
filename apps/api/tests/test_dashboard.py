from fastapi.testclient import TestClient

from finadvisor_api.legacy.db import SessionLocal
from finadvisor_api.legacy.main import app
from finadvisor_api.legacy.session_repository import create_session

client = TestClient(app)


def entrepreneur_headers():
    with SessionLocal() as db:
        create_session(db, "dashboard-test-token", "dashboard@finadvisor.uz")
    return {"Authorization": "Bearer dashboard-test-token"}


def test_onboarding_summary_is_available():
    response = client.get(
        "/api/v1/workspace/onboarding", headers=entrepreneur_headers()
    )
    assert response.status_code == 200
    assert response.json()["status"] == "in_progress"


def test_dashboard_summary_has_key_metrics():
    response = client.get(
        "/api/v1/workspace/dashboard", headers=entrepreneur_headers()
    )
    assert response.status_code == 200
    body = response.json()
    assert body["monthly_revenue"] == "248000000"
    assert body["alerts"] == 2


def test_notifications_and_settings_endpoints_work():
    headers = entrepreneur_headers()
    settings = client.get("/api/v1/workspace/settings", headers=headers)
    notifications = client.get("/api/v1/workspace/notifications", headers=headers)
    assert settings.status_code == 200
    assert notifications.status_code == 200
    assert len(notifications.json()["items"]) >= 1
