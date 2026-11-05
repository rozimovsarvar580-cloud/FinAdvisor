"""Store analytics consent choices.

Revision ID: 20261027_20
Revises: 20261026_19
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20261027_20"
down_revision: str | None = "20261026_19"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "analytics_consents",
        sa.Column("id", sa.String(36), primary_key=True, nullable=False),
        sa.Column("visitor_id", sa.String(64), nullable=False),
        sa.Column("consented", sa.Boolean(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index(
        "ix_analytics_consents_visitor_id",
        "analytics_consents",
        ["visitor_id"],
    )
    op.create_index(
        "ix_analytics_consents_visitor_created",
        "analytics_consents",
        ["visitor_id", "created_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_analytics_consents_visitor_created", table_name="analytics_consents")
    op.drop_index("ix_analytics_consents_visitor_id", table_name="analytics_consents")
    op.drop_table("analytics_consents")
