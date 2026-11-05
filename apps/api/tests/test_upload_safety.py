import asyncio
from io import BytesIO

import pytest
from fastapi import HTTPException, UploadFile
from openpyxl import Workbook

from finadvisor_api.legacy.routers.accounting import get_antivirus_scanner, import_statement
from finadvisor_api.upload_safety import (
    UploadSafetyError,
    count_csv_data_rows,
    count_xlsx_data_rows,
    safe_storage_name,
    validate_upload,
)


def _xlsx_bytes() -> bytes:
    workbook = Workbook()
    workbook.active.append(["date", "amount"])
    workbook.active.append(["2026-09-21", "100"])
    result = BytesIO()
    workbook.save(result)
    return result.getvalue()


def test_upload_validation_sniffs_csv_and_xlsx_content() -> None:
    assert validate_upload("statement.csv", b"date,amount\n2026-09-21,100") == ".csv"
    assert validate_upload("statement.xlsx", _xlsx_bytes()) == ".xlsx"

    with pytest.raises(UploadSafetyError, match="invalid_file"):
        validate_upload("statement.xlsx", b"not a workbook")
    with pytest.raises(UploadSafetyError, match="invalid_file"):
        validate_upload("statement.csv", b"date,\x00amount")


def test_upload_validation_enforces_size_and_optional_scanner() -> None:
    with pytest.raises(UploadSafetyError, match="file_too_large"):
        validate_upload("statement.csv", b"12345", max_bytes=4)
    with pytest.raises(UploadSafetyError, match="malware_detected"):
        validate_upload("statement.csv", b"date,amount\n", scanner=lambda _: False)


def test_import_row_counting_limits_csv_spreadsheet_size() -> None:
    assert count_csv_data_rows(b"date,amount\n2026-09-21,100") == 1
    assert count_xlsx_data_rows(_xlsx_bytes()) == 1

    many_columns = (",".join(f"column-{index}" for index in range(101))).encode()
    with pytest.raises(UploadSafetyError, match="file_too_large"):
        count_csv_data_rows(many_columns)


def test_storage_names_are_random_and_do_not_contain_client_paths() -> None:
    first = safe_storage_name(r"..\..\private\statement.csv")
    second = safe_storage_name(r"..\..\private\statement.csv")

    assert first.endswith(".csv")
    assert first != second
    assert "/" not in first
    assert "\\" not in first
    assert ".." not in first


def test_antivirus_scanning_is_optional_by_default() -> None:
    assert get_antivirus_scanner() is None


def test_accounting_import_rejects_malware_from_optional_scanner(
) -> None:
    upload = UploadFile(filename="statement.csv", file=BytesIO(b"date,amount\n"))

    with pytest.raises(HTTPException) as error:
        asyncio.run(import_statement(file=upload, _="test-owner", scanner=lambda _: False))

    assert error.value.status_code == 422
    assert error.value.detail["code"] == "malware_detected"


def test_accounting_import_counts_valid_xlsx_rows() -> None:
    upload = UploadFile(filename="statement.xlsx", file=BytesIO(_xlsx_bytes()))

    result = asyncio.run(import_statement(file=upload, _="test-owner"))

    assert result["rows_received"] == 1
    assert "filename" not in result
