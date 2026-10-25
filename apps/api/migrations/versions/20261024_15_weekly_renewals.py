"""Persist weekly renewal attempts and dunning state.

Revision ID: 20261024_15
Revises: 20261024_14
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20261024_15"
down_revision: str | None = "20261024_14"
branch_labels: str | Sequence[str] | None = None
depends_on: str | None = None


def upgrade() -> None:
    with op.batch_alter_table("payments") as batch_op:
        batch_op.add_column(sa.Column("attempt_number", sa.Integer(), nullable=True))
        batch_op.add_column(sa.Column("failed_at", sa.DateTime(timezone=True), nullable=True))
        batch_op.add_column(
            sa.Column("retry_email_sent_at", sa.DateTime(timezone=True), nullable=True)
        )
        batch_op.create_check_constraint(
            "ck_payments_attempt_number",
            "attempt_number IS NULL OR attempt_number >= 1",
        )
        batch_op.create_unique_constraint(
            "uq_payments_invoice_attempt", ["invoice_id", "attempt_number"]
        )


def downgrade() -> None:
    with op.batch_alter_table("payments") as batch_op:
        batch_op.drop_constraint("uq_payments_invoice_attempt", type_="unique")
        batch_op.drop_constraint("ck_payments_attempt_number", type_="check")
        batch_op.drop_column("retry_email_sent_at")
        batch_op.drop_column("failed_at")
        batch_op.drop_column("attempt_number")
