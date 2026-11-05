import csv
import io
from datetime import UTC, date, datetime
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, Query, status
from fastapi.responses import StreamingResponse
from pydantic import BaseModel
from sqlalchemy import select
from sqlalchemy.orm import Session

from finadvisor_api.ai_client import get_ai_provider_status
from finadvisor_api.ai_metering import daily_request_limit
from finadvisor_api.auth import get_current_user
from finadvisor_api.database import get_db
from finadvisor_api.models import AIUsageDaily, CommissionStatement, User

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
