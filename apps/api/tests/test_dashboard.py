from fastapi.testclient import TestClient

from finadvisor_api.legacy.main import app

client = TestClient(app)


def test_onboarding_summary_is_available():
    response = client.get("/api/v1/workspace/onboarding")
    assert response.status_code == 200
    assert response.json()["status"] == "in_progress"


def test_dashboard_summary_has_key_metrics():
    response = client.get("/api/v1/workspace/dashboard")
    assert response.status_code == 200
    body = response.json()
    assert body["monthly_revenue"] == "248000000"
    assert body["alerts"] == 2


def test_notifications_and_settings_endpoints_work():
    settings = client.get("/api/v1/workspace/settings")
    notifications = client.get("/api/v1/workspace/notifications")
    assert settings.status_code == 200
    assert notifications.status_code == 200
    assert len(notifications.json()["items"]) >= 1
