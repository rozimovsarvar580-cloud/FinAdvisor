import json
from decimal import Decimal
from importlib.resources import files
from typing import Literal

from fastapi import APIRouter
from finance_engine import calculate_progressive_commission
from pydantic import BaseModel, ConfigDict, Field

router = APIRouter(prefix="/pricing", tags=["pricing"])

PRICING_CATALOG = json.loads(
    files("finadvisor_api").joinpath("pricing_catalog.json").read_text(encoding="utf-8")
)


@router.get("/plans")
def get_pricing_plans() -> dict[str, object]:
    return PRICING_CATALOG


class CommissionRequest(BaseModel):
    model_config = ConfigDict(strict=True)

    annual_revenue: str = Field(pattern=r"^\d+(?:\.\d{1,2})?$")


class CommissionBandResponse(BaseModel):
    tier: Literal["first_100m", "next_900m", "above_1b"]
    revenue_portion: str
    rate_percent: str
    commission: str


class CommissionResponse(BaseModel):
    annual_revenue: str
    total_commission: str
    bands: list[CommissionBandResponse]


@router.post("/commission", response_model=CommissionResponse)
def calculate_commission(payload: CommissionRequest) -> CommissionResponse:
    result = calculate_progressive_commission(Decimal(payload.annual_revenue))
    return CommissionResponse(
        annual_revenue=format(result.annual_revenue, "f"),
        total_commission=format(result.total_commission, "f"),
        bands=[
            CommissionBandResponse(
                tier=band.tier,
                revenue_portion=format(band.revenue_portion, "f"),
                rate_percent=format(band.rate * Decimal(100), "f"),
                commission=format(band.commission, "f"),
            )
            for band in result.bands
        ],
    )
