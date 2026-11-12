from unittest.mock import Mock

from fastapi.testclient import TestClient

from finadvisor_api.email_sender import EmailDeliveryError
from finadvisor_api.main import app


def test_support_contact_sends_consented_message(monkeypatch):
    calls: list[dict[str, str]] = []

    def send(**kwargs: str) -> None:
        calls.append(kwargs)

    monkeypatch.setattr("finadvisor_api.support.send_support_contact_email", send)
    response = TestClient(app).post(
        "/support/contact",
        json={
            "name": "Restaurant owner",
            "email": "owner@example.com",
            "category": "feedback",
            "message": "Please add an option to export monthly summaries.",
            "consent": True,
            "locale": "en",
        },
    )

    assert response.status_code == 202
    assert response.json() == {"sent": True}
    assert calls == [
        {
            "locale": "en",
            "name": "Restaurant owner",
            "email": "owner@example.com",
            "category": "feedback",
            "message_body": "Please add an option to export monthly summaries.",
        }
    ]


def test_support_contact_requires_valid_input_and_explicit_consent(monkeypatch):
    send = Mock()
    monkeypatch.setattr("finadvisor_api.support.send_support_contact_email", send)
    client = TestClient(app)
    payload = {
        "name": "Owner",
        "email": "owner@example.com",
        "category": "general",
        "message": "I need help with my account.",
        "consent": True,
        "locale": "en",
    }

    missing_consent = {key: value for key, value in payload.items() if key != "consent"}
    assert client.post("/support/contact", json=missing_consent).status_code == 422
    invalid_email = {**payload, "email": "not-an-email"}
    assert client.post("/support/contact", json=invalid_email).status_code == 422
    assert send.call_count == 0


def test_support_contact_surfaces_delivery_failure(monkeypatch):
    def fail(**_kwargs: str) -> None:
        raise EmailDeliveryError("email delivery is unavailable")

    monkeypatch.setattr("finadvisor_api.support.send_support_contact_email", fail)
    response = TestClient(app).post(
        "/support/contact",
        json={
            "name": "Owner",
            "email": "owner@example.com",
            "category": "general",
            "message": "I need help with my account.",
            "consent": True,
            "locale": "en",
        },
    )

    assert response.status_code == 503
    assert response.json()["detail"] == "support.email_delivery_unavailable"
