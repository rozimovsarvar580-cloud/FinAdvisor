from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, inspect


def test_auth_schema_upgrade_adds_locale_oauth_and_hashed_token_tables(
    monkeypatch, tmp_path: Path
) -> None:
    api_root = Path(__file__).resolve().parents[1]
    config = Config(str(api_root / "alembic.ini"))
    config.set_main_option("script_location", str(api_root / "migrations"))
    database_path = tmp_path / "auth-schema.db"
    database_url = f"sqlite:///{database_path.as_posix()}"
    config.set_main_option("sqlalchemy.url", database_url.replace("%", "%%"))
    monkeypatch.delenv("DATABASE_URL", raising=False)

    command.upgrade(config, "head")
    inspector = inspect(create_engine(database_url))

    assert "locale" in {column["name"] for column in inspector.get_columns("users")}
    assert {"oauth_accounts", "refresh_tokens", "email_tokens"} <= set(
        inspector.get_table_names()
    )

    oauth_columns = {
        column["name"] for column in inspector.get_columns("oauth_accounts")
    }
    assert {"provider", "provider_account_id", "user_id"} <= oauth_columns
    assert any(
        constraint["column_names"] == ["provider", "provider_account_id"]
        for constraint in inspector.get_unique_constraints("oauth_accounts")
    )

    refresh_columns = {
        column["name"] for column in inspector.get_columns("refresh_tokens")
    }
    assert {"token_hash", "expires_at", "revoked_at", "user_id"} <= refresh_columns
    assert "token" not in refresh_columns
    assert any(
        constraint["column_names"] == ["token_hash"]
        for constraint in inspector.get_unique_constraints("refresh_tokens")
    )

    email_token_columns = {
        column["name"] for column in inspector.get_columns("email_tokens")
    }
    assert {"token_hash", "purpose", "expires_at", "used_at", "user_id"} <= (
        email_token_columns
    )
    assert "token" not in email_token_columns
    assert any(
        constraint["column_names"] == ["token_hash"]
        for constraint in inspector.get_unique_constraints("email_tokens")
    )

    for table in ("oauth_accounts", "refresh_tokens", "email_tokens"):
        assert any(
            foreign_key["referred_table"] == "users"
            and foreign_key["options"].get("ondelete") == "CASCADE"
            for foreign_key in inspector.get_foreign_keys(table)
        )
