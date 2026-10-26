from datetime import UTC, datetime
from typing import Annotated, Literal
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from finadvisor_api.auth import get_current_user
from finadvisor_api.database import get_db
from finadvisor_api.models import InvestorVerification, User

router = APIRouter(tags=["investor verification"])


class InvestorProfileInput(BaseModel):
    full_name: str = Field(min_length=2, max_length=200)
    organization: str | None = Field(default=None, max_length=200)
    country: str = Field(min_length=2, max_length=100)
    investment_thesis: str = Field(min_length=10, max_length=2000)
    source_of_funds: str = Field(min_length=10, max_length=1000)
    agreement_accepted: Literal[True]


class ReviewInput(BaseModel):
    status: Literal["approved", "rejected"]
    review_note: str | None = Field(default=None, max_length=1000)


def _require_investor(user: User) -> None:
    if user.role != "investor":
        raise HTTPException(status_code=403, detail="investor_verification.investor_required")


def _require_admin(user: User) -> None:
    if user.role != "admin":
        raise HTTPException(status_code=403, detail="admin.required")


def _profile_response(profile: InvestorVerification) -> dict[str, object]:
    return {
        "id": profile.id,
        "full_name": profile.full_name,
        "organization": profile.organization,
        "country": profile.country,
        "investment_thesis": profile.investment_thesis,
        "source_of_funds": profile.source_of_funds,
        "agreement_accepted": profile.agreement_accepted,
        "status": profile.status,
        "review_note": profile.review_note,
        "created_at": profile.created_at,
        "reviewed_at": profile.reviewed_at,
    }


@router.get("/investors/kyc")
def get_my_verification(
    user: Annotated[User, Depends(get_current_user)], db: Annotated[Session, Depends(get_db)]
) -> dict[str, object]:
    _require_investor(user)
    profile = db.scalar(select(InvestorVerification).where(InvestorVerification.user_id == user.id))
    return {"status": profile.status if profile else "not_submitted", "profile": _profile_response(profile) if profile else None}


@router.put("/investors/kyc")
def submit_verification(
    data: InvestorProfileInput,
    user: Annotated[User, Depends(get_current_user)], db: Annotated[Session, Depends(get_db)],
) -> dict[str, object]:
    _require_investor(user)
    profile = db.scalar(select(InvestorVerification).where(InvestorVerification.user_id == user.id))
    if profile and profile.status == "approved":
        raise HTTPException(status_code=409, detail="investor_verification.already_approved")
    if profile is None:
        profile = InvestorVerification(id=str(uuid4()), user_id=user.id, **data.model_dump())
        db.add(profile)
    else:
        for key, value in data.model_dump().items():
            setattr(profile, key, value)
        profile.status = "submitted"
        profile.review_note = None
        profile.reviewed_at = None
    db.commit()
    db.refresh(profile)
    return _profile_response(profile)


@router.get("/admin/investor-verifications")
def list_verifications(
    user: Annotated[User, Depends(get_current_user)], db: Annotated[Session, Depends(get_db)],
) -> dict[str, list[dict[str, object]]]:
    _require_admin(user)
    rows = db.scalars(select(InvestorVerification).order_by(InvestorVerification.created_at)).all()
    return {"items": [{**_profile_response(row), "user_id": row.user_id, "email": db.get(User, row.user_id).email} for row in rows]}


@router.patch("/admin/investor-verifications/{verification_id}")
def review_verification(
    verification_id: str, data: ReviewInput,
    user: Annotated[User, Depends(get_current_user)], db: Annotated[Session, Depends(get_db)],
) -> dict[str, object]:
    _require_admin(user)
    profile = db.get(InvestorVerification, verification_id)
    if profile is None:
        raise HTTPException(status_code=404, detail="investor_verification.not_found")
    profile.status = data.status
    profile.review_note = data.review_note
    profile.reviewed_at = datetime.now(UTC)
    db.commit()
    db.refresh(profile)
    return _profile_response(profile)
