"""Index pending refund reviews.

Revision ID: 20261024_16
Revises: 20261024_15
"""

from collections.abc import Sequence

from alembic import op

revision: str = "20261024_16"
down_revision: str | None = "20261024_15"
branch_labels: str | Sequence[str] | None = None
depends_on: str | None = None


def upgrade() -> None:
    op.create_index(
        "ix_refunds_status_created", "refunds", ["status", "created_at"]
    )


def downgrade() -> None:
    op.drop_index("ix_refunds_status_created", table_name="refunds")
