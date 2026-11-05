from dataclasses import dataclass
from datetime import UTC, datetime
from functools import lru_cache
from importlib.resources import files
from typing import Literal

import yaml
from fastapi import HTTPException, status
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from finadvisor_api.models import PlanAnalysisUsageDaily, User

PlanFeature = Literal["exports", "desktop_agent", "agent_synergy"]
PlanQuota = Literal[
    "saved_plans",
    "plan_analysis_uploads_per_day",
    "marketplace_listings",
]
UPGRADE_HINTS = {"free": "pro", "pro": "business", "business": None}
TIERS = ("free", "pro", "business")


@dataclass(frozen=True)
class PlanLimits:
    saved_plans: int
    ai_requests_per_day: int
    plan_analysis_uploads_per_day: int
    calculators: frozenset[str] | None
    exports: bool
    desktop_agent: bool
    agent_synergy: bool
    team_seats: int
    marketplace_listings: int


def _non_negative_integer(value: object, label: str) -> int:
    if isinstance(value, bool) or not isinstance(value, int) or value < 0:
        raise ValueError(f"Plan limit {label} must be a non-negative integer")
    return value


def _boolean(value: object, label: str) -> bool:
    if not isinstance(value, bool):
        raise TypeError(f"Plan limit {label} must be boolean")
    return value


@lru_cache(maxsize=1)
def load_plan_limits() -> dict[str, PlanLimits]:
    limits_path = files("finadvisor_api").joinpath("data/plan_limits.yaml")
    with limits_path.open("r", encoding="utf-8") as limits_file:
        config = yaml.safe_load(limits_file)
    raw_tiers = config.get("tiers") if isinstance(config, dict) else None
    if not isinstance(raw_tiers, dict):
        raise TypeError("Plan limits must define tiers")

    parsed: dict[str, PlanLimits] = {}
    for tier in TIERS:
        raw = raw_tiers.get(tier)
        if not isinstance(raw, dict):
            raise TypeError(f"Plan limits must define {tier}")
        calculators_value = raw.get("calculators")
        if calculators_value == "all":
            calculators = None
        elif (
            isinstance(calculators_value, list)
            and all(isinstance(item, str) for item in calculators_value)
        ):
            calculators = frozenset(calculators_value)
        else:
            raise ValueError(f"Plan limits calculators for {tier} are invalid")
        parsed[tier] = PlanLimits(
            saved_plans=_non_negative_integer(raw.get("saved_plans"), f"{tier}.saved_plans"),
            ai_requests_per_day=_non_negative_integer(
                raw.get("ai_requests_per_day"), f"{tier}.ai_requests_per_day"
            ),
            plan_analysis_uploads_per_day=_non_negative_integer(
                raw.get("plan_analysis_uploads_per_day"),
                f"{tier}.plan_analysis_uploads_per_day",
            ),
            calculators=calculators,
            exports=_boolean(raw.get("exports"), f"{tier}.exports"),
            desktop_agent=_boolean(raw.get("desktop_agent"), f"{tier}.desktop_agent"),
            agent_synergy=_boolean(raw.get("agent_synergy"), f"{tier}.agent_synergy"),
            team_seats=_non_negative_integer(raw.get("team_seats"), f"{tier}.team_seats"),
            marketplace_listings=_non_negative_integer(
                raw.get("marketplace_listings"), f"{tier}.marketplace_listings"
            ),
        )
    return parsed


def limits_for_plan(plan: str) -> PlanLimits:
    try:
        return load_plan_limits()[plan]
    except KeyError as error:
        raise ValueError(f"Unsupported subscription plan: {plan}") from error


def _upgrade_hint(plan: str) -> str | None:
    return UPGRADE_HINTS[plan]


def require_plan_feature(user: User, feature: PlanFeature) -> None:
    try:
        allowed = getattr(limits_for_plan(user.subscription_plan), feature)
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="plans.invalid_subscription_plan",
        ) from error
    if not allowed:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "plans.feature_not_included",
                "feature": feature,
                "upgrade_hint": _upgrade_hint(user.subscription_plan),
            },
        )


def require_calculator(user: User, calculation_type: str) -> None:
    try:
        calculators = limits_for_plan(user.subscription_plan).calculators
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="plans.invalid_subscription_plan",
        ) from error
    if calculators is not None and calculation_type not in calculators:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail={
                "code": "plans.calculator_not_included",
                "calculator": calculation_type,
                "upgrade_hint": _upgrade_hint(user.subscription_plan),
            },
        )


def require_quota(user: User, quota: PlanQuota, used: int) -> None:
    try:
        limit = getattr(limits_for_plan(user.subscription_plan), quota)
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="plans.invalid_subscription_plan",
        ) from error
    if used < limit:
        return
    zero_limit = limit == 0
    raise HTTPException(
        status_code=(
            status.HTTP_403_FORBIDDEN
            if zero_limit
            else status.HTTP_429_TOO_MANY_REQUESTS
        ),
        detail={
            "code": "plans.quota_not_included" if zero_limit else "plans.quota_reached",
            "quota": quota,
            "limit": limit,
            "upgrade_hint": _upgrade_hint(user.subscription_plan),
        },
    )


def reserve_lifetime_quota(
    db: Session,
    user: User,
    quota: Literal["saved_plans", "marketplace_listings"],
) -> None:
    try:
        limit = getattr(limits_for_plan(user.subscription_plan), quota)
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="plans.invalid_subscription_plan",
        ) from error
    column = getattr(
        User,
        {
            "saved_plans": "saved_plan_count",
            "marketplace_listings": "marketplace_listing_count",
        }[quota],
    )
    result = db.execute(
        update(User)
        .where(User.id == user.id, column < limit)
        .values({column.key: column + 1})
        .execution_options(synchronize_session=False)
    )
    if result.rowcount == 1:
        return
    if db.scalar(select(User.id).where(User.id == user.id)) is None:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="plans.user_record_missing",
        )
    require_quota(user, quota, limit)


def reserve_plan_analysis_upload(db: Session, user: User) -> None:
    try:
        limit = limits_for_plan(user.subscription_plan).plan_analysis_uploads_per_day
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="plans.invalid_subscription_plan",
        ) from error

    quota: PlanQuota = "plan_analysis_uploads_per_day"
    require_quota(user, quota, 0)
    usage_date = datetime.now(UTC).date()
    for _attempt in range(3):
        result = db.execute(
            update(PlanAnalysisUsageDaily)
            .where(
                PlanAnalysisUsageDaily.user_id == user.id,
                PlanAnalysisUsageDaily.usage_date == usage_date,
                PlanAnalysisUsageDaily.uploads < limit,
            )
            .values(uploads=PlanAnalysisUsageDaily.uploads + 1)
        )
        if result.rowcount == 1:
            db.commit()
            return

        existing = db.scalar(
            select(PlanAnalysisUsageDaily.uploads).where(
                PlanAnalysisUsageDaily.user_id == user.id,
                PlanAnalysisUsageDaily.usage_date == usage_date,
            )
        )
        if existing is not None:
            db.rollback()
            require_quota(user, quota, existing)
            continue

        db.add(
            PlanAnalysisUsageDaily(
                user_id=user.id,
                usage_date=usage_date,
                uploads=1,
            )
        )
        try:
            db.commit()
            return
        except IntegrityError:
            db.rollback()

    raise RuntimeError("Could not reserve the plan analysis upload")
