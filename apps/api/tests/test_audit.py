import logging

from fastapi.testclient import TestClient

from finadvisor_api.legacy.main import app

client = TestClient(app)


def test_api_request_is_audited_with_request_id(caplog):
    with caplog.at_level(logging.INFO, logger="finadvisor.audit"):
        response = client.get("/api/v1/health", headers={"X-Request-ID": "audit-test-001"})
    assert response.status_code == 200
    assert "audit-test-001" in caplog.text
