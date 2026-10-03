from io import BytesIO
from pathlib import Path
from zipfile import BadZipFile

from docx import Document
from docx.opc.exceptions import PackageNotFoundError
from pypdf import PdfReader
from pypdf.errors import PdfReadError

from finadvisor_api.readiness import ReadinessResult, calculate_bank_readiness

MAX_DOCUMENT_BYTES = 15 * 1024 * 1024


class DocumentExtractionError(ValueError):
    pass


def extract_document_text(filename: str, content: bytes) -> str:
    suffix = Path(filename).suffix.casefold()
    if suffix not in {".pdf", ".docx"}:
        raise DocumentExtractionError("analysis.unsupported_file_type")
    if len(content) > MAX_DOCUMENT_BYTES:
        raise DocumentExtractionError("analysis.file_too_large")
    if not content:
        raise DocumentExtractionError("analysis.empty_file")

    try:
        if suffix == ".pdf":
            reader = PdfReader(BytesIO(content), strict=True)
            extracted_text = "\n".join(page.extract_text() or "" for page in reader.pages)
        else:
            document = Document(BytesIO(content))
            extracted_text = "\n".join(paragraph.text for paragraph in document.paragraphs)
    except (PdfReadError, PackageNotFoundError, BadZipFile) as error:
        raise DocumentExtractionError("analysis.invalid_document") from error

    if not extracted_text.strip():
        raise DocumentExtractionError("analysis.no_text_found")
    return extracted_text


def analyze_business_plan(filename: str, content: bytes) -> tuple[ReadinessResult, int]:
    text = extract_document_text(filename, content)
    return calculate_bank_readiness(text), len(text.split())
