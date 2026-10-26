"""Add consented first-party funnel events."""

from collections.abc import Sequence

import sqlalchemy as sa
from alembic import op

revision: str = "20261026_18"
down_revision: str | None = "20261024_17"
branch_labels: str | Sequence[str] | None = None
depends_on: str | Sequence[str] | None = None


def upgrade() -> None:
    op.create_table(
        "investor_verifications",
        sa.Column("id", sa.String(36), primary_key=True, nullable=False),
        sa.Column("user_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("full_name", sa.String(200), nullable=False),
        sa.Column("organization", sa.String(200), nullable=True),
        sa.Column("country", sa.String(100), nullable=False),
        sa.Column("investment_thesis", sa.String(2000), nullable=False),
        sa.Column("source_of_funds", sa.String(1000), nullable=False),
        sa.Column("agreement_accepted", sa.Boolean(), nullable=False),
        sa.Column("status", sa.String(16), server_default="submitted", nullable=False),
        sa.Column("review_note", sa.String(1000), nullable=True),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.Column("reviewed_at", sa.DateTime(timezone=True), nullable=True),
        sa.CheckConstraint("status IN ('submitted', 'approved', 'rejected')", name="ck_investor_verifications_status"),
        sa.UniqueConstraint("user_id", name="uq_investor_verifications_user"),
    )
    op.create_index("ix_investor_verifications_user_id", "investor_verifications", ["user_id"])
    op.create_index("ix_investor_verifications_status_created", "investor_verifications", ["status", "created_at"])
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
    op.create_table(
        "marketplace_contact_requests",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("listing_id", sa.String(64), sa.ForeignKey("marketplace_listings.id", ondelete="CASCADE"), nullable=False),
        sa.Column("investor_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("status", sa.String(16), server_default="pending", nullable=False),
        sa.Column("message", sa.String(2000), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
        sa.UniqueConstraint("listing_id", "investor_id", name="uq_marketplace_contact_listing_investor"),
    )
    op.create_index("ix_marketplace_contact_requests_listing_id", "marketplace_contact_requests", ["listing_id"])
    op.create_index("ix_marketplace_contact_requests_investor_id", "marketplace_contact_requests", ["investor_id"])
    op.create_table(
        "marketplace_messages",
        sa.Column("id", sa.String(36), primary_key=True),
        sa.Column("request_id", sa.String(36), sa.ForeignKey("marketplace_contact_requests.id", ondelete="CASCADE"), nullable=False),
        sa.Column("sender_id", sa.String(36), sa.ForeignKey("users.id", ondelete="CASCADE"), nullable=False),
        sa.Column("content", sa.String(4000), nullable=False),
        sa.Column("created_at", sa.DateTime(timezone=True), server_default=sa.func.now(), nullable=False),
    )
    op.create_index("ix_marketplace_messages_request_id", "marketplace_messages", ["request_id"])
    op.create_index("ix_marketplace_messages_sender_id", "marketplace_messages", ["sender_id"])


def downgrade() -> None:
    op.drop_index("ix_investor_verifications_status_created", table_name="investor_verifications")
    op.drop_index("ix_investor_verifications_user_id", table_name="investor_verifications")
    op.drop_table("investor_verifications")
    op.drop_index("ix_marketplace_messages_sender_id", table_name="marketplace_messages")
    op.drop_index("ix_marketplace_messages_request_id", table_name="marketplace_messages")
    op.drop_table("marketplace_messages")
    op.drop_index("ix_marketplace_contact_requests_investor_id", table_name="marketplace_contact_requests")
    op.drop_index("ix_marketplace_contact_requests_listing_id", table_name="marketplace_contact_requests")
    op.drop_table("marketplace_contact_requests")
    op.drop_index("ix_marketplace_listings_status", table_name="marketplace_listings")
    op.drop_column("marketplace_listings", "request_financial_fields")
    op.drop_column("marketplace_listings", "public_financial_fields")
    op.drop_column("marketplace_listings", "status")
    op.drop_index("ix_funnel_events_user_id", table_name="funnel_events")
    op.drop_index("ix_funnel_events_visitor_id", table_name="funnel_events")
    op.drop_index("ix_funnel_events_event_created", table_name="funnel_events")
    op.drop_table("funnel_events")
