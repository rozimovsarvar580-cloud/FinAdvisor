"""create auth sessions table

Revision ID: 0002_create_auth_sessions
Revises: 0001_create_plans
"""

import sqlalchemy as sa
from alembic import op

revision = "0002_create_auth_sessions"
down_revision = "0001_create_plans"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.create_table(
        "auth_sessions",
        sa.Column("token", sa.String(length=128), primary_key=True),
        sa.Column("user_email", sa.String(length=320), nullable=False),
        sa.Column("expires_at", sa.DateTime(timezone=True), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_auth_sessions_user_email", "auth_sessions", ["user_email"])


def downgrade() -> None:
    op.drop_index("ix_auth_sessions_user_email", table_name="auth_sessions")
    op.drop_table("auth_sessions")
