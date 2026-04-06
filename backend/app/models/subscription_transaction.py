from datetime import datetime

from sqlalchemy import DateTime, ForeignKey, Integer, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class SubscriptionTransaction(Base):
    __tablename__ = "subscription_transactions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    transaction_code: Mapped[str] = mapped_column(String(6), nullable=False, unique=True, index=True)
    invoice_number: Mapped[str] = mapped_column(String(6), nullable=False, unique=True, index=True)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    customer_code: Mapped[str | None] = mapped_column(String(6), nullable=True, index=True)
    customer_name: Mapped[str] = mapped_column(String(255), nullable=False)
    customer_email: Mapped[str] = mapped_column(String(255), nullable=False)
    customer_mobile: Mapped[str] = mapped_column(String(20), nullable=False)
    company_name: Mapped[str] = mapped_column(String(255), nullable=False)
    plan_id: Mapped[str] = mapped_column(String(100), nullable=False, index=True)
    plan_name: Mapped[str] = mapped_column(String(255), nullable=False)
    amount: Mapped[int] = mapped_column(Integer, nullable=False)
    currency: Mapped[str] = mapped_column(String(10), nullable=False)
    billing_cycle: Mapped[str] = mapped_column(String(50), nullable=False)
    status: Mapped[str] = mapped_column(String(40), nullable=False, default="verified", index=True)
    razorpay_order_id: Mapped[str] = mapped_column(String(255), nullable=False, unique=True, index=True)
    razorpay_payment_id: Mapped[str] = mapped_column(String(255), nullable=False, unique=True, index=True)
    activated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    expires_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False)
    canceled_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
    )
