"""Merge the initial API and account/knowledge migration branches.

Revision ID: 20261003_03
Revises: 0005_create_email_verifications, 20261003_02
"""

from collections.abc import Sequence

revision: str = "20261003_03"
down_revision: tuple[str, str] = (
    "0005_create_email_verifications",
    "20261003_02",
)
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
