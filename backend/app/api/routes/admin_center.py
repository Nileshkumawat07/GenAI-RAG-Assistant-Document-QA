from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.admin_center import (
    AdminContentUpdateRequest,
    AdminQueryRequest,
    AdminRoleAssignmentRequest,
    AdminUserActionRequest,
    AdminUserMergeRequest,
    AdminUserUpdateRequest,
    BillingAdminUpdateRequest,
    CommunicationTemplateCreateRequest,
)
from app.services.admin_audit_service import AdminAuditService
from app.services.admin_center_service import AdminCenterService, AdminCenterServiceError
from app.services.auth_service import AuthService, AuthServiceError


def build_admin_center_router(admin_center_service: AdminCenterService, auth_service: AuthService) -> APIRouter:
    router = APIRouter(prefix="/admin-center", tags=["admin-center"])
    admin_audit_service = AdminAuditService()

    def require_authenticated_user_id(authorization: str | None = Header(default=None)) -> str:
        if not authorization or not authorization.startswith("Bearer "):
            raise HTTPException(status_code=401, detail="Missing authorization token.")
        token = authorization.split(" ", 1)[1].strip()
        try:
            return auth_service.verify_access_token(token)
        except AuthServiceError as exc:
            raise HTTPException(status_code=401, detail=str(exc)) from exc

    def require_admin(db: Session, user_id: str) -> None:
        if not auth_service.user_is_admin(db, user_id=user_id):
            raise HTTPException(status_code=403, detail="Admin access is required.")

    @router.get("/overview")
    def get_admin_center_overview(
        db: Session = Depends(get_db),
        authenticated_user_id: str = Depends(require_authenticated_user_id),
    ):
        require_admin(db, authenticated_user_id)
        return admin_center_service.get_overview(db)

    @router.post("/users/{user_id}/update")
    def update_admin_user(
        user_id: str,
        payload: AdminUserUpdateRequest,
        db: Session = Depends(get_db),
        authenticated_user_id: str = Depends(require_authenticated_user_id),
    ):
        require_admin(db, authenticated_user_id)
        try:
            user = admin_center_service.update_user_profile(db, target_user_id=user_id, **payload.model_dump())
            admin_audit_service.log_action(db, admin_user_id=authenticated_user_id, action_type="admin_user_updated", target_type="user", target_id=user.id, target_label=user.username, detail=f"Admin updated user profile for {user.full_name}.")
            return {"userId": user.id, "message": "User profile updated."}
        except AdminCenterServiceError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @router.post("/users/{user_id}/lock")
    def lock_admin_user(user_id: str, payload: AdminUserActionRequest, db: Session = Depends(get_db), authenticated_user_id: str = Depends(require_authenticated_user_id)):
        require_admin(db, authenticated_user_id)
        user = admin_center_service.lock_user(db, target_user_id=user_id, actor_user_id=authenticated_user_id)
        admin_audit_service.log_action(db, admin_user_id=authenticated_user_id, action_type="user_locked", target_type="user", target_id=user.id, target_label=user.username, detail=payload.reason or "User locked from admin center.")
        return {"message": "User locked."}

    @router.post("/users/{user_id}/reactivate")
    def reactivate_admin_user(user_id: str, payload: AdminUserActionRequest, db: Session = Depends(get_db), authenticated_user_id: str = Depends(require_authenticated_user_id)):
        require_admin(db, authenticated_user_id)
        user = admin_center_service.reactivate_user(db, target_user_id=user_id, actor_user_id=authenticated_user_id)
        admin_audit_service.log_action(db, admin_user_id=authenticated_user_id, action_type="user_reactivated", target_type="user", target_id=user.id, target_label=user.username, detail=payload.reason or "User reactivated from admin center.")
        return {"message": "User reactivated."}

    @router.post("/users/{user_id}/force-password-reset")
    def admin_force_password_reset(user_id: str, db: Session = Depends(get_db), authenticated_user_id: str = Depends(require_authenticated_user_id)):
        require_admin(db, authenticated_user_id)
        user = admin_center_service.force_password_reset(db, target_user_id=user_id)
        admin_audit_service.log_action(db, admin_user_id=authenticated_user_id, action_type="force_password_reset", target_type="user", target_id=user.id, target_label=user.username, detail="Admin flagged the account for password reset.")
        return {"message": "Password reset required on next login."}

    @router.post("/users/{user_id}/archive")
    def admin_archive_user(user_id: str, payload: AdminUserActionRequest, db: Session = Depends(get_db), authenticated_user_id: str = Depends(require_authenticated_user_id)):
        require_admin(db, authenticated_user_id)
        item = admin_center_service.archive_user(db, target_user_id=user_id, actor_user_id=authenticated_user_id, action_type="archived")
        admin_audit_service.log_action(db, admin_user_id=authenticated_user_id, action_type="user_archived", target_type="user", target_id=user_id, target_label=user_id, detail=payload.reason or "User archived from admin center.")
        return {"archiveId": item.id, "message": "User archived."}

    @router.post("/users/merge")
    def admin_merge_users(payload: AdminUserMergeRequest, db: Session = Depends(get_db), authenticated_user_id: str = Depends(require_authenticated_user_id)):
        require_admin(db, authenticated_user_id)
        try:
            user = admin_center_service.merge_users(db, source_user_id=payload.sourceUserId, target_user_id=payload.targetUserId, actor_user_id=authenticated_user_id)
            admin_audit_service.log_action(db, admin_user_id=authenticated_user_id, action_type="users_merged", target_type="user", target_id=user.id, target_label=user.username, detail=f"Merged {payload.sourceUserId} into {payload.targetUserId}.")
            return {"message": "Users merged."}
        except AdminCenterServiceError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @router.post("/roles/assign")
    def assign_admin_role(payload: AdminRoleAssignmentRequest, db: Session = Depends(get_db), authenticated_user_id: str = Depends(require_authenticated_user_id)):
        require_admin(db, authenticated_user_id)
        try:
            item = admin_center_service.assign_role(db, user_id=payload.userId, role_name=payload.roleName, actor_user_id=authenticated_user_id)
            admin_audit_service.log_action(db, admin_user_id=authenticated_user_id, action_type="role_assigned", target_type="user_role", target_id=item.id, target_label=payload.roleName, detail=f"Assigned role {payload.roleName} to user {payload.userId}.")
            return {"message": "Role assigned."}
        except AdminCenterServiceError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @router.post("/billing/update")
    def update_billing_admin(payload: BillingAdminUpdateRequest, db: Session = Depends(get_db), authenticated_user_id: str = Depends(require_authenticated_user_id)):
        require_admin(db, authenticated_user_id)
        try:
            item = admin_center_service.update_billing_admin(db, transaction_id=payload.transactionId, refund_status=payload.refundStatus, dispute_status=payload.disputeStatus, billing_admin_note=payload.billingAdminNote, retry_count=payload.retryCount, actor_user_id=authenticated_user_id)
            admin_audit_service.log_action(db, admin_user_id=authenticated_user_id, action_type="billing_admin_updated", target_type="transaction", target_id=item.id, target_label=item.invoice_number, detail="Billing administration fields updated.")
            return {"message": "Billing administration updated."}
        except AdminCenterServiceError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @router.post("/content/save")
    def save_admin_content(payload: AdminContentUpdateRequest, db: Session = Depends(get_db), authenticated_user_id: str = Depends(require_authenticated_user_id)):
        require_admin(db, authenticated_user_id)
        item = admin_center_service.create_content_entry(db, page_key=payload.pageKey, section_key=payload.sectionKey, title=payload.title, body_json=payload.bodyJson, is_published=payload.isPublished)
        admin_audit_service.log_action(db, admin_user_id=authenticated_user_id, action_type="content_saved", target_type="content_entry", target_id=item.id, target_label=f"{item.page_key}:{item.section_key}", detail=f"Saved content entry {item.title}.")
        return {"message": "Content saved."}

    @router.post("/communications/templates")
    def create_admin_communication_template(payload: CommunicationTemplateCreateRequest, db: Session = Depends(get_db), authenticated_user_id: str = Depends(require_authenticated_user_id)):
        require_admin(db, authenticated_user_id)
        item = admin_center_service.create_communication_template(db, channel=payload.channel, category=payload.category, title=payload.title, body=payload.body, requires_approval=payload.requiresApproval)
        admin_audit_service.log_action(db, admin_user_id=authenticated_user_id, action_type="communication_template_created", target_type="communication_template", target_id=item.id, target_label=item.title, detail=f"Created {item.channel} communication template.")
        return {"message": "Communication template created."}

    @router.post("/database/query")
    def run_admin_database_query(payload: AdminQueryRequest, db: Session = Depends(get_db), authenticated_user_id: str = Depends(require_authenticated_user_id)):
        require_admin(db, authenticated_user_id)
        try:
            result = admin_center_service.run_read_only_query(payload.sql)
            admin_audit_service.log_action(db, admin_user_id=authenticated_user_id, action_type="read_only_query_executed", target_type="database", target_label="select", detail="Admin executed a read-only query.")
            return result
        except AdminCenterServiceError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    return router
