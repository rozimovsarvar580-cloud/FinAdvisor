"""Create user accounts.

Revision ID: 20261003_01
Revises: 0005_create_email_verifications
Create Date: 2026-10-03
"""
from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20261003_01"
down_revision: str | None = "0005_create_email_verifications"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "users",
        sa.Column("id", sa.String(length=36), nullable=False),
        sa.Column("email", sa.String(length=320), nullable=False),
        sa.Column("name", sa.String(length=200), nullable=False),
        sa.Column("avatar_url", sa.String(length=2048), nullable=True),
        sa.Column("role", sa.String(length=24), nullable=False),
        sa.Column("auth_provider", sa.String(length=24), nullable=False),
        sa.Column("password_hash", sa.String(length=255), nullable=True),
        sa.Column("email_verified", sa.Boolean(), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.PrimaryKeyConstraint("id"),
    )
    op.create_index("ix_users_email", "users", ["email"], unique=True)


def downgrade() -> None:
    op.drop_index("ix_users_email", table_name="users")
    op.drop_table("users")
