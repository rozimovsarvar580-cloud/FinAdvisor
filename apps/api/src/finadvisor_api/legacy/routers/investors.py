from fastapi import APIRouter

router = APIRouter(prefix="/investors", tags=["investors"])


@router.get("/discover")
async def discover_plans() -> dict[str, object]:
    return {
        "items": [
            {"id": "plan-002", "name": "Shahar Qosh", "sector": "restaurant", "funding_need": "850000000", "currency": "UZS"},
            {"id": "plan-004", "name": "Choyxona 24", "sector": "restaurant", "funding_need": "1200000000", "currency": "UZS"},
        ]
    }


@router.get("/saved")
async def saved_plans() -> dict[str, object]:
    return {"items": [{"id": "plan-002", "name": "Shahar Qosh", "saved": True}]}


@router.get("/inbox")
async def investor_inbox() -> dict[str, object]:
    return {"items": [{"id": "thread-001", "plan_id": "plan-002", "unread": True, "subject": "Funding questions"}]}


@router.get("/kyc")
async def kyc_profile() -> dict[str, object]:
    return {"status": "pending", "required": ["identity", "source_of_funds", "agreement"]}
