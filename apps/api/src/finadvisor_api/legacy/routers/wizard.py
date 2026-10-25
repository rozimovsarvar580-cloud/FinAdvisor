from fastapi import APIRouter, Depends

from ..auth_dependencies import require_role

router = APIRouter(prefix="/wizard", tags=["wizard"])


@router.get("/steps")
async def wizard_steps(
    _: str = Depends(require_role("entrepreneur", "accountant", "admin")),
) -> dict[str, object]:
    return {
        "steps": [
            {"id": "restaurant", "title": "Restaurant profile", "done": True},
            {"id": "setup", "title": "Setup costs", "done": False},
            {"id": "staff", "title": "Staffing", "done": False},
            {"id": "scenario", "title": "Scenario review", "done": False},
        ]
    }


@router.post("/validate")
async def validate_wizard(
    _: str = Depends(require_role("entrepreneur", "accountant", "admin")),
) -> dict[str, object]:
    return {
        "valid": True,
        "warnings": ["Cash reserve should be at least 3 months."],
        "message": "Wizard is ready for review.",
    }
