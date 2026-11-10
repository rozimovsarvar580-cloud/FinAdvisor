from collections.abc import Iterator
from contextlib import contextmanager
from decimal import Decimal

import pytest
from sqlalchemy import create_engine, func, select
from sqlalchemy.orm import Session, sessionmaker
from sqlalchemy.pool import StaticPool

from finadvisor_api.database import Base
from finadvisor_api.demo_account import DEMO_ACCOUNT_EMAIL
from finadvisor_api.models import (
    AccountingRecord,
    MarketplaceListing,
    SavedBusinessPlan,
    User,
)
from finadvisor_api.seed_demo import seed_demo


@pytest.fixture
def db_session() -> Iterator[Session]:
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    Base.metadata.create_all(bind=engine)
    testing_session = sessionmaker(bind=engine, autoflush=False, autocommit=False)
    with testing_session() as session:
        yield session
    Base.metadata.drop_all(bind=engine)
    engine.dispose()


def test_seed_demo_is_repeatable_and_creates_readonly_sample_data(
    db_session: Session,
) -> None:
    seed_demo(db_session)
    seed_demo(db_session)

    user = db_session.scalar(select(User).where(User.email == DEMO_ACCOUNT_EMAIL))
    assert user is not None
    assert user.is_demo is True
    assert user.password_hash is None

    plan = db_session.get(SavedBusinessPlan, "plan-demo-restaurant")
    assert plan is not None
    assert plan.owner_id == user.id
    assert plan.generated_plan["calculations"]["monthly_revenue"]

    records = db_session.scalars(
        select(AccountingRecord).where(AccountingRecord.owner_id == user.id)
    ).all()
    assert {record.resource for record in records} >= {
        "inventory",
        "sales",
        "expenses",
        "stock-movements",
        "employees",
    }
    assert db_session.scalar(
        select(func.count()).select_from(AccountingRecord)
    ) == 5

    listing = db_session.get(MarketplaceListing, "listing-demo-restaurant")
    assert listing is not None
    assert listing.owner_id == user.id
    assert listing.saved_plan_id == plan.id
    assert listing.status == "published"
    assert listing.public_financial_fields == []
    assert listing.funding_target == Decimal(100000000)
    assert "Haqiqiy biznes" in listing.summary


def test_seed_demo_refuses_to_change_an_existing_real_account(
    db_session: Session,
) -> None:
    db_session.add(
        User(
            id="existing-account",
            email=DEMO_ACCOUNT_EMAIL,
            name="Existing account",
            role="tadbirkor",
            is_demo=False,
        )
    )
    db_session.commit()

    with pytest.raises(RuntimeError, match="refusing to modify it"):
        seed_demo(db_session)

    existing = db_session.get(User, "existing-account")
    assert existing is not None
    assert existing.is_demo is False


def test_module_entry_point_runs_the_seed(
    db_session: Session,
    monkeypatch: pytest.MonkeyPatch,
    capsys: pytest.CaptureFixture[str],
) -> None:
    from finadvisor_api import seed_demo as seed_demo_module

    @contextmanager
    def session_context() -> Iterator[Session]:
        yield db_session

    monkeypatch.setattr(seed_demo_module, "SessionLocal", session_context)
    seed_demo_module.main()

    assert capsys.readouterr().out.strip() == (
        f"Seeded read-only demo account: {DEMO_ACCOUNT_EMAIL}"
    )
    assert db_session.scalar(select(User).where(User.email == DEMO_ACCOUNT_EMAIL)) is not None
