"""Persist next-renewal plan changes.

Revision ID: 20261024_14
Revises: 20261020_13
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20261024_14"
down_revision: str | None = "20261020_13"
branch_labels: str | Sequence[str] | None = None
depends_on: str | None = None


def upgrade() -> None:
    with op.batch_alter_table("subscriptions") as batch_op:
        batch_op.add_column(sa.Column("pending_plan", sa.String(length=16), nullable=True))
        batch_op.add_column(sa.Column("pending_amount_minor", sa.Integer(), nullable=True))
        batch_op.create_check_constraint(
            "ck_subscriptions_pending_plan",
            "(pending_plan IS NULL AND pending_amount_minor IS NULL) OR "
            "(pending_plan IN ('pro', 'business') AND pending_amount_minor >= 0)",
        )


def downgrade() -> None:
    with op.batch_alter_table("subscriptions") as batch_op:
        batch_op.drop_constraint("ck_subscriptions_pending_plan", type_="check")
        batch_op.drop_column("pending_amount_minor")
        batch_op.drop_column("pending_plan")
