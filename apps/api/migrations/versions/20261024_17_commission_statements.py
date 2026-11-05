"""Add agent revenue entries and monthly commission statements.

Revision ID: 20261024_17
Revises: 20261024_16
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20261024_17"
down_revision: str | None = "20261024_16"
branch_labels: str | Sequence[str] | None = None
depends_on: str | None = None


def upgrade() -> None:
    with op.batch_alter_table("commission_ledger") as batch_op:
        batch_op.alter_column(
            "revenue_minor",
            existing_type=sa.Integer(),
            type_=sa.BigInteger(),
            existing_nullable=False,
        )
        batch_op.alter_column(
            "commission_minor",
            existing_type=sa.Integer(),
            type_=sa.BigInteger(),
            existing_nullable=False,
        )
        batch_op.add_column(sa.Column("revenue_date", sa.Date(), nullable=True))
        batch_op.add_column(sa.Column("device_id", sa.String(length=64), nullable=True))
        batch_op.create_foreign_key(
            "fk_commission_ledger_device_id_agent_devices",
            "agent_devices",
            ["device_id"],
            ["id"],
            ondelete="SET NULL",
        )
        batch_op.create_index(
            "ix_commission_ledger_user_date", ["user_id", "revenue_date"]
        )

    op.create_table(
        "commission_statements",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("revenue_year", sa.Integer(), nullable=False),
        sa.Column("statement_month", sa.Integer(), nullable=False),
        sa.Column("revenue_minor", sa.BigInteger(), nullable=False),
        sa.Column("total_commission_minor", sa.BigInteger(), nullable=False),
        sa.Column("previously_billed_minor", sa.BigInteger(), nullable=False),
        sa.Column("amount_due_minor", sa.BigInteger(), nullable=False),
        sa.Column("status", sa.String(length=16), server_default="issued", nullable=False),
        sa.Column("dispute_reason", sa.String(length=500), nullable=True),
        sa.Column("disputed_at", sa.DateTime(timezone=True), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.CheckConstraint(
            "revenue_minor >= 0 AND total_commission_minor >= 0 "
            "AND previously_billed_minor >= 0 AND amount_due_minor >= 0",
            name="ck_commission_statements_amounts_non_negative",
        ),
        sa.CheckConstraint(
            "statement_month BETWEEN 1 AND 12",
            name="ck_commission_statements_month",
        ),
        sa.CheckConstraint(
            "status IN ('issued', 'disputed', 'paid', 'void')",
            name="ck_commission_statements_status",
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "user_id",
            "revenue_year",
            "statement_month",
            name="uq_commission_statement_user_period",
        ),
    )
    op.create_index(
        "ix_commission_statements_user_id", "commission_statements", ["user_id"]
    )
    op.create_index(
        "ix_commission_statements_period",
        "commission_statements",
        ["revenue_year", "statement_month"],
    )


def downgrade() -> None:
    op.drop_index("ix_commission_statements_period", table_name="commission_statements")
    op.drop_index("ix_commission_statements_user_id", table_name="commission_statements")
    op.drop_table("commission_statements")
    with op.batch_alter_table("commission_ledger") as batch_op:
        batch_op.drop_index("ix_commission_ledger_user_date")
        batch_op.drop_constraint(
            "fk_commission_ledger_device_id_agent_devices", type_="foreignkey"
        )
        batch_op.drop_column("device_id")
        batch_op.drop_column("revenue_date")
        batch_op.alter_column(
            "commission_minor",
            existing_type=sa.BigInteger(),
            type_=sa.Integer(),
            existing_nullable=False,
        )
        batch_op.alter_column(
            "revenue_minor",
            existing_type=sa.BigInteger(),
            type_=sa.Integer(),
            existing_nullable=False,
        )
