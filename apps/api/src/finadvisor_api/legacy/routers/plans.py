from decimal import Decimal
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from ..db import get_db
from ..repositories import create_plan as create_plan_record
from ..repositories import create_plan_version, list_plan_versions, seed_demo_plans
from ..repositories import get_plan as get_plan_record
from ..repositories import list_plans as list_plan_records
from ..schemas import PlanCreateRequest, PlanUpdateRequest, WhatIfRequest

router = APIRouter(prefix="/plans", tags=["plans"])


@router.get("/")
async def list_plans(db: Session = Depends(get_db)) -> dict[str, object]:
    seed_demo_plans(db)
    return {"items": [
        {
            "id": plan.id,
            "name": plan.name,
            "status": plan.status,
            "currency": plan.currency,
            "monthly_revenue": str(plan.monthly_revenue or 0),
            "monthly_profit": str(plan.monthly_profit or 0),
        }
        for plan in list_plan_records(db)
    ]}


@router.get("/{plan_id}")
async def get_plan(plan_id: str, db: Session = Depends(get_db)) -> dict[str, object]:
    seed_demo_plans(db)
    plan = get_plan_record(db, plan_id)
    if plan is None:
        return {"id": plan_id, "status": "not_found"}
    return {
        "id": plan.id,
        "name": plan.name,
        "currency": plan.currency,
        "monthly_revenue": str(plan.monthly_revenue or 0),
        "monthly_profit": str(plan.monthly_profit or 0),
        "status": plan.status,
        "scenarios": {"base": "ok", "pessimistic": "watch", "optimistic": "strong"},
    }


@router.put("/{plan_id}")
async def update_plan(
    plan_id: str,
    data: PlanUpdateRequest,
    db: Session = Depends(get_db),
) -> dict[str, object]:
    plan = get_plan_record(db, plan_id)
    if plan is None:
        raise HTTPException(status_code=404, detail={"code": "plan_not_found", "message": "Plan not found"})
    plan.name = data.name
    plan.monthly_revenue = data.monthly_revenue
    plan.monthly_profit = data.monthly_profit
    db.commit()
    db.refresh(plan)
    version = create_plan_version(db, plan)
    return {"id": plan.id, "status": "updated", "version": version.version}


@router.get("/{plan_id}/versions")
async def plan_versions(plan_id: str, db: Session = Depends(get_db)) -> dict[str, object]:
    if get_plan_record(db, plan_id) is None:
        raise HTTPException(status_code=404, detail={"code": "plan_not_found", "message": "Plan not found"})
    return {
        "items": [
            {"id": item.id, "version": item.version, "snapshot": item.snapshot}
            for item in list_plan_versions(db, plan_id)
        ]
    }


@router.post("/{plan_id}/what-if")
async def plan_what_if(
    plan_id: str,
    data: WhatIfRequest,
    db: Session = Depends(get_db),
) -> dict[str, object]:
    plan = get_plan_record(db, plan_id)
    if plan is None:
        raise HTTPException(status_code=404, detail={"code": "plan_not_found", "message": "Plan not found"})
    revenue = Decimal(plan.monthly_revenue or 0) * (Decimal(1) + data.revenue_change_percent / 100)
    profit = Decimal(plan.monthly_profit or 0) * (Decimal(1) + data.revenue_change_percent / 100)
    profit -= Decimal(plan.monthly_revenue or 0) * data.cost_change_percent / 100
    return {
        "plan_id": plan_id,
        "currency": plan.currency,
        "monthly_revenue": str(revenue.quantize(Decimal("0.01"))),
        "monthly_profit": str(profit.quantize(Decimal("0.01"))),
        "inputs": data.model_dump(mode="json"),
    }


@router.post("/")
async def create_plan(
    data: PlanCreateRequest | None = None,
    db: Session = Depends(get_db),
) -> dict[str, object]:
    plan = create_plan_record(db, f"plan-{uuid4().hex[:8]}", data.name if data else "Untitled plan")
    return {"id": plan.id, "status": "created", "message": "Plan draft created", "currency": plan.currency}
