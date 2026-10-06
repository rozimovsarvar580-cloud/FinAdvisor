from decimal import Decimal

from sqlalchemy import select
from sqlalchemy.orm import Session

from .models import Plan, PlanVersion
from uuid import uuid4


def list_plans(db: Session) -> list[Plan]:
    return list(db.scalars(select(Plan).order_by(Plan.created_at.desc())))


def get_plan(db: Session, plan_id: str) -> Plan | None:
    return db.get(Plan, plan_id)


def create_plan(db: Session, plan_id: str, name: str) -> Plan:
    plan = Plan(
        id=plan_id,
        name=name,
        status="draft",
        currency="UZS",
        monthly_revenue=Decimal("0"),
        monthly_profit=Decimal("0"),
    )
    db.add(plan)
    db.commit()
    db.refresh(plan)
    return plan


def create_plan_version(db: Session, plan: Plan) -> PlanVersion:
    latest = db.query(PlanVersion).filter(PlanVersion.plan_id == plan.id).count()
    version = PlanVersion(
        id=f"version-{uuid4().hex[:12]}",
        plan_id=plan.id,
        version=latest + 1,
        snapshot={
            "name": plan.name,
            "status": plan.status,
            "currency": plan.currency,
            "monthly_revenue": str(plan.monthly_revenue or 0),
            "monthly_profit": str(plan.monthly_profit or 0),
        },
    )
    db.add(version)
    db.commit()
    db.refresh(version)
    return version


def list_plan_versions(db: Session, plan_id: str) -> list[PlanVersion]:
    return list(
        db.query(PlanVersion)
        .filter(PlanVersion.plan_id == plan_id)
        .order_by(PlanVersion.version.desc())
    )


def seed_demo_plans(db: Session) -> None:
    if db.scalar(select(Plan.id).limit(1)) is not None:
        return
    db.add_all(
        [
            Plan(
                id="plan-001",
                name="Samarqand Bistro",
                status="draft",
                monthly_revenue=Decimal("248000000"),
                monthly_profit=Decimal("42700000"),
            ),
            Plan(
                id="plan-002",
                name="Shahar Qosh",
                status="review",
                monthly_revenue=Decimal("180000000"),
                monthly_profit=Decimal("28000000"),
            ),
        ]
    )
    db.commit()
