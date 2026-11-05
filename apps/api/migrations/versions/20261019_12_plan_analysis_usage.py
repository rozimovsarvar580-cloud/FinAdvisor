"""Track plan analysis uploads per user and day.

Revision ID: 20261019_12
Revises: 20261018_11
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20261019_12"
down_revision: str | None = "20261018_11"
branch_labels: str | Sequence[str] | None = None
depends_on: str | None = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("saved_plan_count", sa.Integer(), server_default="0", nullable=False),
    )
    op.add_column(
        "users",
        sa.Column(
            "marketplace_listing_count",
            sa.Integer(),
            server_default="0",
            nullable=False,
        ),
    )
    op.execute(
        """
        UPDATE users
        SET saved_plan_count = (
            SELECT COUNT(*)
            FROM saved_business_plans
            WHERE saved_business_plans.owner_id = users.id
        )
        """
    )
    op.execute(
        """
        UPDATE users
        SET marketplace_listing_count = (
            SELECT COUNT(*)
            FROM marketplace_listings
            WHERE marketplace_listings.owner_id = users.id
        )
        """
    )
    op.create_table(
        "plan_analysis_usage_daily",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("usage_date", sa.Date(), nullable=False),
        sa.Column("uploads", sa.Integer(), server_default="0", nullable=False),
        sa.CheckConstraint(
            "uploads >= 0",
            name="ck_plan_analysis_usage_non_negative",
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint(
            "user_id",
            "usage_date",
            name="uq_plan_analysis_usage_user_date",
        ),
    )
    op.create_index(
        "ix_plan_analysis_usage_daily_user_id",
        "plan_analysis_usage_daily",
        ["user_id"],
    )
    op.create_index(
        "ix_plan_analysis_usage_daily_usage_date",
        "plan_analysis_usage_daily",
        ["usage_date"],
    )


def downgrade() -> None:
    op.drop_index(
        "ix_plan_analysis_usage_daily_usage_date",
        table_name="plan_analysis_usage_daily",
    )
    op.drop_index(
        "ix_plan_analysis_usage_daily_user_id",
        table_name="plan_analysis_usage_daily",
    )
    op.drop_table("plan_analysis_usage_daily")
    op.drop_column("users", "marketplace_listing_count")
    op.drop_column("users", "saved_plan_count")
