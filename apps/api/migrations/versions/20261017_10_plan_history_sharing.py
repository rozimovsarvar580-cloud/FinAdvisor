"""Add revocable read-only plan sharing tokens.

Revision ID: 20261017_10
Revises: 20261016_09
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20261017_10"
down_revision: str | None = "20261016_09"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "saved_business_plans",
        sa.Column("share_token_hash", sa.String(length=64), nullable=True),
    )
    op.create_index(
        "ix_saved_business_plans_share_token_hash",
        "saved_business_plans",
        ["share_token_hash"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index(
        "ix_saved_business_plans_share_token_hash",
        table_name="saved_business_plans",
    )
    op.drop_column("saved_business_plans", "share_token_hash")
