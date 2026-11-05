<<<<<<< HEAD
import logging
import smtplib
from dataclasses import dataclass
from email.message import EmailMessage as SMTPMessage
from html import escape
from typing import Literal, Protocol
from urllib.parse import quote
=======
import json
import smtplib
import ssl
from email.message import EmailMessage
from importlib.resources import files
from typing import Literal, Protocol
from urllib.parse import urlencode
>>>>>>> 12899e6e553a1563cc224d5ccc910c29dc2ea331

import httpx

from finadvisor_api.config import Settings, get_settings

<<<<<<< HEAD
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
=======
EmailTemplate = Literal["verify", "reset", "welcome", "payment_retry"]
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
>>>>>>> 12899e6e553a1563cc224d5ccc910c29dc2ea331


class SMTPEmailSender:
    def __init__(self, settings: Settings) -> None:
<<<<<<< HEAD
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
=======
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
>>>>>>> 12899e6e553a1563cc224d5ccc910c29dc2ea331


class ResendEmailSender:
    def __init__(self, settings: Settings) -> None:
<<<<<<< HEAD
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
=======
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
>>>>>>> 12899e6e553a1563cc224d5ccc910c29dc2ea331


def get_email_sender(settings: Settings | None = None) -> EmailSender:
    configuration = settings or get_settings()
    if configuration.email_provider == "console":
<<<<<<< HEAD
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
=======
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
>>>>>>> 12899e6e553a1563cc224d5ccc910c29dc2ea331
