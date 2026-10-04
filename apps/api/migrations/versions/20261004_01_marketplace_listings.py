"""Add owner-published restaurant marketplace listings.

Revision ID: 20261004_01
Revises: 0006_create_agent_tables
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20261004_01"
down_revision: str | None = "0006_create_agent_tables"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "marketplace_listings",
        sa.Column("id", sa.String(length=64), nullable=False),
        sa.Column("owner_id", sa.String(length=36), nullable=False),
        sa.Column("business_name", sa.String(length=200), nullable=False),
        sa.Column("city", sa.String(length=120), nullable=False),
        sa.Column("stage", sa.String(length=16), nullable=False),
        sa.Column("funding_target", sa.Numeric(20, 2), nullable=False),
        sa.Column("currency", sa.String(length=3), server_default="UZS", nullable=False),
        sa.Column("summary", sa.String(length=2000), nullable=False),
        sa.Column("is_published", sa.Boolean(), server_default=sa.true(), nullable=False),
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
        "ix_marketplace_listings_owner_id", "marketplace_listings", ["owner_id"]
    )
    op.create_index(
        "ix_marketplace_listings_is_published",
        "marketplace_listings",
        ["is_published"],
    )


def downgrade() -> None:
    op.drop_index("ix_marketplace_listings_is_published", table_name="marketplace_listings")
    op.drop_index("ix_marketplace_listings_owner_id", table_name="marketplace_listings")
    op.drop_table("marketplace_listings")
