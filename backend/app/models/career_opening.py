from datetime import datetime, timezone

from sqlalchemy import Boolean, DateTime, ForeignKey, Integer, String, Text
from sqlalchemy.orm import Mapped, mapped_column

from app.core.database import Base


class CareerOpening(Base):
    __tablename__ = "career_openings"

    id: Mapped[str] = mapped_column(String(36), primary_key=True)
    opening_code: Mapped[str] = mapped_column(String(6), nullable=False, unique=True, index=True)
    title: Mapped[str] = mapped_column(String(160), nullable=False, index=True)
    department: Mapped[str] = mapped_column(String(120), nullable=False, index=True)
    location: Mapped[str] = mapped_column(String(120), nullable=False)
    work_mode: Mapped[str] = mapped_column(String(60), nullable=False, default="Hybrid")
    employment_type: Mapped[str] = mapped_column(String(60), nullable=False, default="Full-time")
    experience_level: Mapped[str] = mapped_column(String(80), nullable=False, default="Mid Level")
    salary_range: Mapped[str | None] = mapped_column(String(120), nullable=True)
    summary: Mapped[str] = mapped_column(Text, nullable=False)
    responsibilities_json: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
    requirements_json: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
    perks_json: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
    skills_json: Mapped[str] = mapped_column(Text, nullable=False, default="[]")
    seats_open: Mapped[int] = mapped_column(Integer, nullable=False, default=1)
    application_deadline: Mapped[datetime | None] = mapped_column(DateTime(timezone=True), nullable=True)
    is_published: Mapped[bool] = mapped_column(Boolean, nullable=False, default=True)
    is_featured: Mapped[bool] = mapped_column(Boolean, nullable=False, default=False)
    created_by_user_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id"), nullable=True)
    updated_by_user_id: Mapped[str | None] = mapped_column(String(36), ForeignKey("users.id"), nullable=True)
    created_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
    updated_at: Mapped[datetime] = mapped_column(DateTime(timezone=True), nullable=False, default=lambda: datetime.now(timezone.utc))
