"""Continue the linear API migration chain after knowledge vectors.

Revision ID: 20261003_03
Revises: 20261003_02
"""

from collections.abc import Sequence

revision: str = "20261003_03"
down_revision: str | None = "20261003_02"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    pass


def downgrade() -> None:
    pass
