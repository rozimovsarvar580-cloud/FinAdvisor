"""Add consented first-party funnel events."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20261026_18"
down_revision: str | None = "20261024_17"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.add_column("marketplace_listings", sa.Column("status", sa.String(16), server_default="published", nullable=False))
    op.add_column("marketplace_listings", sa.Column("public_financial_fields", sa.JSON(), server_default="[]", nullable=False))
    op.add_column("marketplace_listings", sa.Column("request_financial_fields", sa.JSON(), server_default="[]", nullable=False))
    op.create_index("ix_marketplace_listings_status", "marketplace_listings", ["status"])
    op.create_table(
        "funnel_events",
        sa.Column("id", sa.String(36), primary_key=True, nullable=False),
        sa.Column("event", sa.String(32), nullable=False),
        sa.Column("visitor_id", sa.String(64), nullable=True),
        sa.Column("user_id", sa.String(36), nullable=True),
        sa.Column("consented", sa.Boolean(), server_default=sa.true(), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.CheckConstraint("event IN ('visit', 'signup', 'plan_created', 'export', 'checkout_started', 'paid')", name="ck_funnel_events_event"),
        sa.ForeignKeyConstraint(["user_id"], ["users.id"], ondelete="SET NULL"),
    )
    op.create_index("ix_funnel_events_event_created", "funnel_events", ["event", "created_at"])
    op.create_index("ix_funnel_events_visitor_id", "funnel_events", ["visitor_id"])
    op.create_index("ix_funnel_events_user_id", "funnel_events", ["user_id"])


def downgrade() -> None:
    op.drop_index("ix_marketplace_listings_status", table_name="marketplace_listings")
    op.drop_column("marketplace_listings", "request_financial_fields")
    op.drop_column("marketplace_listings", "public_financial_fields")
    op.drop_column("marketplace_listings", "status")
    op.drop_index("ix_funnel_events_user_id", table_name="funnel_events")
    op.drop_index("ix_funnel_events_visitor_id", table_name="funnel_events")
    op.drop_index("ix_funnel_events_event_created", table_name="funnel_events")
    op.drop_table("funnel_events")
