from datetime import UTC, datetime, timedelta
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, ConfigDict, Field
from sqlalchemy import func, select
from sqlalchemy.orm import Session

from finadvisor_api.auth import get_current_user
from finadvisor_api.database import get_db
from finadvisor_api.models import AnalyticsConsent, FunnelEvent, User

router = APIRouter(prefix="/analytics", tags=["analytics"])
FunnelEventName = Literal["visit", "signup", "plan_created", "export", "checkout_started", "paid"]


class EventRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    event: FunnelEventName
    consent: bool
    visitor_id: str | None = Field(default=None, min_length=16, max_length=64, pattern=r"^[A-Za-z0-9_-]+$")


class AnalyticsConsentRequest(BaseModel):
    model_config = ConfigDict(extra="forbid")
    visitor_id: str = Field(min_length=16, max_length=64, pattern=r"^[A-Za-z0-9_-]+$")
    consent: bool


def record_funnel_event(db: Session, event: FunnelEventName, user_id: str | None = None) -> None:
    db.add(FunnelEvent(event=event, user_id=user_id, consented=True))


@router.post("/events", status_code=status.HTTP_202_ACCEPTED)
def record_event(
    payload: EventRequest,
    db: Annotated[Session, Depends(get_db)],
) -> dict[str, bool]:
    if not payload.consent:
        raise HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail="analytics.consent_required")
    if payload.visitor_id is None:
        raise HTTPException(status_code=status.HTTP_422_UNPROCESSABLE_CONTENT, detail="analytics.visitor_id_required")
    consent = db.scalar(
        select(AnalyticsConsent)
        .where(AnalyticsConsent.visitor_id == payload.visitor_id)
        .order_by(AnalyticsConsent.created_at.desc(), AnalyticsConsent.id.desc())
        .limit(1)
    )
    if consent is None or not consent.consented:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="analytics.consent_required",
        )
    db.add(FunnelEvent(event=payload.event, visitor_id=payload.visitor_id))
    db.commit()
    return {"recorded": True}


@router.post("/consent", status_code=status.HTTP_202_ACCEPTED)
def record_analytics_consent(
    payload: AnalyticsConsentRequest,
    db: Annotated[Session, Depends(get_db)],
) -> dict[str, bool]:
    db.add(
        AnalyticsConsent(
            visitor_id=payload.visitor_id,
            consented=payload.consent,
            created_at=datetime.now(UTC),
        )
    )
    db.commit()
    return {"recorded": True}


@router.get("/funnel", tags=["admin"])
def get_funnel(
    db: Annotated[Session, Depends(get_db)],
    user: Annotated[User, Depends(get_current_user)],
) -> dict[str, object]:
    if user.role != "admin":
        raise HTTPException(status_code=status.HTTP_403_FORBIDDEN, detail="admin.required")
    start = datetime.now(UTC) - timedelta(days=30)
    rows = db.execute(
        select(FunnelEvent.event, func.count(FunnelEvent.id))
        .where(FunnelEvent.created_at >= start, FunnelEvent.consented.is_(True))
        .group_by(FunnelEvent.event)
    ).all()
    counts = {event: count for event, count in rows}
    return {"period_days": 30, "counts": {event: counts.get(event, 0) for event in ("visit", "signup", "plan_created", "export", "checkout_started", "paid")}}
