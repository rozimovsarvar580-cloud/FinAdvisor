from pathlib import Path

from alembic import command
from alembic.config import Config
from alembic.script import ScriptDirectory
from sqlalchemy import create_engine, inspect


def test_migrations_form_one_chain_and_upgrade_fresh_sqlite(
    monkeypatch, tmp_path
) -> None:
    api_root = Path(__file__).resolve().parents[1]
    config = Config(str(api_root / "alembic.ini"))
    config.set_main_option("script_location", str(api_root / "migrations"))
    database_path = tmp_path / "fresh.sqlite"
    config.set_main_option("sqlalchemy.url", f"sqlite:///{database_path.as_posix()}")
    monkeypatch.delenv("DATABASE_URL", raising=False)

    script = ScriptDirectory.from_config(config)
    revisions = list(script.walk_revisions())

    assert sum(revision.down_revision is None for revision in revisions) == 1
    assert all(not isinstance(revision.down_revision, tuple) for revision in revisions)
    assert script.get_heads() == ["20261026_19"]

    engine = create_engine(f"sqlite:///{database_path.as_posix()}")
    try:
        command.upgrade(config, "head")
        with engine.connect() as connection:
            invoice_columns = {
                column["name"] for column in inspect(connection).get_columns("invoices")
            }
            invoice_constraints = {
                constraint["name"]
                for constraint in inspect(connection).get_unique_constraints("invoices")
            }
            subscription_columns = {
                column["name"]
                for column in inspect(connection).get_columns("subscriptions")
            }
            subscription_checks = {
                constraint["name"]
                for constraint in inspect(connection).get_check_constraints(
                    "subscriptions"
                )
            }
            payment_columns = {
                column["name"] for column in inspect(connection).get_columns("payments")
            }
            payment_constraints = {
                constraint["name"]
                for constraint in inspect(connection).get_unique_constraints("payments")
            }
            refund_indexes = {
                index["name"] for index in inspect(connection).get_indexes("refunds")
            }
            commission_columns = {
                column["name"]
                for column in inspect(connection).get_columns("commission_ledger")
            }
            commission_indexes = {
                index["name"]
                for index in inspect(connection).get_indexes("commission_ledger")
            }
            statement_constraints = {
                constraint["name"]
                for constraint in inspect(connection).get_unique_constraints(
                    "commission_statements"
                )
            }
            funnel_columns = {
                column["name"] for column in inspect(connection).get_columns("funnel_events")
            }
            funnel_indexes = {
                index["name"] for index in inspect(connection).get_indexes("funnel_events")
            }
            assert "provider_checkout_id" in invoice_columns
            assert "uq_invoices_provider_checkout_id" in invoice_constraints
            assert "pending_plan" in subscription_columns
            assert "pending_amount_minor" in subscription_columns
            assert "ck_subscriptions_pending_plan" in subscription_checks
            assert {"attempt_number", "failed_at", "retry_email_sent_at"} <= payment_columns
            assert "uq_payments_invoice_attempt" in payment_constraints
            assert "ix_refunds_status_created" in refund_indexes
            assert {"revenue_date", "device_id"} <= commission_columns
            assert "ix_commission_ledger_user_date" in commission_indexes
            assert "uq_commission_statement_user_period" in statement_constraints
            assert {"event", "visitor_id", "user_id", "consented", "created_at"} <= funnel_columns
            assert "ix_funnel_events_event_created" in funnel_indexes
    finally:
        engine.dispose()
