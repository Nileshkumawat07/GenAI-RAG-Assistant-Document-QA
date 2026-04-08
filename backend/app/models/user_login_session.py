from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, ForeignKey, String
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class UserLoginSession(Base):
    __tablename__ = "user_login_sessions"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    token_id: Mapped[str] = mapped_column(String(64), nullable=False, unique=True, index=True)
    device_label: Mapped[str] = mapped_column(String(160), nullable=False, default="Unknown device")
    device_type: Mapped[str] = mapped_column(String(40), nullable=False, default="desktop")
    browser_name: Mapped[str | None] = mapped_column(String(80), nullable=True)
    os_name: Mapped[str | None] = mapped_column(String(80), nullable=True)
    user_agent: Mapped[str | None] = mapped_column(String(500), nullable=True)
    ip_address: Mapped[str | None] = mapped_column(String(80), nullable=True)
    location_label: Mapped[str | None] = mapped_column(String(120), nullable=True)
    remember_device: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    trusted: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    is_revoked: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    last_seen_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    revoked_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
