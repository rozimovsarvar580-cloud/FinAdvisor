from datetime import UTC, date, datetime
from typing import Annotated
from uuid import uuid4

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel, Field
from sqlalchemy import select
from sqlalchemy.orm import Session

from finadvisor_api.accounting import _build_report
from finadvisor_api.ai_client import AIClientError, generate
from finadvisor_api.auth import get_current_user
from finadvisor_api.commission import create_revenue_entry
from finadvisor_api.database import get_db
from finadvisor_api.models import AgentCommand, AgentDevice, User
from finadvisor_api.plan_limits import require_plan_feature
from finadvisor_api.schemas import (
    AgentCommandRequest,
    AgentCommandResponse,
    AgentDeviceRegisterRequest,
    AgentDeviceResponse,
    AgentSyncStatementRequest,
)


class AgentRevenueCreateRequest(BaseModel):
    revenue_minor: int = Field(ge=0)
    revenue_date: date
    source_entry_id: str = Field(min_length=1, max_length=64)
    device_id: str | None = Field(default=None, min_length=1, max_length=64)


class AgentRevenueResponse(BaseModel):
    id: str
    source_entry_id: str
    revenue_minor: int
    commission_minor: int
    revenue_date: date
    status: str

router = APIRouter(prefix="/agent", tags=["agent"])
OPERATOR_ROLES = {"tadbirkor", "buxgalter"}


def require_agent_operator(user: User) -> None:
    if user.role not in OPERATOR_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="agent.operator_required",
        )
    require_plan_feature(user, "desktop_agent")


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


@router.post("/commands", response_model=AgentCommandResponse, status_code=status.HTTP_201_CREATED)
async def issue_command(
    data: AgentCommandRequest,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> AgentCommandResponse:
    require_agent_operator(user)
    if user.role != "tadbirkor":
        raise HTTPException(status_code=403, detail="agent.owner_required")
    device = None
    if data.device_id:
        device = db.scalar(select(AgentDevice).where(
            AgentDevice.id == data.device_id, AgentDevice.owner_email == user.email
        ))
        if device is None:
            raise HTTPException(status_code=404, detail="agent.device_not_found")
    command = AgentCommand(
        id=f"command-{uuid4().hex}", owner_email=user.email,
        device_id=device.id if device else None, name=data.name, status="running",
        input_data={"period": data.period},
    )
    db.add(command)
    db.commit()
    db.refresh(command)
    report = _build_report(db, user, data.period, datetime.now(UTC).date())
    prompts = {
        "generate_growth_plan": "Create a practical business growth plan using only the supplied accounting report. If data is insufficient, say so. Do not calculate or invent figures.",
        "generate_report": "Summarize the supplied accounting report. Use only its figures; do not calculate or invent figures.",
        "explain_this_month": "Explain this month's supplied accounting report in plain language. Use only its figures; do not calculate or invent figures.",
    }
    try:
        command.result = await generate(prompts[data.name], {"accounting_report": report})
        command.status = "completed"
    except AIClientError:
        command.result = ""
        command.status = "failed"
    db.commit()
    db.refresh(command)
    return AgentCommandResponse(
        id=command.id, name=command.name, status=command.status,
        device_id=command.device_id, created_at=command.created_at, result=command.result,
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
                result=item.result,
            )
            for item in records
        ]
    }


@router.post(
    "/revenue",
    response_model=AgentRevenueResponse,
    status_code=status.HTTP_201_CREATED,
)
def create_agent_revenue(
    data: AgentRevenueCreateRequest,
    user: Annotated[User, Depends(get_current_user)],
    db: Annotated[Session, Depends(get_db)],
) -> AgentRevenueResponse:
    require_agent_operator(user)
    if data.device_id is not None:
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
    entry = create_revenue_entry(
        db,
        user_id=user.id,
        revenue_minor=data.revenue_minor,
        revenue_date=data.revenue_date,
        source_entry_id=data.source_entry_id,
        device_id=data.device_id,
    )
    return AgentRevenueResponse(
        id=entry.id,
        source_entry_id=entry.source_entry_id,
        revenue_minor=entry.revenue_minor,
        commission_minor=entry.commission_minor,
        revenue_date=entry.revenue_date,
        status=entry.status,
    )


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
