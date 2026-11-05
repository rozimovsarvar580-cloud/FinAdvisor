from datetime import UTC, datetime, timedelta
from typing import TypeVar

from sqlalchemy import delete, or_, select
from sqlalchemy.orm import Session
from sqlalchemy.sql.elements import ColumnElement

from finadvisor_api.models import (
    AccountingRecord,
    AgentCommand,
    AgentDevice,
    AIUsageDaily,
    AuditLog,
    ChatConversation,
    ChatMessage,
    CommissionLedger,
    CommissionStatement,
    EmailToken,
    FunnelEvent,
    InvestorVerification,
    Invoice,
    LedgerEntry,
    MarketplaceContactRequest,
    MarketplaceListing,
    MarketplaceMessage,
    MarketplaceReport,
    ModerationAuditEntry,
    OAuthAccount,
    Payment,
    PlanAnalysisUsageDaily,
    RefreshToken,
    Refund,
    SavedBusinessPlan,
    Subscription,
    User,
)

DELETION_GRACE_PERIOD = timedelta(days=30)
Model = TypeVar("Model")


def _records(
    db: Session,
    model: type[Model],
    condition: ColumnElement[bool],
    excluded_fields: frozenset[str] = frozenset(),
) -> list[dict[str, object]]:
    rows = db.scalars(select(model).where(condition)).all()
    return [
        {
            column.key: getattr(row, column.key)
            for column in model.__table__.columns
            if column.key not in excluded_fields
        }
        for row in rows
    ]


def build_account_export(db: Session, user: User) -> dict[str, object]:
    conversations = _records(db, ChatConversation, ChatConversation.owner_id == user.id)
    conversation_ids = [record["id"] for record in conversations]
    listings = _records(db, MarketplaceListing, MarketplaceListing.owner_id == user.id)
    listing_ids = [record["id"] for record in listings]
    listing_requests = (
        select(MarketplaceContactRequest.id).where(
            MarketplaceContactRequest.listing_id.in_(listing_ids)
        )
        if listing_ids
        else None
    )
    investor_requests = _records(
        db, MarketplaceContactRequest, MarketplaceContactRequest.investor_id == user.id
    )
    request_ids = [record["id"] for record in investor_requests]
    if listing_requests is not None:
        request_ids.extend(db.scalars(listing_requests).all())
    message_condition: ColumnElement[bool] = MarketplaceMessage.sender_id == user.id
    if request_ids:
        message_condition = or_(
            message_condition,
            MarketplaceMessage.request_id.in_(request_ids),
        )

    return {
        "exported_at": datetime.now(UTC),
        "account": {
            "id": user.id,
            "email": user.email,
            "name": user.name,
            "avatar_url": user.avatar_url,
            "role": user.role,
            "locale": user.locale,
            "created_at": user.created_at,
            "email_verified": user.email_verified,
            "subscription_plan": user.subscription_plan,
            "deletion_requested_at": user.deletion_requested_at,
        },
        "connected_accounts": _records(
            db,
            OAuthAccount,
            OAuthAccount.user_id == user.id,
            frozenset({"provider_account_id"}),
        ),
        "plans": _records(db, SavedBusinessPlan, SavedBusinessPlan.owner_id == user.id),
        "ledger_entries": _records(db, LedgerEntry, LedgerEntry.owner_id == user.id),
        "accounting_records": _records(
            db, AccountingRecord, AccountingRecord.owner_id == user.id
        ),
        "agent_devices": _records(db, AgentDevice, AgentDevice.owner_email == user.email),
        "agent_commands": _records(db, AgentCommand, AgentCommand.owner_email == user.email),
        "conversations": conversations,
        "chat_messages": _records(
            db,
            ChatMessage,
            ChatMessage.conversation_id.in_(conversation_ids)
            if conversation_ids
            else ChatMessage.id == -1,
        ),
        "marketplace_listings": listings,
        "marketplace_contact_requests": investor_requests,
        "marketplace_messages": _records(
            db, MarketplaceMessage, message_condition
        ),
        "marketplace_reports": _records(
            db, MarketplaceReport, MarketplaceReport.reporter_id == user.id
        ),
        "investor_verification": _records(
            db, InvestorVerification, InvestorVerification.user_id == user.id
        ),
        "ai_usage": _records(db, AIUsageDaily, AIUsageDaily.user_id == user.id),
        "analysis_usage": _records(
            db, PlanAnalysisUsageDaily, PlanAnalysisUsageDaily.user_id == user.id
        ),
        "subscriptions": _records(
            db,
            Subscription,
            Subscription.user_id == user.id,
            frozenset({"provider_customer_id", "provider_subscription_id"}),
        ),
        "invoices": _records(
            db,
            Invoice,
            Invoice.user_id == user.id,
            frozenset({"provider_checkout_id"}),
        ),
        "payments": _records(
            db,
            Payment,
            Payment.user_id == user.id,
            frozenset({"provider_payment_id"}),
        ),
        "refunds": _records(
            db,
            Refund,
            Refund.payment_id.in_(
                select(Payment.id).where(Payment.user_id == user.id)
            ),
            frozenset({"provider_refund_id"}),
        ),
        "commission_entries": _records(
            db, CommissionLedger, CommissionLedger.user_id == user.id
        ),
        "commission_statements": _records(
            db, CommissionStatement, CommissionStatement.user_id == user.id
        ),
        "audit_events": _records(db, AuditLog, AuditLog.actor_id == user.id),
        "analytics_events": _records(db, FunnelEvent, FunnelEvent.user_id == user.id),
        "moderation_events": _records(
            db, ModerationAuditEntry, ModerationAuditEntry.actor_id == user.id
        ),
    }


def _delete_user_data(db: Session, user: User) -> None:
    listing_ids = db.scalars(
        select(MarketplaceListing.id).where(MarketplaceListing.owner_id == user.id)
    ).all()
    request_query = select(MarketplaceContactRequest.id).where(
        MarketplaceContactRequest.investor_id == user.id
    )
    if listing_ids:
        request_query = request_query.union(
            select(MarketplaceContactRequest.id).where(
                MarketplaceContactRequest.listing_id.in_(listing_ids)
            )
        )
    request_ids = db.scalars(request_query).all()

    if request_ids:
        db.execute(
            delete(MarketplaceMessage).where(
                MarketplaceMessage.request_id.in_(request_ids)
            )
        )
    db.execute(delete(MarketplaceMessage).where(MarketplaceMessage.sender_id == user.id))
    db.execute(
        delete(MarketplaceContactRequest).where(
            MarketplaceContactRequest.investor_id == user.id
        )
    )
    if listing_ids:
        db.execute(
            delete(MarketplaceContactRequest).where(
                MarketplaceContactRequest.listing_id.in_(listing_ids)
            )
        )
        db.execute(
            delete(MarketplaceListing).where(MarketplaceListing.id.in_(listing_ids))
        )

    payment_ids = select(Payment.id).where(Payment.user_id == user.id)
    db.execute(delete(Refund).where(Refund.payment_id.in_(payment_ids)))
    db.execute(delete(Payment).where(Payment.user_id == user.id))
    db.execute(delete(Invoice).where(Invoice.user_id == user.id))
    db.execute(delete(Subscription).where(Subscription.user_id == user.id))

    conversation_ids = select(ChatConversation.id).where(ChatConversation.owner_id == user.id)
    db.execute(
        delete(ChatMessage).where(ChatMessage.conversation_id.in_(conversation_ids))
    )
    db.execute(delete(ChatConversation).where(ChatConversation.owner_id == user.id))
    db.execute(delete(ModerationAuditEntry).where(ModerationAuditEntry.actor_id == user.id))
    db.execute(delete(MarketplaceReport).where(MarketplaceReport.reporter_id == user.id))
    db.execute(delete(AuditLog).where(AuditLog.actor_id == user.id))
    db.execute(delete(FunnelEvent).where(FunnelEvent.user_id == user.id))
    db.execute(delete(AgentCommand).where(AgentCommand.owner_email == user.email))
    db.execute(delete(CommissionLedger).where(CommissionLedger.user_id == user.id))
    db.execute(delete(AgentDevice).where(AgentDevice.owner_email == user.email))

    for model, condition in (
        (OAuthAccount, OAuthAccount.user_id == user.id),
        (RefreshToken, RefreshToken.user_id == user.id),
        (EmailToken, EmailToken.user_id == user.id),
        (SavedBusinessPlan, SavedBusinessPlan.owner_id == user.id),
        (InvestorVerification, InvestorVerification.user_id == user.id),
        (LedgerEntry, LedgerEntry.owner_id == user.id),
        (AccountingRecord, AccountingRecord.owner_id == user.id),
        (AIUsageDaily, AIUsageDaily.user_id == user.id),
        (PlanAnalysisUsageDaily, PlanAnalysisUsageDaily.user_id == user.id),
        (CommissionStatement, CommissionStatement.user_id == user.id),
    ):
        db.execute(delete(model).where(condition))
    db.delete(user)


def purge_expired_account_deletions(
    db: Session,
    now: datetime | None = None,
) -> int:
    current_time = now or datetime.now(UTC)
    cutoff = current_time - DELETION_GRACE_PERIOD
    users = db.scalars(
        select(User).where(
            User.deletion_requested_at.is_not(None),
            User.deletion_requested_at <= cutoff,
        )
    ).all()
    for user in users:
        _delete_user_data(db, user)
    db.commit()
    return len(users)
