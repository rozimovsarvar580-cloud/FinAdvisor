"""Store consented sample-plan download requests.

Revision ID: 20261027_22
Revises: 20261027_21
"""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20261027_22"
down_revision: str | None = "20261027_21"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "sample_plan_leads",
        sa.Column("id", sa.String(36), primary_key=True, nullable=False),
        sa.Column("email", sa.String(320), nullable=False),
        sa.Column("consented", sa.Boolean(), nullable=False),
        sa.Column("consent_version", sa.String(32), nullable=False),
        sa.Column("locale", sa.String(5), nullable=False),
        sa.Column(
            "created_at",
            sa.DateTime(timezone=True),
            server_default=sa.func.now(),
            nullable=False,
        ),
        sa.CheckConstraint("consented = true", name="ck_sample_plan_leads_consented"),
    )
    op.create_index("ix_sample_plan_leads_email", "sample_plan_leads", ["email"])
    op.create_index(
        "ix_sample_plan_leads_email_created",
        "sample_plan_leads",
        ["email", "created_at"],
    )


def downgrade() -> None:
    op.drop_index("ix_sample_plan_leads_email_created", table_name="sample_plan_leads")
    op.drop_index("ix_sample_plan_leads_email", table_name="sample_plan_leads")
    op.drop_table("sample_plan_leads")
