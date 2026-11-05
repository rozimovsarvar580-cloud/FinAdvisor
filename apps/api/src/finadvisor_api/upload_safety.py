from __future__ import annotations

import csv
from collections.abc import Callable
from io import BytesIO, StringIO
from uuid import uuid4
from zipfile import BadZipFile, ZipFile

from openpyxl import load_workbook
from openpyxl.utils.exceptions import InvalidFileException

MAX_UPLOAD_BYTES = 15 * 1024 * 1024
MAX_UPLOAD_ARCHIVE_ENTRIES = 2_000
MAX_UPLOAD_UNCOMPRESSED_BYTES = 100 * 1024 * 1024
MAX_UPLOAD_ROWS = 10_000
MAX_UPLOAD_COLUMNS = 100
MAX_UPLOAD_CELLS = 100_000
AntivirusScanner = Callable[[bytes], bool]


class UploadSafetyError(ValueError):
    def __init__(self, code: str) -> None:
        super().__init__(code)
        self.code = code


def _extension(filename: str) -> str:
    basename = filename.replace("\\", "/").rsplit("/", 1)[-1]
    return f".{basename.rsplit('.', 1)[-1].lower()}" if "." in basename else ""


def safe_storage_name(filename: str) -> str:
    extension = _extension(filename)
    if extension not in {".csv", ".xlsx", ".pdf", ".docx", ".txt"}:
        raise UploadSafetyError("unsupported_file")
    return f"{uuid4().hex}{extension}"


def validate_upload(
    filename: str,
    content: bytes,
    *,
    max_bytes: int = MAX_UPLOAD_BYTES,
    scanner: AntivirusScanner | None = None,
) -> str:
    if len(content) > max_bytes:
        raise UploadSafetyError("file_too_large")
    if not content:
        raise UploadSafetyError("empty_file")

    extension = _extension(filename)
    if extension == ".csv":
        try:
            decoded = content.decode("utf-8-sig")
        except UnicodeDecodeError as error:
            raise UploadSafetyError("invalid_file") from error
        if "\x00" in decoded:
            raise UploadSafetyError("invalid_file")
    elif extension == ".xlsx":
        try:
            with ZipFile(BytesIO(content)) as archive:
                entries = archive.infolist()
                if (
                    len(entries) > MAX_UPLOAD_ARCHIVE_ENTRIES
                    or sum(entry.file_size for entry in entries) > MAX_UPLOAD_UNCOMPRESSED_BYTES
                ):
                    raise UploadSafetyError("file_too_large")
                if "xl/workbook.xml" not in archive.namelist():
                    raise UploadSafetyError("invalid_file")
        except BadZipFile as error:
            raise UploadSafetyError("invalid_file") from error
    else:
        raise UploadSafetyError("unsupported_file")

    if scanner is not None and not scanner(content):
        raise UploadSafetyError("malware_detected")
    return extension


def count_csv_data_rows(content: bytes) -> int:
    try:
        reader = csv.reader(StringIO(content.decode("utf-8-sig")))
        row_count = 0
        cell_count = 0
        for row in reader:
            row_count += 1
            cell_count += len(row)
            if (
                row_count > MAX_UPLOAD_ROWS + 1
                or len(row) > MAX_UPLOAD_COLUMNS
                or cell_count > MAX_UPLOAD_CELLS
            ):
                raise UploadSafetyError("file_too_large")
    except (csv.Error, UnicodeDecodeError) as error:
        raise UploadSafetyError("invalid_file") from error
    return max(0, row_count - 1)


def count_xlsx_data_rows(content: bytes) -> int:
    workbook = None
    try:
        workbook = load_workbook(BytesIO(content), read_only=True, data_only=True)
        worksheet = workbook.active
        if worksheet.max_column > MAX_UPLOAD_COLUMNS:
            raise UploadSafetyError("file_too_large")

        row_count = 0
        cell_count = 0
        for row_index, row in enumerate(
            worksheet.iter_rows(
                max_row=MAX_UPLOAD_ROWS + 2,
                max_col=MAX_UPLOAD_COLUMNS + 1,
                values_only=True,
            ),
            start=1,
        ):
            row_count = row_index
            if row_index > MAX_UPLOAD_ROWS + 1 or any(
                value is not None for value in row[MAX_UPLOAD_COLUMNS:]
            ):
                raise UploadSafetyError("file_too_large")
            cell_count += sum(value is not None for value in row)
            if cell_count > MAX_UPLOAD_CELLS:
                raise UploadSafetyError("file_too_large")
    except UploadSafetyError:
        raise
    except (BadZipFile, InvalidFileException, KeyError, OSError, ValueError) as error:
        raise UploadSafetyError("invalid_file") from error
    finally:
        if workbook is not None:
            workbook.close()
    return max(0, row_count - 1)
