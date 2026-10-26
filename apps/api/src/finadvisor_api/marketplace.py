from time import monotonic
from typing import Annotated
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from finadvisor_api.auth import _get_current_user, bearer_scheme, get_current_user
from finadvisor_api.database import get_db
from finadvisor_api.email_sender import EmailDeliveryError, send_marketplace_email
from finadvisor_api.models import (
    InvestorVerification,
    MarketplaceContactRequest,
    MarketplaceListing,
    MarketplaceMessage,
    SavedBusinessPlan,
    User,
)
from finadvisor_api.plan_limits import reserve_lifetime_quota
from finadvisor_api.plan_schemas import PlanGenerateResponse
from finadvisor_api.schemas import (
    MarketplaceListingCreateRequest,
    MarketplaceListingDetailResponse,
    MarketplaceListingResponse,
    MarketplaceListingVisibilityRequest,
)

router = APIRouter(prefix="/marketplace/listings", tags=["marketplace"])
_contact_hits: dict[str, list[float]] = {}


class ContactRequestInput(BaseModel):
    message: str = Field(min_length=1, max_length=2000)


class ContactDecisionInput(BaseModel):
    status: str = Field(pattern="^(accepted|declined)$")


class MarketplaceMessageInput(BaseModel):
    content: str = Field(min_length=1, max_length=4000)


def _check_contact_rate(user_id: str) -> None:
    now = monotonic()
    hits = [hit for hit in _contact_hits.get(user_id, []) if now - hit < 3600]
    if len(hits) >= 10:
        raise HTTPException(status_code=429, detail="marketplace.rate_limited")
    hits.append(now)
    _contact_hits[user_id] = hits


def _notify(recipient: User, subject: str, body: str) -> None:
    messages = {
        "uz": ("Marketplace xabari", "Sizda yangi investor bilan bog‘liq yangilanish bor."),
        "ru": ("Сообщение маркетплейса", "У вас есть новое обновление от инвестора."),
        "en": ("Marketplace update", "You have a new investor related update."),
    }
    fallback_subject, fallback_body = messages.get(recipient.locale, messages["uz"])
    try:
        send_marketplace_email(recipient.email, recipient.locale, subject or fallback_subject, body or fallback_body)
    except EmailDeliveryError:
        # Email delivery must not undo a committed contact or message.
        return
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
    credentials=Depends(bearer_scheme),
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
    investor = _get_current_user(credentials, db) if credentials else None
    verification = db.scalar(
        select(InvestorVerification).where(
            InvestorVerification.user_id == investor.id,
            InvestorVerification.status == "approved",
        )
    ) if investor and investor.role == "investor" else None
    return MarketplaceListingDetailResponse(
        **_listing_response(listing).model_dump(),
        plan={
            "summary": plan.summary,
            "sections": [section.model_dump() for section in plan.sections],
            "calculations": {
                key: value
                for key, value in plan.calculations.model_dump().items()
                if verification and key in (listing.public_financial_fields or [])
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


@router.post("/{listing_id}/contacts", status_code=status.HTTP_201_CREATED)
def request_listing_contact(
    listing_id: str, data: ContactRequestInput,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict[str, object]:
    _check_contact_rate(user.id)
    if user.role != "investor":
        raise HTTPException(status_code=403, detail="marketplace.investor_required")
    listing = db.scalar(select(MarketplaceListing).where(MarketplaceListing.id == listing_id, MarketplaceListing.status == "published"))
    if listing is None:
        raise HTTPException(status_code=404, detail="marketplace.listing_not_found")
    if listing.owner_id == user.id:
        raise HTTPException(status_code=400, detail="marketplace.self_contact")
    existing = db.scalar(select(MarketplaceContactRequest).where(MarketplaceContactRequest.listing_id == listing_id, MarketplaceContactRequest.investor_id == user.id))
    if existing:
        raise HTTPException(status_code=409, detail="marketplace.contact_exists")
    contact = MarketplaceContactRequest(id=str(uuid4()), listing_id=listing_id, investor_id=user.id, message=data.message.strip())
    db.add(contact)
    db.commit()
    db.refresh(contact)
    owner = db.get(User, listing.owner_id)
    if owner:
        _notify(owner, "", "")
    return {"id": contact.id, "status": contact.status, "listing_id": contact.listing_id, "message": contact.message, "created_at": contact.created_at}


@router.patch("/contacts/{contact_id}")
def decide_listing_contact(
    contact_id: str, data: ContactDecisionInput,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict[str, str]:
    _check_contact_rate(user.id)
    contact = db.get(MarketplaceContactRequest, contact_id)
    listing = db.get(MarketplaceListing, contact.listing_id) if contact else None
    if not listing or listing.owner_id != user.id:
        raise HTTPException(status_code=404, detail="marketplace.contact_not_found")
    if contact.status != "pending":
        raise HTTPException(status_code=409, detail="marketplace.contact_resolved")
    contact.status = data.status
    db.commit()
    investor = db.get(User, contact.investor_id)
    if investor:
        _notify(investor, "", "")
    return {"id": contact.id, "status": contact.status}


@router.get("/{listing_id}/contacts")
def list_listing_contacts(
    listing_id: str, user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict[str, list[dict[str, object]]]:
    listing = db.get(MarketplaceListing, listing_id)
    if not listing or listing.owner_id != user.id:
        raise HTTPException(status_code=404, detail="marketplace.listing_not_found")
    rows = db.scalars(select(MarketplaceContactRequest).where(MarketplaceContactRequest.listing_id == listing_id).order_by(MarketplaceContactRequest.created_at)).all()
    return {"items": [{"id": row.id, "investor_id": row.investor_id, "status": row.status, "message": row.message, "created_at": row.created_at} for row in rows]}


@router.get("/contacts/{contact_id}/messages")
def get_contact_messages(
    contact_id: str, user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict[str, list[dict[str, object]]]:
    contact = db.get(MarketplaceContactRequest, contact_id)
    listing = db.get(MarketplaceListing, contact.listing_id) if contact else None
    if not contact or not listing or user.id not in {contact.investor_id, listing.owner_id}:
        raise HTTPException(status_code=404, detail="marketplace.contact_not_found")
    rows = db.scalars(select(MarketplaceMessage).where(MarketplaceMessage.request_id == contact_id).order_by(MarketplaceMessage.created_at)).all()
    return {"items": [{"id": row.id, "sender_id": row.sender_id, "content": row.content, "created_at": row.created_at} for row in rows]}


@router.post("/contacts/{contact_id}/messages", status_code=status.HTTP_201_CREATED)
def send_contact_message(
    contact_id: str, data: MarketplaceMessageInput,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict[str, object]:
    _check_contact_rate(user.id)
    contact = db.get(MarketplaceContactRequest, contact_id)
    listing = db.get(MarketplaceListing, contact.listing_id) if contact else None
    if not contact or not listing or user.id not in {contact.investor_id, listing.owner_id}:
        raise HTTPException(status_code=404, detail="marketplace.contact_not_found")
    if contact.status != "accepted":
        raise HTTPException(status_code=409, detail="marketplace.contact_not_accepted")
    message = MarketplaceMessage(id=str(uuid4()), request_id=contact_id, sender_id=user.id, content=data.content.strip())
    db.add(message)
    db.commit()
    db.refresh(message)
    recipient = db.get(User, listing.owner_id if user.id == contact.investor_id else contact.investor_id)
    if recipient:
        _notify(recipient, "", "")
    return {"id": message.id, "sender_id": message.sender_id, "content": message.content, "created_at": message.created_at}
