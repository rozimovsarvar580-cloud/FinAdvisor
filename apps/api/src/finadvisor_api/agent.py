from typing import Annotated
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy import select
from sqlalchemy.orm import Session

from finadvisor_api.auth import get_current_user
from finadvisor_api.database import get_db
from finadvisor_api.models import AgentCommand, AgentDevice, User
from finadvisor_api.schemas import (
    AgentCommandResponse,
    AgentDeviceRegisterRequest,
    AgentDeviceResponse,
    AgentSyncStatementRequest,
)

router = APIRouter(prefix="/agent", tags=["agent"])
OPERATOR_ROLES = {"tadbirkor", "buxgalter"}


def require_agent_operator(user: User) -> None:
    if user.role not in OPERATOR_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="agent.operator_required",
        )


@router.get("/devices", response_model=dict[str, list[AgentDeviceResponse]])
def list_devices(
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> dict[str, list[AgentDeviceResponse]]:
    require_agent_operator(user)
    records = db.scalars(
        select(AgentDevice)
        .where(AgentDevice.owner_email == user.email)
        .order_by(AgentDevice.created_at.desc())
    ).all()
    return {
        "items": [
            AgentDeviceResponse(
                id=item.id,
                name=item.name,
                status=item.status,
                created_at=item.created_at,
            )
            for item in records
        ]
    }


@router.post(
    "/devices",
    response_model=AgentDeviceResponse,
    status_code=status.HTTP_201_CREATED,
)
def register_device(
    data: AgentDeviceRegisterRequest,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> AgentDeviceResponse:
    require_agent_operator(user)
    device = AgentDevice(
        id=f"device-{uuid4().hex}",
        owner_email=user.email,
        name=data.name,
        status="registered",
    )
    db.add(device)
    db.commit()
    db.refresh(device)
    return AgentDeviceResponse(
        id=device.id,
        name=device.name,
        status=device.status,
        created_at=device.created_at,
    )


@router.get("/commands", response_model=dict[str, list[AgentCommandResponse]])
def list_commands(
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
    device_id: str | None = None,
) -> dict[str, list[AgentCommandResponse]]:
    require_agent_operator(user)
    query = select(AgentCommand).where(AgentCommand.owner_email == user.email)
    if device_id is not None:
        query = query.where(AgentCommand.device_id == device_id)
    records = db.scalars(query.order_by(AgentCommand.created_at.desc())).all()
    return {
        "items": [
            AgentCommandResponse(
                id=item.id,
                name=item.name,
                status=item.status,
                device_id=item.device_id,
                created_at=item.created_at,
            )
            for item in records
        ]
    }


@router.post(
    "/commands/sync-statement",
    response_model=AgentCommandResponse,
    status_code=status.HTTP_202_ACCEPTED,
)
def queue_statement_sync(
    data: AgentSyncStatementRequest,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> AgentCommandResponse:
    require_agent_operator(user)
    device = db.scalar(
        select(AgentDevice).where(
            AgentDevice.id == data.device_id,
            AgentDevice.owner_email == user.email,
        )
    )
    if device is None:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="agent.device_not_found",
        )

    command = AgentCommand(
        id=f"command-{uuid4().hex}",
        owner_email=user.email,
        device_id=device.id,
        name="sync_statement",
        status="queued",
    )
    db.add(command)
    db.commit()
    db.refresh(command)
    return AgentCommandResponse(
        id=command.id,
        name=command.name,
        status=command.status,
        device_id=command.device_id,
        created_at=command.created_at,
    )
