"""Store sector and flexible inputs on saved plans.

Revision ID: 20261027_24
Revises: 20261027_23
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20261027_24"
down_revision: str | None = "20261027_23"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "saved_business_plans",
        sa.Column(
            "sector_id",
            sa.String(length=64),
            server_default="restaurant_cafe",
            nullable=False,
        ),
    )
    op.add_column(
        "saved_business_plans",
        sa.Column(
            "inputs",
            sa.JSON(),
            server_default=sa.text("'{}'"),
            nullable=False,
        ),
    )


def downgrade() -> None:
    op.drop_column("saved_business_plans", "inputs")
    op.drop_column("saved_business_plans", "sector_id")
