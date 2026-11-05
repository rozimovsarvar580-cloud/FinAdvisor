import csv
import io
from collections import defaultdict
from datetime import UTC, date, datetime, timedelta
from decimal import Decimal
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from finance_engine import (
    calculate_cancellation_rate_percent,
    decimal_amount_to_string,
    normalize_recurring_revenue_minor,
    sum_decimal_amounts,
    sum_minor_units,
)
from finance_engine.money import minor_units_to_decimal_string
from pydantic import BaseModel
from sqlalchemy import func, or_, select
from sqlalchemy.orm import Session

from finadvisor_api.ai_client import get_ai_provider_status
from finadvisor_api.ai_metering import daily_request_limit
from finadvisor_api.auth import get_current_user
from finadvisor_api.database import get_db
from finadvisor_api.models import (
    AIUsageDaily,
    CommissionLedger,
    CommissionStatement,
    Payment,
    Subscription,
    User,
)

router = APIRouter(prefix="/admin", tags=["admin"])


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


class RevenueAmountResponse(BaseModel):
    currency: str
    amount_minor: int
    amount: str


class RevenueUserResponse(BaseModel):
    user_id: str
    email: str
    ai_cost_usd: str
    ai_cost_complete: bool
    ai_cost_is_estimate: bool
    subscription_revenue_30d: list[RevenueAmountResponse]


class AdminRevenueDashboardResponse(BaseModel):
    as_of: datetime
    period_start: datetime
    active_subscribers_total: int
    active_subscribers_by_plan: dict[str, int]
    cancellations_30d: int
    cancellation_rate_percent_30d: str | None
    failed_payment_attempts_30d: int
    weekly_recurring_revenue: list[RevenueAmountResponse]
    monthly_recurring_revenue: list[RevenueAmountResponse]
    gross_subscription_payments_7d: list[RevenueAmountResponse]
    accrued_commission: list[RevenueAmountResponse]
    ai_cost_usd_30d: str
    ai_cost_complete_30d: bool
    ai_cost_is_estimate_30d: bool
    users: list[RevenueUserResponse]


def _money_by_currency(amounts: dict[str, list[int]]) -> list[RevenueAmountResponse]:
    results: list[RevenueAmountResponse] = []
    for currency, values in sorted(amounts.items()):
        total = sum_minor_units(values)
        results.append(RevenueAmountResponse(
            currency=currency,
            amount_minor=total,
            amount=minor_units_to_decimal_string(total),
        ))
    return results


def _build_admin_revenue_dashboard(
    db: Session, as_of: datetime
) -> AdminRevenueDashboardResponse:
    period_start = as_of - timedelta(days=30)
    week_start = as_of - timedelta(days=7)
    period_start_date = period_start.date()

    active_subscriptions = db.scalars(
        select(Subscription).where(
            Subscription.status == "active",
            or_(
                Subscription.current_period_end.is_(None),
                Subscription.current_period_end > as_of,
            ),
        )
    ).all()
    active_by_plan = {"pro": 0, "business": 0}
    weekly_recurring: dict[str, list[int]] = defaultdict(list)
    monthly_recurring: dict[str, list[int]] = defaultdict(list)
    for subscription in active_subscriptions:
        if subscription.plan in active_by_plan:
            active_by_plan[subscription.plan] += 1
        normalized = normalize_recurring_revenue_minor(
            subscription.amount_minor, subscription.billing_period
        )
        weekly_recurring[subscription.currency].append(normalized.weekly)
        monthly_recurring[subscription.currency].append(normalized.monthly)

    canceled_subscriptions = db.scalars(
        select(Subscription).where(
            Subscription.status == "canceled",
            Subscription.updated_at >= period_start,
        )
    ).all()
    cancellation_rate = calculate_cancellation_rate_percent(
        len(active_subscriptions), len(canceled_subscriptions)
    )
    failed_payment_attempts = db.scalar(
        select(func.count(Payment.id)).where(
            Payment.status == "failed",
            func.coalesce(Payment.failed_at, Payment.created_at) >= period_start,
        )
    ) or 0

    paid_rows = db.execute(
        select(Payment, User.email)
        .join(User, User.id == Payment.user_id)
        .where(
            Payment.status == "succeeded",
            Payment.paid_at >= period_start,
        )
        .order_by(Payment.user_id, Payment.currency, Payment.paid_at)
    ).all()
    paid_rows_7d = db.execute(
        select(Payment)
        .where(
            Payment.status == "succeeded",
            Payment.paid_at >= week_start,
        )
    ).scalars().all()
    weekly_payments: dict[str, list[int]] = defaultdict(list)
    for payment in paid_rows_7d:
        weekly_payments[payment.currency].append(payment.amount_minor)

    accrued_commissions = db.scalars(
        select(CommissionLedger).where(CommissionLedger.status == "accrued")
    ).all()
    commission_amounts: dict[str, list[int]] = defaultdict(list)
    for entry in accrued_commissions:
        commission_amounts[entry.currency].append(entry.commission_minor)

    usage_rows = db.execute(
        select(AIUsageDaily, User.email)
        .join(User, User.id == AIUsageDaily.user_id)
        .where(
            AIUsageDaily.usage_date >= period_start_date,
            AIUsageDaily.usage_date <= as_of.date(),
        )
        .order_by(AIUsageDaily.user_id, AIUsageDaily.usage_date)
    ).all()
    usage_by_user: dict[str, list[AIUsageDaily]] = defaultdict(list)
    email_by_user: dict[str, str] = {}
    for usage, email in usage_rows:
        usage_by_user[usage.user_id].append(usage)
        email_by_user[usage.user_id] = email
    paid_by_user: dict[str, dict[str, list[int]]] = defaultdict(
        lambda: defaultdict(list)
    )
    for payment, email in paid_rows:
        paid_by_user[payment.user_id][payment.currency].append(payment.amount_minor)
        email_by_user[payment.user_id] = email

    user_ids = sorted(set(usage_by_user) | set(paid_by_user))
    user_comparisons: list[RevenueUserResponse] = []
    all_known_ai_costs: list[Decimal] = []
    for user_id in user_ids:
        usage = usage_by_user.get(user_id, [])
        user_cost = sum_decimal_amounts(
            [row.estimated_cost_usd for row in usage]
        )
        all_known_ai_costs.append(user_cost)
        user_cost_complete = all(
            row.token_usage_complete and row.cost_pricing_complete for row in usage
        )
        user_cost_estimate = any(
            not row.cost_pricing_verified for row in usage
        ) or not user_cost_complete
        user_comparisons.append(
            RevenueUserResponse(
                user_id=user_id,
                email=email_by_user[user_id],
                ai_cost_usd=decimal_amount_to_string(user_cost),
                ai_cost_complete=user_cost_complete,
                ai_cost_is_estimate=user_cost_estimate,
                subscription_revenue_30d=_money_by_currency(
                    paid_by_user.get(user_id, {})
                ),
            )
        )

    all_usage = [usage for rows in usage_by_user.values() for usage in rows]
    ai_cost_complete = all(
        row.token_usage_complete and row.cost_pricing_complete for row in all_usage
    )
    ai_cost_is_estimate = any(
        not row.cost_pricing_verified for row in all_usage
    ) or not ai_cost_complete

    return AdminRevenueDashboardResponse(
        as_of=as_of,
        period_start=period_start,
        active_subscribers_total=len(active_subscriptions),
        active_subscribers_by_plan=active_by_plan,
        cancellations_30d=len(canceled_subscriptions),
        cancellation_rate_percent_30d=(
            format(cancellation_rate, "f") if cancellation_rate is not None else None
        ),
        failed_payment_attempts_30d=failed_payment_attempts,
        weekly_recurring_revenue=_money_by_currency(weekly_recurring),
        monthly_recurring_revenue=_money_by_currency(monthly_recurring),
        gross_subscription_payments_7d=_money_by_currency(weekly_payments),
        accrued_commission=_money_by_currency(commission_amounts),
        ai_cost_usd_30d=decimal_amount_to_string(
            sum_decimal_amounts(all_known_ai_costs)
        ),
        ai_cost_complete_30d=ai_cost_complete,
        ai_cost_is_estimate_30d=ai_cost_is_estimate,
        users=user_comparisons,
    )


def _safe_csv_text(value: str) -> str:
    if value.lstrip().startswith(("=", "+", "-", "@")):
        return f"'{value}"
    return value


def _admin_revenue_csv(report: AdminRevenueDashboardResponse) -> bytes:
    output = io.StringIO()
    writer = csv.writer(output)
    writer.writerow(
        [
            "section",
            "metric",
            "user_id",
            "email",
            "currency",
            "amount_minor",
            "amount",
            "ai_cost_usd",
            "count",
            "percentage",
            "complete",
            "is_estimate",
            "period_start",
            "as_of",
        ]
    )
    period_start = report.period_start.isoformat()
    as_of = report.as_of.isoformat()

    def summary(
        metric: str,
        *,
        count: int | None = None,
        percentage: str | None = None,
        amount: str | None = None,
        currency: str = "",
    ):
        writer.writerow(
            [
                "summary",
                metric,
                "",
                "",
                currency,
                "",
                amount,
                "",
                count,
                percentage,
                "",
                "",
                period_start,
                as_of,
            ]
        )

    summary("active_subscribers_total", count=report.active_subscribers_total)
    for plan, count in sorted(report.active_subscribers_by_plan.items()):
        summary(f"active_subscribers_{plan}", count=count)
    summary("cancellations_30d", count=report.cancellations_30d)
    summary(
        "cancellation_rate_percent_30d",
        percentage=report.cancellation_rate_percent_30d,
    )
    summary("failed_payment_attempts_30d", count=report.failed_payment_attempts_30d)

    for metric, amounts in (
        ("weekly_recurring_revenue", report.weekly_recurring_revenue),
        ("monthly_recurring_revenue", report.monthly_recurring_revenue),
        ("gross_subscription_payments_7d", report.gross_subscription_payments_7d),
        ("accrued_commission", report.accrued_commission),
    ):
        for amount in amounts:
            writer.writerow(
                [
                    "summary",
                    metric,
                    "",
                    "",
                    amount.currency,
                    amount.amount_minor,
                    amount.amount,
                    "",
                    "",
                    "",
                    "",
                    "",
                    period_start,
                    as_of,
                ]
            )
    summary("ai_cost_usd_30d", amount=report.ai_cost_usd_30d, currency="USD")
    writer.writerow(
        [
            "summary",
            "ai_cost_status_30d",
            "",
            "",
            "USD",
            "",
            report.ai_cost_usd_30d,
            report.ai_cost_usd_30d,
            "",
            "",
            report.ai_cost_complete_30d,
            report.ai_cost_is_estimate_30d,
            period_start,
            as_of,
        ]
    )
    for user in report.users:
        revenues = user.subscription_revenue_30d
        if not revenues:
            revenues = [RevenueAmountResponse(currency="", amount_minor=0, amount="0.00")]
        for revenue in revenues:
            writer.writerow(
                [
                    "user",
                    "ai_cost_vs_subscription_revenue_30d",
                    user.user_id,
                    _safe_csv_text(user.email),
                    _safe_csv_text(revenue.currency),
                    revenue.amount_minor,
                    revenue.amount,
                    user.ai_cost_usd,
                    "",
                    "",
                    user.ai_cost_complete,
                    user.ai_cost_is_estimate,
                    period_start,
                    as_of,
                ]
            )
    return output.getvalue().encode("utf-8")


@router.get("/revenue", response_model=AdminRevenueDashboardResponse)
def get_admin_revenue_dashboard(
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> AdminRevenueDashboardResponse:
    _require_admin(user)
    return _build_admin_revenue_dashboard(db, datetime.now(UTC))


@router.get("/revenue/export")
def export_admin_revenue_dashboard(
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> StreamingResponse:
    _require_admin(user)
    report = _build_admin_revenue_dashboard(db, datetime.now(UTC))
    return StreamingResponse(
        io.BytesIO(_admin_revenue_csv(report)),
        media_type="text/csv",
        headers={"Content-Disposition": "attachment; filename=admin_revenue.csv"},
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
