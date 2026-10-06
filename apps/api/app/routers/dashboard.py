from fastapi import APIRouter

from ..schemas import AuthResponse

router = APIRouter(prefix="/workspace", tags=["workspace"])


@router.get("/onboarding")
async def onboarding_state() -> dict[str, object]:
    return {
        "status": "in_progress",
        "steps": [
            {"id": "company", "title": "Company profile", "completed": True},
            {"id": "cashflow", "title": "Cash flow setup", "completed": False},
            {"id": "plan", "title": "Financial plan", "completed": False},
        ],
    }


@router.get("/dashboard")
async def dashboard_summary() -> dict[str, object]:
    return {
        "owner": "Ali Valiyev",
        "restaurant": "Samarqand Bistro",
        "monthly_revenue": "248000000",
        "monthly_profit": "42700000",
        "break_even_days": 42,
        "alerts": 2,
    }


@router.get("/settings")
async def settings() -> dict[str, object]:
    return {
        "language": "uz",
        "currency": "UZS",
        "notifications": {"email": True, "sms": False, "push": True},
    }


@router.get("/notifications")
async def notifications() -> dict[str, object]:
    return {
        "items": [
            {"id": "n-1", "title": "Tax filing reminder", "read": False},
            {"id": "n-2", "title": "Cash reserve below target", "read": True},
        ]
    }
