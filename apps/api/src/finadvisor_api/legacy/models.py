from datetime import datetime
from decimal import Decimal

from sqlalchemy import DateTime, JSON, Numeric, String, ForeignKey, func
from sqlalchemy.orm import Mapped, mapped_column

from .db import Base


class Plan(Base):
    __tablename__ = "plans"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    name: Mapped[str] = mapped_column(String(200))
    status: Mapped[str] = mapped_column(String(32), default="draft")
    currency: Mapped[str] = mapped_column(String(3), default="UZS")
    monthly_revenue: Mapped[Decimal | None] = mapped_column(Numeric(20, 2), nullable=True)
    monthly_profit: Mapped[Decimal | None] = mapped_column(Numeric(20, 2), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

    def __init__(self, **kwargs: object) -> None:
        kwargs.setdefault("currency", "UZS")
        super().__init__(**kwargs)


class PlanVersion(Base):
    __tablename__ = "plan_versions"

    id: Mapped[str] = mapped_column(String(64), primary_key=True)
    plan_id: Mapped[str] = mapped_column(ForeignKey("plans.id"), index=True)
    version: Mapped[int] = mapped_column(nullable=False)
    snapshot: Mapped[dict[str, object]] = mapped_column(JSON, nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class AuthSession(Base):
    __tablename__ = "auth_sessions"

    token: Mapped[str] = mapped_column(String(128), primary_key=True)
    user_email: Mapped[str] = mapped_column(String(320), index=True)
    role: Mapped[str] = mapped_column(String(32), default="entrepreneur")
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True))
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())


class EmailVerification(Base):
    __tablename__ = "email_verifications"

    email: Mapped[str] = mapped_column(String(320), primary_key=True)
    code_hash: Mapped[str] = mapped_column(String(128), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), server_default=func.now())

