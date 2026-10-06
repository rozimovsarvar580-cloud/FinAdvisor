from io import BytesIO

from fastapi import APIRouter
from fastapi.responses import Response
from openpyxl import Workbook

router = APIRouter(prefix="/plans", tags=["exports"])


@router.get("/{plan_id}/export.csv")
async def export_plan_csv(plan_id: str) -> Response:
    csv = (
        "metric,value,currency\n"
        f"plan_id,{plan_id},\n"
        "monthly_revenue,248000000,UZS\n"
        "monthly_profit,42700000,UZS\n"
        "status,draft,\n"
    )
    return Response(
        content=csv,
        media_type="text/csv",
        headers={"Content-Disposition": f'attachment; filename="{plan_id}.csv"'},
    )


@router.get("/{plan_id}/export.xlsx")
async def export_plan_xlsx(plan_id: str) -> Response:
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "Summary"
    sheet.append(["Metric", "Value", "Currency"])
    sheet.append(["plan_id", plan_id, ""])
    sheet.append(["monthly_revenue", "248000000", "UZS"])
    sheet.append(["monthly_profit", "42700000", "UZS"])
    sheet.append(["status", "draft", ""])
    sheet.freeze_panes = "A2"
    sheet.column_dimensions["A"].width = 24
    sheet.column_dimensions["B"].width = 20
    sheet.column_dimensions["C"].width = 12

    output = BytesIO()
    workbook.save(output)
    return Response(
        content=output.getvalue(),
        media_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        headers={"Content-Disposition": f'attachment; filename="{plan_id}.xlsx"'},
    )
@router.get("/{plan_id}/report")
async def plan_report(plan_id: str) -> dict[str, object]:
    return {
        "plan_id": plan_id,
        "format": "report-data",
        "currency": "UZS",
        "sections": [
            {"title": "Summary", "monthly_revenue": "248000000", "monthly_profit": "42700000"},
            {"title": "Scenarios", "base": "ok", "pessimistic": "watch", "optimistic": "strong"},
        ],
        "disclaimer": "This report is informational and is not financial or legal advice.",
    }
