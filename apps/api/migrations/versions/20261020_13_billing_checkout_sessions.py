"""Persist provider checkout session identity on invoices.

Revision ID: 20261020_13
Revises: 20261019_12
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20261020_13"
down_revision: str | None = "20261019_12"
branch_labels: str | Sequence[str] | None = None
depends_on: str | None = None


def upgrade() -> None:
    with op.batch_alter_table("invoices") as batch_op:
        batch_op.add_column(
            sa.Column("provider_checkout_id", sa.String(length=255), nullable=True)
        )
        batch_op.create_unique_constraint(
            "uq_invoices_provider_checkout_id",
            ["provider_checkout_id"],
        )


def downgrade() -> None:
    with op.batch_alter_table("invoices") as batch_op:
        batch_op.drop_constraint(
            "uq_invoices_provider_checkout_id",
            type_="unique",
        )
        batch_op.drop_column("provider_checkout_id")
