from datetime import date, datetime

from sqlalchemy import Boolean, Date, DateTime, String, Text, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class User(Base):
    __tablename__ = "users"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    full_name: Mapped[str] = mapped_column(String(255), nullable=False)
    username: Mapped[str] = mapped_column(String(100), nullable=False, unique=True, index=True)
    date_of_birth: Mapped[date] = mapped_column(Date, nullable=False)
    gender: Mapped[str] = mapped_column(String(50), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False, unique=True, index=True)
    alternate_email: Mapped[str | None] = mapped_column(String(255), nullable=True)
    mobile: Mapped[str] = mapped_column(String(20), nullable=False, unique=True, index=True)
    security_question: Mapped[str] = mapped_column(String(255), nullable=False)
    security_answer: Mapped[str] = mapped_column(Text, nullable=False)
    referral_code: Mapped[str | None] = mapped_column(String(100), nullable=True)
    password_hash: Mapped[str] = mapped_column(String(255), nullable=False)
    email_verified: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    mobile_verified: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    subscription_plan_id: Mapped[str | None] = mapped_column(String(100), nullable=True)
    subscription_plan_name: Mapped[str | None] = mapped_column(String(255), nullable=True)
    subscription_status: Mapped[str] = mapped_column(String(50), nullable=False, default="free")
    subscription_amount: Mapped[int | None] = mapped_column(nullable=True)
    subscription_currency: Mapped[str | None] = mapped_column(String(10), nullable=True)
    subscription_billing_cycle: Mapped[str | None] = mapped_column(String(50), nullable=True)
    subscription_activated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    subscription_payment_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    subscription_order_id: Mapped[str | None] = mapped_column(String(255), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
