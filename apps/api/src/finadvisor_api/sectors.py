import json
from functools import lru_cache

from fastapi import APIRouter, HTTPException, status
from finance_engine.sectors import SectorDefinition, load_sectors
from pydantic import BaseModel, ConfigDict

router = APIRouter(prefix="/sectors", tags=["sectors"])


class SectorResponse(BaseModel):
    model_config = ConfigDict(extra="forbid")

    id: str
    names: dict[str, str]
    revenue_model_type: str
    cost_categories: list[str]
    staff_roles: list[str]
    inventory_cogs_behavior: dict[str, object]
    kpis: list[str]
    questions: dict[str, list[str]]
    licenses_regulations: list[dict[str, object]]


@lru_cache(maxsize=1)
def _sector_definitions() -> tuple[SectorDefinition, ...]:
    return load_sectors()


def find_sector(sector_id: str) -> SectorDefinition | None:
    return next(
        (sector for sector in _sector_definitions() if sector.id == sector_id),
        None,
    )


def validate_sector_inputs(sector: SectorDefinition, inputs: dict[str, object]) -> None:
    try:
        encoded_inputs = json.dumps(inputs, ensure_ascii=False, allow_nan=False)
    except (TypeError, ValueError) as error:
        raise ValueError("inputs must contain JSON-compatible values") from error
    if len(encoded_inputs) > 65_536:
        raise ValueError("inputs must not exceed 65536 encoded characters")

    revenue_model = inputs.get("revenue_model_type")
    if revenue_model is not None and revenue_model != sector.revenue_model_type:
        raise ValueError("inputs.revenue_model_type does not match the selected sector")

    for field, allowed_values in (
        ("cost_categories", sector.cost_categories),
        ("staff_roles", sector.staff_roles),
    ):
        values = inputs.get(field)
        if values is None:
            continue
        if not isinstance(values, list) or not all(isinstance(value, str) for value in values):
            raise ValueError(f"inputs.{field} must be a list of strings")
        unsupported = set(values) - set(allowed_values)
        if unsupported:
            raise ValueError(f"inputs.{field} contains values unsupported by {sector.id}")


def _sector_response(sector: SectorDefinition) -> SectorResponse:
    return SectorResponse(
        id=sector.id,
        names=dict(sector.names),
        revenue_model_type=sector.revenue_model_type,
        cost_categories=list(sector.cost_categories),
        staff_roles=list(sector.staff_roles),
        inventory_cogs_behavior=dict(sector.inventory_cogs_behavior),
        kpis=list(sector.kpis),
        questions={locale: list(items) for locale, items in sector.questions.items()},
        licenses_regulations=[dict(item) for item in sector.licenses_regulations],
    )


@router.get("", response_model=list[SectorResponse])
def list_sectors() -> list[SectorResponse]:
    return [_sector_response(sector) for sector in _sector_definitions()]


@router.get("/{sector_id}", response_model=SectorResponse)
def read_sector(sector_id: str) -> SectorResponse:
    sector = find_sector(sector_id)
    if sector is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="sectors.sector_not_found",
        )
    return _sector_response(sector)
