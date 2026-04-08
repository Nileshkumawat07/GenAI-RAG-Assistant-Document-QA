from sqlalchemy import select
from sqlalchemy.orm import Session

from fastapi import APIRouter, Depends, Header, HTTPException, Query

from app.core.database import get_db
from app.models.contact_request import ContactRequest
from app.schemas.contact import (
    ContactRequestCreate,
    ContactRequestResponse,
    ContactRequestUpdateStatus,
)
from app.services.auth_service import AuthService, AuthServiceError
from app.services.admin_audit_service import AdminAuditService
from app.services.contact_request_service import ContactRequestService, ContactRequestServiceError


def build_contact_request_router(contact_request_service: ContactRequestService, auth_service: AuthService) -> APIRouter:
    router = APIRouter(prefix="/contact-requests", tags=["contact-requests"])
    admin_audit_service = AdminAuditService()

    def require_authenticated_user_id(authorization: str | None = Header(default=None)) -> str:
        if not authorization or not authorization.startswith("Bearer "):
            raise HTTPException(status_code=401, detail="Missing authorization token.")

        token = authorization.split(" ", 1)[1].strip()
        if not token:
            raise HTTPException(status_code=401, detail="Missing authorization token.")

        try:
            return auth_service.verify_access_token(token)
        except AuthServiceError as exc:
            raise HTTPException(status_code=401, detail=str(exc)) from exc

    def serialize_contact_request(item):
        return ContactRequestResponse(
            id=item.id,
            userId=item.user_id,
            category=item.category,
            title=item.title,
            requestCode=item.request_code,
            status=item.status,
            adminMessage=item.admin_message,
            values=item.values,
            createdAt=item.created_at,
            userFullName=item.user_full_name,
            userEmail=item.user_email,
            userMobile=item.user_mobile,
        )

    @router.post("", response_model=ContactRequestResponse)
    def create_contact_request(
        payload: ContactRequestCreate,
        db: Session = Depends(get_db),
        authenticated_user_id: str = Depends(require_authenticated_user_id),
    ):
        try:
            if payload.userId != authenticated_user_id:
                raise HTTPException(status_code=403, detail="You can only create your own contact requests.")
            item = contact_request_service.create_request(
                db,
                user_id=authenticated_user_id,
                category=payload.category,
                title=payload.title,
                values=payload.values,
            )
            return serialize_contact_request(item)
        except ContactRequestServiceError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @router.get("", response_model=list[ContactRequestResponse])
    def list_contact_requests(
        user_id: str = Query(..., alias="userId"),
        db: Session = Depends(get_db),
        authenticated_user_id: str = Depends(require_authenticated_user_id),
    ):
        try:
            if user_id != authenticated_user_id:
                raise HTTPException(status_code=403, detail="You can only access your own contact requests.")
            items = contact_request_service.list_requests(db, user_id=authenticated_user_id)
            return [serialize_contact_request(item) for item in items]
        except ContactRequestServiceError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @router.get("/admin/all", response_model=list[ContactRequestResponse])
    def list_all_contact_requests(
        db: Session = Depends(get_db),
        authenticated_user_id: str = Depends(require_authenticated_user_id),
    ):
        try:
            if not auth_service.user_has_management_access(db, user_id=authenticated_user_id):
                raise HTTPException(status_code=403, detail="Management access is required.")
            items = contact_request_service.list_all_requests(db)
            return [serialize_contact_request(item) for item in items]
        except ContactRequestServiceError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @router.patch("/{request_id}", response_model=ContactRequestResponse)
    def update_contact_request_status(
        request_id: str,
        payload: ContactRequestUpdateStatus,
        db: Session = Depends(get_db),
        authenticated_user_id: str = Depends(require_authenticated_user_id),
    ):
        try:
            if payload.userId and payload.userId != authenticated_user_id:
                raise HTTPException(status_code=403, detail="You can only update your own contact requests.")
            item = contact_request_service.update_status(
                db,
                user_id=authenticated_user_id,
                request_id=request_id,
                status=payload.status,
            )
            return serialize_contact_request(item)
        except ContactRequestServiceError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @router.patch("/admin/{request_id}", response_model=ContactRequestResponse)
    def admin_update_contact_request_status(
        request_id: str,
        payload: ContactRequestUpdateStatus,
        db: Session = Depends(get_db),
        authenticated_user_id: str = Depends(require_authenticated_user_id),
    ):
        try:
            if not auth_service.user_has_management_access(db, user_id=authenticated_user_id):
                raise HTTPException(status_code=403, detail="Management access is required.")
            item = contact_request_service.admin_update_status(
                db,
                request_id=request_id,
                status=payload.status,
                admin_message=payload.adminMessage,
            )
            admin_audit_service.log_action(
                db,
                admin_user_id=authenticated_user_id,
                action_type="request_status_updated",
                target_type="contact_request",
                target_id=item.id,
                target_label=item.request_code or item.title,
                detail=f"Status changed to {item.status}. Admin note: {(item.admin_message or 'None')[:180]}",
            )
            return serialize_contact_request(item)
        except ContactRequestServiceError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @router.delete("/{request_id}")
    def delete_contact_request(
        request_id: str,
        user_id: str = Query(..., alias="userId"),
        db: Session = Depends(get_db),
        authenticated_user_id: str = Depends(require_authenticated_user_id),
    ):
        try:
            if user_id != authenticated_user_id:
                raise HTTPException(status_code=403, detail="You can only delete your own contact requests.")
            contact_request_service.delete_request(db, user_id=authenticated_user_id, request_id=request_id)
            return {"message": "Contact request deleted successfully."}
        except ContactRequestServiceError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @router.delete("/admin/{request_id}")
    def admin_delete_contact_request(
        request_id: str,
        db: Session = Depends(get_db),
        authenticated_user_id: str = Depends(require_authenticated_user_id),
    ):
        try:
            if not auth_service.user_has_management_access(db, user_id=authenticated_user_id):
                raise HTTPException(status_code=403, detail="Management access is required.")
            existing_item = db.execute(
                select(ContactRequest).where(ContactRequest.id == request_id)
            ).scalar_one_or_none()
            contact_request_service.admin_delete_request(db, request_id=request_id)
            admin_audit_service.log_action(
                db,
                admin_user_id=authenticated_user_id,
                action_type="request_deleted",
                target_type="contact_request",
                target_id=request_id,
                target_label=(existing_item.request_code if existing_item else None) or (existing_item.title if existing_item else None) or request_id,
                detail=f"Request '{existing_item.title}' removed from the administration queue." if existing_item else "Request removed from the administration queue.",
            )
            return {"message": "Contact request deleted successfully."}
        except ContactRequestServiceError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    return router
