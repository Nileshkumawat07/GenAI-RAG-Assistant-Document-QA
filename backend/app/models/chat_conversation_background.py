from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class ChatConversationBackground(Base):
    __tablename__ = "chat_conversation_backgrounds"
    __table_args__ = (
        UniqueConstraint("conversation_type", "conversation_key", name="uq_chat_conversation_background_key"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    conversation_type: Mapped[str] = mapped_column(String(40), nullable=False, index=True)
    conversation_key: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    created_by_user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    file_name: Mapped[str] = mapped_column(String(255), nullable=False)
    mime_type: Mapped[str | None] = mapped_column(String(120), nullable=True)
    storage_path: Mapped[str] = mapped_column(String(600), nullable=False)
    background_url: Mapped[str] = mapped_column(String(600), nullable=False)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    updated_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
