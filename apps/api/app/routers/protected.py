from fastapi import APIRouter, Depends

from ..auth_dependencies import require_role

router = APIRouter(prefix="/protected", tags=["access"])


@router.get("/admin")
async def admin_area(_: str = Depends(require_role("admin"))) -> dict[str, str]:
    return {"area": "admin"}


@router.get("/investor")
async def investor_area(_: str = Depends(require_role("investor", "admin"))) -> dict[str, str]:
    return {"area": "investor"}


@router.get("/accounting")
async def accounting_area(_: str = Depends(require_role("accountant", "entrepreneur", "admin"))) -> dict[str, str]:
    return {"area": "accounting"}
