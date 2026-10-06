from fastapi import APIRouter, Depends

from ..auth_dependencies import current_user

router = APIRouter(prefix="/me", tags=["auth"])


@router.get("")
async def me(user_email: str = Depends(current_user)) -> dict[str, object]:
    return {"email": user_email, "role": "entrepreneur"}
