import uuid
from datetime import date, datetime
from decimal import Decimal

from sqlalchemy import (
    JSON,
    BigInteger,
    Boolean,
    CheckConstraint,
    Date,
    DateTime,
    ForeignKey,
    ForeignKeyConstraint,
    Index,
    Integer,
    Numeric,
    String,
    Text,
    UniqueConstraint,
    func,
)
from sqlalchemy.orm import Mapped, mapped_column

from finadvisor_api.database import Base


class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        Index(
            "ix_users_auth_provider_subject",
            "auth_provider",
            "provider_user_id",
            unique=True,
        ),
    )

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(200))
    avatar_url: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    role: Mapped[str] = mapped_column(String(24), default="tadbirkor")
    is_suspended: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    subscription_plan: Mapped[str] = mapped_column(
        String(16), default="free", server_default="free"
    )
    saved_plan_count: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    marketplace_listing_count: Mapped[int] = mapped_column(
        Integer, default=0, server_default="0"
    )
    needs_role: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default="false"
    )
    locale: Mapped[str] = mapped_column(String(5), default="uz", server_default="uz")
    deletion_requested_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    auth_provider: Mapped[str] = mapped_column(String(24), default="credentials")
    provider_user_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    password_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    email_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class OAuthAccount(Base):
    __tablename__ = "oauth_accounts"
    __table_args__ = (
        UniqueConstraint(
            "provider",
            "provider_account_id",
            name="uq_oauth_accounts_provider_account",
        ),
    )

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    provider: Mapped[str] = mapped_column(String(32))
    provider_account_id: Mapped[str] = mapped_column(String(255))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class RefreshToken(Base):
    __tablename__ = "refresh_tokens"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    token_hash: Mapped[str] = mapped_column(String(128), unique=True)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    revoked_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class EmailToken(Base):
    __tablename__ = "email_tokens"
    __table_args__ = (
        Index("ix_email_tokens_user_purpose", "user_id", "purpose"),
    )

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    token_hash: Mapped[str] = mapped_column(String(128), unique=True)
    purpose: Mapped[str] = mapped_column(String(32))
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), index=True)
    used_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class FunnelEvent(Base):
    __tablename__ = "funnel_events"
    __table_args__ = (
        CheckConstraint("event IN ('visit', 'signup', 'plan_created', 'export', 'checkout_started', 'paid')", name="ck_funnel_events_event"),
        Index("ix_funnel_events_event_created", "event", "created_at"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    event: Mapped[str] = mapped_column(String(32), nullable=False)
    visitor_id: Mapped[str | None] = mapped_column(String(64), nullable=True, index=True)
    user_id: Mapped[str | None] = mapped_column(ForeignKey("users.id", ondelete="SET NULL"), nullable=True, index=True)
    consented: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True, server_default="true")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class AgentDevice(Base):
    __tablename__ = "agent_devices"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    owner_email: Mapped[str] = mapped_column(String(320), index=True)
    name: Mapped[str] = mapped_column(String(120))
    status: Mapped[str] = mapped_column(String(32), default="registered")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class AgentCommand(Base):
    __tablename__ = "agent_commands"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    owner_email: Mapped[str] = mapped_column(String(320), index=True)
    device_id: Mapped[str | None] = mapped_column(
        ForeignKey("agent_devices.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(64))
    status: Mapped[str] = mapped_column(String(32), default="queued")
    input_data: Mapped[dict[str, object]] = mapped_column(JSON, default=dict, nullable=False)
    result: Mapped[str | None] = mapped_column(Text, nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class SavedBusinessPlan(Base):
    __tablename__ = "saved_business_plans"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    owner_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    business_name: Mapped[str] = mapped_column(String(200))
    location: Mapped[str] = mapped_column(String(300))
    request_payload: Mapped[dict[str, object]] = mapped_column(JSON, nullable=False)
    generated_plan: Mapped[dict[str, object]] = mapped_column(JSON, nullable=False)
    share_token_hash: Mapped[str | None] = mapped_column(
        String(64), nullable=True, unique=True, index=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class MarketplaceListing(Base):
    __tablename__ = "marketplace_listings"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    owner_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    saved_plan_id: Mapped[str | None] = mapped_column(
        ForeignKey("saved_business_plans.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    business_name: Mapped[str] = mapped_column(String(200))
    city: Mapped[str] = mapped_column(String(120))
    stage: Mapped[str] = mapped_column(String(16))
    funding_target: Mapped[Decimal] = mapped_column(Numeric(20, 2))
    currency: Mapped[str] = mapped_column(String(3), default="UZS")
    summary: Mapped[str] = mapped_column(String(2000))
    is_published: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    status: Mapped[str] = mapped_column(String(16), default="published", index=True)
    public_financial_fields: Mapped[list[str]] = mapped_column(JSON, default=list)
    request_financial_fields: Mapped[list[str]] = mapped_column(JSON, default=list)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class MarketplaceContactRequest(Base):
    __tablename__ = "marketplace_contact_requests"
    __table_args__ = (UniqueConstraint("listing_id", "investor_id", name="uq_marketplace_contact_listing_investor"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    listing_id: Mapped[str] = mapped_column(ForeignKey("marketplace_listings.id", ondelete="CASCADE"), index=True)
    investor_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    status: Mapped[str] = mapped_column(String(16), default="pending", server_default="pending")
    message: Mapped[str] = mapped_column(String(2000))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class MarketplaceMessage(Base):
    __tablename__ = "marketplace_messages"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    request_id: Mapped[str] = mapped_column(ForeignKey("marketplace_contact_requests.id", ondelete="CASCADE"), index=True)
    sender_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    content: Mapped[str] = mapped_column(String(4000))
    is_hidden: Mapped[bool] = mapped_column(Boolean, default=False, server_default="false")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class MarketplaceReport(Base):
    __tablename__ = "marketplace_reports"
    __table_args__ = (
        CheckConstraint("target_type IN ('listing', 'message')", name="ck_marketplace_reports_target_type"),
        CheckConstraint("status IN ('open', 'resolved')", name="ck_marketplace_reports_status"),
        Index("ix_marketplace_reports_status_created", "status", "created_at"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    reporter_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    target_type: Mapped[str] = mapped_column(String(16), nullable=False)
    target_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    reason: Mapped[str] = mapped_column(String(1000), nullable=False)
    status: Mapped[str] = mapped_column(String(16), default="open", server_default="open")
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    resolved_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class ModerationAuditEntry(Base):
    __tablename__ = "moderation_audit_entries"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    actor_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="RESTRICT"), index=True)
    action: Mapped[str] = mapped_column(String(32), nullable=False)
    target_type: Mapped[str] = mapped_column(String(16), nullable=False)
    target_id: Mapped[str] = mapped_column(String(64), nullable=False, index=True)
    report_id: Mapped[str | None] = mapped_column(ForeignKey("marketplace_reports.id", ondelete="SET NULL"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class InvestorVerification(Base):
    __tablename__ = "investor_verifications"
    __table_args__ = (
        CheckConstraint("status IN ('submitted', 'approved', 'rejected')", name="ck_investor_verifications_status"),
        UniqueConstraint("user_id", name="uq_investor_verifications_user"),
        Index("ix_investor_verifications_status_created", "status", "created_at"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    full_name: Mapped[str] = mapped_column(String(200))
    organization: Mapped[str | None] = mapped_column(String(200), nullable=True)
    country: Mapped[str] = mapped_column(String(100))
    investment_thesis: Mapped[str] = mapped_column(String(2000))
    source_of_funds: Mapped[str] = mapped_column(String(1000))
    agreement_accepted: Mapped[bool] = mapped_column(Boolean, nullable=False)
    status: Mapped[str] = mapped_column(String(16), default="submitted", server_default="submitted")
    review_note: Mapped[str | None] = mapped_column(String(1000), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())
    reviewed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)


class LedgerEntry(Base):
    __tablename__ = "ledger_entries"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    owner_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    entry_date: Mapped[date] = mapped_column(Date, index=True)
    category: Mapped[str] = mapped_column(String(64))
    amount: Mapped[Decimal] = mapped_column(Numeric(20, 2))
    currency: Mapped[str] = mapped_column(String(3), default="UZS")
    description: Mapped[str | None] = mapped_column(String(500), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class AccountingRecord(Base):
    __tablename__ = "accounting_records"
    __table_args__ = (
        UniqueConstraint("owner_id", "resource", "client_id", name="uq_accounting_record_client"),
        CheckConstraint("resource IN ('inventory', 'stock-movements', 'sales', 'expenses', 'employees')", name="ck_accounting_record_resource"),
        Index("ix_accounting_records_owner_resource", "owner_id", "resource"),
    )

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    owner_id: Mapped[str] = mapped_column(ForeignKey("users.id", ondelete="CASCADE"), index=True)
    resource: Mapped[str] = mapped_column(String(32), nullable=False)
    client_id: Mapped[str] = mapped_column(String(128), nullable=False)
    data: Mapped[dict[str, object]] = mapped_column(JSON, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class ChatConversation(Base):
    __tablename__ = "chat_conversations"

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    owner_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    title: Mapped[str] = mapped_column(String(200))
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class ChatMessage(Base):
    __tablename__ = "chat_messages"

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    conversation_id: Mapped[str] = mapped_column(
        ForeignKey("chat_conversations.id", ondelete="CASCADE"), index=True
    )
    role: Mapped[str] = mapped_column(String(16))
    content: Mapped[str] = mapped_column(Text)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class AIUsageDaily(Base):
    __tablename__ = "ai_usage_daily"
    __table_args__ = (
        UniqueConstraint("user_id", "usage_date", name="uq_ai_usage_user_date"),
        CheckConstraint(
            "requests >= 0 AND completed_requests >= 0 "
            "AND unknown_token_usage_requests >= 0 "
            "AND completed_requests <= requests "
            "AND unknown_token_usage_requests <= completed_requests "
            "AND input_tokens >= 0 AND output_tokens >= 0",
            name="ck_ai_usage_non_negative",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    usage_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    requests: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    completed_requests: Mapped[int] = mapped_column(
        Integer, default=0, server_default="0"
    )
    unknown_token_usage_requests: Mapped[int] = mapped_column(
        Integer, default=0, server_default="0"
    )
    input_tokens: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    output_tokens: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    token_usage_complete: Mapped[bool] = mapped_column(
        Boolean, default=True, server_default="true"
    )
    estimated_cost_usd: Mapped[Decimal] = mapped_column(
        Numeric(24, 12), default=Decimal(0), server_default="0"
    )
    cost_pricing_complete: Mapped[bool] = mapped_column(
        Boolean, default=True, server_default="true"
    )
    cost_pricing_verified: Mapped[bool] = mapped_column(
        Boolean, default=True, server_default="true"
    )


class PlanAnalysisUsageDaily(Base):
    __tablename__ = "plan_analysis_usage_daily"
    __table_args__ = (
        UniqueConstraint(
            "user_id",
            "usage_date",
            name="uq_plan_analysis_usage_user_date",
        ),
        CheckConstraint(
            "uploads >= 0",
            name="ck_plan_analysis_usage_non_negative",
        ),
    )

    id: Mapped[int] = mapped_column(Integer, primary_key=True, autoincrement=True)
    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    usage_date: Mapped[date] = mapped_column(Date, nullable=False, index=True)
    uploads: Mapped[int] = mapped_column(Integer, default=0, server_default="0")


class Subscription(Base):
    __tablename__ = "subscriptions"
    __table_args__ = (
        CheckConstraint(
            "plan IN ('pro', 'business')",
            name="ck_subscriptions_plan",
        ),
        CheckConstraint(
            "status IN ('incomplete', 'active', 'past_due', 'canceled', 'expired')",
            name="ck_subscriptions_status",
        ),
        CheckConstraint(
            "billing_period IN ('weekly', 'monthly', 'yearly')",
            name="ck_subscriptions_billing_period",
        ),
        CheckConstraint(
            "(pending_plan IS NULL AND pending_amount_minor IS NULL) OR "
            "(pending_plan IN ('pro', 'business') AND pending_amount_minor >= 0)",
            name="ck_subscriptions_pending_plan",
        ),
        CheckConstraint("amount_minor >= 0", name="ck_subscriptions_amount_non_negative"),
        Index("ix_subscriptions_user_status", "user_id", "status"),
        Index("ix_subscriptions_period_end", "current_period_end"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    plan: Mapped[str] = mapped_column(String(16))
    status: Mapped[str] = mapped_column(String(16), default="incomplete")
    billing_period: Mapped[str] = mapped_column(String(16), default="weekly")
    amount_minor: Mapped[int] = mapped_column(Integer)
    pending_plan: Mapped[str | None] = mapped_column(String(16), nullable=True)
    pending_amount_minor: Mapped[int | None] = mapped_column(Integer, nullable=True)
    currency: Mapped[str] = mapped_column(String(3), default="USD", server_default="USD")
    provider: Mapped[str | None] = mapped_column(String(32), nullable=True)
    provider_customer_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    provider_subscription_id: Mapped[str | None] = mapped_column(
        String(255), nullable=True, unique=True
    )
    current_period_start: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    current_period_end: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    cancel_at_period_end: Mapped[bool] = mapped_column(
        Boolean, default=False, server_default="false"
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now(), onupdate=func.now()
    )


class Invoice(Base):
    __tablename__ = "invoices"
    __table_args__ = (
        CheckConstraint("amount_minor >= 0", name="ck_invoices_amount_non_negative"),
        CheckConstraint(
            "status IN ('draft', 'open', 'paid', 'void', 'uncollectible')",
            name="ck_invoices_status",
        ),
        UniqueConstraint("user_id", "invoice_number", name="uq_invoices_user_number"),
        UniqueConstraint("id", "user_id", name="uq_invoices_id_user"),
        Index("ix_invoices_user_created", "user_id", "created_at"),
        Index("ix_invoices_status_due", "status", "due_at"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    subscription_id: Mapped[str | None] = mapped_column(
        ForeignKey("subscriptions.id", ondelete="SET NULL"), nullable=True, index=True
    )
    invoice_number: Mapped[str] = mapped_column(String(64))
    provider_checkout_id: Mapped[str | None] = mapped_column(
        String(255), nullable=True, unique=True
    )
    amount_minor: Mapped[int] = mapped_column(Integer)
    currency: Mapped[str] = mapped_column(String(3), default="USD", server_default="USD")
    status: Mapped[str] = mapped_column(String(24), default="open", server_default="open")
    period_start: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    period_end: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    due_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class Payment(Base):
    __tablename__ = "payments"
    __table_args__ = (
        CheckConstraint("amount_minor >= 0", name="ck_payments_amount_non_negative"),
        CheckConstraint(
            "attempt_number IS NULL OR attempt_number >= 1",
            name="ck_payments_attempt_number",
        ),
        CheckConstraint(
            "status IN ('pending', 'succeeded', 'failed', 'refunded', 'partially_refunded')",
            name="ck_payments_status",
        ),
        ForeignKeyConstraint(
            ["invoice_id", "user_id"],
            ["invoices.id", "invoices.user_id"],
            ondelete="RESTRICT",
            name="fk_payments_invoice_owner",
        ),
        UniqueConstraint(
            "invoice_id", "attempt_number", name="uq_payments_invoice_attempt"
        ),
        Index("ix_payments_user_created", "user_id", "created_at"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    invoice_id: Mapped[str] = mapped_column(String(36), index=True)
    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    provider: Mapped[str] = mapped_column(String(32))
    provider_payment_id: Mapped[str | None] = mapped_column(
        String(255), nullable=True, unique=True
    )
    amount_minor: Mapped[int] = mapped_column(Integer)
    currency: Mapped[str] = mapped_column(String(3))
    status: Mapped[str] = mapped_column(String(24), default="pending", server_default="pending")
    attempt_number: Mapped[int | None] = mapped_column(Integer, nullable=True)
    failed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    retry_email_sent_at: Mapped[datetime | None] = mapped_column(
        DateTime(timezone=True), nullable=True
    )
    paid_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class PaymentEvent(Base):
    __tablename__ = "payment_events"
    __table_args__ = (
        UniqueConstraint("provider", "provider_event_id", name="uq_payment_event_provider_id"),
        CheckConstraint("attempts >= 0", name="ck_payment_events_attempts_non_negative"),
        Index("ix_payment_events_status_received", "status", "received_at"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    provider: Mapped[str] = mapped_column(String(32))
    provider_event_id: Mapped[str] = mapped_column(String(255))
    event_type: Mapped[str] = mapped_column(String(100))
    raw_payload: Mapped[dict[str, object]] = mapped_column(JSON, nullable=False)
    signature_valid: Mapped[bool] = mapped_column(Boolean)
    status: Mapped[str] = mapped_column(String(24), default="received", server_default="received")
    attempts: Mapped[int] = mapped_column(Integer, default=0, server_default="0")
    received_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    processed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_error: Mapped[str | None] = mapped_column(String(500), nullable=True)


class CommissionLedger(Base):
    __tablename__ = "commission_ledger"
    __table_args__ = (
        CheckConstraint(
            "revenue_minor >= 0 AND commission_minor >= 0",
            name="ck_commission_ledger_amounts_non_negative",
        ),
        CheckConstraint(
            "status IN ('accrued', 'invoiced', 'paid', 'disputed', 'void')",
            name="ck_commission_ledger_status",
        ),
        UniqueConstraint("user_id", "source_entry_id", name="uq_commission_source_entry"),
        Index("ix_commission_ledger_user_year", "user_id", "revenue_year"),
        Index("ix_commission_ledger_user_date", "user_id", "revenue_date"),
        Index("ix_commission_ledger_status", "status"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    source_entry_id: Mapped[str] = mapped_column(String(64))
    revenue_year: Mapped[int] = mapped_column(Integer)
    revenue_minor: Mapped[int] = mapped_column(BigInteger)
    commission_minor: Mapped[int] = mapped_column(BigInteger)
    revenue_date: Mapped[date | None] = mapped_column(Date, nullable=True)
    device_id: Mapped[str | None] = mapped_column(
        ForeignKey("agent_devices.id", ondelete="SET NULL"), nullable=True
    )
    currency: Mapped[str] = mapped_column(String(3), default="UZS", server_default="UZS")
    status: Mapped[str] = mapped_column(String(16), default="accrued", server_default="accrued")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class CommissionStatement(Base):
    __tablename__ = "commission_statements"
    __table_args__ = (
        CheckConstraint(
            "revenue_minor >= 0 AND total_commission_minor >= 0 "
            "AND previously_billed_minor >= 0 AND amount_due_minor >= 0",
            name="ck_commission_statements_amounts_non_negative",
        ),
        CheckConstraint(
            "statement_month BETWEEN 1 AND 12",
            name="ck_commission_statements_month",
        ),
        CheckConstraint(
            "status IN ('issued', 'disputed', 'paid', 'void')",
            name="ck_commission_statements_status",
        ),
        UniqueConstraint(
            "user_id",
            "revenue_year",
            "statement_month",
            name="uq_commission_statement_user_period",
        ),
        Index("ix_commission_statements_period", "revenue_year", "statement_month"),
    )

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    user_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    revenue_year: Mapped[int] = mapped_column(Integer)
    statement_month: Mapped[int] = mapped_column(Integer)
    revenue_minor: Mapped[int] = mapped_column(BigInteger)
    total_commission_minor: Mapped[int] = mapped_column(BigInteger)
    previously_billed_minor: Mapped[int] = mapped_column(BigInteger)
    amount_due_minor: Mapped[int] = mapped_column(BigInteger)
    status: Mapped[str] = mapped_column(String(16), default="issued", server_default="issued")
    dispute_reason: Mapped[str | None] = mapped_column(String(500), nullable=True)
    disputed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class Refund(Base):
    __tablename__ = "refunds"
    __table_args__ = (
        CheckConstraint("amount_minor > 0", name="ck_refunds_amount_positive"),
        CheckConstraint(
            "status IN ('pending', 'succeeded', 'failed', 'canceled')",
            name="ck_refunds_status",
        ),
        Index("ix_refunds_status_created", "status", "created_at"),
        Index("ix_refunds_payment_created", "payment_id", "created_at"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True, default=lambda: str(uuid.uuid4()))
    payment_id: Mapped[str] = mapped_column(
        ForeignKey("payments.id", ondelete="RESTRICT"), index=True
    )
    amount_minor: Mapped[int] = mapped_column(Integer)
    currency: Mapped[str] = mapped_column(String(3))
    status: Mapped[str] = mapped_column(String(16), default="pending", server_default="pending")
    reason: Mapped[str | None] = mapped_column(String(500), nullable=True)
    provider_refund_id: Mapped[str | None] = mapped_column(
        String(255), nullable=True, unique=True
    )
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
    processed_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
