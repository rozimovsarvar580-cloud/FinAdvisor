from fastapi import APIRouter, Depends

from ..auth_dependencies import require_role

router = APIRouter(prefix="/agent", tags=["agent"])


@router.get("/devices")
async def devices(_: str = Depends(require_role("entrepreneur", "accountant", "admin"))) -> dict[str, object]:
    return {"items": [{"id": "device-001", "name": "Office PC", "status": "not_connected"}]}


@router.get("/commands")
async def command_history(_: str = Depends(require_role("entrepreneur", "accountant", "admin"))) -> dict[str, object]:
    return {"items": [{"id": "command-001", "name": "sync_statement", "status": "queued"}]}


@router.post("/commands/sync-statement")
async def sync_statement(_: str = Depends(require_role("entrepreneur", "accountant", "admin"))) -> dict[str, object]:
    return {"command_id": "command-002", "name": "sync_statement", "status": "queued"}
