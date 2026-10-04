from datetime import datetime
from typing import Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field

UserRole = Literal["tadbirkor", "buxgalter", "investor"]


class RegisterRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    email: EmailStr
    name: str = Field(min_length=1, max_length=200)
    password: str = Field(min_length=8, max_length=128)
    role: UserRole = "tadbirkor"


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    email: EmailStr
    name: str
    avatar_url: str | None
    role: UserRole
    auth_provider: str
    email_verified: bool
    created_at: datetime


class TokenResponse(BaseModel):
    access_token: str
    token_type: Literal["bearer"] = "bearer"
    user: UserResponse


class AgentDeviceRegisterRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    name: str = Field(min_length=1, max_length=120)


class AgentDeviceResponse(BaseModel):
    id: str
    name: str
    status: str
    created_at: datetime


class AgentCommandResponse(BaseModel):
    id: str
    name: str
    status: str
    device_id: str | None
    created_at: datetime


class AgentSyncStatementRequest(BaseModel):
    device_id: str = Field(min_length=1, max_length=64)
