from sqlalchemy import ForeignKey, String, UniqueConstraint
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class UserSocialLink(Base):
    __tablename__ = "user_social_links"
    __table_args__ = (
        UniqueConstraint("user_id", "provider", name="uq_user_social_links_user_provider"),
        UniqueConstraint("provider", "provider_id", name="uq_user_social_links_provider_provider_id"),
    )

    user_id: Mapped[str] = mapped_column(
        String(36),
        ForeignKey("users.id", ondelete="CASCADE"),
        primary_key=True,
    )
    provider: Mapped[str] = mapped_column(String(50), primary_key=True)
    provider_id: Mapped[str] = mapped_column(String(255), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False)
