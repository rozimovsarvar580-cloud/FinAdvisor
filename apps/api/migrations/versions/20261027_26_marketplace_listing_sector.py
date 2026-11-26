"""Add sectors to marketplace listings.

Revision ID: 20261027_26
Revises: 20261027_25
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20261027_26"
down_revision: str | None = "20261027_25"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("marketplace_listings") as batch:
        batch.add_column(
            sa.Column(
                "sector_id",
                sa.String(length=64),
                server_default="restaurant_cafe",
                nullable=False,
            )
        )
        batch.create_index(
            "ix_marketplace_listings_sector_id",
            ["sector_id"],
            unique=False,
        )


def downgrade() -> None:
    with op.batch_alter_table("marketplace_listings") as batch:
        batch.drop_index("ix_marketplace_listings_sector_id")
        batch.drop_column("sector_id")
