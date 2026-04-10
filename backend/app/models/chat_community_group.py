from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class ChatCommunityGroup(Base):
    __tablename__ = "chat_community_groups"
    __table_args__ = (
        UniqueConstraint("community_id", "group_id", name="uq_chat_community_group_pair"),
    )

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    community_id: Mapped[str] = mapped_column(String(36), ForeignKey("chat_communities.id"), nullable=False, index=True)
    group_id: Mapped[str] = mapped_column(String(36), ForeignKey("chat_groups.id"), nullable=False, index=True)
    created_at: Mapped[datetime] = mapped_column(
        DateTime(timezone=True),
        nullable=False,
        default=lambda: datetime.now(timezone.utc),
    )
