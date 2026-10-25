from email.message import EmailMessage
from typing import Self

import httpx
import pytest

from finadvisor_api import email_sender
from finadvisor_api.config import load_settings


class FakeSMTP:
    def __init__(self, host: str, port: int, timeout: int) -> None:
        self.host = host
        self.port = port
        self.timeout = timeout
        self.message: EmailMessage | None = None
        self.started_tls = False

    def __enter__(self) -> Self:
        return self

    def __exit__(self, *args: object) -> None:
        return None

    def starttls(self, context) -> None:
        self.started_tls = True

    def login(self, username: str, password: str) -> None:
        assert username == "mailer"
        assert password == "password-placeholder"

    def send_message(self, message: EmailMessage) -> None:
        self.message = message


def test_smtp_auth_email_is_localized_and_contains_link(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    settings = load_settings(
        {
            "EMAIL_PROVIDER": "smtp",
            "EMAIL_HOST": "mail.example",
            "EMAIL_FROM": "team@example.test",
            "EMAIL_USERNAME": "mailer",
            "EMAIL_PASSWORD": "password-placeholder",
            "NEXTAUTH_URL": "https://app.example",
        }
    )
    smtp = FakeSMTP("mail.example", 587, 10)
    monkeypatch.setattr(email_sender, "get_settings", lambda: settings)
    monkeypatch.setattr(email_sender.smtplib, "SMTP", lambda *args, **kwargs: smtp)

    email_sender.send_auth_email(
        "owner@example.test", "ru", "reset", "one-time-token"
    )

    assert smtp.started_tls is True
    assert smtp.message is not None
    assert smtp.message["To"] == "owner@example.test"
    assert smtp.message["Subject"] == "Сброс пароля"
    assert "https://app.example/ru/reset-password?token=one-time-token" in smtp.message.get_content()


def test_resend_auth_email_uses_configured_secret_and_translation(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    settings = load_settings(
        {
            "EMAIL_PROVIDER": "resend",
            "EMAIL_FROM": "team@example.test",
            "RESEND_API_KEY": "resend-key-placeholder",
            "NEXTAUTH_URL": "https://app.example",
        }
    )
    calls: list[tuple[str, dict[str, object]]] = []

    def fake_post(url: str, **kwargs: object) -> httpx.Response:
        calls.append((url, kwargs))
        return httpx.Response(202, request=httpx.Request("POST", url))

    monkeypatch.setattr(email_sender, "get_settings", lambda: settings)
    monkeypatch.setattr(email_sender.httpx, "post", fake_post)

    email_sender.send_auth_email(
        "owner@example.test", "uz", "verify", "one-time-token"
    )

    assert len(calls) == 1
    url, kwargs = calls[0]
    assert url == "https://api.resend.com/emails"
    assert kwargs["headers"] == {
        "Authorization": "Bearer resend-key-placeholder",
        "Content-Type": "application/json",
    }
    body = kwargs["json"]
    assert isinstance(body, dict)
    assert body["subject"] == "Email manzilingizni tasdiqlang"
    assert "https://app.example/uz/verify-email?token=one-time-token" in body["text"]


def test_console_sender_delivers_welcome_template_in_development(
    monkeypatch: pytest.MonkeyPatch, capsys: pytest.CaptureFixture[str]
) -> None:
    settings = load_settings({"EMAIL_PROVIDER": "console"})
    monkeypatch.setattr(email_sender, "get_settings", lambda: settings)

    email_sender.send_welcome_email("owner@example.test", "en", "Restaurant Owner")

    output = capsys.readouterr().out
    assert "Welcome to FinAdvisor" in output
    assert "Hello, Restaurant Owner." in output


def test_localized_templates_cover_all_three_auth_email_types() -> None:
    for locale in ("uz", "ru", "en"):
        for template in ("verify", "reset", "welcome", "payment_retry"):
            context = (
                {"name": "Owner"}
                if template == "welcome"
                else {"amount": "10.00", "currency": "USD"}
                if template == "payment_retry"
                else {"link": "https://example.test"}
            )
            message = email_sender._build_message(
                "owner@example.test",
                locale,
                template,
                "team@example.test",
                context,
            )
            assert message["Subject"]
            assert message.get_content().strip()


def test_payment_retry_email_is_localized_and_includes_exact_amount(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    settings = load_settings(
        {
            "EMAIL_PROVIDER": "smtp",
            "EMAIL_HOST": "mail.example",
            "EMAIL_FROM": "team@example.test",
            "NEXTAUTH_URL": "https://app.example",
        }
    )
    smtp = FakeSMTP("mail.example", 587, 10)
    monkeypatch.setattr(email_sender, "get_settings", lambda: settings)
    monkeypatch.setattr(email_sender.smtplib, "SMTP", lambda *args, **kwargs: smtp)

    email_sender.send_payment_retry_email("owner@example.test", "ru", "10.00", "USD")

    assert smtp.message is not None
    assert smtp.message["Subject"] == "Повторная попытка оплаты подписки"
    assert "10.00 USD" in smtp.message.get_content()


def test_auth_email_requires_configured_provider(
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    monkeypatch.setattr(
        email_sender, "get_settings", lambda: load_settings({"EMAIL_PROVIDER": "disabled"})
    )

    with pytest.raises(email_sender.EmailDeliveryError):
        email_sender.send_auth_email(
            "owner@example.test", "uz", "verify", "one-time-token"
        )


def test_console_email_delivery_is_rejected_in_production() -> None:
    settings = load_settings(
        {
            "APP_ENV": "production",
            "DATABASE_URL": "postgresql+psycopg://db.example/finadvisor",
            "JWT_SECRET": "test-placeholder-jwt-secret-not-real",
            "EMAIL_PROVIDER": "console",
        }
    )

    with pytest.raises(email_sender.EmailDeliveryError):
        email_sender.get_email_sender(settings)
