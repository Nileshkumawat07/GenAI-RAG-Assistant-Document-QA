from __future__ import annotations

import json
import random
import uuid
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone

from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.models.contact_request import ContactRequest
from app.models.request_assignment_history import RequestAssignmentHistory
from app.models.user import User


class ContactRequestServiceError(RuntimeError):
    """Raised when contact request operations fail for an expected reason."""


@dataclass
class ContactRequestPayload:
    id: str
    user_id: str
    category: str
    title: str
    request_code: str | None
    status: str
    admin_message: str | None
    assigned_manager_user_id: str | None
    assigned_manager_name: str | None
    assigned_manager_email: str | None
    assigned_by_user_id: str | None
    assigned_at: str | None
    first_response_at: str | None
    completed_at: str | None
    last_status_updated_at: str | None
    last_status_updated_by_user_id: str | None
    values: dict[str, str]
    created_at: str
    user_full_name: str | None = None
    user_email: str | None = None
    user_mobile: str | None = None


class ContactRequestService:
    CATEGORY_PREFIX = {
        "general": "INQ",
        "business": "BUS",
        "technical": "TKT",
        "partnership": "PRO",
        "media": "MPR",
    }

    STATUS_OPTIONS = ("In Progress", "In Review", "Completed")
    STATUS_ALIASES = {
        "submitted": "In Progress",
        "in process": "In Progress",
        "in_progress": "In Progress",
        "in-progress": "In Progress",
        "in review": "In Review",
        "in_review": "In Review",
        "in-review": "In Review",
        "closed": "Completed",
        "complete": "Completed",
        "completed": "Completed",
    }

    def create_request(
        self,
        db: Session,
        *,
        user_id: str,
        category: str,
        title: str,
        values: dict[str, str],
    ) -> ContactRequestPayload:
        self._require_user(db, user_id)

        normalized_category = category.strip().lower()
        due_hours = 6 if normalized_category == "technical" else 24
        request = ContactRequest(
            id=str(uuid.uuid4()),
            user_id=user_id,
            category=normalized_category,
            title=title.strip(),
            request_code=self._generate_numeric_code(db),
            status="In Progress",
            priority_score=90 if normalized_category == "technical" else 75 if normalized_category == "business" else 60,
            due_at=datetime.now(timezone.utc) + timedelta(hours=due_hours),
            queue_owner="technical" if normalized_category == "technical" else "general",
            source_channel="web",
            payload_json=json.dumps(values),
        )
        db.add(request)
        db.commit()
        db.refresh(request)
        return self._serialize(request)

    def list_requests(self, db: Session, *, user_id: str) -> list[ContactRequestPayload]:
        self._require_user(db, user_id)
        requests = db.execute(
            select(ContactRequest)
            .where(ContactRequest.user_id == user_id)
            .order_by(desc(ContactRequest.created_at))
        ).scalars().all()
        return [self._serialize(item) for item in requests]

    def list_all_requests(self, db: Session) -> list[ContactRequestPayload]:
        records = db.execute(
            select(ContactRequest, User)
            .join(User, User.id == ContactRequest.user_id)
            .order_by(desc(ContactRequest.created_at))
        ).all()
        return [self._serialize(request, user) for request, user in records]

    def delete_request(self, db: Session, *, user_id: str, request_id: str) -> None:
        request = self._require_request(db, user_id, request_id)
        db.delete(request)
        db.commit()

    def admin_delete_request(self, db: Session, *, request_id: str) -> None:
        request = db.execute(
            select(ContactRequest).where(ContactRequest.id == request_id)
        ).scalar_one_or_none()
        if not request:
            raise ContactRequestServiceError("Contact request was not found.")
        db.delete(request)
        db.commit()

    def update_status(self, db: Session, *, user_id: str, request_id: str, status: str) -> ContactRequestPayload:
        normalized_status = self._normalize_status(status)
        if not normalized_status:
            raise ContactRequestServiceError("Invalid request status.")

        request = self._require_request(db, user_id, request_id)
        request.status = normalized_status
        db.commit()
        db.refresh(request)
        return self._serialize(request)

    def admin_update_status(
        self,
        db: Session,
        *,
        request_id: str,
        status: str,
        admin_message: str | None = None,
        acting_user_id: str | None = None,
        assigned_manager_user_id: str | None = None,
    ) -> ContactRequestPayload:
        normalized_status = self._normalize_status(status)
        if not normalized_status:
            raise ContactRequestServiceError("Invalid request status.")

        request = db.execute(
            select(ContactRequest).where(ContactRequest.id == request_id)
        ).scalar_one_or_none()
        if not request:
            raise ContactRequestServiceError("Contact request was not found.")

        now = datetime.now(timezone.utc)
        if assigned_manager_user_id is not None:
            if assigned_manager_user_id:
                manager = db.execute(select(User).where(User.id == assigned_manager_user_id)).scalar_one_or_none()
                if not manager:
                    raise ContactRequestServiceError("Assigned management user was not found.")
                previous_manager_user_id = request.assigned_manager_user_id
                request.assigned_manager_user_id = assigned_manager_user_id
                request.assigned_by_user_id = acting_user_id
                request.assigned_at = now
                db.add(
                    RequestAssignmentHistory(
                        id=str(uuid.uuid4()),
                        request_id=request.id,
                        previous_manager_user_id=previous_manager_user_id,
                        next_manager_user_id=assigned_manager_user_id,
                        assigned_by_user_id=acting_user_id,
                    )
                )
            else:
                previous_manager_user_id = request.assigned_manager_user_id
                request.assigned_manager_user_id = None
                request.assigned_by_user_id = acting_user_id
                request.assigned_at = now
                db.add(
                    RequestAssignmentHistory(
                        id=str(uuid.uuid4()),
                        request_id=request.id,
                        previous_manager_user_id=previous_manager_user_id,
                        next_manager_user_id=None,
                        assigned_by_user_id=acting_user_id,
                    )
                )

        request.status = normalized_status
        request.admin_message = (admin_message or "").strip() or None
        request.last_status_updated_at = now
        request.last_status_updated_by_user_id = acting_user_id
        if request.first_response_at is None and request.admin_message:
            request.first_response_at = now
        if normalized_status == "Completed":
            request.completed_at = now
        elif request.completed_at is not None:
            request.completed_at = None
        db.commit()
        db.refresh(request)
        return self._serialize(request)

    def bulk_update_status(
        self,
        db: Session,
        *,
        request_ids: list[str],
        status: str,
        acting_user_id: str | None = None,
    ) -> list[ContactRequestPayload]:
        normalized_status = self._normalize_status(status)
        if not normalized_status:
            raise ContactRequestServiceError("Invalid request status.")
        if not request_ids:
            raise ContactRequestServiceError("Select at least one request.")

        items = db.execute(
            select(ContactRequest).where(ContactRequest.id.in_(request_ids))
        ).scalars().all()
        if not items:
            return []

        now = datetime.now(timezone.utc)
        for request in items:
            request.status = normalized_status
            request.last_status_updated_at = now
            request.last_status_updated_by_user_id = acting_user_id
            if normalized_status == "Completed":
                request.completed_at = now
            elif request.completed_at is not None:
                request.completed_at = None
        db.commit()
        return [self._serialize(item) for item in items]

    def _require_user(self, db: Session, user_id: str) -> None:
        user = db.execute(select(User.id).where(User.id == user_id)).scalar_one_or_none()
        if not user:
            raise ContactRequestServiceError("User account was not found.")

    def _require_request(self, db: Session, user_id: str, request_id: str) -> ContactRequest:
        request = db.execute(
            select(ContactRequest).where(
                ContactRequest.id == request_id,
                ContactRequest.user_id == user_id,
            )
        ).scalar_one_or_none()
        if not request:
            raise ContactRequestServiceError("Contact request was not found.")
        return request

    def _build_request_code(self, category: str) -> str | None:
        prefix = self.CATEGORY_PREFIX.get(category)
        if not prefix:
            return None

        del prefix
        return self._generate_numeric_code(db=None)

    def _generate_numeric_code(self, db: Session | None) -> str:
        for _ in range(20):
            code = f"{random.randint(0, 999999):06d}"
            if db is None:
                return code
            exists = db.execute(
                select(ContactRequest.id).where(ContactRequest.request_code == code)
            ).scalar_one_or_none()
            if not exists:
                return code
        raise ContactRequestServiceError("Unable to generate a short request code.")

    def _normalize_status(self, status: str) -> str | None:
        normalized = (status or "").strip()
        if not normalized:
            return None

        if normalized in self.STATUS_OPTIONS:
            return normalized

        return self.STATUS_ALIASES.get(normalized.lower())

    def _serialize(self, request: ContactRequest, user: User | None = None) -> ContactRequestPayload:
        db_user = user
        assigned_manager = None
        if hasattr(request, "_sa_instance_state"):
            session = request._sa_instance_state.session
            if db_user is None and session is not None:
                db_user = session.execute(select(User).where(User.id == request.user_id)).scalar_one_or_none()
            if request.assigned_manager_user_id and session is not None:
                assigned_manager = session.execute(
                    select(User).where(User.id == request.assigned_manager_user_id)
                ).scalar_one_or_none()

        return ContactRequestPayload(
            id=request.id,
            user_id=request.user_id,
            category=request.category,
            title=request.title,
            request_code=request.request_code,
            status=self._normalize_status(request.status) or request.status,
            admin_message=request.admin_message,
            assigned_manager_user_id=request.assigned_manager_user_id,
            assigned_manager_name=assigned_manager.full_name if assigned_manager else None,
            assigned_manager_email=assigned_manager.email if assigned_manager else None,
            assigned_by_user_id=request.assigned_by_user_id,
            assigned_at=request.assigned_at.isoformat() if request.assigned_at else None,
            first_response_at=request.first_response_at.isoformat() if request.first_response_at else None,
            completed_at=request.completed_at.isoformat() if request.completed_at else None,
            last_status_updated_at=request.last_status_updated_at.isoformat() if request.last_status_updated_at else None,
            last_status_updated_by_user_id=request.last_status_updated_by_user_id,
            values=json.loads(request.payload_json),
            created_at=request.created_at.isoformat(),
            user_full_name=db_user.full_name if db_user else None,
            user_email=db_user.email if db_user else None,
            user_mobile=db_user.mobile if db_user else None,
        )
