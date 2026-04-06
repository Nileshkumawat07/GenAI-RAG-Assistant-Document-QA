from __future__ import annotations

import json
import random
import uuid
from dataclasses import dataclass

from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.models.contact_request import ContactRequest
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
        request = ContactRequest(
            id=str(uuid.uuid4()),
            user_id=user_id,
            category=normalized_category,
            title=title.strip(),
            request_code=self._generate_numeric_code(db),
            status="In Progress",
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
    ) -> ContactRequestPayload:
        normalized_status = self._normalize_status(status)
        if not normalized_status:
            raise ContactRequestServiceError("Invalid request status.")

        request = db.execute(
            select(ContactRequest).where(ContactRequest.id == request_id)
        ).scalar_one_or_none()
        if not request:
            raise ContactRequestServiceError("Contact request was not found.")

        request.status = normalized_status
        request.admin_message = (admin_message or "").strip() or None
        db.commit()
        db.refresh(request)
        user = db.execute(select(User).where(User.id == request.user_id)).scalar_one_or_none()
        return self._serialize(request, user)

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
        return ContactRequestPayload(
            id=request.id,
            user_id=request.user_id,
            category=request.category,
            title=request.title,
            request_code=request.request_code,
            status=self._normalize_status(request.status) or request.status,
            admin_message=request.admin_message,
            values=json.loads(request.payload_json),
            created_at=request.created_at.isoformat(),
            user_full_name=user.full_name if user else None,
            user_email=user.email if user else None,
            user_mobile=user.mobile if user else None,
        )
