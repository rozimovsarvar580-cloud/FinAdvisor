import logging

from fastapi.testclient import TestClient

from finadvisor_api.legacy.audit import _security_action
from finadvisor_api.legacy.main import app

client = TestClient(app)


def test_api_request_is_audited_with_request_id(caplog):
    with caplog.at_level(logging.INFO, logger="finadvisor.audit"):
        response = client.get("/api/v1/health", headers={"X-Request-ID": "audit-test-001"})
    assert response.status_code == 200
    assert "audit-test-001" in caplog.text


def test_security_action_classifies_sensitive_routes():
    assert _security_action("/auth/login", "POST") == "login"
    assert _security_action("/admin/users/123", "PATCH") == "role_change"
    assert _security_action("/plans/123/export.xlsx", "GET") == "export"
    assert _security_action("/health", "GET") is None
