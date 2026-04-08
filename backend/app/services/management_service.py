from __future__ import annotations

import uuid
from datetime import datetime, timezone

from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.models.admin_audit_log import AdminAuditLog
from app.models.contact_request import ContactRequest
from app.models.management_note import ManagementNote
from app.models.reply_template import ReplyTemplate
from app.models.user import User
from app.services.auth_service import AuthService


class ManagementServiceError(RuntimeError):
    """Raised when management operations fail for an expected reason."""


class ManagementService:
    DEFAULT_TEMPLATES = [
        (
            "Need More Details",
            "general",
            "Thanks for reaching out. Please share any missing details so we can review and update your request quickly.",
        ),
        (
            "Issue In Review",
            "technical",
            "Your request is now in review with our management team. We will share the next update after validation is complete.",
        ),
        (
            "Completed Successfully",
            "business",
            "This request has been completed from our side. If you need any follow-up help, reply here and we will continue the conversation.",
        ),
    ]

    def __init__(self, auth_service: AuthService) -> None:
        self.auth_service = auth_service

    def ensure_default_reply_templates(self, db: Session) -> None:
        existing_count = db.execute(select(ReplyTemplate.id)).scalars().first()
        if existing_count:
            return
        now = datetime.now(timezone.utc)
        for title, category, body in self.DEFAULT_TEMPLATES:
            db.add(
                ReplyTemplate(
                    id=str(uuid.uuid4()),
                    title=title,
                    category=category,
                    body=body,
                    is_active=True,
                    created_at=now,
                    updated_at=now,
                )
            )
        db.commit()

    def get_overview(self, db: Session) -> dict:
        users = db.execute(select(User).order_by(User.created_at.desc())).scalars().all()
        requests = db.execute(select(ContactRequest).order_by(desc(ContactRequest.created_at))).scalars().all()
        notes = db.execute(select(ManagementNote).order_by(desc(ManagementNote.created_at)).limit(300)).scalars().all()
        templates = db.execute(
            select(ReplyTemplate).where(ReplyTemplate.is_active.is_(True)).order_by(ReplyTemplate.title.asc())
        ).scalars().all()
        actions = db.execute(
            select(AdminAuditLog).order_by(desc(AdminAuditLog.created_at)).limit(250)
        ).scalars().all()

        user_lookup = {user.id: user for user in users}
        request_rows = [self.serialize_request(item, user_lookup=user_lookup) for item in requests]
        management_users = [self.serialize_management_user(user, requests, user_lookup) for user in users if user.is_management]
        activity_dashboard = [
            self.serialize_activity_item(user, requests)
            for user in users
            if user.is_management and not user.management_access_suspended
        ]

        now = datetime.now(timezone.utc)
        today_start = now.replace(hour=0, minute=0, second=0, microsecond=0)

        summary = {
            "totalManagementUsers": len([user for user in users if user.is_management and not user.management_access_suspended]),
            "openRequests": len([item for item in requests if (item.status or "In Progress") == "In Progress"]),
            "inReviewRequests": len([item for item in requests if (item.status or "") == "In Review"]),
            "completedToday": len(
                [
                    item
                    for item in requests
                    if item.completed_at and self._ensure_utc(item.completed_at) >= today_start
                ]
            ),
        }

        return {
            "summary": summary,
            "managementUsers": management_users,
            "requests": request_rows,
            "notes": [self.serialize_note(item, user_lookup=user_lookup) for item in notes],
            "replyTemplates": [self.serialize_reply_template(item) for item in templates],
            "recentActions": [self.serialize_action(item) for item in actions],
            "activityDashboard": activity_dashboard,
        }

    def create_note(
        self,
        db: Session,
        *,
        author_user_id: str,
        note_text: str,
        request_id: str | None = None,
        target_user_id: str | None = None,
    ) -> ManagementNote:
        cleaned_text = (note_text or "").strip()
        if not cleaned_text:
            raise ManagementServiceError("Note text is required.")
        if not request_id and not target_user_id:
            raise ManagementServiceError("Attach the note to a request or a user.")
        if request_id:
            request_item = db.get(ContactRequest, request_id)
            if not request_item:
                raise ManagementServiceError("Request was not found for this note.")
        if target_user_id:
            user = db.get(User, target_user_id)
            if not user:
                raise ManagementServiceError("User was not found for this note.")

        item = ManagementNote(
            id=str(uuid.uuid4()),
            author_user_id=author_user_id,
            request_id=request_id,
            target_user_id=target_user_id,
            note_text=cleaned_text,
        )
        db.add(item)
        db.commit()
        db.refresh(item)
        return item

    def create_reply_template(
        self,
        db: Session,
        *,
        created_by_user_id: str,
        title: str,
        category: str | None,
        body: str,
    ) -> ReplyTemplate:
        cleaned_title = (title or "").strip()
        cleaned_body = (body or "").strip()
        if not cleaned_title:
            raise ManagementServiceError("Template title is required.")
        if not cleaned_body:
            raise ManagementServiceError("Template body is required.")

        now = datetime.now(timezone.utc)
        item = ReplyTemplate(
            id=str(uuid.uuid4()),
            title=cleaned_title,
            category=(category or "").strip().lower() or None,
            body=cleaned_body,
            created_by_user_id=created_by_user_id,
            is_active=True,
            created_at=now,
            updated_at=now,
        )
        db.add(item)
        db.commit()
        db.refresh(item)
        return item

    def get_reply_template(self, db: Session, *, template_id: str) -> ReplyTemplate:
        item = db.get(ReplyTemplate, template_id)
        if not item or not item.is_active:
            raise ManagementServiceError("Reply template was not found.")
        return item

    def list_report_rows(self, db: Session) -> list[dict]:
        overview = self.get_overview(db)
        rows: list[dict] = []
        for user in overview["managementUsers"]:
            rows.append(
                {
                    "rowType": "manager",
                    "managerName": user["fullName"],
                    "managerEmail": user["email"],
                    "accessStatus": "Suspended" if user["accessSuspended"] else "Active",
                    "grantedAt": user["managementGrantedAt"],
                    "grantedBy": user["managementGrantedByName"],
                    "handledRequests": user["handledRequestCount"],
                    "pendingAssigned": user["pendingAssignedCount"],
                    "averageResponseMinutes": user["averageResponseMinutes"],
                }
            )
        for request in overview["requests"]:
            rows.append(
                {
                    "rowType": "request",
                    "requestCode": request["requestCode"],
                    "title": request["title"],
                    "category": request["category"],
                    "status": request["status"],
                    "userFullName": request["userFullName"],
                    "userEmail": request["userEmail"],
                    "assignedManagerName": request["assignedManagerName"],
                    "assignedAt": request["assignedAt"],
                    "completedAt": request["completedAt"],
                }
            )
        return rows

    def serialize_request(self, request: ContactRequest, *, user_lookup: dict[str, User]) -> dict:
        requester = user_lookup.get(request.user_id)
        assigned_manager = user_lookup.get(request.assigned_manager_user_id) if request.assigned_manager_user_id else None
        return {
            "id": request.id,
            "userId": request.user_id,
            "category": request.category,
            "title": request.title,
            "requestCode": request.request_code,
            "status": request.status,
            "adminMessage": request.admin_message,
            "assignedManagerUserId": request.assigned_manager_user_id,
            "assignedManagerName": assigned_manager.full_name if assigned_manager else None,
            "assignedManagerEmail": assigned_manager.email if assigned_manager else None,
            "assignedByUserId": request.assigned_by_user_id,
            "assignedAt": request.assigned_at.isoformat() if request.assigned_at else None,
            "firstResponseAt": request.first_response_at.isoformat() if request.first_response_at else None,
            "completedAt": request.completed_at.isoformat() if request.completed_at else None,
            "lastStatusUpdatedAt": request.last_status_updated_at.isoformat() if request.last_status_updated_at else None,
            "lastStatusUpdatedByUserId": request.last_status_updated_by_user_id,
            "values": self._deserialize_values(request.payload_json),
            "createdAt": request.created_at.isoformat() if request.created_at else None,
            "userFullName": requester.full_name if requester else None,
            "userEmail": requester.email if requester else None,
            "userMobile": requester.mobile if requester else None,
        }

    def serialize_management_user(self, user: User, requests: list[ContactRequest], user_lookup: dict[str, User]) -> dict:
        assigned_requests = [item for item in requests if item.assigned_manager_user_id == user.id]
        handled_requests = [item for item in assigned_requests if (item.status or "") == "Completed"]
        response_minutes = [
            (self._ensure_utc(item.first_response_at) - self._ensure_utc(item.created_at)).total_seconds() / 60
            for item in assigned_requests
            if item.first_response_at and item.created_at
        ]
        granted_by = user_lookup.get(user.management_granted_by_user_id) if user.management_granted_by_user_id else None
        suspended_by = user_lookup.get(user.management_suspended_by_user_id) if user.management_suspended_by_user_id else None
        last_action_times = [
            self._ensure_utc(item.last_status_updated_at)
            for item in assigned_requests
            if item.last_status_updated_at
        ]
        return {
            "id": user.id,
            "publicUserCode": user.public_user_code,
            "fullName": user.full_name,
            "username": user.username,
            "email": user.email,
            "mobile": user.mobile,
            "isManagement": bool(user.is_management),
            "accessSuspended": bool(user.management_access_suspended),
            "managementGrantedAt": user.management_granted_at.isoformat() if user.management_granted_at else None,
            "managementGrantedByUserId": user.management_granted_by_user_id,
            "managementGrantedByName": granted_by.full_name if granted_by else None,
            "managementSuspendedAt": user.management_suspended_at.isoformat() if user.management_suspended_at else None,
            "managementSuspendedByUserId": user.management_suspended_by_user_id,
            "managementSuspendedByName": suspended_by.full_name if suspended_by else None,
            "requestCount": len(assigned_requests),
            "handledRequestCount": len(handled_requests),
            "pendingAssignedCount": len([item for item in assigned_requests if (item.status or "") != "Completed"]),
            "averageResponseMinutes": round(sum(response_minutes) / len(response_minutes), 2) if response_minutes else None,
            "lastActionAt": max(last_action_times).isoformat() if last_action_times else None,
        }

    def serialize_note(self, note: ManagementNote, *, user_lookup: dict[str, User]) -> dict:
        author = user_lookup.get(note.author_user_id)
        return {
            "id": note.id,
            "authorUserId": note.author_user_id,
            "authorName": author.full_name if author else None,
            "requestId": note.request_id,
            "targetUserId": note.target_user_id,
            "noteText": note.note_text,
            "createdAt": note.created_at.isoformat() if note.created_at else None,
        }

    def serialize_reply_template(self, item: ReplyTemplate) -> dict:
        return {
            "id": item.id,
            "title": item.title,
            "category": item.category,
            "body": item.body,
            "isActive": bool(item.is_active),
            "createdByUserId": item.created_by_user_id,
            "createdAt": item.created_at.isoformat() if item.created_at else None,
            "updatedAt": item.updated_at.isoformat() if item.updated_at else None,
        }

    def serialize_action(self, item: AdminAuditLog) -> dict:
        return {
            "id": item.id,
            "actorUserId": item.admin_user_id,
            "actorName": item.admin_name,
            "actorEmail": item.admin_email,
            "actionType": item.action_type,
            "targetType": item.target_type,
            "targetId": item.target_id,
            "targetLabel": item.target_label,
            "detail": item.detail,
            "createdAt": item.created_at.isoformat() if item.created_at else None,
        }

    def serialize_activity_item(self, user: User, requests: list[ContactRequest]) -> dict:
        assigned_requests = [item for item in requests if item.assigned_manager_user_id == user.id]
        completed_today = 0
        today_start = datetime.now(timezone.utc).replace(hour=0, minute=0, second=0, microsecond=0)
        for item in assigned_requests:
            if item.completed_at and self._ensure_utc(item.completed_at) >= today_start:
                completed_today += 1
        response_minutes = [
            (self._ensure_utc(item.first_response_at) - self._ensure_utc(item.created_at)).total_seconds() / 60
            for item in assigned_requests
            if item.first_response_at and item.created_at
        ]
        return {
            "managerUserId": user.id,
            "managerName": user.full_name,
            "handledRequests": len([item for item in assigned_requests if (item.status or "") == "Completed"]),
            "pendingQueue": len([item for item in assigned_requests if (item.status or "") != "Completed"]),
            "averageResponseMinutes": round(sum(response_minutes) / len(response_minutes), 2) if response_minutes else None,
            "completedToday": completed_today,
        }

    @staticmethod
    def _deserialize_values(payload_json: str) -> dict:
        import json

        return json.loads(payload_json)

    @staticmethod
    def _ensure_utc(value: datetime) -> datetime:
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value

