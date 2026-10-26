from __future__ import annotations

from collections import defaultdict
from datetime import UTC, date, datetime
from decimal import Decimal

from fastapi import APIRouter, Depends, HTTPException, status
from finance_engine import calculate_progressive_commission
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from finadvisor_api.auth import get_current_user
from finadvisor_api.database import get_db
from finadvisor_api.models import CommissionLedger, CommissionStatement, User

router = APIRouter(tags=["commission"])


class CommissionDisputeRequest(BaseModel):
    reason: str = Field(min_length=1, max_length=500)


class CommissionStatementResponse(BaseModel):
    id: str
    user_id: str
    revenue_year: int
    statement_month: int
    revenue_minor: int
    total_commission_minor: int
    previously_billed_minor: int
    amount_due_minor: int
    status: str
    dispute_reason: str | None = None
    disputed_at: datetime | None = None
    created_at: datetime


def _statement_response(statement: CommissionStatement) -> dict[str, object]:
    return {
        "id": statement.id,
        "user_id": statement.user_id,
        "revenue_year": statement.revenue_year,
        "statement_month": statement.statement_month,
        "revenue_minor": statement.revenue_minor,
        "total_commission_minor": statement.total_commission_minor,
        "previously_billed_minor": statement.previously_billed_minor,
        "amount_due_minor": statement.amount_due_minor,
        "status": statement.status,
        "dispute_reason": statement.dispute_reason,
        "disputed_at": statement.disputed_at,
        "created_at": statement.created_at,
    }


@router.get("/me/commission-statements", response_model=list[CommissionStatementResponse])
def list_my_commission_statements(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[CommissionStatementResponse]:
    sync_commission_statements_for_user(db, user.id)
    rows = (
        db.query(CommissionStatement)
        .filter_by(user_id=user.id)
        .order_by(CommissionStatement.revenue_year.desc(), CommissionStatement.statement_month.desc())
        .all()
    )
    return [CommissionStatementResponse.model_validate(_statement_response(item)) for item in rows]


@router.get("/commission-statements", response_model=list[CommissionStatementResponse])
def list_commission_statements_for_owner(
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> list[CommissionStatementResponse]:
    return list_my_commission_statements(user=user, db=db)


@router.post(
    "/me/commission-statements/{statement_id}/dispute",
    response_model=CommissionStatementResponse,
)
def dispute_my_commission_statement(
    statement_id: str,
    payload: CommissionDisputeRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CommissionStatementResponse:
    statement = dispute_statement(db, user_id=user.id, statement_id=statement_id, reason=payload.reason)
    return CommissionStatementResponse.model_validate(_statement_response(statement))


@router.post(
    "/commission-statements/{statement_id}/dispute",
    response_model=CommissionStatementResponse,
)
def dispute_commission_statement(
    statement_id: str,
    payload: CommissionDisputeRequest,
    user: User = Depends(get_current_user),
    db: Session = Depends(get_db),
) -> CommissionStatementResponse:
    return dispute_my_commission_statement(
        statement_id=statement_id,
        payload=payload,
        user=user,
        db=db,
    )


def sync_commission_statements_for_user(db: Session, user_id: str) -> list[dict[str, object]]:
    entries = db.scalars(
        select(CommissionLedger)
        .where(CommissionLedger.user_id == user_id)
        .where(CommissionLedger.status != "void")
        .order_by(CommissionLedger.revenue_date.asc(), CommissionLedger.created_at.asc())
    ).all()
    if not entries:
        return []

    month_totals: dict[int, dict[int, int]] = defaultdict(dict)
    for entry in entries:
        if entry.revenue_date is None:
            continue
        month_totals.setdefault(entry.revenue_year, {})
        month_totals[entry.revenue_year][entry.revenue_date.month] = (
            month_totals[entry.revenue_year].get(entry.revenue_date.month, 0)
            + entry.revenue_minor
        )

    generated: list[dict[str, object]] = []
    for year in sorted(month_totals):
        items = sorted(month_totals[year].items())
        cumulative_revenue = 0
        cumulative_billed = 0
        for month, month_total in items:
            cumulative_revenue += month_total
            total_commission = int(
                calculate_progressive_commission(Decimal(cumulative_revenue)).total_commission
            )
            previous_billed = cumulative_billed
            amount_due = total_commission - previous_billed

            statement = (
                db.query(CommissionStatement)
                .filter_by(user_id=user_id, revenue_year=year, statement_month=month)
                .one_or_none()
            )
            if statement is None:
                statement = CommissionStatement(
                    user_id=user_id,
                    revenue_year=year,
                    statement_month=month,
                    revenue_minor=0,
                    total_commission_minor=0,
                    previously_billed_minor=0,
                    amount_due_minor=0,
                    status="issued",
                )
                db.add(statement)
            if statement.status == "disputed" and statement.dispute_reason:
                existing_status = "disputed"
            else:
                existing_status = "issued"
            statement.revenue_minor = cumulative_revenue
            statement.total_commission_minor = total_commission
            statement.previously_billed_minor = previous_billed
            statement.amount_due_minor = amount_due
            statement.status = existing_status
            cumulative_billed = total_commission
            generated.append(_statement_response(statement))

    db.flush()
    db.commit()
    return generated


def create_revenue_entry(
    db: Session,
    *,
    user_id: str,
    revenue_minor: int,
    revenue_date: date,
    source_entry_id: str,
    device_id: str | None = None,
) -> CommissionLedger:
    if revenue_minor < 0:
        raise ValueError("Commission revenue cannot be negative")

    existing = (
        db.query(CommissionLedger)
        .filter_by(user_id=user_id, source_entry_id=source_entry_id)
        .one_or_none()
    )
    if existing is not None:
        return existing

    entry = CommissionLedger(
        user_id=user_id,
        source_entry_id=source_entry_id,
        revenue_year=revenue_date.year,
        revenue_minor=revenue_minor,
        commission_minor=int(
            calculate_progressive_commission(Decimal(revenue_minor)).total_commission
        ),
        revenue_date=revenue_date,
        device_id=device_id,
        currency="UZS",
        status="accrued",
    )
    db.add(entry)
    db.flush()
    sync_commission_statements_for_user(db, user_id)
    return entry


def dispute_statement(
    db: Session,
    *,
    user_id: str,
    statement_id: str,
    reason: str,
) -> CommissionStatement:
    statement = (
        db.query(CommissionStatement)
        .filter_by(id=statement_id, user_id=user_id)
        .one_or_none()
    )
    if statement is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="commission.statement_not_found",
        )
    if not reason or not reason.strip():
        raise HTTPException(
            status_code=status.HTTP_422_UNPROCESSABLE_ENTITY,
            detail="commission.dispute_reason_required",
        )
    statement.status = "disputed"
    statement.dispute_reason = reason.strip()[:500]
    statement.disputed_at = datetime.now(UTC)
    db.flush()
    db.commit()
    return statement
