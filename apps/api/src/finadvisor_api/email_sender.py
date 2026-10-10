import logging
import smtplib
from dataclasses import dataclass
from email.message import EmailMessage as SMTPMessage
from html import escape
from typing import Literal, Protocol
from urllib.parse import quote

import httpx

from finadvisor_api.config import Settings, get_settings

EmailKind = Literal["verify", "reset", "welcome"]
SUPPORTED_LOCALES = {"en", "ru", "uz"}
LOGGER = logging.getLogger(__name__)

_TEMPLATES: dict[str, dict[EmailKind, tuple[str, str, str]]] = {
    "en": {
        "verify": (
            "Verify your FinAdvisor email",
            "Confirm your email address using this link: {url}",
            "Confirm your email address by selecting the link below.",
        ),
        "reset": (
            "Reset your FinAdvisor password",
            "Reset your password using this link: {url}",
            "A password reset was requested for your account. Select below to continue.",
        ),
        "welcome": (
            "Welcome to FinAdvisor",
            "Welcome to FinAdvisor. Get started: {url}",
            "Welcome to FinAdvisor. Open your workspace to get started.",
        ),
    },
    "ru": {
        "verify": (
            "Подтвердите адрес электронной почты FinAdvisor",
            "Подтвердите адрес электронной почты по ссылке: {url}",
            "Чтобы подтвердить адрес электронной почты, перейдите по ссылке ниже.",
        ),
        "reset": (
            "Сбросьте пароль FinAdvisor",
            "Сбросьте пароль по ссылке: {url}",
            "Для вашей учетной записи запрошен сброс пароля. Перейдите по ссылке ниже.",
        ),
        "welcome": (
            "Добро пожаловать в FinAdvisor",
            "Добро пожаловать в FinAdvisor. Начните работу: {url}",
            "Добро пожаловать в FinAdvisor. Откройте рабочее пространство, чтобы начать.",
        ),
    },
    "uz": {
        "verify": (
            "FinAdvisor elektron pochta manzilini tasdiqlang",
            "Elektron pochta manzilini ushbu havola orqali tasdiqlang: {url}",
            "Elektron pochta manzilini tasdiqlash uchun quyidagi havolani oching.",
        ),
        "reset": (
            "FinAdvisor parolini tiklang",
            "Parolni ushbu havola orqali tiklang: {url}",
            "Hisobingiz uchun parolni tiklash so'raldi. Davom etish uchun quyidagi havolani oching.",
        ),
        "welcome": (
            "FinAdvisor xizmatiga xush kelibsiz",
            "FinAdvisor xizmatiga xush kelibsiz. Ishni boshlang: {url}",
            "FinAdvisor xizmatiga xush kelibsiz. Ishni boshlash uchun ish maydoningizni oching.",
        ),
    },
}


@dataclass(frozen=True)
class OutboundEmail:
    recipient: str
    subject: str
    text_body: str
    html_body: str


class EmailSender(Protocol):
    def send(self, message: OutboundEmail) -> None: ...


class ConsoleEmailSender:
    def send(self, message: OutboundEmail) -> None:
        LOGGER.info(
            "Email delivery (console):\nTo: %s\nSubject: %s\n\n%s",
            message.recipient,
            message.subject,
            message.text_body,
        )


class SMTPEmailSender:
    def __init__(self, settings: Settings) -> None:
        if not settings.email_host or not settings.email_from:
            raise RuntimeError("EMAIL_HOST and EMAIL_FROM are required for SMTP")
        self.settings = settings

    def send(self, message: OutboundEmail) -> None:
        email = SMTPMessage()
        email["From"] = self.settings.email_from
        email["To"] = message.recipient
        email["Subject"] = message.subject
        email.set_content(message.text_body)
        email.add_alternative(message.html_body, subtype="html")

        with smtplib.SMTP(
            self.settings.email_host, self.settings.email_port, timeout=10
        ) as client:
            client.starttls()
            if self.settings.email_username and self.settings.email_password:
                client.login(
                    self.settings.email_username, self.settings.email_password
                )
            client.send_message(email)


class ResendEmailSender:
    def __init__(self, settings: Settings) -> None:
        if not settings.email_api_key or not settings.email_from:
            raise RuntimeError("EMAIL_API_KEY and EMAIL_FROM are required for Resend")
        self.settings = settings

    def send(self, message: OutboundEmail) -> None:
        response = httpx.post(
            "https://api.resend.com/emails",
            headers={"Authorization": f"Bearer {self.settings.email_api_key}"},
            json={
                "from": self.settings.email_from,
                "to": [message.recipient],
                "subject": message.subject,
                "text": message.text_body,
                "html": message.html_body,
            },
            timeout=10.0,
        )
        response.raise_for_status()


def get_email_sender(settings: Settings | None = None) -> EmailSender:
    configuration = settings or get_settings()
    if configuration.email_provider == "console":
        return ConsoleEmailSender()
    if configuration.email_provider == "smtp":
        return SMTPEmailSender(configuration)
    if configuration.email_provider == "resend":
        return ResendEmailSender(configuration)
    if configuration.email_provider == "disabled":
        raise RuntimeError("EMAIL_PROVIDER must be configured to send email")
    raise RuntimeError(
        f"Unsupported EMAIL_PROVIDER: {configuration.email_provider}"
    )


def build_email(
    kind: EmailKind, locale: str, recipient: str, action_url: str
) -> OutboundEmail:
    try:
        subject, text_template, html_intro = _TEMPLATES[locale][kind]
    except KeyError as error:
        if locale not in SUPPORTED_LOCALES:
            raise ValueError(f"Unsupported email locale: {locale}") from error
        raise
    text_body = text_template.format(url=action_url)
    html_body = (
        "<!doctype html><html><body><p>"
        + escape(html_intro)
        + '</p><p><a href="'
        + escape(action_url, quote=True)
        + '">'
        + escape(action_url)
        + "</a></p></body></html>"
    )
    return OutboundEmail(
        recipient=recipient,
        subject=subject,
        text_body=text_body,
        html_body=html_body,
    )


def build_action_url(
    kind: Literal["verify", "reset", "welcome"],
    locale: str,
    token: str | None = None,
    base_url: str | None = None,
) -> str:
    if locale not in SUPPORTED_LOCALES:
        raise ValueError(f"Unsupported email locale: {locale}")
    settings = get_settings()
    configured_base_url = base_url or settings.nextauth_url
    if configured_base_url is None:
        if settings.environment not in {"dev", "development"}:
            raise RuntimeError("NEXTAUTH_URL is required to build email action links")
        configured_base_url = "http://localhost:3000"
    root = configured_base_url.rstrip("/")
    paths = {
        "verify": "verify-email",
        "reset": "reset-password",
        "welcome": "app",
    }
    url = f"{root}/{locale}/{paths[kind]}"
    if token is not None:
        url += f"?token={quote(token, safe='')}"
    return url
