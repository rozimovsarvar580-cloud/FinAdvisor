from email.message import EmailMessage
from unittest.mock import Mock

import httpx
import pytest

from finadvisor_api.config import Settings, load_settings
from finadvisor_api.email_sender import (
    ConsoleEmailSender,
    EmailKind,
    OutboundEmail,
    ResendEmailSender,
    SMTPEmailSender,
    build_action_url,
    build_email,
    get_email_sender,
)


def _settings(**overrides: str) -> Settings:
    values = {
        "APP_ENV": "production",
        "DATABASE_URL": "sqlite:///./test.db",
        "JWT_SECRET": "unit-test-secret",
        "EMAIL_FROM": "FinAdvisor <noreply@example.com>",
        "EMAIL_HOST": "smtp.example.com",
        "EMAIL_API_KEY": "test-resend-key",
    }
    values.update(overrides)
    return load_settings(values)


@pytest.mark.parametrize("locale", ["uz", "ru", "en"])
@pytest.mark.parametrize("kind", ["verify", "reset", "welcome"])
def test_localized_templates_include_action_url(locale: str, kind: EmailKind) -> None:
    action_url = build_action_url(
        kind, locale, "single-use-token" if kind != "welcome" else None,
        "https://finadvisor.example",
    )
    message = build_email(kind, locale, "owner@example.com", action_url)

    assert message.recipient == "owner@example.com"
    assert message.subject
    assert action_url in message.text_body
    assert action_url in message.html_body


def test_action_url_encodes_tokens_and_rejects_unknown_locales() -> None:
    url = build_action_url(
        "reset", "en", "token with&reserved=chars", "https://finadvisor.example/"
    )

    assert url == (
        "https://finadvisor.example/en/reset-password?"
        "token=token%20with%26reserved%3Dchars"
    )
    with pytest.raises(ValueError, match="Unsupported email locale"):
        build_action_url("verify", "fr", "token")


def test_action_url_requires_a_public_base_url_outside_development(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setenv("APP_ENV", "production")
    monkeypatch.setenv("DATABASE_URL", "sqlite:///./test.db")
    monkeypatch.setenv("JWT_SECRET", "unit-test-secret")
    monkeypatch.delenv("NEXTAUTH_URL", raising=False)

    with pytest.raises(RuntimeError, match="NEXTAUTH_URL is required"):
        build_action_url("verify", "en", "token")

    monkeypatch.setenv("APP_ENV", "development")
    assert build_action_url("verify", "en", "token").startswith(
        "http://localhost:3000/en/verify-email?"
    )


def test_development_defaults_to_console_sender(monkeypatch: pytest.MonkeyPatch) -> None:
    settings = load_settings({"APP_ENV": "development"})
    sender = get_email_sender(settings)
    message = OutboundEmail("owner@example.com", "Welcome", "Plain", "<p>HTML</p>")
    log = Mock()
    monkeypatch.setattr("finadvisor_api.email_sender.LOGGER.info", log)

    assert isinstance(sender, ConsoleEmailSender)
    sender.send(message)
    log.assert_called_once_with(
        "Email delivery (console):\nTo: %s\nSubject: %s\n\n%s",
        "owner@example.com",
        "Welcome",
        "Plain",
    )
    production = load_settings(
        {
            "APP_ENV": "production",
            "DATABASE_URL": "sqlite:///./test.db",
            "JWT_SECRET": "unit-test-secret",
        }
    )
    assert production.email_provider == "disabled"


def test_smtp_sender_uses_tls_and_sends_both_body_types(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    smtp_client = Mock()
    smtp_context = Mock()
    smtp_context.__enter__ = Mock(return_value=smtp_client)
    smtp_context.__exit__ = Mock(return_value=False)
    smtp_factory = Mock(return_value=smtp_context)
    monkeypatch.setattr("finadvisor_api.email_sender.smtplib.SMTP", smtp_factory)
    sender = SMTPEmailSender(
        _settings(EMAIL_USERNAME="mailer", EMAIL_PASSWORD="smtp-test-password")
    )
    message = OutboundEmail(
        "owner@example.com", "Verify", "Plain body", "<p>HTML body</p>"
    )

    sender.send(message)

    smtp_factory.assert_called_once_with("smtp.example.com", 587, timeout=10)
    smtp_client.starttls.assert_called_once_with()
    smtp_client.login.assert_called_once_with("mailer", "smtp-test-password")
    sent_message = smtp_client.send_message.call_args.args[0]
    assert isinstance(sent_message, EmailMessage)
    assert sent_message["To"] == "owner@example.com"
    assert sent_message.get_body(("plain",)).get_content().strip() == "Plain body"
    assert sent_message.get_body(("html",)).get_content().strip() == "<p>HTML body</p>"


def test_resend_sender_posts_email_and_raises_provider_errors(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    response = Mock()
    post = Mock(return_value=response)
    monkeypatch.setattr("finadvisor_api.email_sender.httpx.post", post)
    sender = ResendEmailSender(_settings())
    message = OutboundEmail(
        "owner@example.com", "Reset", "Plain body", "<p>HTML body</p>"
    )

    sender.send(message)

    post.assert_called_once_with(
        "https://api.resend.com/emails",
        headers={"Authorization": "Bearer test-resend-key"},
        json={
            "from": "FinAdvisor <noreply@example.com>",
            "to": ["owner@example.com"],
            "subject": "Reset",
            "text": "Plain body",
            "html": "<p>HTML body</p>",
        },
        timeout=10.0,
    )
    response.raise_for_status.assert_called_once_with()

    post.side_effect = httpx.ConnectError("provider unavailable")
    with pytest.raises(httpx.ConnectError):
        sender.send(message)


def test_sender_selection_requires_a_real_delivery_provider() -> None:
    with pytest.raises(RuntimeError, match="EMAIL_PROVIDER must be configured"):
        get_email_sender(_settings(EMAIL_PROVIDER="disabled"))
    with pytest.raises(RuntimeError, match="Unsupported EMAIL_PROVIDER"):
        get_email_sender(_settings(EMAIL_PROVIDER="unknown"))
    with pytest.raises(RuntimeError, match="EMAIL_API_KEY and EMAIL_FROM"):
        get_email_sender(_settings(EMAIL_PROVIDER="resend", EMAIL_API_KEY=""))
