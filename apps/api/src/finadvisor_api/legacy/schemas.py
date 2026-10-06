from decimal import Decimal

from pydantic import BaseModel, EmailStr, Field


class CreditCalculationRequest(BaseModel):
    principal: Decimal = Field(gt=0)
    annual_rate: Decimal = Field(ge=0)
    months: int = Field(gt=0, le=600)


class CalculationResponse(BaseModel):
    calculation: str
    rows: list[dict[str, object]]
    formula: str
    inputs: dict[str, object]


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1)


class RegisterRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=8)
    full_name: str = Field(min_length=2)


class PasswordResetRequest(BaseModel):
    email: EmailStr


class VerificationRequest(BaseModel):
    email: EmailStr
    code: str = Field(pattern=r"^\d{6}$")


class AuthResponse(BaseModel):
    message: str
    email: EmailStr | None = None
    token: str | None = None


class PlanCreateRequest(BaseModel):
    name: str = Field(min_length=2, max_length=200)


class PlanUpdateRequest(BaseModel):
    name: str = Field(min_length=2, max_length=200)
    monthly_revenue: Decimal = Field(ge=0)
    monthly_profit: Decimal = Field()


class WhatIfRequest(BaseModel):
    revenue_change_percent: Decimal = Field(ge=-100, le=1000)
    cost_change_percent: Decimal = Field(ge=-100, le=1000)


class ExplanationRequest(BaseModel):
    question: str = Field(min_length=1, max_length=1000)
    result: dict[str, object] = Field(default_factory=dict)
