from datetime import date, datetime
from typing import Annotated, Literal

from pydantic import BaseModel, ConfigDict, EmailStr, Field, model_validator

from finadvisor_api.calc_schemas import NonNegativeDecimal, SignedDecimal, StrictInput

UserRole = Literal["tadbirkor", "buxgalter", "investor"]
AuthenticatedUserRole = Literal["tadbirkor", "buxgalter", "investor", "admin"]


class RegisterRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    email: EmailStr
    name: str = Field(min_length=1, max_length=200)
    password: str = Field(min_length=8, max_length=128)
    role: UserRole = "tadbirkor"


class LoginRequest(BaseModel):
    email: EmailStr
    password: str = Field(min_length=1, max_length=128)


class RefreshTokenRequest(BaseModel):
    refresh_token: str = Field(min_length=1, max_length=128)


class EmailRequest(BaseModel):
    email: EmailStr


class EmailTokenRequest(BaseModel):
    token: str = Field(min_length=1, max_length=128)


class PasswordResetRequest(EmailTokenRequest):
    password: str = Field(min_length=8, max_length=128)


class OAuthExchangeRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    provider: Literal["google", "facebook"]
    provider_account_id: str = Field(min_length=1, max_length=255)
    email: EmailStr
    name: str = Field(min_length=1, max_length=200)
    avatar_url: str | None = Field(default=None, max_length=2048)
    email_verified: bool = False
    role: UserRole = "tadbirkor"


class OAuthProviderTokenRequest(BaseModel):
    provider: Literal["google", "facebook"]
    access_token: str = Field(min_length=1, max_length=4096)
    role: UserRole = "tadbirkor"


class UpdateRoleRequest(BaseModel):
    model_config = ConfigDict(str_strip_whitespace=True)

    role: UserRole | None = None
    name: str | None = Field(default=None, min_length=1, max_length=200)
    locale: Literal["uz", "ru", "en"] | None = None


class ChangePasswordRequest(BaseModel):
    current_password: str = Field(min_length=1, max_length=128)
    new_password: str = Field(min_length=8, max_length=128)


class OAuthAccountSummary(BaseModel):
    provider: Literal["google", "facebook"]
    connected_at: datetime


class UserResponse(BaseModel):
    model_config = ConfigDict(from_attributes=True)

    id: str
    email: EmailStr
    name: str
    avatar_url: str | None
    role: AuthenticatedUserRole
    needs_role: bool
    locale: Literal["uz", "ru", "en"]
    auth_provider: str
    email_verified: bool
    created_at: datetime
    deletion_requested_at: datetime | None


class TokenResponse(BaseModel):
    access_token: str
    refresh_token: str
    expires_in: int
    token_type: Literal["bearer"] = "bearer"
    user: UserResponse


class OAuthTokenResponse(TokenResponse):
    is_new: bool


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
    result: str | None = None


class AgentSyncStatementRequest(BaseModel):
    device_id: str = Field(min_length=1, max_length=64)


class AgentCommandRequest(BaseModel):
    name: Literal["generate_growth_plan", "generate_report", "explain_this_month"]
    period: Literal["day", "week", "month", "year"] = "month"
    device_id: str | None = Field(default=None, min_length=1, max_length=64)


class MarketplaceListingCreateRequest(StrictInput):
    plan_id: str = Field(min_length=1, max_length=64)
    stage: Literal["idea", "pilot", "scale"]
    funding_target: Annotated[
        NonNegativeDecimal,
        Field(gt=0, max_digits=20, decimal_places=2),
    ]
    summary: str = Field(min_length=1, max_length=2000)
    status: Literal["draft", "published", "archived"] = "published"
    public_financial_fields: list[str] = Field(default_factory=list, max_length=32)
    request_financial_fields: list[str] = Field(default_factory=list, max_length=32)


class MarketplaceListingVisibilityRequest(StrictInput):
    status: Literal["draft", "published", "archived"] | None = None
    is_published: bool | None = None
    public_financial_fields: list[str] | None = Field(default=None, max_length=32)
    request_financial_fields: list[str] | None = Field(default=None, max_length=32)

    @model_validator(mode="after")
    def require_status(self):
        if self.status is None and self.is_published is None:
            raise ValueError("status is required")
        return self


class MarketplaceListingResponse(BaseModel):
    id: str
    plan_id: str | None
    business_name: str
    city: str
    stage: Literal["idea", "pilot", "scale"]
    funding_target: str
    currency: Literal["UZS"]
    summary: str
    is_published: bool
    status: Literal["draft", "published", "archived"]
    public_financial_fields: list[str]
    request_financial_fields: list[str]
    created_at: datetime


class MarketplacePublicPlan(BaseModel):
    summary: str
    sections: list[dict[str, str]]
    calculations: dict[str, str | int | None]


class MarketplaceListingDetailResponse(MarketplaceListingResponse):
    plan: MarketplacePublicPlan


class LedgerEntryCreateRequest(StrictInput):
    entry_date: date = Field(strict=False)
    category: str = Field(min_length=1, max_length=64)
    amount: Annotated[SignedDecimal, Field(max_digits=20, decimal_places=2)]
    description: str | None = Field(default=None, max_length=500)


class LedgerEntryResponse(BaseModel):
    id: str
    entry_date: date
    category: str
    amount: str
    currency: Literal["UZS"]
    description: str | None
