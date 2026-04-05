from __future__ import annotations

import json
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
    values: dict[str, str]
    created_at: str


class ContactRequestService:
    CATEGORY_PREFIX = {
        "general": "INQ",
        "business": "BUS",
        "technical": "TKT",
        "partnership": "PRO",
        "media": "MPR",
    }

    STATUS_OPTIONS = {"Submitted", "In Review", "In Process", "Closed"}

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
            request_code=self._build_request_code(normalized_category),
            status="Submitted",
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

    def delete_request(self, db: Session, *, user_id: str, request_id: str) -> None:
        request = self._require_request(db, user_id, request_id)
        db.delete(request)
        db.commit()

    def update_status(self, db: Session, *, user_id: str, request_id: str, status: str) -> ContactRequestPayload:
        if status not in self.STATUS_OPTIONS:
            raise ContactRequestServiceError("Invalid request status.")

        request = self._require_request(db, user_id, request_id)
        request.status = status
        db.commit()
        db.refresh(request)
        return self._serialize(request)

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

        return f"{prefix}-{uuid.uuid4().hex[:8].upper()}"

    def _serialize(self, request: ContactRequest) -> ContactRequestPayload:
        return ContactRequestPayload(
            id=request.id,
            user_id=request.user_id,
            category=request.category,
            title=request.title,
            request_code=request.request_code,
            status=request.status,
            values=json.loads(request.payload_json),
            created_at=request.created_at.isoformat(),
        )
