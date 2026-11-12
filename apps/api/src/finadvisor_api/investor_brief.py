import re
from datetime import UTC, datetime
from html import escape
from io import BytesIO
from pathlib import Path
from typing import Annotated, Literal

from fastapi import APIRouter, Depends, status
from fastapi.responses import Response
from pydantic import BaseModel, ConfigDict, EmailStr, Field
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer
from sqlalchemy.orm import Session

from finadvisor_api.database import get_db
from finadvisor_api.models import InvestorBriefLead

router = APIRouter(prefix="/investor-brief", tags=["investor brief"])
CONSENT_VERSION = "investor-brief-v1"
_LINK_PATTERN = re.compile(r"\[([^\]]+)\]\([^)]+\)")
_BOLD_PATTERN = re.compile(r"\*\*(.*?)\*\*")
_CODE_PATTERN = re.compile(r"`([^`]*)`")
_NUMBERED_ITEM_PATTERN = re.compile(r"^\d+\.\s+")


class InvestorBriefRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    email: EmailStr = Field(max_length=320)
    consent: Literal[True]
    locale: Literal["uz", "ru", "en"]


def _read_investor_source() -> str:
    for parent in Path(__file__).resolve().parents:
        source = parent / "docs" / "INVESTOR.md"
        if source.is_file():
            return source.read_text(encoding="utf-8")
    raise FileNotFoundError("docs/INVESTOR.md is required to generate the investor brief")


def _plain_markdown(text: str) -> str:
    linked_text = _LINK_PATTERN.sub(r"\1", text)
    emphasized_text = _BOLD_PATTERN.sub(r"\1", linked_text)
    return _CODE_PATTERN.sub(r"\1", emphasized_text)


def render_investor_brief_pdf(source: str | None = None) -> bytes:
    font_path = Path(__file__).resolve().parent / "fonts" / "NotoSans.ttf"
    pdfmetrics.registerFont(TTFont("FinAdvisorInvestor", str(font_path)))
    pdfmetrics.registerFont(TTFont("FinAdvisorInvestor-Bold", str(font_path)))

    styles = getSampleStyleSheet()
    styles.add(
        ParagraphStyle(
            "InvestorTitle",
            parent=styles["Title"],
            fontName="FinAdvisorInvestor-Bold",
            alignment=TA_CENTER,
            textColor=colors.HexColor("#183B56"),
            leading=26,
            spaceAfter=14,
        )
    )
    styles.add(
        ParagraphStyle(
            "InvestorHeading",
            parent=styles["Heading2"],
            fontName="FinAdvisorInvestor-Bold",
            textColor=colors.HexColor("#183B56"),
            spaceBefore=12,
            spaceAfter=6,
        )
    )
    styles.add(
        ParagraphStyle(
            "InvestorSubheading",
            parent=styles["Heading3"],
            fontName="FinAdvisorInvestor-Bold",
            textColor=colors.HexColor("#183B56"),
            spaceBefore=8,
            spaceAfter=4,
        )
    )
    styles.add(
        ParagraphStyle(
            "InvestorBody",
            parent=styles["BodyText"],
            fontName="FinAdvisorInvestor",
            leading=15,
            spaceAfter=7,
        )
    )

    story = []
    paragraph_lines: list[str] = []

    def flush_paragraph() -> None:
        if paragraph_lines:
            content = escape(" ".join(paragraph_lines))
            story.append(Paragraph(content, styles["InvestorBody"]))
            paragraph_lines.clear()

    document_source = source if source is not None else _read_investor_source()
    for raw_line in document_source.splitlines():
        line = raw_line.strip()
        if not line:
            flush_paragraph()
            continue
        if line.startswith("# "):
            flush_paragraph()
            story.append(
                Paragraph(escape(_plain_markdown(line[2:])), styles["InvestorTitle"])
            )
        elif line.startswith("## "):
            flush_paragraph()
            story.append(
                Paragraph(escape(_plain_markdown(line[3:])), styles["InvestorHeading"])
            )
        elif line.startswith("### "):
            flush_paragraph()
            story.append(
                Paragraph(
                    escape(_plain_markdown(line[4:])),
                    styles["InvestorSubheading"],
                )
            )
        elif line.startswith("|"):
            flush_paragraph()
            if re.fullmatch(r"\|?[\s:|-]+\|?", line):
                continue
            cells = [_plain_markdown(cell.strip()) for cell in line.strip("|").split("|")]
            story.append(
                Paragraph(escape("    |    ".join(cells)), styles["InvestorBody"])
            )
        elif line.startswith("- "):
            flush_paragraph()
            story.append(
                Paragraph(
                    f"&#8226; {escape(_plain_markdown(line[2:]))}",
                    styles["InvestorBody"],
                )
            )
        elif _NUMBERED_ITEM_PATTERN.match(line):
            flush_paragraph()
            story.append(
                Paragraph(escape(_plain_markdown(line)), styles["InvestorBody"])
            )
        elif line in {"---", "***"}:
            flush_paragraph()
            story.append(Spacer(1, 3 * mm))
        else:
            paragraph_lines.append(_plain_markdown(line))

    flush_paragraph()
    output = BytesIO()
    document = SimpleDocTemplate(
        output,
        pagesize=A4,
        rightMargin=20 * mm,
        leftMargin=20 * mm,
        topMargin=18 * mm,
        bottomMargin=18 * mm,
        title="FinAdvisor Investor Brief",
        author="FinAdvisor",
    )
    document.build(story)
    return output.getvalue()


@router.post("/download", status_code=status.HTTP_200_OK)
def download_investor_brief(
    payload: InvestorBriefRequest,
    db: Annotated[Session, Depends(get_db)],
) -> Response:
    pdf = render_investor_brief_pdf()
    db.add(
        InvestorBriefLead(
            email=str(payload.email).lower(),
            consented=True,
            consent_version=CONSENT_VERSION,
            locale=payload.locale,
            created_at=datetime.now(UTC),
        )
    )
    db.commit()
    return Response(
        content=pdf,
        media_type="application/pdf",
        headers={
            "Content-Disposition": 'inline; filename="finadvisor-investor-brief.pdf"',
            "Cache-Control": "no-store",
        },
    )
