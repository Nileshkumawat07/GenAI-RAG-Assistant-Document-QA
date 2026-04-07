from __future__ import annotations

import uuid

from sqlalchemy import desc, select
from sqlalchemy.orm import Session

from app.models.admin_audit_log import AdminAuditLog
from app.models.user import User


class AdminAuditService:
    def log_action(
        self,
        db: Session,
        *,
        admin_user_id: str | None,
        action_type: str,
        target_type: str,
        target_id: str | None = None,
        target_label: str | None = None,
        detail: str | None = None,
    ) -> AdminAuditLog:
        admin_user = db.get(User, admin_user_id) if admin_user_id else None
        item = AdminAuditLog(
            id=str(uuid.uuid4()),
            admin_user_id=admin_user_id,
            admin_name=admin_user.full_name if admin_user else None,
            admin_email=admin_user.email if admin_user else None,
            action_type=action_type,
            target_type=target_type,
            target_id=target_id,
            target_label=target_label,
            detail=detail,
        )
        db.add(item)
        db.commit()
        db.refresh(item)
        return item

    def list_recent_actions(self, db: Session, *, limit: int = 100) -> list[AdminAuditLog]:
        safe_limit = max(1, min(limit, 500))
        return db.execute(
            select(AdminAuditLog)
            .order_by(desc(AdminAuditLog.created_at))
            .limit(safe_limit)
        ).scalars().all()
