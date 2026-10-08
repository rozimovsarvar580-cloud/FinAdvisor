"""create plans table

Revision ID: 0001_create_plans
Revises:
"""

import sqlalchemy as sa
from alembic import op

revision = "0001_create_plans"
down_revision = None
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "plans",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("status", sa.String(length=32), nullable=False, server_default="draft"),
        sa.Column("currency", sa.String(length=3), nullable=False, server_default="UZS"),
        sa.Column("monthly_revenue", sa.Numeric(20, 2), nullable=True),
        sa.Column("monthly_profit", sa.Numeric(20, 2), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )


def downgrade() -> None:
    op.drop_table("plans")
