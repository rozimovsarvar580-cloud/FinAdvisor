"""add role to auth sessions

Revision ID: 0003_add_session_role
Revises: 0002_create_auth_sessions
"""

from alembic import op
import sqlalchemy as sa

revision = "0003_add_session_role"
down_revision = "0002_create_auth_sessions"
branch_labels = None
depends_on = None


def upgrade() -> None:
    op.add_column("auth_sessions", sa.Column("role", sa.String(length=32), nullable=False, server_default="entrepreneur"))


def downgrade() -> None:
    op.drop_column("auth_sessions", "role")
