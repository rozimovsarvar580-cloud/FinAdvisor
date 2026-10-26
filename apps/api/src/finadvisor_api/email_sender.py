import json
import smtplib
import ssl
from email.message import EmailMessage
from importlib.resources import files
from typing import Literal, Protocol
from urllib.parse import urlencode

import httpx

from finadvisor_api.config import Settings, get_settings

EmailTemplate = Literal[
    "verify", "reset", "welcome", "payment_retry", "receipt",
    "payment_failed", "subscription_ended", "investor_contact_request",
]
_MESSAGES = json.loads(
    files("finadvisor_api")
    .joinpath("auth_email_messages.json")
    .read_text(encoding="utf-8")
)


class EmailDeliveryError(RuntimeError):
    pass


class EmailSender(Protocol):
    def send(self, message: EmailMessage) -> None: ...


class ConsoleEmailSender:
    def send(self, message: EmailMessage) -> None:
        print(message)


class SMTPEmailSender:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    def send(self, message: EmailMessage) -> None:
        try:
            with smtplib.SMTP(
                self.settings.email_host,
                self.settings.email_port,
                timeout=10,
            ) as client:
                client.starttls(context=ssl.create_default_context())
                if self.settings.email_username and self.settings.email_password:
                    client.login(
                        self.settings.email_username,
                        self.settings.email_password,
                    )
                client.send_message(message)
        except (smtplib.SMTPException, OSError) as error:
            raise EmailDeliveryError("Authentication email delivery failed") from error


class ResendEmailSender:
    def __init__(self, settings: Settings) -> None:
        self.settings = settings

    def send(self, message: EmailMessage) -> None:
        try:
            response = httpx.post(
                "https://api.resend.com/emails",
                headers={
                    "Authorization": f"Bearer {self.settings.resend_api_key}",
                    "Content-Type": "application/json",
                },
                json={
                    "from": message["From"],
                    "to": [message["To"]],
                    "subject": message["Subject"],
                    "text": message.get_content(),
                },
                timeout=10,
            )
            response.raise_for_status()
        except (httpx.HTTPStatusError, httpx.RequestError) as error:
            raise EmailDeliveryError("Authentication email delivery failed") from error


def get_email_sender(settings: Settings | None = None) -> EmailSender:
    configuration = settings or get_settings()
    if configuration.email_provider == "console":
        if configuration.environment in {"prod", "production"}:
            raise EmailDeliveryError("Console email delivery is not allowed in production")
        return ConsoleEmailSender()
    if configuration.email_provider == "smtp":
        if (
            not configuration.email_host
            or not configuration.email_from
            or not configuration.nextauth_url
            or bool(configuration.email_username)
            != bool(configuration.email_password)
        ):
            raise EmailDeliveryError("SMTP email delivery is not fully configured")
        return SMTPEmailSender(configuration)
    if configuration.email_provider == "resend":
        if (
            not configuration.resend_api_key
            or not configuration.email_from
            or not configuration.nextauth_url
        ):
            raise EmailDeliveryError("Resend email delivery is not fully configured")
        return ResendEmailSender(configuration)
    raise EmailDeliveryError("Authentication email delivery is not configured")


def ensure_auth_email_delivery_configured() -> None:
    get_email_sender()


def _build_message(
    recipient: str,
    locale: str,
    template: EmailTemplate,
    sender_address: str,
    context: dict[str, str],
) -> EmailMessage:
    localized = _MESSAGES.get(locale, _MESSAGES["uz"])
    template_messages = localized[template]
    message = EmailMessage()
    message["Subject"] = template_messages["subject"]
    message["From"] = sender_address
    message["To"] = recipient
    message.set_content(template_messages["body"].format(**context))
    return message


def _send_template_email(
    recipient: str,
    locale: str,
    template: EmailTemplate,
    context: dict[str, str],
) -> None:
    settings = get_settings()
    sender = get_email_sender(settings)
    message = _build_message(
        recipient,
        locale,
        template,
        settings.email_from or "FinAdvisor",
        context,
    )
    sender.send(message)


def send_auth_email(
    recipient: str,
    locale: str,
    purpose: Literal["verify", "reset"],
    token: str,
) -> None:
    settings = get_settings()
    path = "verify-email" if purpose == "verify" else "reset-password"
    base_url = (settings.nextauth_url or "http://localhost:3000").rstrip("/")
    link = f"{base_url}/{locale}/{path}?{urlencode({'token': token})}"
    _send_template_email(recipient, locale, purpose, {"link": link})


def send_welcome_email(recipient: str, locale: str, name: str) -> None:
    _send_template_email(recipient, locale, "welcome", {"name": name})


def send_payment_retry_email(
    recipient: str, locale: str, amount: str, currency: str
) -> None:
    _send_template_email(
        recipient,
        locale,
        "payment_retry",
        {"amount": amount, "currency": currency},
    )


def send_transactional_email(
    recipient: str, locale: str, template: Literal[
        "receipt", "payment_failed", "subscription_ended", "investor_contact_request"
    ], **context: str,
) -> None:
    _send_template_email(recipient, locale, template, context)


def send_investor_contact_request_email(
    recipient: str, locale: str, investor: str, business: str, message: str
) -> None:
    send_transactional_email(
        recipient, locale, "investor_contact_request",
        investor=investor, business=business, message=message,
    )


def send_marketplace_email(recipient: str, locale: str, subject: str, body: str) -> None:
    settings = get_settings()
    message = EmailMessage()
    message["Subject"] = subject
    message["From"] = settings.email_from or "FinAdvisor"
    message["To"] = recipient
    message.set_content(body)
    get_email_sender(settings).send(message)
