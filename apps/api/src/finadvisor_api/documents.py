import json
from decimal import Decimal, InvalidOperation
from importlib.resources import files
from io import BytesIO
from typing import Literal
from xml.sax.saxutils import escape

from fastapi import APIRouter, Path
from fastapi.responses import Response
from openpyxl import Workbook
from openpyxl.styles import Font, PatternFill
from pydantic import model_validator
from reportlab.lib import colors
from reportlab.lib.enums import TA_CENTER
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.pdfbase import pdfmetrics
from reportlab.pdfbase.ttfonts import TTFont
from reportlab.platypus import Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle

from finadvisor_api.calc_schemas import StrictInput
from finadvisor_api.plan_schemas import PlanGenerateResponse

router = APIRouter(prefix="/documents", tags=["documents"])

DOCUMENT_MESSAGES = json.loads(
    files("finadvisor_api").joinpath("document_messages.json").read_text(encoding="utf-8")
)
FINANCIAL_KEYS = (
    "monthly_revenue",
    "monthly_payroll",
    "startup_capex",
    "total_startup_cost",
    "monthly_fixed_costs",
    "monthly_variable_cost",
    "monthly_operating_profit",
    "annual_operating_profit",
    "break_even_revenue",
    "target_monthly_revenue",
    "loan_first_payment",
    "loan_total_payment",
    "loan_total_interest",
    "loan_term_months",
    "annual_debt_service",
    "dscr",
)
CURRENCY_KEYS = frozenset(
    {
        "monthly_revenue",
        "monthly_payroll",
        "startup_capex",
        "total_startup_cost",
        "monthly_fixed_costs",
        "monthly_variable_cost",
        "monthly_operating_profit",
        "annual_operating_profit",
        "break_even_revenue",
        "target_monthly_revenue",
        "loan_first_payment",
        "loan_total_payment",
        "loan_total_interest",
        "annual_debt_service",
    }
)


class PlanDocumentRequest(StrictInput):
    locale: Literal["uz", "ru", "en"]
    plan: PlanGenerateResponse

    @model_validator(mode="after")
    def validate_financial_values(self) -> "PlanDocumentRequest":
        for key in FINANCIAL_KEYS:
            value = getattr(self.plan.calculations, key)
            if value is None:
                continue
            try:
                amount = Decimal(str(value))
            except InvalidOperation as error:
                raise ValueError(f"{key} must be a decimal value") from error
            if not amount.is_finite():
                raise ValueError(f"{key} must be finite")
        return self


def _messages(locale: str) -> dict[str, object]:
    return DOCUMENT_MESSAGES[locale]


def _excel_text(value: str) -> str:
    if value.startswith(("=", "+", "-", "@")):
        return f"'{value}"
    return value


def render_plan_pdf(request: PlanDocumentRequest) -> bytes:
    labels = _messages(request.locale)
    font_path = files("reportlab").joinpath("fonts/Vera.ttf")
    bold_font_path = files("reportlab").joinpath("fonts/VeraBd.ttf")
    pdfmetrics.registerFont(TTFont("FinAdvisor", str(font_path)))
    pdfmetrics.registerFont(TTFont("FinAdvisor-Bold", str(bold_font_path)))

    styles = getSampleStyleSheet()
    styles.add(
        ParagraphStyle(
            "FinAdvisorTitle",
            parent=styles["Title"],
            fontName="FinAdvisor-Bold",
            alignment=TA_CENTER,
            textColor=colors.HexColor("#183B56"),
            spaceAfter=10,
        )
    )
    styles.add(
        ParagraphStyle(
            "FinAdvisorBody",
            parent=styles["BodyText"],
            fontName="FinAdvisor",
            leading=15,
            spaceAfter=8,
        )
    )
    styles.add(
        ParagraphStyle(
            "FinAdvisorHeading",
            parent=styles["Heading2"],
            fontName="FinAdvisor-Bold",
            textColor=colors.HexColor("#183B56"),
            spaceBefore=10,
            spaceAfter=7,
        )
    )

    output = BytesIO()
    document = SimpleDocTemplate(
        output,
        pagesize=A4,
        rightMargin=18 * mm,
        leftMargin=18 * mm,
        topMargin=18 * mm,
        bottomMargin=18 * mm,
        title=str(labels["title"]),
    )
    story = [
        Paragraph(escape(str(labels["title"])), styles["FinAdvisorTitle"]),
        Paragraph(escape(str(labels["summary"])), styles["FinAdvisorHeading"]),
        Paragraph(escape(request.plan.summary).replace("\n", "<br/>"), styles["FinAdvisorBody"]),
        Paragraph(escape(str(labels["financials"])), styles["FinAdvisorHeading"]),
    ]
    metrics = labels["metrics"]
    financial_rows = [
        [
            str(metrics[key]),
            (
                f"{getattr(request.plan.calculations, key)} {labels['currency']}"
                if key in CURRENCY_KEYS
                else str(getattr(request.plan.calculations, key))
            ),
        ]
        for key in FINANCIAL_KEYS
        if getattr(request.plan.calculations, key) is not None
    ]
    financial_table = Table(financial_rows, colWidths=[105 * mm, 55 * mm], repeatRows=0)
    financial_table.setStyle(
        TableStyle(
            [
                ("FONTNAME", (0, 0), (-1, -1), "FinAdvisor"),
                ("BACKGROUND", (0, 0), (-1, -1), colors.HexColor("#F3F6F8")),
                ("TEXTCOLOR", (0, 0), (-1, -1), colors.HexColor("#183B56")),
                ("GRID", (0, 0), (-1, -1), 0.35, colors.HexColor("#D8E0E5")),
                ("VALIGN", (0, 0), (-1, -1), "TOP"),
                ("LEFTPADDING", (0, 0), (-1, -1), 7),
                ("RIGHTPADDING", (0, 0), (-1, -1), 7),
                ("TOPPADDING", (0, 0), (-1, -1), 6),
                ("BOTTOMPADDING", (0, 0), (-1, -1), 6),
            ]
        )
    )
    story.extend(
        [financial_table, Paragraph(escape(str(labels["plan"])), styles["FinAdvisorHeading"])]
    )
    for section in request.plan.sections:
        story.append(Paragraph(escape(section.title), styles["FinAdvisorHeading"]))
        story.append(
            Paragraph(
                escape(section.content).replace("\n", "<br/>"),
                styles["FinAdvisorBody"],
            )
        )
    story.extend(
        [
            Spacer(1, 8),
            Paragraph(escape(str(labels["disclaimer"])), styles["FinAdvisorBody"]),
        ]
    )
    document.build(story)
    return output.getvalue()


def render_plan_excel(request: PlanDocumentRequest) -> bytes:
    labels = _messages(request.locale)
    workbook = Workbook()
    summary = workbook.active
    sheet_names = labels["sheets"]
    summary.title = sheet_names["summary"]
    financials = workbook.create_sheet(sheet_names["financials"])
    financial_sheet_name = str(sheet_names["financials"]).replace("'", "''")
    plan_sheet = workbook.create_sheet(sheet_names["plan"])
    header_fill = PatternFill("solid", fgColor="183B56")
    header_font = Font(color="FFFFFF", bold=True)

    financials.append([str(labels["financials"]), labels["value"], labels["unit"]])
    financial_rows: dict[str, int] = {}
    for key in FINANCIAL_KEYS:
        value = getattr(request.plan.calculations, key)
        if value is not None:
            financials.append(
                [
                    labels["metrics"][key],
                    Decimal(str(value)),
                    str(labels["currency"]) if key in CURRENCY_KEYS else "",
                ]
            )
            financial_rows[key] = financials.max_row
    financials.freeze_panes = "A2"
    financials.column_dimensions["A"].width = 40
    financials.column_dimensions["B"].width = 24
    financials.column_dimensions["C"].width = 14

    summary.append([str(labels["title"]), labels["value"]])
    summary_keys = (
        "monthly_revenue",
        "monthly_operating_profit",
        "annual_operating_profit",
        "total_startup_cost",
        "break_even_revenue",
        "dscr",
    )
    for key in summary_keys:
        if key in financial_rows:
            summary.append(
                [
                    labels["metrics"][key],
                    f"='{financial_sheet_name}'!B{financial_rows[key]}",
                ]
            )
    summary.freeze_panes = "A2"
    summary.column_dimensions["A"].width = 40
    summary.column_dimensions["B"].width = 24

    plan_sheet.append([str(labels["plan"]), ""])
    plan_sheet.append([str(labels["summary"]), _excel_text(request.plan.summary)])
    plan_sheet.append(["", ""])
    for section in request.plan.sections:
        plan_sheet.append([_excel_text(section.title), _excel_text(section.content)])
    plan_sheet.column_dimensions["A"].width = 30
    plan_sheet.column_dimensions["B"].width = 100
    for sheet in (summary, financials, plan_sheet):
        for cell in sheet[1]:
            cell.fill = header_fill
            cell.font = header_font

    output = BytesIO()
    workbook.save(output)
    return output.getvalue()


@router.post("/{plan_id}/pdf")
def export_plan_pdf(
    request: PlanDocumentRequest,
    plan_id: str = Path(pattern=r"^[A-Za-z0-9_-]{1,80}$"),
) -> Response:
    content = render_plan_pdf(request)
    return Response(
        content=content,
        media_type="application/pdf",
        headers={"Content-Disposition": f'attachment; filename="finadvisor-plan-{plan_id}.pdf"'},
    )


@router.post("/{plan_id}/excel")
def export_plan_excel(
    request: PlanDocumentRequest,
    plan_id: str = Path(pattern=r"^[A-Za-z0-9_-]{1,80}$"),
) -> Response:
    content = render_plan_excel(request)
    return Response(
        content=content,
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="finadvisor-plan-{plan_id}.xlsx"'},
    )
