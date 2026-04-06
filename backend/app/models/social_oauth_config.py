from datetime import datetime

from sqlalchemy import Boolean, DateTime, String, func
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class SocialOAuthConfig(Base):
    __tablename__ = "social_oauth_configs"

    provider_key: Mapped[str] = mapped_column(String(50), primary_key=True)
    client_id: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    client_secret: Mapped[str] = mapped_column(String(255), nullable=False, default="")
    is_enabled: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, server_default=func.now())
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        server_default=func.now(),
        onupdate=func.now(),
    )
