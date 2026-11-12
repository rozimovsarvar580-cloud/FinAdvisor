import json
from datetime import UTC, datetime
from importlib.resources import files
from io import BytesIO
from typing import Annotated, Literal
from xml.sax.saxutils import escape

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
from finadvisor_api.models import SamplePlanLead

router = APIRouter(prefix="/lead-magnet", tags=["lead magnet"])
CONSENT_VERSION = "sample-plan-v1"
LEAD_MAGNET_MESSAGES = json.loads(
    files("finadvisor_api").joinpath("lead_magnet_messages.json").read_text(encoding="utf-8")
)


class SamplePlanDownloadRequest(BaseModel):
    model_config = ConfigDict(extra="forbid", str_strip_whitespace=True)

    email: EmailStr = Field(max_length=320)
    consent: Literal[True]
    locale: Literal["uz", "ru", "en"]


def render_sample_plan_pdf(locale: Literal["uz", "ru", "en"]) -> bytes:
    labels = LEAD_MAGNET_MESSAGES[locale]
    font_path = files("finadvisor_api").joinpath("fonts", "NotoSans.ttf")
    pdfmetrics.registerFont(TTFont("FinAdvisorSample", str(font_path)))
    pdfmetrics.registerFont(TTFont("FinAdvisorSample-Bold", str(font_path)))

    styles = getSampleStyleSheet()
    styles.add(
        ParagraphStyle(
            "SamplePlanTitle",
            parent=styles["Title"],
            fontName="FinAdvisorSample-Bold",
            alignment=TA_CENTER,
            textColor=colors.HexColor("#183B56"),
            leading=24,
            spaceAfter=12,
        )
    )
    styles.add(
        ParagraphStyle(
            "SamplePlanHeading",
            parent=styles["Heading2"],
            fontName="FinAdvisorSample-Bold",
            textColor=colors.HexColor("#183B56"),
            spaceBefore=12,
            spaceAfter=6,
        )
    )
    styles.add(
        ParagraphStyle(
            "SamplePlanBody",
            parent=styles["BodyText"],
            fontName="FinAdvisorSample",
            leading=16,
            spaceAfter=8,
        )
    )

    output = BytesIO()
    document = SimpleDocTemplate(
        output,
        pagesize=A4,
        rightMargin=20 * mm,
        leftMargin=20 * mm,
        topMargin=20 * mm,
        bottomMargin=20 * mm,
        title=str(labels["title"]),
    )
    story = [
        Paragraph(escape(str(labels["title"])), styles["SamplePlanTitle"]),
        Paragraph(escape(str(labels["subtitle"])), styles["SamplePlanBody"]),
        Spacer(1, 5 * mm),
    ]
    for section in labels["sections"]:
        story.extend(
            [
                Paragraph(escape(str(section["title"])), styles["SamplePlanHeading"]),
                Paragraph(escape(str(section["prompt"])), styles["SamplePlanBody"]),
            ]
        )
    story.extend(
        [
            Spacer(1, 4 * mm),
            Paragraph(escape(str(labels["completion_note"])), styles["SamplePlanBody"]),
            Spacer(1, 3 * mm),
            Paragraph(escape(str(labels["disclaimer"])), styles["SamplePlanBody"]),
        ]
    )
    document.build(story)
    return output.getvalue()


@router.post("/sample-plan", status_code=status.HTTP_200_OK)
def download_sample_plan(
    payload: SamplePlanDownloadRequest,
    db: Annotated[Session, Depends(get_db)],
) -> Response:
    pdf = render_sample_plan_pdf(payload.locale)
    db.add(
        SamplePlanLead(
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
            "Content-Disposition": 'attachment; filename="finadvisor-sample-business-plan.pdf"',
            "Cache-Control": "no-store",
        },
    )
