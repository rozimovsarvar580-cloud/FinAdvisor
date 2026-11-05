from typing import Annotated
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from finadvisor_api.auth import get_current_user
from finadvisor_api.database import get_db
from finadvisor_api.models import LedgerEntry, User
from finadvisor_api.schemas import LedgerEntryCreateRequest, LedgerEntryResponse

router = APIRouter(prefix="/accounting", tags=["accounting"])
ACCOUNTING_ROLES = {"tadbirkor", "buxgalter"}


def _require_accounting_role(user: User) -> None:
    if user.role not in ACCOUNTING_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="accounting.role_required",
        )


def _entry_response(entry: LedgerEntry) -> LedgerEntryResponse:
    return LedgerEntryResponse(
        id=entry.id,
        entry_date=entry.entry_date,
        category=entry.category,
        amount=format(entry.amount, "f"),
        currency="UZS",
        description=entry.description,
    )


@router.get("/entries", response_model=dict[str, list[LedgerEntryResponse]])
def list_entries(
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict[str, list[LedgerEntryResponse]]:
    _require_accounting_role(user)
    entries = db.scalars(
        select(LedgerEntry)
        .where(LedgerEntry.owner_id == user.id)
        .order_by(LedgerEntry.entry_date.desc(), LedgerEntry.created_at.desc())
    ).all()
    return {"items": [_entry_response(entry) for entry in entries]}


@router.post(
    "/entries",
    response_model=LedgerEntryResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_entry(
    payload: LedgerEntryCreateRequest,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> LedgerEntryResponse:
    _require_accounting_role(user)
    entry = LedgerEntry(
        id=f"ledger-{uuid4().hex}",
        owner_id=user.id,
        entry_date=payload.entry_date,
        category=payload.category,
        amount=payload.amount,
        currency="UZS",
        description=payload.description,
    )
    db.add(entry)
    db.commit()
    db.refresh(entry)
    return _entry_response(entry)
