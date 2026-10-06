from io import BytesIO

import pytest
from docx import Document

from finadvisor_api.document_analysis import (
    DocumentExtractionError,
    analyze_business_plan,
    extract_document_text,
)


def test_extracts_docx_text_and_scores_bank_readiness() -> None:
    document = Document()
    document.add_paragraph(
        "Restaurant business overview. Market and customers. "
        "Staff team. Financial revenue and profit. Loan funding."
    )
    content = BytesIO()
    document.save(content)

    result, word_count = analyze_business_plan("plan.docx", content.getvalue())

    assert result.score == 100
    assert word_count > 0


@pytest.mark.parametrize(
    ("filename", "content", "expected_error"),
    [
        ("plan.txt", b"text", "analysis.unsupported_file_type"),
        ("plan.pdf", b"", "analysis.empty_file"),
        ("plan.docx", b"invalid", "analysis.invalid_document"),
    ],
)
def test_document_extraction_rejects_invalid_uploads(
    filename: str, content: bytes, expected_error: str
) -> None:
    with pytest.raises(DocumentExtractionError, match=expected_error):
        extract_document_text(filename, content)


def test_analyze_endpoint_accepts_docx_upload() -> None:
    document = Document()
    document.add_paragraph(
        "Restaurant market customers team staff financial revenue profit loan funding"
    )
    content = BytesIO()
    document.save(content)

    from fastapi.testclient import TestClient

    from finadvisor_api.main import app

    response = TestClient(app).post(
        "/plans/analyze",
        files={
            "file": (
                "plan.docx",
                content.getvalue(),
                "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
            )
        },
    )

    assert response.status_code == 200
    assert response.json()["score"] == 100
