import uuid
from datetime import datetime
from decimal import Decimal

from sqlalchemy import JSON, Boolean, DateTime, ForeignKey, Index, Numeric, String, func
from sqlalchemy.orm import Mapped, mapped_column

from finadvisor_api.database import Base


class User(Base):
    __tablename__ = "users"
    __table_args__ = (
        Index(
            "ix_users_auth_provider_subject",
            "auth_provider",
            "provider_user_id",
            unique=True,
        ),
    )

    id: Mapped[str] = mapped_column(
        String(36), primary_key=True, default=lambda: str(uuid.uuid4())
    )
    email: Mapped[str] = mapped_column(String(320), unique=True, index=True)
    name: Mapped[str] = mapped_column(String(200))
    avatar_url: Mapped[str | None] = mapped_column(String(2048), nullable=True)
    role: Mapped[str] = mapped_column(String(24), default="tadbirkor")
    auth_provider: Mapped[str] = mapped_column(String(24), default="credentials")
    provider_user_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    password_hash: Mapped[str | None] = mapped_column(String(255), nullable=True)
    email_verified: Mapped[bool] = mapped_column(Boolean, default=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class AgentDevice(Base):
    __tablename__ = "agent_devices"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    owner_email: Mapped[str] = mapped_column(String(320), index=True)
    name: Mapped[str] = mapped_column(String(120))
    status: Mapped[str] = mapped_column(String(32), default="registered")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class AgentCommand(Base):
    __tablename__ = "agent_commands"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    owner_email: Mapped[str] = mapped_column(String(320), index=True)
    device_id: Mapped[str | None] = mapped_column(
        ForeignKey("agent_devices.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    name: Mapped[str] = mapped_column(String(64))
    status: Mapped[str] = mapped_column(String(32), default="queued")
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class SavedBusinessPlan(Base):
    __tablename__ = "saved_business_plans"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    owner_id: Mapped[str] = mapped_column(
        ForeignKey("users.id", ondelete="CASCADE"), index=True
    )
    business_name: Mapped[str] = mapped_column(String(200))
    location: Mapped[str] = mapped_column(String(300))
    request_payload: Mapped[dict[str, object]] = mapped_column(JSON, nullable=False)
    generated_plan: Mapped[dict[str, object]] = mapped_column(JSON, nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )


class MarketplaceListing(Base):
    __tablename__ = "marketplace_listings"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    owner_id: Mapped[str] = mapped_column(ForeignKey("users.id"), index=True)
    saved_plan_id: Mapped[str | None] = mapped_column(
        ForeignKey("saved_business_plans.id", ondelete="SET NULL"),
        nullable=True,
        index=True,
    )
    business_name: Mapped[str] = mapped_column(String(200))
    city: Mapped[str] = mapped_column(String(120))
    stage: Mapped[str] = mapped_column(String(16))
    funding_target: Mapped[Decimal] = mapped_column(Numeric(20, 2))
    currency: Mapped[str] = mapped_column(String(3), default="UZS")
    summary: Mapped[str] = mapped_column(String(2000))
    is_published: Mapped[bool] = mapped_column(Boolean, default=True, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True), server_default=func.now()
    )
