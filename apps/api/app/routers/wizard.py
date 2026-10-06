from fastapi import APIRouter

router = APIRouter(prefix="/wizard", tags=["wizard"])


@router.get("/steps")
async def wizard_steps() -> dict[str, object]:
    return {
        "steps": [
            {"id": "restaurant", "title": "Restaurant profile", "done": True},
            {"id": "setup", "title": "Setup costs", "done": False},
            {"id": "staff", "title": "Staffing", "done": False},
            {"id": "scenario", "title": "Scenario review", "done": False},
        ]
    }


@router.post("/validate")
async def validate_wizard() -> dict[str, object]:
    return {
        "valid": True,
        "warnings": ["Cash reserve should be at least 3 months."],
        "message": "Wizard is ready for review.",
    }
