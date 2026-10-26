import json
import logging

from fastapi.testclient import TestClient

from finadvisor_api.legacy.audit import _security_action
from finadvisor_api.legacy.main import app
from finadvisor_api.request_logging import RequestJsonFormatter, redact_log_value

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


def test_request_logs_are_json_and_include_request_and_user_ids():
    record = logging.LogRecord("finadvisor.audit", logging.INFO, __file__, 1, "api_request", (), None)
    record.request_id = "request-123"
    record.user_id = "user-456"
    record.method = "GET"
    record.path = "/api/v1/profile"
    record.status_code = 200

    event = json.loads(RequestJsonFormatter().format(record))
    assert event == {
        "event": "api_request",
        "request_id": "request-123",
        "user_id": "user-456",
        "method": "GET",
        "path": "/api/v1/profile",
        "status_code": 200,
    }


def test_log_redaction_removes_credentials_and_personal_identifiers():
    message = "email=person@example.com password=hunter2 Bearer abc.def 192.0.2.5"
    redacted = redact_log_value(message)
    assert "person@example.com" not in redacted
    assert "hunter2" not in redacted
    assert "abc.def" not in redacted
    assert "192.0.2.5" not in redacted
