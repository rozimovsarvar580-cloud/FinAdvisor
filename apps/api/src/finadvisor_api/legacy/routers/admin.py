from fastapi import APIRouter

router = APIRouter(prefix="/admin", tags=["admin"])


@router.get("/users")
async def users() -> dict[str, object]:
    return {"items": [{"id": "user-001", "email": "demo@finadvisor.uz", "role": "entrepreneur", "status": "active"}]}


@router.get("/moderation")
async def moderation_queue() -> dict[str, object]:
    return {"items": [{"id": "plan-002", "status": "needs_review", "reason": "Investor publication review"}]}


@router.get("/audit")
async def audit_log() -> dict[str, object]:
    return {
        "items": [
            {"id": "audit-001", "action": "login", "actor": "user-001", "request_id": "demo-request-001"},
            {"id": "audit-002", "action": "plan_export", "actor": "user-001", "request_id": "demo-request-002"},
        ]
    }


@router.get("/feature-flags")
async def feature_flags() -> dict[str, object]:
    return {"items": [{"key": "investor_marketplace", "enabled": True}, {"key": "desktop_agent", "enabled": False}]}
