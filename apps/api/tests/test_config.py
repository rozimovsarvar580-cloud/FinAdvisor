import pytest

from finadvisor_api.config import load_settings


def test_development_settings_have_local_defaults() -> None:
    settings = load_settings({})

    assert settings.environment == "development"
    assert settings.database_url == "sqlite:///./finadvisor.db"
    assert settings.redis_url == "redis://localhost:6379/0"
    assert settings.email_provider == "disabled"
    assert settings.payment_provider == "disabled"
    assert settings.email_port == 587
    assert settings.openai_timeout_seconds == 30


def test_settings_load_optional_integrations_and_api_urls() -> None:
    settings = load_settings(
        {
            "GOOGLE_CLIENT_ID": "google-client-id-placeholder",
            "GOOGLE_CLIENT_SECRET": "google-client-secret-placeholder",
            "FACEBOOK_CLIENT_ID": "facebook-client-id-placeholder",
            "FACEBOOK_CLIENT_SECRET": "facebook-client-secret-placeholder",
            "INTERNAL_API_KEY": "internal-key-placeholder",
            "EMAIL_PROVIDER": "smtp",
            "EMAIL_HOST": "mail.example",
            "EMAIL_USERNAME": "mailer",
            "EMAIL_PASSWORD": "email-password-placeholder",
            "EMAIL_FROM": "team@example.test",
            "PAYMENT_PROVIDER": "test-provider",
            "PAYMENT_PUBLIC_KEY": "payment-public-placeholder",
            "PAYMENT_SECRET_KEY": "payment-secret-placeholder",
            "PAYMENT_WEBHOOK_SECRET": "webhook-secret-placeholder",
            "SENTRY_DSN": "https://public@example.test/1",
        }
    )

    assert settings.google_client_id == "google-client-id-placeholder"
    assert settings.google_client_secret == "google-client-secret-placeholder"
    assert settings.facebook_client_id == "facebook-client-id-placeholder"
    assert settings.facebook_client_secret == "facebook-client-secret-placeholder"
    assert settings.internal_api_key == "internal-key-placeholder"
    assert settings.email_provider == "smtp"
    assert settings.email_host == "mail.example"
    assert settings.email_username == "mailer"
    assert settings.email_from == "team@example.test"
    assert settings.payment_provider == "test-provider"
    assert settings.payment_public_key == "payment-public-placeholder"
    assert settings.payment_secret_key == "payment-secret-placeholder"
    assert settings.payment_webhook_secret == "webhook-secret-placeholder"
    assert settings.sentry_dsn == "https://public@example.test/1"
    assert settings.finadvisor_api_url == "http://127.0.0.1:8000"
    assert settings.next_public_api_url == "http://127.0.0.1:8000"


def test_production_requires_database_and_jwt_configuration() -> None:
    with pytest.raises(
        RuntimeError,
        match="DATABASE_URL, JWT_SECRET",
    ):
        load_settings({"APP_ENV": "production"})


def test_production_loads_configured_settings() -> None:
    settings = load_settings(
        {
            "APP_ENV": "production",
            "DATABASE_URL": "postgresql+psycopg://db.example/finadvisor",
            "JWT_SECRET": "test-placeholder-jwt-secret-not-real",
            "NEXTAUTH_URL": "https://app.example",
            "EMAIL_PORT": "2525",
            "FINADVISOR_API_URL": "https://api.example",
            "NEXT_PUBLIC_API_URL": "https://api.example",
            "OPENAI_TIMEOUT_SECONDS": "12.5",
        }
    )

    assert settings.database_url == "postgresql+psycopg://db.example/finadvisor"
    assert settings.jwt_secret == "test-placeholder-jwt-secret-not-real"
    assert settings.nextauth_url == "https://app.example"
    assert settings.email_port == 2525
    assert settings.finadvisor_api_url == "https://api.example"
    assert settings.next_public_api_url == "https://api.example"
    assert settings.openai_timeout_seconds == 12.5


@pytest.mark.parametrize(
    ("variable", "value", "message"),
    [
        ("NEXTAUTH_URL", "app.example", "NEXTAUTH_URL"),
        ("REDIS_URL", "https://redis.example", "REDIS_URL"),
        ("DATABASE_URL", "database-without-scheme", "DATABASE_URL"),
        ("EMAIL_PORT", "not-a-port", "EMAIL_PORT must be an integer"),
        ("EMAIL_PORT", "70000", "EMAIL_PORT must be between"),
        ("OPENAI_TIMEOUT_SECONDS", "0", "OPENAI_TIMEOUT_SECONDS"),
    ],
)
def test_settings_reject_invalid_values(
    variable: str,
    value: str,
    message: str,
) -> None:
    with pytest.raises(ValueError, match=message):
        load_settings({variable: value})
