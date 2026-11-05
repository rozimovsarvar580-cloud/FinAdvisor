"""Create subscriptions, invoices, payments, events, commissions and refunds.

Revision ID: 20261018_11
Revises: 20261017_10
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20261018_11"
down_revision: str | None = "20261017_10"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "subscriptions",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("plan", sa.String(length=16), nullable=False),
        sa.Column("status", sa.String(length=16), nullable=False),
        sa.Column("billing_period", sa.String(length=16), nullable=False),
        sa.Column("amount_minor", sa.Integer(), nullable=False),
        sa.Column("currency", sa.String(length=3), server_default="USD", nullable=False),
        sa.Column("provider", sa.String(length=32), nullable=True),
        sa.Column("provider_customer_id", sa.String(length=255), nullable=True),
        sa.Column("provider_subscription_id", sa.String(length=255), nullable=True),
        sa.Column("current_period_start", sa.DateTime(timezone=True), nullable=True),
        sa.Column("current_period_end", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "cancel_at_period_end",
            sa.Boolean(),
            server_default=sa.false(),
            nullable=False,
        ),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("updated_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("plan IN ('pro', 'business')", name="ck_subscriptions_plan"),
        sa.CheckConstraint(
            "status IN ('incomplete', 'active', 'past_due', 'canceled', 'expired')",
            name="ck_subscriptions_status",
        ),
        sa.CheckConstraint(
            "billing_period IN ('weekly', 'monthly', 'yearly')",
            name="ck_subscriptions_billing_period",
        ),
        sa.CheckConstraint("amount_minor >= 0", name="ck_subscriptions_amount_non_negative"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("provider_subscription_id"),
    )
    op.create_index("ix_subscriptions_user_id", "subscriptions", ["user_id"])
    op.create_index(
        "ix_subscriptions_user_status", "subscriptions", ["user_id", "status"]
    )
    op.create_index(
        "ix_subscriptions_period_end", "subscriptions", ["current_period_end"]
    )

    op.create_table(
        "invoices",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("subscription_id", sa.String(length=36), nullable=True),
        sa.Column("invoice_number", sa.String(length=64), nullable=False),
        sa.Column("amount_minor", sa.Integer(), nullable=False),
        sa.Column("currency", sa.String(length=3), server_default="USD", nullable=False),
        sa.Column("status", sa.String(length=24), server_default="open", nullable=False),
        sa.Column("period_start", sa.DateTime(timezone=True), nullable=True),
        sa.Column("period_end", sa.DateTime(timezone=True), nullable=True),
        sa.Column("due_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("paid_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("amount_minor >= 0", name="ck_invoices_amount_non_negative"),
        sa.CheckConstraint(
            "status IN ('draft', 'open', 'paid', 'void', 'uncollectible')",
            name="ck_invoices_status",
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.ForeignKeyConstraint(
            ["subscription_id"], ["subscriptions.id"], ondelete="SET NULL"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "invoice_number", name="uq_invoices_user_number"),
        sa.UniqueConstraint("id", "user_id", name="uq_invoices_id_user"),
    )
    op.create_index("ix_invoices_user_id", "invoices", ["user_id"])
    op.create_index("ix_invoices_subscription_id", "invoices", ["subscription_id"])
    op.create_index("ix_invoices_user_created", "invoices", ["user_id", "created_at"])
    op.create_index("ix_invoices_status_due", "invoices", ["status", "due_at"])

    op.create_table(
        "payments",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("invoice_id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("provider", sa.String(length=32), nullable=False),
        sa.Column("provider_payment_id", sa.String(length=255), nullable=True),
        sa.Column("amount_minor", sa.Integer(), nullable=False),
        sa.Column("currency", sa.String(length=3), nullable=False),
        sa.Column("status", sa.String(length=24), server_default="pending", nullable=False),
        sa.Column("paid_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("amount_minor >= 0", name="ck_payments_amount_non_negative"),
        sa.CheckConstraint(
            "status IN ('pending', 'succeeded', 'failed', 'refunded', 'partially_refunded')",
            name="ck_payments_status",
        ),
        sa.ForeignKeyConstraint(
            ["invoice_id", "user_id"],
            ["invoices.id", "invoices.user_id"],
            ondelete="RESTRICT",
            name="fk_payments_invoice_owner",
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("provider_payment_id"),
    )
    op.create_index("ix_payments_invoice_id", "payments", ["invoice_id"])
    op.create_index("ix_payments_user_id", "payments", ["user_id"])
    op.create_index("ix_payments_user_created", "payments", ["user_id", "created_at"])

    op.create_table(
        "payment_events",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("provider", sa.String(length=32), nullable=False),
        sa.Column("provider_event_id", sa.String(length=255), nullable=False),
        sa.Column("event_type", sa.String(length=100), nullable=False),
        sa.Column("raw_payload", sa.JSON(), nullable=False),
        sa.Column("signature_valid", sa.Boolean(), nullable=False),
        sa.Column("status", sa.String(length=24), server_default="received", nullable=False),
        sa.Column("attempts", sa.Integer(), server_default="0", nullable=False),
        sa.Column("received_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("processed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column("last_error", sa.String(length=500), nullable=True),
        sa.CheckConstraint(
            "attempts >= 0", name="ck_payment_events_attempts_non_negative"
        ),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "provider",
            "provider_event_id",
            name="uq_payment_event_provider_id",
        ),
    )
    op.create_index(
        "ix_payment_events_status_received",
        "payment_events",
        ["status", "received_at"],
    )

    op.create_table(
        "commission_ledger",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("source_entry_id", sa.String(length=64), nullable=False),
        sa.Column("revenue_year", sa.Integer(), nullable=False),
        sa.Column("revenue_minor", sa.Integer(), nullable=False),
        sa.Column("commission_minor", sa.Integer(), nullable=False),
        sa.Column("currency", sa.String(length=3), server_default="UZS", nullable=False),
        sa.Column("status", sa.String(length=16), server_default="accrued", nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint(
            "revenue_minor >= 0 AND commission_minor >= 0",
            name="ck_commission_ledger_amounts_non_negative",
        ),
        sa.CheckConstraint(
            "status IN ('accrued', 'invoiced', 'paid', 'disputed', 'void')",
            name="ck_commission_ledger_status",
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "user_id", "source_entry_id", name="uq_commission_source_entry"
        ),
    )
    op.create_index("ix_commission_ledger_user_id", "commission_ledger", ["user_id"])
    op.create_index(
        "ix_commission_ledger_user_year",
        "commission_ledger",
        ["user_id", "revenue_year"],
    )
    op.create_index(
        "ix_commission_ledger_status", "commission_ledger", ["status"]
    )

    op.create_table(
        "refunds",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("payment_id", sa.String(length=36), nullable=False),
        sa.Column("amount_minor", sa.Integer(), nullable=False),
        sa.Column("currency", sa.String(length=3), nullable=False),
        sa.Column("status", sa.String(length=16), server_default="pending", nullable=False),
        sa.Column("reason", sa.String(length=500), nullable=True),
        sa.Column("provider_refund_id", sa.String(length=255), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("processed_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint("amount_minor > 0", name="ck_refunds_amount_positive"),
        sa.CheckConstraint(
            "status IN ('pending', 'succeeded', 'failed', 'canceled')",
            name="ck_refunds_status",
        ),
        sa.ForeignKeyConstraint(["payment_id"], ["payments.id"], ondelete="RESTRICT"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("provider_refund_id"),
    )
    op.create_index("ix_refunds_payment_id", "refunds", ["payment_id"])
    op.create_index(
        "ix_refunds_payment_created", "refunds", ["payment_id", "created_at"]
    )


def downgrade() -> None:
    op.drop_index("ix_refunds_payment_created", table_name="refunds")
    op.drop_index("ix_refunds_payment_id", table_name="refunds")
    op.drop_table("refunds")

    op.drop_index("ix_commission_ledger_status", table_name="commission_ledger")
    op.drop_index("ix_commission_ledger_user_year", table_name="commission_ledger")
    op.drop_index("ix_commission_ledger_user_id", table_name="commission_ledger")
    op.drop_table("commission_ledger")

    op.drop_index(
        "ix_payment_events_status_received", table_name="payment_events"
    )
    op.drop_table("payment_events")

    op.drop_index("ix_payments_user_created", table_name="payments")
    op.drop_index("ix_payments_user_id", table_name="payments")
    op.drop_index("ix_payments_invoice_id", table_name="payments")
    op.drop_table("payments")

    op.drop_index("ix_invoices_status_due", table_name="invoices")
    op.drop_index("ix_invoices_user_created", table_name="invoices")
    op.drop_index("ix_invoices_subscription_id", table_name="invoices")
    op.drop_index("ix_invoices_user_id", table_name="invoices")
    op.drop_table("invoices")

    op.drop_index("ix_subscriptions_period_end", table_name="subscriptions")
    op.drop_index("ix_subscriptions_user_status", table_name="subscriptions")
    op.drop_index("ix_subscriptions_user_id", table_name="subscriptions")
    op.drop_table("subscriptions")
