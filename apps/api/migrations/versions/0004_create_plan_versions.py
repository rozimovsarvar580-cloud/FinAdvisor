"""create plan versions

Revision ID: 0004_create_plan_versions
Revises: 0003_add_session_role
"""

import sqlalchemy as sa
from alembic import op

revision = "0004_create_plan_versions"
down_revision = "0003_add_session_role"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "plan_versions",
        sa.Column("id", sa.String(length=64), primary_key=True),
        sa.Column("plan_id", sa.String(length=64), sa.ForeignKey("plans.id"), nullable=False),
        sa.Column("version", sa.Integer(), nullable=False),
        sa.Column("snapshot", sa.JSON(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_plan_versions_plan_id", "plan_versions", ["plan_id"])


def downgrade() -> None:
    op.drop_index("ix_plan_versions_plan_id", table_name="plan_versions")
    op.drop_table("plan_versions")
