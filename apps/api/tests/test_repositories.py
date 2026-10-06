from decimal import Decimal

from sqlalchemy import create_engine
from sqlalchemy.orm import Session

from app.db import Base
from app.repositories import create_plan, get_plan, list_plans


def test_plan_repository_persists_decimal_values():
    engine = create_engine("sqlite://")
    Base.metadata.create_all(engine)
    with Session(engine) as db:
        created = create_plan(db, "plan-repo-001", "Repository Bistro")
        assert created.currency == "UZS"
        assert created.monthly_revenue == Decimal("0")
        assert get_plan(db, "plan-repo-001").name == "Repository Bistro"
        assert len(list_plans(db)) == 1
