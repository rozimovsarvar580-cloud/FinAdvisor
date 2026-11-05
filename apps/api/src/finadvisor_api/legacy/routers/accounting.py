from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile, status

from ...upload_safety import (
    MAX_UPLOAD_BYTES,
    AntivirusScanner,
    UploadSafetyError,
    count_csv_data_rows,
    count_xlsx_data_rows,
    validate_upload,
)
from ..auth_dependencies import require_role

router = APIRouter(prefix="/accounting", tags=["accounting"])


def get_antivirus_scanner() -> AntivirusScanner | None:
    return None


@router.get("/daily")
async def daily_entries(_: str = Depends(require_role("accountant", "entrepreneur", "admin"))) -> dict[str, object]:
    return {
        "items": [
            {"id": "entry-001", "date": "2026-09-21", "category": "sales", "amount": "8200000", "currency": "UZS"},
            {"id": "entry-002", "date": "2026-09-21", "category": "supplies", "amount": "1650000", "currency": "UZS"},
        ]
    }


@router.get("/inventory")
async def inventory(_: str = Depends(require_role("accountant", "entrepreneur", "admin"))) -> dict[str, object]:
    return {
        "items": [
            {"sku": "rice-001", "name": "Rice", "quantity": "120.00", "unit": "kg", "reorder_level": "50.00"},
            {"sku": "oil-001", "name": "Cooking oil", "quantity": "24.00", "unit": "l", "reorder_level": "30.00"},
        ]
    }


@router.get("/payroll")
async def payroll(_: str = Depends(require_role("accountant", "entrepreneur", "admin"))) -> dict[str, object]:
    return {
        "period": "2026-09",
        "currency": "UZS",
        "employees": [
            {"id": "emp-001", "role": "Chef", "gross_salary": "8500000", "status": "pending"},
            {"id": "emp-002", "role": "Waiter", "gross_salary": "4200000", "status": "pending"},
        ],
    }


@router.get("/tax")
async def tax_summary(_: str = Depends(require_role("accountant", "entrepreneur", "admin"))) -> dict[str, object]:
    return {
        "period": "2026-09",
        "currency": "UZS",
        "regime": "turnover_tax",
        "estimated_due": "12400000",
        "source": "tax_rules_2026.yaml",
        "review_status": "pending_accountant_review",
    }


@router.get("/loans")
async def loans(_: str = Depends(require_role("accountant", "entrepreneur", "admin"))) -> dict[str, object]:
    return {
        "items": [
            {"id": "loan-001", "provider": "Demo Bank", "principal": "500000000", "currency": "UZS", "next_payment": "18500000"},
        ]
    }


@router.post("/import")
async def import_statement(
    file: UploadFile | None = File(default=None),
    _: str = Depends(require_role("accountant", "entrepreneur", "admin")),
    scanner: Annotated[AntivirusScanner | None, Depends(get_antivirus_scanner)] = None,
) -> dict[str, object]:
    if file is None:
        return {
            "status": "accepted",
            "import_id": "import-001",
            "rows_received": 0,
            "message": "Upload a CSV or XLSX statement to begin import.",
        }
    filename = file.filename or ""
    content = await file.read(MAX_UPLOAD_BYTES + 1)
    try:
        suffix = validate_upload(filename, content, scanner=scanner)
    except UploadSafetyError as error:
        code = error.code
        status_code = (
            status.HTTP_413_REQUEST_ENTITY_TOO_LARGE
            if code == "file_too_large"
            else status.HTTP_415_UNSUPPORTED_MEDIA_TYPE
            if code == "unsupported_file"
            else status.HTTP_422_UNPROCESSABLE_CONTENT
            if code == "malware_detected"
            else status.HTTP_400_BAD_REQUEST
        )
        raise HTTPException(
            status_code=status_code,
            detail={"code": code, "message": "Upload rejected", "details": {}},
        ) from error
    try:
        row_count = (
            count_csv_data_rows(content)
            if suffix == ".csv"
            else count_xlsx_data_rows(content)
        )
    except UploadSafetyError as error:
        raise HTTPException(
            status_code=(
                status.HTTP_413_REQUEST_ENTITY_TOO_LARGE
                if error.code == "file_too_large"
                else status.HTTP_400_BAD_REQUEST
            ),
            detail={"code": error.code, "message": "Upload rejected", "details": {}},
        ) from error
    return {
        "status": "accepted",
        "import_id": "import-001",
        "rows_received": row_count,
        "message": "Statement validated and queued for import.",
    }
