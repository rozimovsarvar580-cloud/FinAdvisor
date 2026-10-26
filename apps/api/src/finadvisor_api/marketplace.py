from typing import Annotated
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from finadvisor_api.auth import get_current_user
from finadvisor_api.database import get_db
from finadvisor_api.models import MarketplaceListing, SavedBusinessPlan, User
from finadvisor_api.plan_limits import reserve_lifetime_quota
from finadvisor_api.plan_schemas import PlanGenerateResponse
from finadvisor_api.schemas import (
    MarketplaceListingCreateRequest,
    MarketplaceListingDetailResponse,
    MarketplaceListingResponse,
    MarketplaceListingVisibilityRequest,
)

router = APIRouter(prefix="/marketplace/listings", tags=["marketplace"])
FINANCIAL_FIELDS = frozenset({
    "monthly_revenue", "monthly_payroll", "startup_capex", "total_startup_cost",
    "monthly_fixed_costs", "monthly_variable_cost", "monthly_operating_profit",
    "annual_operating_profit", "break_even_revenue", "target_monthly_revenue",
    "loan_first_payment", "loan_total_payment", "loan_total_interest",
    "annual_debt_service", "dscr",
})


def _listing_response(listing: MarketplaceListing) -> MarketplaceListingResponse:
    return MarketplaceListingResponse(
        id=listing.id,
        plan_id=listing.saved_plan_id,
        business_name=listing.business_name,
        city=listing.city,
        stage=listing.stage,
        funding_target=format(listing.funding_target, "f"),
        currency="UZS",
        summary=listing.summary,
        is_published=listing.is_published,
        status=listing.status,
        public_financial_fields=listing.public_financial_fields or [],
        request_financial_fields=listing.request_financial_fields or [],
        created_at=listing.created_at,
    )


def _require_owner(user: User) -> None:
    if user.role != "tadbirkor":
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="marketplace.owner_required",
        )


def _owner_listing_query(owner_id: str):
    return (
        select(MarketplaceListing)
        .where(MarketplaceListing.owner_id == owner_id)
        .order_by(MarketplaceListing.created_at.desc())
    )


@router.get("", response_model=dict[str, list[MarketplaceListingResponse]])
def discover_listings(
    db: Annotated[Session, Depends(get_db)],
) -> dict[str, list[MarketplaceListingResponse]]:
    listings = db.scalars(
        select(MarketplaceListing)
        .where(MarketplaceListing.status == "published")
        .order_by(MarketplaceListing.created_at.desc())
    ).all()
    return {"items": [_listing_response(item) for item in listings]}


@router.get("/mine", response_model=dict[str, list[MarketplaceListingResponse]])
def my_listings(
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict[str, list[MarketplaceListingResponse]]:
    _require_owner(user)
    listings = db.scalars(_owner_listing_query(user.id)).all()
    return {"items": [_listing_response(item) for item in listings]}


@router.get("/{listing_id}", response_model=MarketplaceListingDetailResponse)
def public_listing_details(
    listing_id: str,
    db: Annotated[Session, Depends(get_db)],
) -> MarketplaceListingDetailResponse:
    listing = db.scalar(
        select(MarketplaceListing).where(
            MarketplaceListing.id == listing_id,
            MarketplaceListing.status == "published",
            MarketplaceListing.saved_plan_id.is_not(None),
        )
    )
    if listing is None or listing.saved_plan_id is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="marketplace.listing_not_found",
        )
    saved_plan = db.get(SavedBusinessPlan, listing.saved_plan_id)
    if saved_plan is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="marketplace.listing_not_found",
        )
    plan = PlanGenerateResponse.model_validate(saved_plan.generated_plan)
    return MarketplaceListingDetailResponse(
        **_listing_response(listing).model_dump(),
        plan={
            "summary": plan.summary,
            "sections": [section.model_dump() for section in plan.sections],
            "calculations": {
                key: value
                for key, value in plan.calculations.model_dump().items()
                if key in (listing.public_financial_fields or [])
            },
        },
    )


@router.post(
    "",
    response_model=MarketplaceListingResponse,
    status_code=status.HTTP_201_CREATED,
)
def publish_listing(
    data: MarketplaceListingCreateRequest,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> MarketplaceListingResponse:
    _require_owner(user)
    saved_plan = db.scalar(
        select(SavedBusinessPlan).where(
            SavedBusinessPlan.id == data.plan_id,
            SavedBusinessPlan.owner_id == user.id,
        )
    )
    if saved_plan is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="marketplace.plan_not_found",
        )
    reserve_lifetime_quota(db, user, "marketplace_listings")
    listing = MarketplaceListing(
        id=f"listing-{uuid4().hex}",
        owner_id=user.id,
        saved_plan_id=saved_plan.id,
        business_name=saved_plan.business_name,
        city=saved_plan.location,
        stage=data.stage,
        funding_target=data.funding_target,
        currency="UZS",
        summary=data.summary,
        is_published=data.status == "published",
        status=data.status,
        public_financial_fields=data.public_financial_fields,
        request_financial_fields=data.request_financial_fields,
    )
    db.add(listing)
    db.commit()
    db.refresh(listing)
    return _listing_response(listing)


@router.patch(
    "/{listing_id}/visibility",
    response_model=MarketplaceListingResponse,
)
def update_listing_visibility(
    listing_id: str,
    data: MarketplaceListingVisibilityRequest,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> MarketplaceListingResponse:
    _require_owner(user)
    listing = db.scalar(
        _owner_listing_query(user.id).where(MarketplaceListing.id == listing_id)
    )
    if listing is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="marketplace.listing_not_found",
        )

    public_fields = data.public_financial_fields if data.public_financial_fields is not None else listing.public_financial_fields
    request_fields = data.request_financial_fields if data.request_financial_fields is not None else listing.request_financial_fields
    if (set(public_fields) | set(request_fields)) - FINANCIAL_FIELDS or set(public_fields) & set(request_fields):
        raise HTTPException(status_code=422, detail="marketplace.invalid_financial_visibility")
    next_status = data.status or ("published" if data.is_published else "draft")
    listing.status = next_status
    listing.is_published = next_status == "published"
    listing.public_financial_fields = public_fields
    listing.request_financial_fields = request_fields
    db.commit()
    db.refresh(listing)
    return _listing_response(listing)
