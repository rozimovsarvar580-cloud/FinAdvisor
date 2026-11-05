from collections.abc import Iterator
from contextlib import contextmanager
from datetime import UTC, date, datetime

from fastapi import HTTPException, status
from finance_engine.ai_cost import estimate_ai_cost
from sqlalchemy import select, update
from sqlalchemy.exc import IntegrityError
from sqlalchemy.orm import Session

from finadvisor_api.ai_client import capture_token_usage
from finadvisor_api.models import AIUsageDaily, User
from finadvisor_api.plan_limits import UPGRADE_HINTS, limits_for_plan


def daily_request_limit(plan: str) -> int:
    return limits_for_plan(plan).ai_requests_per_day


def _limit_error(plan: str, daily_limit: int) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_429_TOO_MANY_REQUESTS,
        detail={
            "code": "ai.daily_limit_reached",
            "daily_limit": daily_limit,
            "upgrade_hint": UPGRADE_HINTS[plan],
        },
    )


def reserve_ai_request(db: Session, user: User) -> date:
    try:
        daily_limit = daily_request_limit(user.subscription_plan)
    except ValueError as error:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="ai.invalid_subscription_plan",
        ) from error

    usage_date = datetime.now(UTC).date()
    for _attempt in range(3):
        result = db.execute(
            update(AIUsageDaily)
            .where(
                AIUsageDaily.user_id == user.id,
                AIUsageDaily.usage_date == usage_date,
                AIUsageDaily.requests < daily_limit,
            )
            .values(requests=AIUsageDaily.requests + 1)
        )
        if result.rowcount == 1:
            db.execute(
                update(AIUsageDaily)
                .where(
                    AIUsageDaily.user_id == user.id,
                    AIUsageDaily.usage_date == usage_date,
                )
                .values(token_usage_complete=False)
            )
            db.commit()
            return usage_date

        usage_exists = db.scalar(
            select(AIUsageDaily.id).where(
                AIUsageDaily.user_id == user.id,
                AIUsageDaily.usage_date == usage_date,
            )
        )
        if usage_exists is not None:
            db.rollback()
            raise _limit_error(user.subscription_plan, daily_limit)

        db.add(
            AIUsageDaily(
                user_id=user.id,
                usage_date=usage_date,
                requests=1,
                token_usage_complete=False,
            )
        )
        try:
            db.commit()
            return usage_date
        except IntegrityError:
            db.rollback()

    raise RuntimeError("Could not reserve the daily AI request")


def record_ai_token_usage(
    db: Session,
    user_id: str,
    usage_date: date,
    model: str,
    input_tokens: int | None,
    output_tokens: int | None,
) -> None:
    usage = db.scalar(
        select(AIUsageDaily).where(
            AIUsageDaily.user_id == user_id,
            AIUsageDaily.usage_date == usage_date,
        ).with_for_update()
    )
    if usage is None:
        raise RuntimeError("Reserved AI usage record was not found")

    if input_tokens is None or output_tokens is None:
        usage.completed_requests += 1
        usage.unknown_token_usage_requests += 1
        usage.token_usage_complete = False
        usage.cost_pricing_complete = False
        db.commit()
        return

    usage.completed_requests += 1
    usage.input_tokens += input_tokens
    usage.output_tokens += output_tokens
    cost = estimate_ai_cost(model, input_tokens, output_tokens)
    if cost is None:
        usage.cost_pricing_complete = False
        usage.cost_pricing_verified = False
    else:
        usage.estimated_cost_usd += cost.amount_usd
        usage.cost_pricing_verified = (
            usage.cost_pricing_verified and cost.verified
        )
    usage.token_usage_complete = (
        usage.completed_requests == usage.requests
        and usage.unknown_token_usage_requests == 0
    )
    db.commit()


@contextmanager
def capture_user_ai_usage(
    db: Session,
    user: User,
    usage_date: date,
    model: str,
) -> Iterator[None]:
    user_id = user.id

    def record(input_tokens: int | None, output_tokens: int | None) -> None:
        record_ai_token_usage(
            db,
            user_id,
            usage_date,
            model,
            input_tokens,
            output_tokens,
        )

    with capture_token_usage(record):
        yield
