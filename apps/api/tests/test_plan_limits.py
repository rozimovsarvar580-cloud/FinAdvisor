from datetime import UTC, datetime

import pytest
from fastapi import HTTPException
from sqlalchemy import create_engine
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import sessionmaker
from sqlalchemy.pool import StaticPool

from finadvisor_api.database import Base
from finadvisor_api.models import PlanAnalysisUsageDaily, User
from finadvisor_api.plan_limits import (
    limits_for_plan,
    require_calculator,
    require_plan_feature,
    reserve_lifetime_quota,
    reserve_plan_analysis_upload,
)


@pytest.fixture
def limits_database():
    engine = create_engine(
        "sqlite://",
        connect_args={"check_same_thread": False},
        poolclass=StaticPool,
    )
    session_factory = sessionmaker(bind=engine, expire_on_commit=False)
    Base.metadata.create_all(bind=engine)
    user = User(
        id="limits-user",
        email="limits-user@example.com",
        name="Limits User",
        role="tadbirkor",
        subscription_plan="free",
    )
    with session_factory() as session:
        session.add(user)
        session.commit()
    yield session_factory, user
    Base.metadata.drop_all(bind=engine)
    engine.dispose()


def test_tier_entitlements_share_one_limits_configuration() -> None:
    free = limits_for_plan("free")
    pro = limits_for_plan("pro")
    business = limits_for_plan("business")

    assert (free.saved_plans, pro.saved_plans, business.saved_plans) == (1, 10, 50)
    assert (free.ai_requests_per_day, pro.ai_requests_per_day) == (10, 100)
    assert (
        free.plan_analysis_uploads_per_day,
        pro.plan_analysis_uploads_per_day,
        business.plan_analysis_uploads_per_day,
    ) == (0, 10, 30)
    assert free.calculators == frozenset({"startup-cost"})
    assert pro.calculators is business.calculators is None
    assert not free.exports and pro.exports and business.exports
    assert not free.desktop_agent and not pro.desktop_agent and business.desktop_agent
    assert (free.marketplace_listings, pro.marketplace_listings) == (0, 1)


def test_free_tier_is_restricted_and_pro_is_allowed() -> None:
    free = User(
        id="free-user",
        email="free@example.com",
        name="Free User",
        subscription_plan="free",
    )
    pro = User(
        id="pro-user",
        email="pro@example.com",
        name="Pro User",
        subscription_plan="pro",
    )

    require_calculator(free, "startup-cost")
    require_plan_feature(pro, "exports")
    require_calculator(pro, "payroll")

    with pytest.raises(HTTPException) as export_error:
        require_plan_feature(free, "exports")
    assert export_error.value.status_code == 403
    with pytest.raises(HTTPException) as calculator_error:
        require_calculator(free, "payroll")
    assert calculator_error.value.status_code == 403
    with pytest.raises(HTTPException) as desktop_error:
        require_plan_feature(pro, "desktop_agent")
    assert desktop_error.value.status_code == 403


def test_saved_plan_and_marketplace_quotas_are_reserved_atomically(
    limits_database,
) -> None:
    session_factory, user = limits_database
    with session_factory() as session:
        reserve_lifetime_quota(session, user, "saved_plans")
        session.commit()
        assert session.get(User, user.id).saved_plan_count == 1
        with pytest.raises(HTTPException) as saved_plan_error:
            reserve_lifetime_quota(session, user, "saved_plans")
        assert saved_plan_error.value.status_code == 429
        assert saved_plan_error.value.detail["code"] == "plans.quota_reached"

        with pytest.raises(HTTPException) as listing_error:
            reserve_lifetime_quota(session, user, "marketplace_listings")
        assert listing_error.value.status_code == 403
        assert listing_error.value.detail["code"] == "plans.quota_not_included"

        user.subscription_plan = "pro"
        reserve_lifetime_quota(session, user, "marketplace_listings")
        session.commit()
        assert session.get(User, user.id).marketplace_listing_count == 1
        with pytest.raises(HTTPException) as listing_quota_error:
            reserve_lifetime_quota(session, user, "marketplace_listings")
        assert listing_quota_error.value.status_code == 429


def test_analysis_uploads_are_denied_for_free_and_capped_for_pro(
    limits_database,
) -> None:
    session_factory, user = limits_database
    with session_factory() as session:
        with pytest.raises(HTTPException) as free_error:
            reserve_plan_analysis_upload(session, user)
        assert free_error.value.status_code == 403

        session_user = session.get(User, user.id)
        session_user.subscription_plan = "pro"
        user.subscription_plan = "pro"
        session.commit()
        usage = PlanAnalysisUsageDaily(
            user_id=user.id,
            usage_date=datetime.now(UTC).date(),
            uploads=9,
        )
        session.add(usage)
        session.commit()

        reserve_plan_analysis_upload(session, user)
        assert session.get(PlanAnalysisUsageDaily, usage.id).uploads == 10
        with pytest.raises(HTTPException) as capped_error:
            reserve_plan_analysis_upload(session, user)
        assert capped_error.value.status_code == 429


def test_analysis_upload_reservation_retries_after_concurrent_first_insert(
    limits_database,
    monkeypatch: pytest.MonkeyPatch,
) -> None:
    session_factory, user = limits_database
    user.subscription_plan = "pro"
    with session_factory() as session:
        original_commit = session.commit
        attempts = 0

        def concurrent_insert_then_commit() -> None:
            nonlocal attempts
            attempts += 1
            if attempts == 1:
                session.rollback()
                with session_factory() as concurrent_session:
                    concurrent_session.add(
                        PlanAnalysisUsageDaily(
                            user_id=user.id,
                            usage_date=datetime.now(UTC).date(),
                            uploads=1,
                        )
                    )
                    concurrent_session.commit()
                raise IntegrityError("concurrent insert", {}, Exception())
            original_commit()

        monkeypatch.setattr(session, "commit", concurrent_insert_then_commit)
        reserve_plan_analysis_upload(session, user)

    with session_factory() as session:
        usage = session.query(PlanAnalysisUsageDaily).one()
        assert usage.uploads == 2
