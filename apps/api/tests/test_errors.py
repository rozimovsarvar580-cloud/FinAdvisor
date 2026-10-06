from fastapi.testclient import TestClient

from app.main import app

client = TestClient(app)


def test_validation_error_has_standard_shape_and_request_id():
    response = client.post(
        "/api/v1/calc/credit/annuity",
        headers={"X-Request-ID": "request-test-001"},
        json={"principal": "-1", "annual_rate": "10", "months": 12},
    )
    body = response.json()
    assert response.status_code == 422
    assert body["code"] == "validation_error"
    assert body["request_id"] == "request-test-001"
    assert "details" in body


def test_http_error_has_standard_shape_and_request_id():
    response = client.post(
        "/api/v1/auth/login",
        headers={"X-Request-ID": "request-test-002"},
        json={"email": "demo@finadvisor.uz", "password": "wrong"},
    )
    body = response.json()
    assert response.status_code == 401
    assert body["code"] == "invalid_credentials"
    assert body["request_id"] == "request-test-002"
