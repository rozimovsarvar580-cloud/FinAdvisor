from datetime import UTC, date, datetime, timedelta
from decimal import Decimal, InvalidOperation
from io import BytesIO
from typing import Annotated, Any
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from fastapi.responses import Response
from finance_engine.money import accounting_totals, quantize_money, sum_decimal_amounts
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from finadvisor_api.auth import get_current_user
from finadvisor_api.database import get_db
from finadvisor_api.models import AccountingRecord, LedgerEntry, User
from finadvisor_api.schemas import LedgerEntryCreateRequest, LedgerEntryResponse

router = APIRouter(prefix="/accounting", tags=["accounting"])
reports_router = APIRouter(prefix="/reports", tags=["reports"])
ACCOUNTING_ROLES = {"tadbirkor", "buxgalter"}
RESOURCES = {"inventory", "stock-movements", "sales", "expenses", "employees"}
REPORT_PERIODS = {"day", "week", "month", "year"}


def _report_dates(period: str, today: date) -> tuple[date, date]:
    if period == "day":
        return today, today
    if period == "week":
        start = today - timedelta(days=today.weekday())
        return start, start + timedelta(days=6)
    if period == "month":
        start = today.replace(day=1)
        next_month = date(today.year + (today.month == 12), today.month % 12 + 1, 1)
        return start, next_month - timedelta(days=1)
    if period == "year":
        return date(today.year, 1, 1), date(today.year, 12, 31)
    raise HTTPException(status_code=404, detail="reports.period_not_found")


def _amount(data: dict[str, Any], *keys: str) -> Decimal:
    raw = next((data[key] for key in keys if key in data), "0")
    try:
        value = Decimal(str(raw))
    except (InvalidOperation, ValueError):
        return Decimal(0)
    return value if value.is_finite() else Decimal(0)


def _record_date(data: dict[str, Any]) -> date | None:
    raw = data.get("date") or data.get("entry_date") or data.get("occurred_at")
    try:
        return date.fromisoformat(str(raw)[:10]) if raw else None
    except ValueError:
        return None


def _build_report(db: Session, user: User, period: str, today: date) -> dict[str, Any]:
    start, end = _report_dates(period, today)
    records = db.scalars(select(AccountingRecord).where(
        AccountingRecord.owner_id == user.id,
        AccountingRecord.resource.in_(("sales", "expenses", "stock-movements", "inventory")),
    )).all()
    selected = [r for r in records if (d := _record_date(r.data)) is not None and start <= d <= end]
    sales = [r for r in selected if r.resource == "sales"]
    expenses = [r for r in selected if r.resource == "expenses"]
    movements = [r for r in selected if r.resource == "stock-movements"]
    inventory = [r for r in records if r.resource == "inventory"]
    totals = accounting_totals(
        (_amount(r.data, "amount", "total", "revenue") for r in sales),
        (_amount(r.data, "amount", "total", "expense") for r in expenses),
        (_amount(r.data, "tax_amount", "tax") for r in sales + expenses),
    )
    stock_in = sum_decimal_amounts(_amount(r.data, "quantity", "amount") for r in movements
                                   if str(r.data.get("direction", r.data.get("type", ""))).lower() in {"in", "stock_in", "purchase"})
    stock_sold = sum_decimal_amounts(_amount(r.data, "quantity", "amount") for r in movements
                                     if str(r.data.get("direction", r.data.get("type", ""))).lower() in {"sold", "sale", "out"})
    remaining = sum_decimal_amounts(_amount(r.data, "quantity", "remaining", "stock") for r in inventory)
    return {"period": period, "start_date": start.isoformat(), "end_date": end.isoformat(), "currency": "UZS",
            "revenue": format(totals["revenue"], "f"), "expenses": format(totals["expenses"], "f"),
            "profit": format(totals["profit"], "f"), "taxes": format(totals["taxes"], "f"),
            "stock": {"in": format(quantize_money(stock_in), "f"), "sold": format(quantize_money(stock_sold), "f"),
                      "remaining": format(quantize_money(remaining), "f")}}


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


@reports_router.get("/{period}")
def get_report(
    period: str,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict[str, Any]:
    _require_accounting_role(user)
    return _build_report(db, user, period, datetime.now(UTC).date())


@reports_router.get("/{period}/export.{format}")
def export_report(
    period: str,
    format: str,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> Response:
    _require_accounting_role(user)
    report = _build_report(db, user, period, datetime.now(UTC).date())
    if format == "xlsx":
        from openpyxl import Workbook

        workbook = Workbook()
        sheet = workbook.active
        sheet.title = "Report"
        sheet.append(["Metric", "Value", "Currency"])
        for key in ("revenue", "expenses", "profit", "taxes"):
            sheet.append([key, report[key], report["currency"]])
        for key, value in report["stock"].items():
            sheet.append([f"stock_{key}", value, "units"])
        output = BytesIO()
        workbook.save(output)
        return Response(output.getvalue(), media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
                        headers={"Content-Disposition": f'attachment; filename="report-{period}.xlsx"'})
    if format == "pdf":
        from reportlab.lib.pagesizes import letter
        from reportlab.pdfgen import canvas

        output = BytesIO()
        page = canvas.Canvas(output, pagesize=letter)
        page.drawString(72, 740, f"FinAdvisor {period} report ({report['start_date']} – {report['end_date']})")
        y = 710
        for key in ("revenue", "expenses", "profit", "taxes"):
            page.drawString(72, y, f"{key}: {report[key]} {report['currency']}")
            y -= 20
        for key, value in report["stock"].items():
            page.drawString(72, y, f"stock {key}: {value}")
            y -= 20
        page.save()
        return Response(output.getvalue(), media_type="application/pdf",
                        headers={"Content-Disposition": f'attachment; filename="report-{period}.pdf"'})
    raise HTTPException(status_code=404, detail="reports.format_not_found")


