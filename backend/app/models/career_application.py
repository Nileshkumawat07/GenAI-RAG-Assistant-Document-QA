from datetime import datetime, timezone

from sqlalchemy import DateTime, ForeignKey, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class CareerApplication(Base):
    __tablename__ = "career_applications"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    application_code: Mapped[str] = mapped_column(String(6), nullable=False, unique=True, index=True)
    opening_id: Mapped[str] = mapped_column(String(36), ForeignKey("career_openings.id"), nullable=False, index=True)
    user_id: Mapped[str] = mapped_column(String(36), ForeignKey("users.id"), nullable=False, index=True)
    full_name: Mapped[str] = mapped_column(String(160), nullable=False)
    email: Mapped[str] = mapped_column(String(255), nullable=False)
    mobile: Mapped[str] = mapped_column(String(40), nullable=False)
    city: Mapped[str | None] = mapped_column(String(120), nullable=True)
    current_company: Mapped[str | None] = mapped_column(String(160), nullable=True)
    current_role: Mapped[str | None] = mapped_column(String(160), nullable=True)
    total_experience: Mapped[str | None] = mapped_column(String(80), nullable=True)
    notice_period: Mapped[str | None] = mapped_column(String(80), nullable=True)
    current_ctc: Mapped[str | None] = mapped_column(String(80), nullable=True)
    expected_ctc: Mapped[str | None] = mapped_column(String(80), nullable=True)
    portfolio_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    linkedin_url: Mapped[str | None] = mapped_column(String(500), nullable=True)
    cover_letter: Mapped[str | None] = mapped_column(Text, nullable=True)
    resume_filename: Mapped[str | None] = mapped_column(String(255), nullable=True)
    resume_path: Mapped[str | None] = mapped_column(String(500), nullable=True)
    status: Mapped[str] = mapped_column(String(60), nullable=False, default="Submitted", index=True)
    admin_message: Mapped[str | None] = mapped_column(Text, nullable=True)
    assigned_manager_user_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id"), nullable=True, index=True)
    assigned_by_user_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id"), nullable=True)
    assigned_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    first_response_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    decision_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_status_updated_at: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    last_status_updated_by_user_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc), index=True)
