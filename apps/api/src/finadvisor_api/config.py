import os
from collections.abc import Mapping
from dataclasses import dataclass
from urllib.parse import urlsplit


@dataclass(frozen=True)
class Settings:
    environment: str
    database_url: str
    database_url_is_set: bool
    redis_url: str
    jwt_secret: str | None
    nextauth_secret: str | None
    nextauth_url: str | None
    internal_api_key: str | None
    google_client_id: str | None
    google_client_secret: str | None
    facebook_client_id: str | None
    facebook_client_secret: str | None
    email_provider: str
    email_host: str | None
    email_port: int
    email_username: str | None
    email_password: str | None
    email_from: str | None
    email_api_key: str | None
    payment_provider: str
    payment_public_key: str | None
    payment_secret_key: str | None
    payment_webhook_secret: str | None
    sentry_dsn: str | None
    finadvisor_api_url: str
    next_public_api_url: str
    openai_api_key: str | None
    openai_model: str
    openai_timeout_seconds: float


def _optional(environ: Mapping[str, str], name: str) -> str | None:
    value = environ.get(name, "").strip()
    return value or None


def _validate_url(name: str, value: str | None, schemes: set[str]) -> None:
    if value is None:
        return
    parsed = urlsplit(value)
    if parsed.scheme not in schemes or not parsed.netloc:
        raise ValueError(f"{name} must be an absolute URL using {', '.join(sorted(schemes))}")


def _validate_database_url(value: str) -> None:
    if not urlsplit(value).scheme:
        raise ValueError("DATABASE_URL must include a database scheme")


def load_settings(environ: Mapping[str, str] | None = None) -> Settings:
    values = os.environ if environ is None else environ
    environment = (
        values.get("APP_ENV")
        or values.get("ENVIRONMENT")
        or values.get("NODE_ENV")
        or "development"
    ).strip().lower()

    if environment in {"prod", "production"}:
        missing = [
            name
            for name in ("DATABASE_URL", "JWT_SECRET")
            if not values.get(name, "").strip()
        ]
        if missing:
            raise RuntimeError(
                "Missing required production configuration: " + ", ".join(missing)
            )

    try:
        email_port = int(values.get("EMAIL_PORT") or "587")
    except ValueError as error:
        raise ValueError("EMAIL_PORT must be an integer") from error
    if not 1 <= email_port <= 65535:
        raise ValueError("EMAIL_PORT must be between 1 and 65535")

    try:
        openai_timeout_seconds = float(values.get("OPENAI_TIMEOUT_SECONDS") or "30")
    except ValueError as error:
        raise ValueError("OPENAI_TIMEOUT_SECONDS must be a number") from error
    if openai_timeout_seconds <= 0:
        raise ValueError("OPENAI_TIMEOUT_SECONDS must be greater than zero")

    nextauth_url = _optional(values, "NEXTAUTH_URL")
    sentry_dsn = _optional(values, "SENTRY_DSN")
    redis_url = values.get("REDIS_URL", "redis://localhost:6379/0").strip()
    database_url = values.get("DATABASE_URL", "sqlite:///./finadvisor.db")
    _validate_url("NEXTAUTH_URL", nextauth_url, {"http", "https"})
    _validate_url("SENTRY_DSN", sentry_dsn, {"http", "https"})
    _validate_url("REDIS_URL", redis_url, {"redis", "rediss"})
    _validate_database_url(database_url)

    finadvisor_api_url = values.get(
        "FINADVISOR_API_URL", "http://127.0.0.1:8000"
    ).strip()
    next_public_api_url = values.get(
        "NEXT_PUBLIC_API_URL", "http://127.0.0.1:8000"
    ).strip()
    _validate_url("FINADVISOR_API_URL", finadvisor_api_url, {"http", "https"})
    _validate_url("NEXT_PUBLIC_API_URL", next_public_api_url, {"http", "https"})

    return Settings(
        environment=environment,
        database_url=database_url,
        database_url_is_set=bool(values.get("DATABASE_URL", "").strip()),
        redis_url=redis_url,
        jwt_secret=_optional(values, "JWT_SECRET"),
        nextauth_secret=_optional(values, "NEXTAUTH_SECRET"),
        nextauth_url=nextauth_url,
        internal_api_key=_optional(values, "INTERNAL_API_KEY"),
        google_client_id=_optional(values, "GOOGLE_CLIENT_ID"),
        google_client_secret=_optional(values, "GOOGLE_CLIENT_SECRET"),
        facebook_client_id=_optional(values, "FACEBOOK_CLIENT_ID"),
        facebook_client_secret=_optional(values, "FACEBOOK_CLIENT_SECRET"),
        email_provider=values.get(
            "EMAIL_PROVIDER",
            "console" if environment in {"dev", "development"} else "disabled",
        )
        .strip()
        .lower(),
        email_host=_optional(values, "EMAIL_HOST"),
        email_port=email_port,
        email_username=_optional(values, "EMAIL_USERNAME"),
        email_password=_optional(values, "EMAIL_PASSWORD"),
        email_from=_optional(values, "EMAIL_FROM"),
        email_api_key=_optional(values, "EMAIL_API_KEY"),
        payment_provider=values.get("PAYMENT_PROVIDER", "disabled").strip().lower(),
        payment_public_key=_optional(values, "PAYMENT_PUBLIC_KEY"),
        payment_secret_key=_optional(values, "PAYMENT_SECRET_KEY"),
        payment_webhook_secret=_optional(values, "PAYMENT_WEBHOOK_SECRET"),
        sentry_dsn=sentry_dsn,
        finadvisor_api_url=finadvisor_api_url,
        next_public_api_url=next_public_api_url,
        openai_api_key=_optional(values, "OPENAI_API_KEY"),
        openai_model=values.get("OPENAI_MODEL", "gpt-4o-mini").strip(),
        openai_timeout_seconds=openai_timeout_seconds,
    )


def get_settings() -> Settings:
    return load_settings()


settings = load_settings()
