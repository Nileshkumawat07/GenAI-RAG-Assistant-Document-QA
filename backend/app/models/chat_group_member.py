from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class ChatGroupMember(Base):
    __tablename__ = "chat_group_members"
    __table_args__ = (
        UniqueConstraint("group_id", "user_id", name="uq_chat_group_member_group_user"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    group_id: Mapped[str] = mapped_column(String(36), ForeignKey("chat_groups.id"), nullable=False, index=True)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    role: Mapped[str] = mapped_column(String(40), nullable=False, default="member")
    is_muted: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    added_by_user_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id"), nullable=True)
    joined_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
    last_read_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
