"""Add owner-scoped accounting ledger entries.

Revision ID: 20261014_07
Revises: 20261014_06
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20261014_07"
down_revision: str | None = "20261014_06"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "ledger_entries",
        sa.Column("id", sa.String(length=64), nullable=False),
        sa.Column("owner_id", sa.String(length=36), nullable=False),
        sa.Column("entry_date", sa.Date(), nullable=False),
        sa.Column("category", sa.String(length=64), nullable=False),
        sa.Column("amount", sa.Numeric(precision=20, scale=2), nullable=False),
        sa.Column(
            "currency",
            sa.String(length=3),
            server_default="UZS",
            nullable=False,
        ),
        sa.Column("description", sa.String(length=500), nullable=True),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.ForeignKeyConstraint(["owner_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index(
        "ix_ledger_entries_owner_id", "ledger_entries", ["owner_id"], unique=False
    )
    op.create_index(
        "ix_ledger_entries_entry_date", "ledger_entries", ["entry_date"], unique=False
    )


def downgrade() -> None:
    op.drop_index("ix_ledger_entries_entry_date", table_name="ledger_entries")
    op.drop_index("ix_ledger_entries_owner_id", table_name="ledger_entries")
    op.drop_table("ledger_entries")
