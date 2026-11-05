"""Add daily AI usage metering and plan tiers.

Revision ID: 20261016_09
Revises: 20261015_08
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20261016_09"
down_revision: str | None = "20261015_08"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column(
            "subscription_plan",
            sa.String(length=16),
            server_default="free",
            nullable=False,
        ),
    )
    op.create_table(
        "ai_usage_daily",
        sa.Column("id", sa.Integer(), autoincrement=True, nullable=False),
        sa.Column("user_id", sa.String(length=36), nullable=False),
        sa.Column("usage_date", sa.Date(), nullable=False),
        sa.Column("requests", sa.Integer(), server_default="0", nullable=False),
        sa.Column(
            "completed_requests",
            sa.Integer(),
            server_default="0",
            nullable=False,
        ),
        sa.Column(
            "unknown_token_usage_requests",
            sa.Integer(),
            server_default="0",
            nullable=False,
        ),
        sa.Column("input_tokens", sa.Integer(), server_default="0", nullable=False),
        sa.Column("output_tokens", sa.Integer(), server_default="0", nullable=False),
        sa.Column(
            "token_usage_complete",
            sa.Boolean(),
            server_default=sa.true(),
            nullable=False,
        ),
        sa.Column(
            "estimated_cost_usd",
            sa.Numeric(precision=24, scale=12),
            server_default="0",
            nullable=False,
        ),
        sa.Column(
            "cost_pricing_complete",
            sa.Boolean(),
            server_default=sa.true(),
            nullable=False,
        ),
        sa.Column(
            "cost_pricing_verified",
            sa.Boolean(),
            server_default=sa.true(),
            nullable=False,
        ),
        sa.CheckConstraint(
            "requests >= 0 AND completed_requests >= 0 "
            "AND unknown_token_usage_requests >= 0 "
            "AND completed_requests <= requests "
            "AND unknown_token_usage_requests <= completed_requests "
            "AND input_tokens >= 0 AND output_tokens >= 0",
            name="ck_ai_usage_non_negative",
        ),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="CASCADE"),
        sa.PrimaryKeyConstraint("id"),
        sa.UniqueConstraint("user_id", "usage_date", name="uq_ai_usage_user_date"),
    )
    op.create_index(
        "ix_ai_usage_daily_user_id",
        "ai_usage_daily",
        ["user_id"],
        unique=False,
    )
    op.create_index(
        "ix_ai_usage_daily_usage_date",
        "ai_usage_daily",
        ["usage_date"],
        unique=False,
    )


def downgrade() -> None:
    op.drop_index("ix_ai_usage_daily_usage_date", table_name="ai_usage_daily")
    op.drop_index("ix_ai_usage_daily_user_id", table_name="ai_usage_daily")
    op.drop_table("ai_usage_daily")
    op.drop_column("users", "subscription_plan")
