from datetime import datetime

from sqlalchemy import Boolean, DateTime, ForeignKey, String, UniqueConstraint, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class LinkedProvider(Base):
    __tablename__ = "linked_providers"
    __table_args__ = (UniqueConstraint("user_id", "provider_key", name="uq_linked_provider_user_provider"),)

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id", ondelete="CASCADE"), nullable=False, index=True)
    provider_key: Mapped[str] = mapped_column(String(50), nullable=False, index=True)
    provider_email: Mapped[str] = mapped_column(String(255), nullable=False)
    provider_display_name: Mapped[str] = mapped_column(String(255), nullable=False)
    provider_identifier: Mapped[str] = mapped_column(String(255), nullable=False)
    verified: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    linked_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
