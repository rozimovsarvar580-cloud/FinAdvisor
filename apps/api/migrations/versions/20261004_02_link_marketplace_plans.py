"""Persist generated business plans and link public listings to them.

Revision ID: 20261004_02
Revises: 20261004_01
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20261004_02"
down_revision: str | None = "20261004_01"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "saved_business_plans",
        sa.Column("id", sa.String(length=64), nullable=False),
        sa.Column("owner_id", sa.String(length=36), nullable=False),
        sa.Column("business_name", sa.String(length=200), nullable=False),
        sa.Column("location", sa.String(length=300), nullable=False),
        sa.Column("request_payload", sa.JSON(), nullable=False),
        sa.Column("generated_plan", sa.JSON(), nullable=False),
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
        "ix_saved_business_plans_owner_id",
        "saved_business_plans",
        ["owner_id"],
    )
    op.add_column(
        "marketplace_listings",
        sa.Column("saved_plan_id", sa.String(length=64), nullable=True),
    )
    op.create_foreign_key(
        "fk_marketplace_listings_saved_plan_id",
        "marketplace_listings",
        "saved_business_plans",
        ["saved_plan_id"],
        ["id"],
        ondelete="SET NULL",
    )
    op.create_index(
        "ix_marketplace_listings_saved_plan_id",
        "marketplace_listings",
        ["saved_plan_id"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_marketplace_listings_saved_plan_id",
        table_name="marketplace_listings",
    )
    op.drop_constraint(
        "fk_marketplace_listings_saved_plan_id",
        "marketplace_listings",
        type_="foreignkey",
    )
    op.drop_column("marketplace_listings", "saved_plan_id")
    op.drop_index(
        "ix_saved_business_plans_owner_id",
        table_name="saved_business_plans",
    )
    op.drop_table("saved_business_plans")
