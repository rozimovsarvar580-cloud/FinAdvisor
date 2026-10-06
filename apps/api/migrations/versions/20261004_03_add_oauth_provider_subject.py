"""Store stable OAuth provider identities for account sign-in.

Revision ID: 20261004_03
Revises: 20261004_02
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20261004_03"
down_revision: str | None = "20261004_02"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column(
        "users",
        sa.Column("provider_user_id", sa.String(length=255), nullable=True),
    )
    op.create_index(
        "ix_users_auth_provider_subject",
        "users",
        ["auth_provider", "provider_user_id"],
        unique=True,
    )


def downgrade() -> None:
    op.drop_index("ix_users_auth_provider_subject", table_name="users")
    op.drop_column("users", "provider_user_id")
