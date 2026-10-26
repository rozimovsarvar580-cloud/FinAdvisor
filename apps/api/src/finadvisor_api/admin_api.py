import csv
import io
from collections import defaultdict
from datetime import UTC, date, datetime, timedelta
from typing import Annotated, Literal
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from finance_engine.money import (
    decimal_amount_to_string,
    minor_units_to_decimal_string,
    monthly_recurring_minor_units,
    percentage_rate,
    sum_decimal_amounts,
    sum_minor_units,
)
from pydantic import BaseModel
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from finadvisor_api.ai_client import get_ai_provider_status
from finadvisor_api.ai_metering import daily_request_limit
from finadvisor_api.auth import get_current_user
from finadvisor_api.database import get_db
from finadvisor_api.models import (
    AIUsageDaily,
    CommissionLedger,
    CommissionStatement,
    Invoice,
    MarketplaceListing,
    MarketplaceMessage,
    MarketplaceReport,
    ModerationAuditEntry,
    Payment,
    Subscription,
    User,
)

router = APIRouter(prefix="/admin", tags=["admin"])


class ModerationAction(BaseModel):
    action: Literal["hide", "ban", "dismiss"]


@router.get("/moderation")
def moderation_queue(user: Annotated[User, Depends(get_current_user)], db: Annotated[Session, Depends(get_db)]) -> dict[str, list[dict[str, object]]]:
    _require_admin(user)
    reports = db.scalars(select(MarketplaceReport).where(MarketplaceReport.status == "open").order_by(MarketplaceReport.created_at)).all()
    items = []
    for report in reports:
        target = db.get(MarketplaceListing if report.target_type == "listing" else MarketplaceMessage, report.target_id)
        reporter = db.get(User, report.reporter_id)
        items.append({"id": report.id, "target_type": report.target_type, "target_id": report.target_id, "reason": report.reason, "reporter_id": report.reporter_id, "reporter_email": reporter.email if reporter else None, "created_at": report.created_at, "target_exists": target is not None})
    return {"items": items}


@router.patch("/moderation/{report_id}")
def review_moderation_report(report_id: str, data: ModerationAction, user: Annotated[User, Depends(get_current_user)], db: Annotated[Session, Depends(get_db)]) -> dict[str, str]:
    _require_admin(user)
    report = db.get(MarketplaceReport, report_id)
    if report is None:
        raise HTTPException(status_code=404, detail="moderation.report_not_found")
    if report.status != "open":
        raise HTTPException(status_code=409, detail="moderation.report_resolved")
    action_target_type = report.target_type
    if data.action == "hide":
        if report.target_type == "listing":
            target = db.get(MarketplaceListing, report.target_id)
            if target:
                target.status = "archived"
                target.is_published = False
        else:
            target = db.get(MarketplaceMessage, report.target_id)
            if target:
                target.is_hidden = True
    elif data.action == "ban":
        if report.target_type == "listing":
            target = db.get(MarketplaceListing, report.target_id)
            target_user_id = target.owner_id if target else None
        else:
            target = db.get(MarketplaceMessage, report.target_id)
            target_user_id = target.sender_id if target else None
        banned = db.get(User, target_user_id) if target_user_id else None
        if banned:
            banned.is_suspended = True
    report.status = "resolved"
    report.resolved_at = datetime.now(UTC)
    db.add(ModerationAuditEntry(id=str(uuid4()), actor_id=user.id, action=data.action, target_type=action_target_type, target_id=report.target_id, report_id=report.id))
    db.commit()
    return {"id": report.id, "status": report.status, "action": data.action}


@router.get("/moderation/audit")
def moderation_audit(user: Annotated[User, Depends(get_current_user)], db: Annotated[Session, Depends(get_db)]) -> dict[str, list[dict[str, object]]]:
    _require_admin(user)
    rows = db.scalars(select(ModerationAuditEntry).order_by(ModerationAuditEntry.created_at.desc()).limit(200)).all()
    return {"items": [{"id": row.id, "actor_id": row.actor_id, "action": row.action, "target_type": row.target_type, "target_id": row.target_id, "report_id": row.report_id, "created_at": row.created_at} for row in rows]}


class AIStatusResponse(BaseModel):
    connected: bool
    provider: Literal["openai"]
    model: str


class AIUsageResponse(BaseModel):
    user_id: str
    email: str
    plan: str
    date: date
    requests: int
    daily_limit: int
    completed_requests: int
    input_tokens: int
    output_tokens: int
    token_usage_complete: bool
    estimated_cost_usd: str | None
    cost_pricing_complete: bool
    cost_is_estimate: bool


class CommissionStatementSummaryResponse(BaseModel):
    user_id: str
    email: str
    plan: str
    revenue_year: int
    statement_month: int
    revenue_minor: int
    total_commission_minor: int
    previously_billed_minor: int
    amount_due_minor: int
    status: str
    dispute_reason: str | None


class RevenueTotalResponse(BaseModel):
    currency: str
    amount_minor: int
    amount_decimal: str


class UserAIFinancialResponse(BaseModel):
    user_id: str
    email: str
    plan: str
    subscription_revenue_minor_usd: int
    subscription_revenue_usd: str
    estimated_ai_cost_usd: str | None
    token_usage_complete: bool
    cost_pricing_complete: bool


class RevenueDashboardResponse(BaseModel):
    period_start: date
    period_end: date
    mrr: list[RevenueTotalResponse]
    weekly_revenue: list[RevenueTotalResponse]
    active_subscribers_by_plan: dict[str, int]
    current_active_subscribers: int
    churned_subscribers: int
    churn_rate_percent: str | None
    failed_payment_count: int
    accrued_commission: list[RevenueTotalResponse]
    ai_financials_by_user: list[UserAIFinancialResponse]


def _totals_by_currency(amounts: dict[str, list[int]]) -> list[RevenueTotalResponse]:
    return [
        RevenueTotalResponse(
            currency=currency,
            amount_minor=sum_minor_units(values),
            amount_decimal=minor_units_to_decimal_string(sum_minor_units(values)),
        )
        for currency, values in sorted(amounts.items())
    ]


def _reporting_period(year: int | None, month: int | None) -> tuple[date, date]:
    now = datetime.now(UTC)
    selected_year = year or now.year
    selected_month = month or now.month
    period_start = date(selected_year, selected_month, 1)
    period_end = (
        date(selected_year + 1, 1, 1)
        if selected_month == 12
        else date(selected_year, selected_month + 1, 1)
    )
    return period_start, period_end


def _reporting_datetime(value: date) -> datetime:
    return datetime.combine(value, datetime.min.time(), tzinfo=UTC)


def _build_revenue_dashboard(
    db: Session, period_start: date, period_end: date
) -> RevenueDashboardResponse:
    start_at = _reporting_datetime(period_start)
    end_at = _reporting_datetime(period_end)
    now = datetime.now(UTC)

    active_subscriptions = db.scalars(
        select(Subscription).where(Subscription.status == "active")
    ).all()
    mrr_amounts: dict[str, list[int]] = defaultdict(list)
    for subscription in active_subscriptions:
        mrr_amounts[subscription.currency].append(
            monthly_recurring_minor_units(
                subscription.amount_minor, subscription.billing_period
            )
        )

    plan_rows = db.execute(
        select(Subscription.plan, func.count(func.distinct(Subscription.user_id)))
        .where(Subscription.status == "active")
        .group_by(Subscription.plan)
    ).all()
    active_by_plan = {plan: count for plan, count in plan_rows}
    current_active_subscribers = db.scalar(
        select(func.count(func.distinct(Subscription.user_id))).where(
            Subscription.status == "active"
        )
    ) or 0
    churned_subscribers = db.scalar(
        select(func.count(func.distinct(Subscription.user_id))).where(
            Subscription.status == "canceled",
            Subscription.updated_at >= start_at,
            Subscription.updated_at < end_at,
        )
    ) or 0
    churn_rate = percentage_rate(
        churned_subscribers, current_active_subscribers + churned_subscribers
    )

    weekly_start = now - timedelta(days=7)
    weekly_rows = db.execute(
        select(Payment.currency, Payment.amount_minor)
        .join(Invoice, Invoice.id == Payment.invoice_id)
        .where(
            Payment.status == "succeeded",
            Invoice.subscription_id.is_not(None),
            Payment.paid_at >= weekly_start,
            Payment.paid_at <= now,
        )
    ).all()
    weekly_amounts: dict[str, list[int]] = defaultdict(list)
    for currency, amount_minor in weekly_rows:
        weekly_amounts[currency].append(amount_minor)

    failed_payment_count = db.scalar(
        select(func.count(Payment.id))
        .join(Invoice, Invoice.id == Payment.invoice_id)
        .where(
            Payment.status == "failed",
            Invoice.subscription_id.is_not(None),
            Payment.created_at >= start_at,
            Payment.created_at < end_at,
        )
    ) or 0

    commission_rows = db.execute(
        select(CommissionLedger.currency, CommissionLedger.commission_minor).where(
            CommissionLedger.status == "accrued"
        )
    ).all()
    commission_amounts: dict[str, list[int]] = defaultdict(list)
    for currency, amount_minor in commission_rows:
        commission_amounts[currency].append(amount_minor)

    user_details: dict[str, tuple[str, str]] = {}
    user_revenue: dict[str, list[int]] = defaultdict(list)
    revenue_rows = db.execute(
        select(
            Payment.user_id,
            Payment.amount_minor,
            User.email,
            User.subscription_plan,
        )
        .join(Invoice, Invoice.id == Payment.invoice_id)
        .join(User, User.id == Payment.user_id)
        .where(
            Payment.status == "succeeded",
            Payment.currency == "USD",
            Invoice.subscription_id.is_not(None),
            Payment.paid_at >= start_at,
            Payment.paid_at < end_at,
        )
    ).all()
    for user_id, amount_minor, email, plan in revenue_rows:
        user_details[user_id] = (email, plan)
        user_revenue[user_id].append(amount_minor)

    usage_rows = db.execute(
        select(AIUsageDaily, User.email, User.subscription_plan)
        .join(User, User.id == AIUsageDaily.user_id)
        .where(
            AIUsageDaily.usage_date >= period_start,
            AIUsageDaily.usage_date < period_end,
        )
    ).all()
    user_usage: dict[str, list[AIUsageDaily]] = defaultdict(list)
    for usage, email, plan in usage_rows:
        user_details[usage.user_id] = (email, plan)
        user_usage[usage.user_id].append(usage)

    ai_financials = []
    for user_id in sorted(user_details):
        email, plan = user_details[user_id]
        usage = user_usage.get(user_id, [])
        cost_complete = all(item.cost_pricing_complete for item in usage)
        token_usage_complete = all(item.token_usage_complete for item in usage)
        cost = sum_decimal_amounts(
            item.estimated_cost_usd for item in usage
        )
        ai_financials.append(
            UserAIFinancialResponse(
                user_id=user_id,
                email=email,
                plan=plan,
                subscription_revenue_minor_usd=sum_minor_units(
                    user_revenue.get(user_id, [])
                ),
                subscription_revenue_usd=minor_units_to_decimal_string(
                    sum_minor_units(user_revenue.get(user_id, []))
                ),
                estimated_ai_cost_usd=(
                    decimal_amount_to_string(cost)
                    if cost_complete and token_usage_complete
                    else None
                ),
                token_usage_complete=token_usage_complete,
                cost_pricing_complete=cost_complete,
            )
        )

    return RevenueDashboardResponse(
        period_start=period_start,
        period_end=period_end,
        mrr=_totals_by_currency(mrr_amounts),
        weekly_revenue=_totals_by_currency(weekly_amounts),
        active_subscribers_by_plan=active_by_plan,
        current_active_subscribers=current_active_subscribers,
        churned_subscribers=churned_subscribers,
        churn_rate_percent=format(churn_rate, ".2f") if churn_rate is not None else None,
        failed_payment_count=failed_payment_count,
        accrued_commission=_totals_by_currency(commission_amounts),
        ai_financials_by_user=ai_financials,
    )


def get_revenue_dashboard(
    db: Session,
    year: int | None = None,
    month: int | None = None,
) -> RevenueDashboardResponse:
    period_start, period_end = _reporting_period(year, month)
    return _build_revenue_dashboard(db, period_start, period_end)


@router.get("/revenue", response_model=RevenueDashboardResponse)
def get_admin_revenue_dashboard(
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    year: int | None = Query(default=None, ge=2000, le=2100),
    month: int | None = Query(default=None, ge=1, le=12),
) -> RevenueDashboardResponse:
    _require_admin(user)
    return get_revenue_dashboard(db, year=year, month=month)


@router.get("/revenue/export")
def export_admin_revenue_dashboard(
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    year: int | None = Query(default=None, ge=2000, le=2100),
    month: int | None = Query(default=None, ge=1, le=12),
) -> StreamingResponse:
    _require_admin(user)
    dashboard = get_revenue_dashboard(db, year=year, month=month)
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(["metric", "user_id", "email", "plan", "currency", "value", "complete"])
    for metric, totals in (
        ("mrr", dashboard.mrr),
        ("weekly_revenue", dashboard.weekly_revenue),
        ("accrued_commission", dashboard.accrued_commission),
    ):
        for total in totals:
            writer.writerow([metric, "", "", "", total.currency, total.amount_minor, "true"])
    writer.writerow(["active_subscribers", "", "", "", "", dashboard.current_active_subscribers, "true"])
    for plan, count in sorted(dashboard.active_subscribers_by_plan.items()):
        writer.writerow(["active_subscribers_by_plan", "", "", plan, "", count, "true"])
    writer.writerow(["churned_subscribers", "", "", "", "", dashboard.churned_subscribers, "true"])
    writer.writerow([
        "churn_rate_percent",
        "",
        "",
        "",
        "",
        dashboard.churn_rate_percent or "",
        str(dashboard.churn_rate_percent is not None).lower(),
    ])
    writer.writerow(["failed_payment_count", "", "", "", "", dashboard.failed_payment_count, "true"])
    for user_metrics in dashboard.ai_financials_by_user:
        writer.writerow([
            "user_ai_cost_vs_revenue_usd",
            user_metrics.user_id,
            user_metrics.email,
            user_metrics.plan,
            "USD",
            f"revenue_minor={user_metrics.subscription_revenue_minor_usd};ai_cost_usd={user_metrics.estimated_ai_cost_usd or ''}",
            str(user_metrics.cost_pricing_complete and user_metrics.token_usage_complete).lower(),
        ])
    body = output.getvalue().encode("utf-8-sig")
    filename = f"revenue_dashboard_{dashboard.period_start:%Y_%m}.csv"
    return StreamingResponse(
        io.BytesIO(body),
        media_type="text/csv; charset=utf-8",
        headers={"Content-Disposition": f'attachment; filename="{filename}"'},
    )


@router.get("/commission-statements", response_model=list[CommissionStatementSummaryResponse])
def get_admin_commission_statements(
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    year: int | None = None,
    month: int | None = None,
) -> list[CommissionStatementSummaryResponse]:
    _require_admin(user)
    query = select(
        CommissionStatement,
        User.email,
        User.subscription_plan,
    ).join(User, User.id == CommissionStatement.user_id)
    if year is not None:
        query = query.where(CommissionStatement.revenue_year == year)
    if month is not None:
        query = query.where(CommissionStatement.statement_month == month)
    query = query.order_by(
        CommissionStatement.revenue_year.desc(),
        CommissionStatement.statement_month.desc(),
        CommissionStatement.user_id,
    )
    rows = db.execute(query).all()
    return [
        CommissionStatementSummaryResponse(
            user_id=statement.user_id,
            email=email,
            plan=plan,
            revenue_year=statement.revenue_year,
            statement_month=statement.statement_month,
            revenue_minor=statement.revenue_minor,
            total_commission_minor=statement.total_commission_minor,
            previously_billed_minor=statement.previously_billed_minor,
            amount_due_minor=statement.amount_due_minor,
            status=statement.status,
            dispute_reason=statement.dispute_reason,
        )
        for statement, email, plan in rows
    ]


@router.get("/commission-statements/export")
def export_admin_commission_statements(
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    year: int | None = None,
    month: int | None = None,
) -> StreamingResponse:
    _require_admin(user)
    rows = get_admin_commission_statements(user, db, year=year, month=month)
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow([
        "user_id",
        "email",
        "plan",
        "revenue_year",
        "statement_month",
        "revenue_minor",
        "total_commission_minor",
        "previously_billed_minor",
        "amount_due_minor",
        "status",
        "dispute_reason",
    ])
    for row in rows:
        writer.writerow([
            row.user_id,
            row.email,
            row.plan,
            row.revenue_year,
            row.statement_month,
            row.revenue_minor,
            row.total_commission_minor,
            row.previously_billed_minor,
            row.amount_due_minor,
            row.status,
            row.dispute_reason,
        ])
    body = output.getvalue().encode("utf-8")
    return StreamingResponse(
        io.BytesIO(body),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=commission_statements.csv"},
    )


def _require_admin(user: User) -> None:
    if user.role != "admin":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="admin.required",
        )


@router.get("/ai-status", response_model=AIStatusResponse)
def get_admin_ai_status(
    user: Annotated[User, Depends(get_current_user)],
) -> AIStatusResponse:
    _require_admin(user)
    provider_status = get_ai_provider_status()
    return AIStatusResponse(
        connected=provider_status.connected,
        provider="openai",
        model=provider_status.model,
    )


@router.get("/ai-usage", response_model=list[AIUsageResponse])
def get_admin_ai_usage(
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    usage_date: Annotated[date | None, Query()] = None,
) -> list[AIUsageResponse]:
    _require_admin(user)
    selected_date = usage_date or datetime.now(UTC).date()
    rows = db.execute(
        select(AIUsageDaily, User.email, User.subscription_plan)
        .join(User, User.id == AIUsageDaily.user_id)
        .where(AIUsageDaily.usage_date == selected_date)
        .order_by(AIUsageDaily.requests.desc(), AIUsageDaily.user_id)
        .limit(500)
    ).all()
    return [
        AIUsageResponse(
            user_id=usage.user_id,
            email=email,
            plan=plan,
            date=usage.usage_date,
            requests=usage.requests,
            daily_limit=daily_request_limit(plan),
            completed_requests=usage.completed_requests,
            input_tokens=usage.input_tokens,
            output_tokens=usage.output_tokens,
            token_usage_complete=usage.token_usage_complete,
            estimated_cost_usd=(
                format(usage.estimated_cost_usd, "f")
                if usage.cost_pricing_complete
                else None
            ),
            cost_pricing_complete=usage.cost_pricing_complete,
            cost_is_estimate=not usage.cost_pricing_verified,
        )
        for usage, email, plan in rows
    ]
