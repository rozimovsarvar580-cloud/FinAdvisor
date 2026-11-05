from pathlib import Path

from alembic import command
from alembic.config import Config
from sqlalchemy import create_engine, inspect

from finadvisor_api.models import EmailToken, OAuthAccount, RefreshToken, User


def test_auth_data_model_migration_upgrades_a_fresh_database(
    tmp_path: Path, monkeypatch
) -> None:
    api_root = Path(__file__).resolve().parents[1]
    database_path = tmp_path / "auth-data-model.db"
    database_url = f"sqlite:///{database_path}"
    config = Config(str(api_root / "alembic.ini"))
    config.set_main_option("script_location", str(api_root / "migrations"))
    config.set_main_option("sqlalchemy.url", database_url)
    monkeypatch.delenv("DATABASE_URL", raising=False)

    command.upgrade(config, "head")

    engine = create_engine(database_url)
    try:
        inspector = inspect(engine)
        tables = set(inspector.get_table_names())
        assert {"users", "oauth_accounts", "refresh_tokens", "email_tokens"} <= tables
        auth_models = (User, OAuthAccount, RefreshToken, EmailToken)
        for model in auth_models:
            persisted_columns = {
                column["name"] for column in inspector.get_columns(model.__tablename__)
            }
            assert set(model.__table__.columns.keys()) <= persisted_columns

        user_columns = {column["name"] for column in inspector.get_columns("users")}
        assert {
            "role",
            "needs_role",
            "email_verified",
            "avatar_url",
            "locale",
            "deletion_requested_at",
        } <= user_columns

        oauth_unique_constraints = inspector.get_unique_constraints("oauth_accounts")
        assert any(
            constraint["column_names"] == ["provider", "provider_account_id"]
            for constraint in oauth_unique_constraints
        )

        for table in ("oauth_accounts", "refresh_tokens", "email_tokens"):
            foreign_keys = inspector.get_foreign_keys(table)
            assert any(
                key["constrained_columns"] == ["user_id"]
                and key["referred_table"] == "users"
                and key["options"].get("ondelete") == "CASCADE"
                for key in foreign_keys
            )

        for table in ("refresh_tokens", "email_tokens"):
            unique_constraints = inspector.get_unique_constraints(table)
            assert any(
                constraint["column_names"] == ["token_hash"]
                for constraint in unique_constraints
            )
    finally:
        engine.dispose()
