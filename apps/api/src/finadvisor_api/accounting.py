from typing import Annotated, Any
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from finadvisor_api.auth import get_current_user
from finadvisor_api.database import get_db
from finadvisor_api.models import AccountingRecord, LedgerEntry, User
from finadvisor_api.schemas import LedgerEntryCreateRequest, LedgerEntryResponse

router = APIRouter(prefix="/accounting", tags=["accounting"])
ACCOUNTING_ROLES = {"tadbirkor", "buxgalter"}
RESOURCES = {"inventory", "stock-movements", "sales", "expenses", "employees"}


class AccountingSyncRequest(BaseModel):
    client_id: str = Field(min_length=1, max_length=128)
    data: dict[str, Any]


def _require_role(user: User, roles: set[str]) -> None:
    if user.role not in roles:
        raise HTTPException(status_code=403, detail="accounting.role_required")


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


@router.get("/{resource}")
def list_resource(
    resource: str,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict[str, list[dict[str, Any]]]:
    _require_role(user, ACCOUNTING_ROLES)
    if resource not in RESOURCES:
        raise HTTPException(status_code=404, detail="accounting.resource_not_found")
    records = db.scalars(select(AccountingRecord).where(
        AccountingRecord.owner_id == user.id, AccountingRecord.resource == resource
    ).order_by(AccountingRecord.created_at)).all()
    return {"items": [{"id": r.id, "client_id": r.client_id, "data": r.data} for r in records]}


@router.post("/sync/{resource}", status_code=status.HTTP_200_OK)
def sync_resource(
    resource: str,
    payload: AccountingSyncRequest,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict[str, Any]:
    _require_role(user, {"buxgalter"})
    if resource not in RESOURCES:
        raise HTTPException(status_code=404, detail="accounting.resource_not_found")
    record = db.scalar(select(AccountingRecord).where(
        AccountingRecord.owner_id == user.id,
        AccountingRecord.resource == resource,
        AccountingRecord.client_id == payload.client_id,
    ))
    if record is not None:
        if record.data != payload.data:
            raise HTTPException(status_code=409, detail="accounting.client_id_conflict")
        return {"id": record.id, "client_id": record.client_id, "data": record.data}
    record = AccountingRecord(id=f"accounting-{uuid4().hex}", owner_id=user.id,
        resource=resource, client_id=payload.client_id, data=payload.data)
    db.add(record)
    db.commit()
    db.refresh(record)
    return {"id": record.id, "client_id": record.client_id, "data": record.data}


