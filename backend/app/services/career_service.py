from __future__ import annotations

import json
import random
import uuid
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path

from fastapi import UploadFile
from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.core.config import BASE_DIR
from app.models.career_application import CareerApplication
from app.models.career_application_assignment_history import CareerApplicationAssignmentHistory
from app.models.career_opening import CareerOpening
from app.models.user import User


class CareerServiceError(RuntimeError):
    """Raised when career operations fail for an expected reason."""


@dataclass
class StoredResume:
    filename: str
    path: str


class CareerService:
    OPENING_WORK_MODES = {"Remote", "Hybrid", "On-site"}
    OPENING_EMPLOYMENT_TYPES = {"Full-time", "Part-time", "Contract", "Internship"}
    APPLICATION_STATUS_OPTIONS = (
        "Submitted",
        "In Review",
        "Shortlisted",
        "Interview Scheduled",
        "Offered",
        "Hired",
        "Rejected",
        "Withdrawn",
    )
    STATUS_ALIASES = {
        "submitted": "Submitted",
        "in review": "In Review",
        "in_review": "In Review",
        "shortlisted": "Shortlisted",
        "interview scheduled": "Interview Scheduled",
        "interview_scheduled": "Interview Scheduled",
        "offered": "Offered",
        "hired": "Hired",
        "rejected": "Rejected",
        "withdrawn": "Withdrawn",
    }
    FINAL_STATUSES = {"Offered", "Hired", "Rejected", "Withdrawn"}
    ALLOWED_RESUME_EXTENSIONS = {".pdf", ".doc", ".docx"}
    MAX_RESUME_BYTES = 10 * 1024 * 1024
    def __init__(self) -> None:
        self.resume_dir = (BASE_DIR / "documents" / "career_applications").resolve()
        self.resume_dir.mkdir(parents=True, exist_ok=True)

    def list_public_openings(self, db: Session) -> list[dict]:
        openings = db.execute(
            select(CareerOpening)
            .where(CareerOpening.is_published.is_(True))
            .order_by(CareerOpening.is_featured.desc(), CareerOpening.updated_at.desc())
        ).scalars().all()
        return [self.serialize_opening(item, application_count=self._count_applications(db, item.id)) for item in openings]

    def list_manage_openings(self, db: Session) -> list[dict]:
        openings = db.execute(select(CareerOpening).order_by(CareerOpening.updated_at.desc())).scalars().all()
        return [self.serialize_opening(item, application_count=self._count_applications(db, item.id)) for item in openings]

    def create_opening(self, db: Session, *, acting_user_id: str, payload: dict) -> dict:
        cleaned = self._normalize_opening_payload(payload)
        item = CareerOpening(
            id=str(uuid.uuid4()),
            opening_code=self._generate_unique_code(db, CareerOpening, CareerOpening.opening_code),
            title=cleaned["title"],
            department=cleaned["department"],
            location=cleaned["location"],
            work_mode=cleaned["work_mode"],
            employment_type=cleaned["employment_type"],
            experience_level=cleaned["experience_level"],
            salary_range=cleaned["salary_range"],
            summary=cleaned["summary"],
            responsibilities_json=json.dumps(cleaned["responsibilities"], ensure_ascii=True),
            requirements_json=json.dumps(cleaned["requirements"], ensure_ascii=True),
            perks_json=json.dumps(cleaned["perks"], ensure_ascii=True),
            skills_json=json.dumps(cleaned["skills"], ensure_ascii=True),
            seats_open=cleaned["seats_open"],
            application_deadline=cleaned["application_deadline"],
            is_published=cleaned["is_published"],
            is_featured=cleaned["is_featured"],
            created_by_user_id=acting_user_id,
            updated_by_user_id=acting_user_id,
        )
        db.add(item)
        db.commit()
        db.refresh(item)
        return self.serialize_opening(item, application_count=0)

    def update_opening(self, db: Session, *, opening_id: str, acting_user_id: str, payload: dict) -> dict:
        item = db.get(CareerOpening, opening_id)
        if not item:
            raise CareerServiceError("Career opening was not found.")
        cleaned = self._normalize_opening_payload(payload)
        item.title = cleaned["title"]
        item.department = cleaned["department"]
        item.location = cleaned["location"]
        item.work_mode = cleaned["work_mode"]
        item.employment_type = cleaned["employment_type"]
        item.experience_level = cleaned["experience_level"]
        item.salary_range = cleaned["salary_range"]
        item.summary = cleaned["summary"]
        item.responsibilities_json = json.dumps(cleaned["responsibilities"], ensure_ascii=True)
        item.requirements_json = json.dumps(cleaned["requirements"], ensure_ascii=True)
        item.perks_json = json.dumps(cleaned["perks"], ensure_ascii=True)
        item.skills_json = json.dumps(cleaned["skills"], ensure_ascii=True)
        item.seats_open = cleaned["seats_open"]
        item.application_deadline = cleaned["application_deadline"]
        item.is_published = cleaned["is_published"]
        item.is_featured = cleaned["is_featured"]
        item.updated_by_user_id = acting_user_id
        item.updated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(item)
        return self.serialize_opening(item, application_count=self._count_applications(db, item.id))

    def create_application(
        self,
        db: Session,
        *,
        user_id: str,
        opening_id: str,
        full_name: str,
        email: str,
        mobile: str,
        city: str | None = None,
        current_company: str | None = None,
        current_role: str | None = None,
        total_experience: str | None = None,
        notice_period: str | None = None,
        current_ctc: str | None = None,
        expected_ctc: str | None = None,
        portfolio_url: str | None = None,
        linkedin_url: str | None = None,
        cover_letter: str | None = None,
        resume_upload: UploadFile | None = None,
    ) -> dict:
        self._require_user(db, user_id)
        opening = db.get(CareerOpening, opening_id)
        if not opening or not opening.is_published:
            raise CareerServiceError("This opening is not available for applications.")
        existing = db.execute(
            select(CareerApplication).where(
                CareerApplication.user_id == user_id,
                CareerApplication.opening_id == opening_id,
                CareerApplication.status != "Withdrawn",
            )
        ).scalar_one_or_none()
        if existing:
            raise CareerServiceError("You already applied for this opening.")

        cleaned_full_name = (full_name or "").strip()
        cleaned_email = (email or "").strip()
        cleaned_mobile = (mobile or "").strip()
        if not cleaned_full_name or not cleaned_email or not cleaned_mobile:
            raise CareerServiceError("Full name, email, and mobile are required.")

        stored_resume = self._store_resume(resume_upload) if resume_upload else None
        item = CareerApplication(
            id=str(uuid.uuid4()),
            application_code=self._generate_unique_code(db, CareerApplication, CareerApplication.application_code),
            opening_id=opening.id,
            user_id=user_id,
            full_name=cleaned_full_name,
            email=cleaned_email,
            mobile=cleaned_mobile,
            city=(city or "").strip() or None,
            current_company=(current_company or "").strip() or None,
            current_role=(current_role or "").strip() or None,
            total_experience=(total_experience or "").strip() or None,
            notice_period=(notice_period or "").strip() or None,
            current_ctc=(current_ctc or "").strip() or None,
            expected_ctc=(expected_ctc or "").strip() or None,
            portfolio_url=(portfolio_url or "").strip() or None,
            linkedin_url=(linkedin_url or "").strip() or None,
            cover_letter=(cover_letter or "").strip() or None,
            resume_filename=stored_resume.filename if stored_resume else None,
            resume_path=stored_resume.path if stored_resume else None,
            status="Submitted",
        )
        db.add(item)
        db.commit()
        db.refresh(item)
        return self.serialize_application(item, opening=opening)

    def list_user_applications(self, db: Session, *, user_id: str) -> list[dict]:
        self._require_user(db, user_id)
        rows = db.execute(
            select(CareerApplication, CareerOpening)
            .join(CareerOpening, CareerOpening.id == CareerApplication.opening_id)
            .where(CareerApplication.user_id == user_id)
            .order_by(desc(CareerApplication.created_at))
        ).all()
        return [self.serialize_application(application, opening=opening) for application, opening in rows]

    def withdraw_application(self, db: Session, *, user_id: str, application_id: str) -> dict:
        application = db.execute(
            select(CareerApplication).where(
                CareerApplication.id == application_id,
                CareerApplication.user_id == user_id,
            )
        ).scalar_one_or_none()
        if not application:
            raise CareerServiceError("Application was not found.")
        if application.status == "Withdrawn":
            return self.serialize_application(application, opening=db.get(CareerOpening, application.opening_id))
        if application.status in {"Hired", "Rejected"}:
            raise CareerServiceError("This application can no longer be withdrawn.")
        now = datetime.now(timezone.utc)
        application.status = "Withdrawn"
        application.last_status_updated_at = now
        application.decision_at = now
        db.commit()
        db.refresh(application)
        return self.serialize_application(application, opening=db.get(CareerOpening, application.opening_id))

    def get_management_overview(self, db: Session) -> dict:
        openings = db.execute(select(CareerOpening).order_by(CareerOpening.updated_at.desc())).scalars().all()
        rows = db.execute(
            select(CareerApplication, CareerOpening)
            .join(CareerOpening, CareerOpening.id == CareerApplication.opening_id)
            .where(CareerApplication.status != "Withdrawn")
            .order_by(desc(CareerApplication.created_at))
        ).all()
        users = db.execute(
            select(User).where(User.is_management.is_(True)).order_by(User.full_name.asc())
        ).scalars().all()
        applications = [self.serialize_application(application, opening=opening) for application, opening in rows]
        summary = {
            "totalOpenings": len(openings),
            "liveOpenings": len([item for item in openings if item.is_published]),
            "totalApplications": len(applications),
            "submitted": len([item for item in applications if item["status"] == "Submitted"]),
            "inReview": len([item for item in applications if item["status"] == "In Review"]),
            "shortlisted": len([item for item in applications if item["status"] == "Shortlisted"]),
            "interviewScheduled": len([item for item in applications if item["status"] == "Interview Scheduled"]),
            "offered": len([item for item in applications if item["status"] == "Offered"]),
            "hired": len([item for item in applications if item["status"] == "Hired"]),
            "rejected": len([item for item in applications if item["status"] == "Rejected"]),
        }
        return {
            "summary": summary,
            "openings": [self.serialize_opening(item, application_count=self._count_applications(db, item.id)) for item in openings],
            "applications": applications,
            "managementUsers": [
                {
                    "id": item.id,
                    "fullName": item.full_name,
                    "email": item.email,
                    "username": item.username,
                    "accessSuspended": bool(item.management_access_suspended),
                }
                for item in users
            ],
        }

    def admin_update_application(
        self,
        db: Session,
        *,
        application_id: str,
        acting_user_id: str,
        status: str,
        admin_message: str | None = None,
        assigned_manager_user_id: str | None = None,
    ) -> dict:
        application = db.get(CareerApplication, application_id)
        if not application:
            raise CareerServiceError("Application was not found.")
        if application.status == "Withdrawn":
            raise CareerServiceError("Withdrawn applications are archived and cannot be updated.")

        normalized_status = self._normalize_status(status)
        if not normalized_status:
            raise CareerServiceError("Invalid application status.")

        now = datetime.now(timezone.utc)
        if assigned_manager_user_id is not None:
            previous_manager_user_id = application.assigned_manager_user_id
            if assigned_manager_user_id:
                manager = db.get(User, assigned_manager_user_id)
                if not manager:
                    raise CareerServiceError("Assigned management user was not found.")
                application.assigned_manager_user_id = assigned_manager_user_id
            else:
                application.assigned_manager_user_id = None
            application.assigned_by_user_id = acting_user_id
            application.assigned_at = now
            db.add(
                CareerApplicationAssignmentHistory(
                    id=str(uuid.uuid4()),
                    application_id=application.id,
                    previous_manager_user_id=previous_manager_user_id,
                    next_manager_user_id=application.assigned_manager_user_id,
                    assigned_by_user_id=acting_user_id,
                )
            )

        application.status = normalized_status
        application.admin_message = (admin_message or "").strip() or None
        application.last_status_updated_at = now
        application.last_status_updated_by_user_id = acting_user_id
        if application.first_response_at is None and application.admin_message:
            application.first_response_at = now
        if normalized_status in self.FINAL_STATUSES:
            application.decision_at = now
        elif normalized_status not in self.FINAL_STATUSES:
            application.decision_at = None
        db.commit()
        db.refresh(application)
        return self.serialize_application(application, opening=db.get(CareerOpening, application.opening_id))

    def get_application_resume_path(self, db: Session, *, application_id: str) -> tuple[CareerApplication, Path]:
        application = db.get(CareerApplication, application_id)
        if not application:
            raise CareerServiceError("Application was not found.")
        if not application.resume_path:
            raise CareerServiceError("No resume is attached to this application.")
        resume_path = Path(application.resume_path)
        if not resume_path.exists():
            raise CareerServiceError("Resume file is no longer available.")
        return application, resume_path

    def serialize_opening(self, item: CareerOpening, *, application_count: int = 0) -> dict:
        return {
            "id": item.id,
            "openingCode": item.opening_code,
            "title": item.title,
            "department": item.department,
            "location": item.location,
            "workMode": item.work_mode,
            "employmentType": item.employment_type,
            "experienceLevel": item.experience_level,
            "salaryRange": item.salary_range,
            "summary": item.summary,
            "responsibilities": self._decode_list(item.responsibilities_json),
            "requirements": self._decode_list(item.requirements_json),
            "perks": self._decode_list(item.perks_json),
            "skills": self._decode_list(item.skills_json),
            "seatsOpen": item.seats_open,
            "applicationDeadline": item.application_deadline.isoformat() if item.application_deadline else None,
            "isPublished": bool(item.is_published),
            "isFeatured": bool(item.is_featured),
            "createdAt": item.created_at.isoformat() if item.created_at else None,
            "updatedAt": item.updated_at.isoformat() if item.updated_at else None,
            "totalApplications": application_count,
        }

    def serialize_application(self, item: CareerApplication, *, opening: CareerOpening | None = None) -> dict:
        opening_title = opening.title if opening else "Unknown Opening"
        opening_department = opening.department if opening else ""
        opening_location = opening.location if opening else ""
        manager_name = None
        manager_email = None
        session = getattr(item, "_sa_instance_state", None).session if hasattr(item, "_sa_instance_state") else None
        if item.assigned_manager_user_id and session is not None:
            manager = session.get(User, item.assigned_manager_user_id)
            if manager:
                manager_name = manager.full_name
                manager_email = manager.email
        return {
            "id": item.id,
            "applicationCode": item.application_code,
            "openingId": item.opening_id,
            "openingTitle": opening_title,
            "openingDepartment": opening_department,
            "openingLocation": opening_location,
            "fullName": item.full_name,
            "email": item.email,
            "mobile": item.mobile,
            "city": item.city,
            "currentCompany": item.current_company,
            "currentRole": item.current_role,
            "totalExperience": item.total_experience,
            "noticePeriod": item.notice_period,
            "currentCtc": item.current_ctc,
            "expectedCtc": item.expected_ctc,
            "portfolioUrl": item.portfolio_url,
            "linkedinUrl": item.linkedin_url,
            "coverLetter": item.cover_letter,
            "resumeFilename": item.resume_filename,
            "hasResume": bool(item.resume_path),
            "status": item.status,
            "adminMessage": item.admin_message,
            "assignedManagerUserId": item.assigned_manager_user_id,
            "assignedManagerName": manager_name,
            "assignedManagerEmail": manager_email,
            "assignedAt": item.assigned_at.isoformat() if item.assigned_at else None,
            "firstResponseAt": item.first_response_at.isoformat() if item.first_response_at else None,
            "decisionAt": item.decision_at.isoformat() if item.decision_at else None,
            "lastStatusUpdatedAt": item.last_status_updated_at.isoformat() if item.last_status_updated_at else None,
            "createdAt": item.created_at.isoformat() if item.created_at else None,
        }

    def _normalize_opening_payload(self, payload: dict) -> dict:
        title = (payload.get("title") or "").strip()
        department = (payload.get("department") or "").strip()
        location = (payload.get("location") or "").strip()
        work_mode = (payload.get("workMode") or payload.get("work_mode") or "").strip() or "Hybrid"
        employment_type = (payload.get("employmentType") or payload.get("employment_type") or "").strip() or "Full-time"
        experience_level = (payload.get("experienceLevel") or payload.get("experience_level") or "").strip() or "Mid Level"
        summary = (payload.get("summary") or "").strip()
        if not title or not department or not location or not summary:
            raise CareerServiceError("Title, department, location, and summary are required.")
        if work_mode not in self.OPENING_WORK_MODES:
            raise CareerServiceError("Choose a valid work mode.")
        if employment_type not in self.OPENING_EMPLOYMENT_TYPES:
            raise CareerServiceError("Choose a valid employment type.")
        seats_open = int(payload.get("seatsOpen") or payload.get("seats_open") or 1)
        if seats_open < 1:
            raise CareerServiceError("Seats open must be at least 1.")
        deadline_raw = (payload.get("applicationDeadline") or payload.get("application_deadline") or "").strip()
        application_deadline = None
        if deadline_raw:
            try:
                application_deadline = datetime.fromisoformat(deadline_raw.replace("Z", "+00:00"))
            except ValueError as exc:
                raise CareerServiceError("Application deadline is invalid.") from exc
        return {
            "title": title,
            "department": department,
            "location": location,
            "work_mode": work_mode,
            "employment_type": employment_type,
            "experience_level": experience_level,
            "salary_range": (payload.get("salaryRange") or payload.get("salary_range") or "").strip() or None,
            "summary": summary,
            "responsibilities": self._clean_string_list(payload.get("responsibilities")),
            "requirements": self._clean_string_list(payload.get("requirements")),
            "perks": self._clean_string_list(payload.get("perks")),
            "skills": self._clean_string_list(payload.get("skills")),
            "seats_open": seats_open,
            "application_deadline": application_deadline,
            "is_published": bool(payload.get("isPublished", payload.get("is_published", True))),
            "is_featured": bool(payload.get("isFeatured", payload.get("is_featured", False))),
        }

    def _store_resume(self, upload: UploadFile) -> StoredResume:
        filename = (upload.filename or "").strip()
        if not filename:
            raise CareerServiceError("Resume filename is missing.")
        extension = Path(filename).suffix.lower()
        if extension not in self.ALLOWED_RESUME_EXTENSIONS:
            raise CareerServiceError("Resume must be a PDF, DOC, or DOCX file.")
        destination = self.resume_dir / f"{uuid.uuid4()}{extension}"
        total_size = 0
        with destination.open("wb") as buffer:
            while True:
                chunk = upload.file.read(1024 * 1024)
                if not chunk:
                    break
                total_size += len(chunk)
                if total_size > self.MAX_RESUME_BYTES:
                    buffer.close()
                    destination.unlink(missing_ok=True)
                    raise CareerServiceError("Resume must be smaller than 10 MB.")
                buffer.write(chunk)
        upload.file.close()
        return StoredResume(filename=filename, path=str(destination))

    def _generate_unique_code(self, db: Session, model, field) -> str:
        for _ in range(40):
            code = f"{random.randint(0, 999999):06d}"
            exists = db.execute(select(model.id).where(field == code)).scalar_one_or_none()
            if not exists:
                return code
        raise CareerServiceError("Unable to generate a short code right now.")

    def _count_applications(self, db: Session, opening_id: str) -> int:
        return len(
            db.execute(
                select(CareerApplication.id).where(
                    CareerApplication.opening_id == opening_id,
                    CareerApplication.status != "Withdrawn",
                )
            ).scalars().all()
        )

    def _require_user(self, db: Session, user_id: str) -> None:
        exists = db.execute(select(User.id).where(User.id == user_id)).scalar_one_or_none()
        if not exists:
            raise CareerServiceError("User account was not found.")

    def _normalize_status(self, status: str) -> str | None:
        cleaned = (status or "").strip()
        if cleaned in self.APPLICATION_STATUS_OPTIONS:
            return cleaned
        return self.STATUS_ALIASES.get(cleaned.lower())

    @staticmethod
    def _clean_string_list(values) -> list[str]:
        if not isinstance(values, list):
            return []
        return [str(item).strip() for item in values if str(item).strip()]

    @staticmethod
    def _decode_list(raw_value: str) -> list[str]:
        try:
            payload = json.loads(raw_value or "[]")
        except json.JSONDecodeError:
            return []
        if not isinstance(payload, list):
            return []
        return [str(item).strip() for item in payload if str(item).strip()]
