"""Support goods and service accounting records.

Revision ID: 20261027_25
Revises: 20261027_24
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20261027_25"
down_revision: str | None = "20261027_24"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    with op.batch_alter_table("accounting_records") as batch:
        batch.add_column(sa.Column("item_type", sa.String(length=16), nullable=True))
        batch.add_column(sa.Column("unit", sa.String(length=32), nullable=True))
        batch.add_column(
            sa.Column("service_duration_minutes", sa.Integer(), nullable=True)
        )
        batch.add_column(sa.Column("tracks_inventory", sa.Boolean(), nullable=True))
        batch.create_check_constraint(
            "ck_accounting_record_item_type",
            "item_type IS NULL OR item_type IN ('goods', 'service')",
        )
        batch.create_check_constraint(
            "ck_accounting_record_service_duration",
            "service_duration_minutes IS NULL OR service_duration_minutes > 0",
        )
        batch.create_check_constraint(
            "ck_accounting_record_service_no_stock",
            "item_type != 'service' OR tracks_inventory = false",
        )
    op.create_table(
        "accounting_preferences",
        sa.Column(
            "owner_id",
            sa.String(length=36),
            sa.ForeignKey("users.id", ondelete="CASCADE"),
            primary_key=True,
            nullable=False,
        ),
        sa.Column(
            "business_type",
            sa.String(length=16),
            server_default="goods",
            nullable=False,
        ),
        sa.CheckConstraint(
            "business_type IN ('goods', 'services', 'mixed')",
            name="ck_accounting_preferences_business_type",
        ),
    )


def downgrade() -> None:
    op.drop_table("accounting_preferences")
    with op.batch_alter_table("accounting_records") as batch:
        batch.drop_constraint("ck_accounting_record_service_no_stock", type_="check")
        batch.drop_constraint("ck_accounting_record_service_duration", type_="check")
        batch.drop_constraint("ck_accounting_record_item_type", type_="check")
        batch.drop_column("tracks_inventory")
        batch.drop_column("service_duration_minutes")
        batch.drop_column("unit")
        batch.drop_column("item_type")
