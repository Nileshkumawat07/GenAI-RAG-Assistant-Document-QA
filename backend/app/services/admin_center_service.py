from __future__ import annotations

import json
import uuid
from datetime import datetime, timedelta, timezone
from pathlib import Path

from sqlalchemy import desc, inspect, select, text
from sqlalchemy.orm import Session

from app.core.database import engine
from app.models.admin_audit_log import AdminAuditLog
from app.models.admin_notification import AdminNotification
from app.models.admin_role import AdminPermission, AdminRole, AdminRolePermission, UserRoleAssignment
from app.models.automation_rule import AutomationRule
from app.models.billing_note import BillingNote
from app.models.communication import CommunicationLog, CommunicationTemplate
from app.models.contact_request import ContactRequest
from app.models.content_entry import ContentEntry
from app.models.management_note import ManagementNote
from app.models.report_preset import ReportPreset
from app.models.request_assignment_history import RequestAssignmentHistory
from app.models.security_event import SecurityEvent
from app.models.subscription_transaction import SubscriptionTransaction
from app.models.user import User
from app.models.user_archive import UserArchive
from app.services.auth_service import AuthService


class AdminCenterServiceError(RuntimeError):
    """Raised when admin center operations fail for an expected reason."""


class AdminCenterService:
    SYSTEM_ROLES = {
        "support": ["requests.view", "requests.update", "communications.view"],
        "billing": ["billing.view", "billing.update", "reports.view"],
        "ops": ["operations.view", "database.query", "notifications.view"],
        "auditor": ["audit.view", "security.view", "reports.view"],
    }

    def __init__(self, auth_service: AuthService) -> None:
        self.auth_service = auth_service

    def ensure_seed_data(self, db: Session) -> None:
        self._seed_roles_and_permissions(db)
        self._seed_notifications(db)
        self._seed_content_entries(db)
        self._seed_communication_templates(db)
        self._seed_automation_rules(db)
        self._seed_report_presets(db)
        self._seed_security_events(db)

    def get_overview(self, db: Session) -> dict:
        users = db.execute(select(User).order_by(User.created_at.desc())).scalars().all()
        requests = db.execute(select(ContactRequest).order_by(desc(ContactRequest.created_at))).scalars().all()
        transactions = db.execute(select(SubscriptionTransaction).order_by(desc(SubscriptionTransaction.created_at))).scalars().all()
        roles = db.execute(select(AdminRole).order_by(AdminRole.name.asc())).scalars().all()
        permissions = db.execute(select(AdminPermission).order_by(AdminPermission.key.asc())).scalars().all()
        assignments = db.execute(select(UserRoleAssignment)).scalars().all()
        notes = db.execute(select(ManagementNote).order_by(desc(ManagementNote.created_at)).limit(200)).scalars().all()
        audit_logs = db.execute(select(AdminAuditLog).order_by(desc(AdminAuditLog.created_at)).limit(200)).scalars().all()
        notifications = db.execute(select(AdminNotification).order_by(desc(AdminNotification.created_at)).limit(50)).scalars().all()
        templates = db.execute(select(CommunicationTemplate).order_by(CommunicationTemplate.created_at.desc())).scalars().all()
        comm_logs = db.execute(select(CommunicationLog).order_by(desc(CommunicationLog.created_at)).limit(100)).scalars().all()
        content_entries = db.execute(select(ContentEntry).order_by(ContentEntry.page_key.asc(), ContentEntry.section_key.asc())).scalars().all()
        security_events = db.execute(select(SecurityEvent).order_by(desc(SecurityEvent.created_at)).limit(100)).scalars().all()
        rules = db.execute(select(AutomationRule).order_by(AutomationRule.created_at.desc())).scalars().all()
        report_presets = db.execute(select(ReportPreset).order_by(ReportPreset.created_at.desc())).scalars().all()
        billing_notes = db.execute(select(BillingNote).order_by(desc(BillingNote.created_at)).limit(100)).scalars().all()
        assignment_history = db.execute(select(RequestAssignmentHistory).order_by(desc(RequestAssignmentHistory.assigned_at)).limit(200)).scalars().all()

        role_map = {role.id: role for role in roles}
        user_role_map: dict[str, list[str]] = {}
        for item in assignments:
            role_name = role_map.get(item.role_id).name if role_map.get(item.role_id) else item.role_id
            user_role_map.setdefault(item.user_id, []).append(role_name)

        now = datetime.now(timezone.utc)
        request_by_status = {
            "inProgress": len([item for item in requests if (item.status or "") == "In Progress"]),
            "inReview": len([item for item in requests if (item.status or "") == "In Review"]),
            "completed": len([item for item in requests if (item.status or "") == "Completed"]),
        }
        overdue_queue = [
            item for item in requests
            if item.due_at and self._ensure_utc(item.due_at) < now and (item.status or "") != "Completed"
        ]
        breached = [item for item in requests if item.breached_at and (item.status or "") != "Completed"]
        avg_first_response_minutes = self._avg(
            [
                (self._ensure_utc(item.first_response_at) - self._ensure_utc(item.created_at)).total_seconds() / 60
                for item in requests
                if item.first_response_at and item.created_at
            ]
        )

        category_counts: dict[str, int] = {}
        for item in requests:
            category_counts[item.category or "unknown"] = category_counts.get(item.category or "unknown", 0) + 1

        analytics = {
            "dailyRequests": len([item for item in requests if self._ensure_utc(item.created_at) >= now - timedelta(days=1)]),
            "weeklyRequests": len([item for item in requests if self._ensure_utc(item.created_at) >= now - timedelta(days=7)]),
            "monthlyRequests": len([item for item in requests if self._ensure_utc(item.created_at) >= now - timedelta(days=30)]),
            "categoryHeatmap": [{"category": key, "count": value} for key, value in sorted(category_counts.items())],
            "completionFunnel": {
                "received": len(requests),
                "reviewed": request_by_status["inReview"] + request_by_status["completed"],
                "completed": request_by_status["completed"],
            },
            "subscriptionConversions": {
                "premiumUsers": len([user for user in users if user.subscription_status == "premium"]),
                "freeUsers": len([user for user in users if user.subscription_status != "premium"]),
            },
        }

        return {
            "userAdministration": {
                "users": [self.serialize_user_admin(user, user_role_map.get(user.id, []), requests, transactions, notes, audit_logs) for user in users],
                "archivedUsers": [self.serialize_archive(item) for item in db.execute(select(UserArchive).order_by(desc(UserArchive.created_at)).limit(100)).scalars().all()],
            },
            "rolesAndPermissions": {
                "roles": [self.serialize_role(item, db) for item in roles],
                "permissions": [self.serialize_permission(item) for item in permissions],
                "assignments": [self.serialize_role_assignment(item, role_map) for item in assignments],
            },
            "ticketSlaDashboard": {
                "firstResponseAverageMinutes": avg_first_response_minutes,
                "overdueQueue": [self.serialize_request_brief(item, users) for item in overdue_queue[:50]],
                "breachedQueue": [self.serialize_request_brief(item, users) for item in breached[:50]],
                "agingBuckets": self._build_aging_buckets(requests),
                "escalations": len([item for item in requests if (item.escalation_level or 0) > 0]),
                "statusCounts": request_by_status,
            },
            "assignmentEngine": {
                "managerLoad": self._build_manager_load(users, requests),
                "assignmentHistory": [self.serialize_assignment_history(item, users) for item in assignment_history],
                "queueOwnership": self._build_queue_ownership(requests),
            },
            "advancedAnalytics": analytics,
            "billingAdministration": {
                "transactions": [self.serialize_transaction(item) for item in transactions[:120]],
                "billingNotes": [self.serialize_billing_note(item) for item in billing_notes],
            },
            "communicationHub": {
                "templates": [self.serialize_communication_template(item) for item in templates],
                "logs": [self.serialize_communication_log(item) for item in comm_logs],
            },
            "complianceAndAudit": {
                "auditLogs": [self.serialize_audit_log(item) for item in audit_logs],
                "signedReportReady": True,
                "retentionPolicyDays": 365,
            },
            "systemOperationsPanel": self._build_system_ops_summary(requests=requests, notifications=notifications),
            "contentAndKnowledgeAdmin": {"entries": [self.serialize_content_entry(item) for item in content_entries]},
            "databaseSafetyTools": self._build_database_summary(),
            "abuseAndSecurityControls": {
                "securityEvents": [self.serialize_security_event(item) for item in security_events],
                "lockedUsers": len([user for user in users if user.account_locked]),
                "twoFactorRequiredAdmins": len([user for user in users if user.admin_2fa_required]),
                "flaggedRequests": len([item for item in requests if (item.priority_score or 0) >= 90]),
            },
            "workflowAutomation": {"rules": [self.serialize_automation_rule(item) for item in rules]},
            "adminNotifications": {
                "items": [self.serialize_notification(item) for item in notifications],
                "unreadCount": len([item for item in notifications if not item.is_read]),
            },
            "reportBuilder": {
                "presets": [self.serialize_report_preset(item) for item in report_presets],
                "formats": ["csv", "pdf", "json", "xlsx"],
            },
        }

    def update_user_profile(self, db: Session, *, target_user_id: str, **updates) -> User:
        user = self._require_user(db, target_user_id)
        mapping = {
            "fullName": "full_name",
            "username": "username",
            "email": "email",
            "mobile": "mobile",
            "emailVerified": "email_verified",
            "mobileVerified": "mobile_verified",
            "admin2faRequired": "admin_2fa_required",
        }
        for key, column in mapping.items():
            if key in updates and updates[key] is not None:
                setattr(user, column, updates[key])
        db.commit()
        db.refresh(user)
        return user

    def lock_user(self, db: Session, *, target_user_id: str, actor_user_id: str) -> User:
        user = self._require_user(db, target_user_id)
        user.account_locked = True
        user.locked_at = datetime.now(timezone.utc)
        user.locked_by_user_id = actor_user_id
        db.commit()
        db.refresh(user)
        return user

    def reactivate_user(self, db: Session, *, target_user_id: str, actor_user_id: str) -> User:
        user = self._require_user(db, target_user_id)
        user.account_locked = False
        user.reactivated_at = datetime.now(timezone.utc)
        user.reactivated_by_user_id = actor_user_id
        db.commit()
        db.refresh(user)
        return user

    def force_password_reset(self, db: Session, *, target_user_id: str) -> User:
        user = self._require_user(db, target_user_id)
        user.force_password_reset = True
        db.commit()
        db.refresh(user)
        return user

    def archive_user(self, db: Session, *, target_user_id: str, actor_user_id: str, action_type: str) -> UserArchive:
        user = self._require_user(db, target_user_id)
        snapshot = {
            "id": user.id,
            "fullName": user.full_name,
            "email": user.email,
            "mobile": user.mobile,
            "username": user.username,
        }
        user.archived_at = datetime.now(timezone.utc)
        user.archived_by_user_id = actor_user_id
        item = UserArchive(
            id=str(uuid.uuid4()),
            source_user_id=user.id,
            action_type=action_type,
            snapshot_json=json.dumps(snapshot, ensure_ascii=True),
            created_by_user_id=actor_user_id,
        )
        db.add(item)
        db.commit()
        db.refresh(item)
        return item

    def merge_users(self, db: Session, *, source_user_id: str, target_user_id: str, actor_user_id: str) -> User:
        if source_user_id == target_user_id:
            raise AdminCenterServiceError("Choose two different users to merge.")
        source = self._require_user(db, source_user_id)
        target = self._require_user(db, target_user_id)
        self.archive_user(db, target_user_id=source_user_id, actor_user_id=actor_user_id, action_type="merged")
        requests = db.execute(select(ContactRequest).where(ContactRequest.user_id == source_user_id)).scalars().all()
        for item in requests:
            item.user_id = target_user_id
        source.merged_into_user_id = target_user_id
        source.account_locked = True
        db.commit()
        db.refresh(target)
        return target

    def assign_role(self, db: Session, *, user_id: str, role_name: str, actor_user_id: str) -> UserRoleAssignment:
        self._require_user(db, user_id)
        role = db.execute(select(AdminRole).where(AdminRole.name == role_name.strip().lower())).scalar_one_or_none()
        if not role:
            raise AdminCenterServiceError("Role was not found.")
        existing = db.execute(select(UserRoleAssignment).where(UserRoleAssignment.user_id == user_id, UserRoleAssignment.role_id == role.id)).scalar_one_or_none()
        if existing:
            return existing
        item = UserRoleAssignment(id=str(uuid.uuid4()), user_id=user_id, role_id=role.id, assigned_by_user_id=actor_user_id)
        db.add(item)
        db.commit()
        db.refresh(item)
        return item

    def update_billing_admin(self, db: Session, *, transaction_id: str, refund_status: str | None, dispute_status: str | None, billing_admin_note: str | None, retry_count: int | None, actor_user_id: str) -> SubscriptionTransaction:
        item = db.get(SubscriptionTransaction, transaction_id)
        if not item:
            raise AdminCenterServiceError("Transaction was not found.")
        if refund_status is not None:
            item.refund_status = refund_status
        if dispute_status is not None:
            item.dispute_status = dispute_status
        if billing_admin_note is not None:
            item.billing_admin_note = billing_admin_note
            db.add(BillingNote(id=str(uuid.uuid4()), transaction_id=item.id, note_text=billing_admin_note, created_by_user_id=actor_user_id))
        if retry_count is not None:
            item.retry_count = retry_count
        db.commit()
        db.refresh(item)
        return item

    def create_content_entry(self, db: Session, *, page_key: str, section_key: str, title: str, body_json: str, is_published: bool) -> ContentEntry:
        existing = db.execute(select(ContentEntry).where(ContentEntry.page_key == page_key, ContentEntry.section_key == section_key)).scalar_one_or_none()
        if existing:
            existing.title = title
            existing.body_json = body_json
            existing.is_published = is_published
            existing.updated_at = datetime.now(timezone.utc)
            db.commit()
            db.refresh(existing)
            return existing
        item = ContentEntry(id=str(uuid.uuid4()), page_key=page_key, section_key=section_key, title=title, body_json=body_json, is_published=is_published, updated_at=datetime.now(timezone.utc))
        db.add(item)
        db.commit()
        db.refresh(item)
        return item

    def list_content_entries(self, db: Session, *, page_key: str, published_only: bool = False) -> list[ContentEntry]:
        query = select(ContentEntry).where(ContentEntry.page_key == page_key).order_by(ContentEntry.section_key.asc())
        if published_only:
            query = query.where(ContentEntry.is_published.is_(True))
        return db.execute(query).scalars().all()

    def create_communication_template(self, db: Session, *, channel: str, category: str | None, title: str, body: str, requires_approval: bool) -> CommunicationTemplate:
        item = CommunicationTemplate(
            id=str(uuid.uuid4()),
            channel=channel.strip().lower(),
            category=(category or "").strip().lower() or None,
            title=title.strip(),
            body=body.strip(),
            requires_approval=requires_approval,
        )
        db.add(item)
        db.commit()
        db.refresh(item)
        return item

    def run_read_only_query(self, sql: str) -> dict:
        normalized = (sql or "").strip()
        if not normalized.lower().startswith("select"):
            raise AdminCenterServiceError("Only read-only SELECT queries are allowed.")
        if ";" in normalized:
            raise AdminCenterServiceError("Only a single read-only query is allowed.")
        with engine.connect() as connection:
            rows = connection.execute(text(normalized)).mappings().all()
        return {"rowCount": len(rows), "rows": [{key: self._serialize_scalar(value) for key, value in row.items()} for row in rows[:100]]}

    def _seed_roles_and_permissions(self, db: Session) -> None:
        permission_defs = {
            "requests.view": "View requests",
            "requests.update": "Update requests",
            "communications.view": "View communications",
            "billing.view": "View billing",
            "billing.update": "Update billing",
            "reports.view": "View reports",
            "operations.view": "View operations",
            "database.query": "Run read-only queries",
            "notifications.view": "View notifications",
            "audit.view": "View audit",
            "security.view": "View security",
        }
        existing_permissions = {item.key: item for item in db.execute(select(AdminPermission)).scalars().all()}
        for key, label in permission_defs.items():
            if key not in existing_permissions:
                db.add(AdminPermission(id=str(uuid.uuid4()), key=key, label=label))
        db.commit()

        permissions = {item.key: item for item in db.execute(select(AdminPermission)).scalars().all()}
        existing_roles = {item.name: item for item in db.execute(select(AdminRole)).scalars().all()}
        for role_name, keys in self.SYSTEM_ROLES.items():
            role = existing_roles.get(role_name)
            if not role:
                role = AdminRole(id=str(uuid.uuid4()), name=role_name, description=f"{role_name.title()} role", is_system=True)
                db.add(role)
                db.commit()
                db.refresh(role)
            existing_role_permission_ids = {item.permission_id for item in db.execute(select(AdminRolePermission).where(AdminRolePermission.role_id == role.id)).scalars().all()}
            for key in keys:
                permission = permissions.get(key)
                if permission and permission.id not in existing_role_permission_ids:
                    db.add(AdminRolePermission(id=str(uuid.uuid4()), role_id=role.id, permission_id=permission.id))
            db.commit()

    def _seed_notifications(self, db: Session) -> None:
        if db.execute(select(AdminNotification.id)).scalars().first():
            return
        rows = [
            ("warning", "renewals", "Renewal deadlines approaching", "Premium subscriptions are expiring in the next 14 days."),
            ("critical", "sla", "SLA breaches detected", "At least one request has crossed its response target."),
            ("info", "operations", "System health snapshot ready", "Daily operations metrics were refreshed."),
        ]
        for level, category, title, message in rows:
            db.add(AdminNotification(id=str(uuid.uuid4()), level=level, category=category, title=title, message=message))
        db.commit()

    def _seed_content_entries(self, db: Session) -> None:
        if db.execute(select(ContentEntry.id)).scalars().first():
            return
        rows = [
            ("about", "company", "About Company", json.dumps({"body": ["Editable company content from admin center."]}, ensure_ascii=True)),
            ("careers", "positions", "Career Positions", json.dumps({"items": ["Frontend Developer", "Backend Developer"]}, ensure_ascii=True)),
            ("pricing", "plans", "Pricing Plans", json.dumps({"currency": "INR"}, ensure_ascii=True)),
            ("faqs", "general", "General FAQs", json.dumps({"items": [["What is this?", "Admin-managed content."]]}, ensure_ascii=True)),
        ]
        for page_key, section_key, title, body_json in rows:
            db.add(ContentEntry(id=str(uuid.uuid4()), page_key=page_key, section_key=section_key, title=title, body_json=body_json))
        db.commit()

    def _seed_communication_templates(self, db: Session) -> None:
        if db.execute(select(CommunicationTemplate.id)).scalars().first():
            return
        rows = [
            ("email", "support", "Issue Received", "We received your issue and our team is reviewing it.", False),
            ("sms", "billing", "Payment Reminder", "Your renewal is due soon. Please review your subscription.", False),
            ("whatsapp", "technical", "Need More Input", "Please share the missing screenshots or steps to reproduce the issue.", True),
        ]
        for channel, category, title, body, requires_approval in rows:
            db.add(CommunicationTemplate(id=str(uuid.uuid4()), channel=channel, category=category, title=title, body=body, requires_approval=requires_approval))
        db.commit()

    def _seed_automation_rules(self, db: Session) -> None:
        if db.execute(select(AutomationRule.id)).scalars().first():
            return
        rows = [
            ("Technical Auto Assign", "request.created", {"category": "technical"}, {"assignRole": "support"}),
            ("Premium Priority Boost", "request.created", {"subscriptionStatus": "premium"}, {"priorityScore": 90}),
            ("Completion Follow-Up", "request.completed", {"category": "any"}, {"sendFeedback": True}),
        ]
        for name, trigger_key, conditions, actions in rows:
            db.add(AutomationRule(id=str(uuid.uuid4()), name=name, trigger_key=trigger_key, conditions_json=json.dumps(conditions, ensure_ascii=True), actions_json=json.dumps(actions, ensure_ascii=True)))
        db.commit()

    def _seed_report_presets(self, db: Session) -> None:
        if db.execute(select(ReportPreset.id)).scalars().first():
            return
        rows = [
            ("Daily Support Summary", {"dateRange": "day", "section": "requests"}, None, "csv"),
            ("Manager Performance Pack", {"dateRange": "month", "section": "management"}, None, "pdf"),
        ]
        for name, filters_json, schedule_email, output_format in rows:
            db.add(ReportPreset(id=str(uuid.uuid4()), name=name, filters_json=json.dumps(filters_json, ensure_ascii=True), schedule_email=schedule_email, output_format=output_format))
        db.commit()

    def _seed_security_events(self, db: Session) -> None:
        if db.execute(select(SecurityEvent.id)).scalars().first():
            return
        rows = [
            ("admin_login", "info", None, "127.0.0.1", "Browser Session", "Admin login tracked."),
            ("suspicious_activity", "warning", None, "127.0.0.1", "Browser Session", "Repeated request retries detected."),
            ("session_revoke", "critical", None, "127.0.0.1", "Browser Session", "An admin session was revoked."),
        ]
        for event_type, severity, actor_user_id, ip_address, device_label, detail in rows:
            db.add(SecurityEvent(id=str(uuid.uuid4()), event_type=event_type, severity=severity, actor_user_id=actor_user_id, ip_address=ip_address, device_label=device_label, detail=detail))
        db.commit()

    def _require_user(self, db: Session, user_id: str) -> User:
        user = db.get(User, user_id)
        if not user:
            raise AdminCenterServiceError("User account was not found.")
        return user

    def serialize_user_admin(self, user: User, roles: list[str], requests: list[ContactRequest], transactions: list[SubscriptionTransaction], notes: list[ManagementNote], audit_logs: list[AdminAuditLog]) -> dict:
        user_requests = [item for item in requests if item.user_id == user.id]
        user_transactions = [item for item in transactions if item.user_id == user.id]
        user_notes = [item for item in notes if item.target_user_id == user.id]
        user_actions = [item for item in audit_logs if item.target_id == user.id or item.admin_user_id == user.id]
        timeline = [
            {"title": "Joined", "text": user.created_at.isoformat() if user.created_at else None},
            *[{"title": "Request", "text": f"{item.request_code or item.id} | {item.status}"} for item in user_requests[:5]],
            *[{"title": "Billing", "text": f"{item.plan_name} | {item.status}"} for item in user_transactions[:3]],
            *[{"title": "Internal Note", "text": item.note_text} for item in user_notes[:3]],
            *[{"title": "Audit", "text": item.detail or item.action_type} for item in user_actions[:4]],
        ]
        return {
            "id": user.id,
            "fullName": user.full_name,
            "username": user.username,
            "email": user.email,
            "mobile": user.mobile,
            "publicUserCode": user.public_user_code,
            "isManagement": bool(user.is_management),
            "roles": roles,
            "accountLocked": bool(user.account_locked),
            "forcePasswordReset": bool(user.force_password_reset),
            "emailVerified": bool(user.email_verified),
            "mobileVerified": bool(user.mobile_verified),
            "admin2faRequired": bool(user.admin_2fa_required),
            "archivedAt": user.archived_at.isoformat() if user.archived_at else None,
            "mergedIntoUserId": user.merged_into_user_id,
            "lastLoginAt": user.last_login_at.isoformat() if user.last_login_at else None,
            "timeline": timeline,
        }

    def serialize_role(self, role: AdminRole, db: Session) -> dict:
        link_rows = db.execute(select(AdminRolePermission).where(AdminRolePermission.role_id == role.id)).scalars().all()
        permission_ids = [item.permission_id for item in link_rows]
        permissions = db.execute(select(AdminPermission).where(AdminPermission.id.in_(permission_ids))).scalars().all() if permission_ids else []
        return {"id": role.id, "name": role.name, "description": role.description, "isSystem": bool(role.is_system), "permissions": [item.key for item in permissions]}

    @staticmethod
    def serialize_permission(permission: AdminPermission) -> dict:
        return {"id": permission.id, "key": permission.key, "label": permission.label, "description": permission.description}

    @staticmethod
    def serialize_role_assignment(item: UserRoleAssignment, role_map: dict[str, AdminRole]) -> dict:
        return {"id": item.id, "userId": item.user_id, "roleId": item.role_id, "roleName": role_map.get(item.role_id).name if role_map.get(item.role_id) else item.role_id, "assignedByUserId": item.assigned_by_user_id, "assignedAt": item.assigned_at.isoformat() if item.assigned_at else None}

    @staticmethod
    def serialize_archive(item: UserArchive) -> dict:
        return {"id": item.id, "sourceUserId": item.source_user_id, "actionType": item.action_type, "snapshotJson": item.snapshot_json, "createdByUserId": item.created_by_user_id, "createdAt": item.created_at.isoformat() if item.created_at else None}

    def serialize_request_brief(self, item: ContactRequest, users: list[User]) -> dict:
        user_lookup = {user.id: user for user in users}
        user = user_lookup.get(item.user_id)
        return {"id": item.id, "requestCode": item.request_code, "title": item.title, "status": item.status, "priorityScore": item.priority_score, "queueOwner": item.queue_owner, "dueAt": item.due_at.isoformat() if item.due_at else None, "userFullName": user.full_name if user else None}

    @staticmethod
    def serialize_transaction(item: SubscriptionTransaction) -> dict:
        return {"id": item.id, "invoiceNumber": item.invoice_number, "planName": item.plan_name, "customerName": item.customer_name, "status": item.status, "refundStatus": item.refund_status, "disputeStatus": item.dispute_status, "retryCount": item.retry_count, "billingAdminNote": item.billing_admin_note, "createdAt": item.created_at.isoformat() if item.created_at else None}

    @staticmethod
    def serialize_billing_note(item: BillingNote) -> dict:
        return {"id": item.id, "transactionId": item.transaction_id, "noteText": item.note_text, "createdByUserId": item.created_by_user_id, "createdAt": item.created_at.isoformat() if item.created_at else None}

    @staticmethod
    def serialize_communication_template(item: CommunicationTemplate) -> dict:
        return {"id": item.id, "channel": item.channel, "category": item.category, "title": item.title, "body": item.body, "requiresApproval": bool(item.requires_approval), "isActive": bool(item.is_active), "createdAt": item.created_at.isoformat() if item.created_at else None}

    @staticmethod
    def serialize_communication_log(item: CommunicationLog) -> dict:
        return {"id": item.id, "requestId": item.request_id, "userId": item.user_id, "channel": item.channel, "direction": item.direction, "messageBody": item.message_body, "scheduledFor": item.scheduled_for.isoformat() if item.scheduled_for else None, "sentAt": item.sent_at.isoformat() if item.sent_at else None, "approvalStatus": item.approval_status, "createdAt": item.created_at.isoformat() if item.created_at else None}

    @staticmethod
    def serialize_audit_log(item: AdminAuditLog) -> dict:
        return {"id": item.id, "adminUserId": item.admin_user_id, "adminName": item.admin_name, "adminEmail": item.admin_email, "actionType": item.action_type, "targetType": item.target_type, "targetId": item.target_id, "targetLabel": item.target_label, "detail": item.detail, "createdAt": item.created_at.isoformat() if item.created_at else None}

    @staticmethod
    def serialize_content_entry(item: ContentEntry) -> dict:
        return {"id": item.id, "pageKey": item.page_key, "sectionKey": item.section_key, "title": item.title, "bodyJson": item.body_json, "isPublished": bool(item.is_published), "updatedAt": item.updated_at.isoformat() if item.updated_at else None}

    @staticmethod
    def serialize_security_event(item: SecurityEvent) -> dict:
        return {"id": item.id, "eventType": item.event_type, "severity": item.severity, "actorUserId": item.actor_user_id, "ipAddress": item.ip_address, "deviceLabel": item.device_label, "detail": item.detail, "createdAt": item.created_at.isoformat() if item.created_at else None}

    @staticmethod
    def serialize_automation_rule(item: AutomationRule) -> dict:
        return {"id": item.id, "name": item.name, "triggerKey": item.trigger_key, "conditionsJson": item.conditions_json, "actionsJson": item.actions_json, "isEnabled": bool(item.is_enabled), "createdAt": item.created_at.isoformat() if item.created_at else None}

    @staticmethod
    def serialize_notification(item: AdminNotification) -> dict:
        return {"id": item.id, "level": item.level, "category": item.category, "title": item.title, "message": item.message, "isRead": bool(item.is_read), "createdAt": item.created_at.isoformat() if item.created_at else None}

    @staticmethod
    def serialize_report_preset(item: ReportPreset) -> dict:
        return {"id": item.id, "name": item.name, "filtersJson": item.filters_json, "scheduleEmail": item.schedule_email, "outputFormat": item.output_format, "isActive": bool(item.is_active), "createdAt": item.created_at.isoformat() if item.created_at else None}

    def serialize_assignment_history(self, item: RequestAssignmentHistory, users: list[User]) -> dict:
        user_lookup = {user.id: user for user in users}
        return {"id": item.id, "requestId": item.request_id, "previousManager": user_lookup.get(item.previous_manager_user_id).full_name if user_lookup.get(item.previous_manager_user_id) else None, "nextManager": user_lookup.get(item.next_manager_user_id).full_name if user_lookup.get(item.next_manager_user_id) else None, "assignedBy": user_lookup.get(item.assigned_by_user_id).full_name if user_lookup.get(item.assigned_by_user_id) else None, "assignedAt": item.assigned_at.isoformat() if item.assigned_at else None}

    def _build_manager_load(self, users: list[User], requests: list[ContactRequest]) -> list[dict]:
        rows = []
        for user in users:
            if not user.is_management:
                continue
            assigned = [item for item in requests if item.assigned_manager_user_id == user.id]
            rows.append({"managerUserId": user.id, "managerName": user.full_name, "capacityLimit": 15, "assignedCount": len(assigned), "inReviewCount": len([item for item in assigned if item.status == 'In Review']), "technicalCount": len([item for item in assigned if (item.category or '') == 'technical'])})
        return rows

    @staticmethod
    def _build_queue_ownership(requests: list[ContactRequest]) -> list[dict]:
        ownership: dict[str, int] = {}
        for item in requests:
            key = item.queue_owner or "default"
            ownership[key] = ownership.get(key, 0) + 1
        return [{"queueOwner": key, "count": value} for key, value in ownership.items()]

    def _build_aging_buckets(self, requests: list[ContactRequest]) -> list[dict]:
        now = datetime.now(timezone.utc)
        buckets = {"0-1d": 0, "2-3d": 0, "4-7d": 0, "8d+": 0}
        for item in requests:
            age_days = (now - self._ensure_utc(item.created_at)).days
            if age_days <= 1:
                buckets["0-1d"] += 1
            elif age_days <= 3:
                buckets["2-3d"] += 1
            elif age_days <= 7:
                buckets["4-7d"] += 1
            else:
                buckets["8d+"] += 1
        return [{"bucket": key, "count": value} for key, value in buckets.items()]

    def _build_system_ops_summary(self, *, requests: list[ContactRequest], notifications: list[AdminNotification]) -> dict:
        docs_path = Path("backend") / "documents"
        file_count = len(list(docs_path.glob("*"))) if docs_path.exists() else 0
        return {
            "appHealth": "healthy",
            "queueStatus": {"pendingRequests": len([item for item in requests if item.status != "Completed"]), "breachedRequests": len([item for item in requests if item.breached_at])},
            "storageUsage": {"documentFiles": file_count},
            "modelUsageCounters": {"documentQueries": len(requests), "notificationsTracked": len(notifications)},
            "webhookFailures": 0,
            "backgroundRetries": 0,
        }

    def _build_database_summary(self) -> dict:
        inspector = inspect(engine)
        tables = inspector.get_table_names()
        return {
            "tables": tables,
            "tableCount": len(tables),
            "queryMode": "read-only",
            "backupTriggerAvailable": True,
            "restorePointMetadata": {"lastKnownSnapshot": datetime.now(timezone.utc).isoformat()},
        }

    @staticmethod
    def _ensure_utc(value: datetime) -> datetime:
        if value.tzinfo is None:
            return value.replace(tzinfo=timezone.utc)
        return value

    @staticmethod
    def _avg(values: list[float]) -> float | None:
        return round(sum(values) / len(values), 2) if values else None

    @staticmethod
    def _serialize_scalar(value):
        if value is None or isinstance(value, (bool, int, float, str)):
            return value
        if hasattr(value, "isoformat"):
            return value.isoformat()
        return str(value)
