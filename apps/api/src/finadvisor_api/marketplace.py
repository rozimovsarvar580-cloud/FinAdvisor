from typing import Annotated
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from finadvisor_api.auth import get_current_user
from finadvisor_api.database import get_db
from finadvisor_api.models import MarketplaceListing, SavedBusinessPlan, User
from finadvisor_api.plan_schemas import PlanGenerateResponse
from finadvisor_api.schemas import (
    MarketplaceListingCreateRequest,
    MarketplaceListingDetailResponse,
    MarketplaceListingResponse,
    MarketplaceListingVisibilityRequest,
)

router = APIRouter(prefix="/marketplace/listings", tags=["marketplace"])


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
        .where(MarketplaceListing.is_published.is_(True))
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
            MarketplaceListing.is_published.is_(True),
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
    return MarketplaceListingDetailResponse(
        **_listing_response(listing).model_dump(),
        plan=PlanGenerateResponse.model_validate(saved_plan.generated_plan),
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
        is_published=True,
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

    listing.is_published = data.is_published
    db.commit()
    db.refresh(listing)
    return _listing_response(listing)
