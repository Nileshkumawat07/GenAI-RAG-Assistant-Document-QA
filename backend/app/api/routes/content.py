from fastapi import APIRouter, Depends, Header, HTTPException
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.admin_center import AdminContentUpdateRequest
from app.services.admin_center_service import AdminCenterService
from app.services.auth_service import AuthService, AuthServiceError


def build_content_router(admin_center_service: AdminCenterService, auth_service: AuthService) -> APIRouter:
    router = APIRouter(prefix="/content", tags=["content"])

    def require_authenticated_user_id(
        authorization: str | None = Header(default=None),
        db: Session = Depends(get_db),
    ) -> str:
        if not authorization or not authorization.startswith("Bearer "):
            raise HTTPException(status_code=401, detail="Missing authorization token.")
        token = authorization.split(" ", 1)[1].strip()
        try:
            user_id = auth_service.verify_access_token(token)
            auth_service.get_user_by_id(db, user_id=user_id)
            return user_id
        except AuthServiceError as exc:
            raise HTTPException(status_code=401, detail=str(exc)) from exc

    def require_admin_or_management(db: Session, user_id: str) -> None:
        if not (auth_service.user_is_admin(db, user_id=user_id) or auth_service.user_has_management_access(db, user_id=user_id)):
            raise HTTPException(status_code=403, detail="Admin or management access is required.")

    @router.get("/page/{page_key}")
    def list_published_content(page_key: str, db: Session = Depends(get_db)):
        return {
            "entries": [
                admin_center_service.serialize_content_entry(item)
                for item in admin_center_service.list_content_entries(db, page_key=page_key, published_only=True)
            ]
        }

    @router.get("/manage/{page_key}")
    def list_manage_content(
        page_key: str,
        db: Session = Depends(get_db),
        authenticated_user_id: str = Depends(require_authenticated_user_id),
    ):
        require_admin_or_management(db, authenticated_user_id)
        return {
            "entries": [
                admin_center_service.serialize_content_entry(item)
                for item in admin_center_service.list_content_entries(db, page_key=page_key, published_only=False)
            ]
        }

    @router.post("/save")
    def save_content(
        payload: AdminContentUpdateRequest,
        db: Session = Depends(get_db),
        authenticated_user_id: str = Depends(require_authenticated_user_id),
    ):
        require_admin_or_management(db, authenticated_user_id)
        item = admin_center_service.create_content_entry(
            db,
            page_key=payload.pageKey,
            section_key=payload.sectionKey,
            title=payload.title,
            body_json=payload.bodyJson,
            is_published=payload.isPublished,
        )
        return {"entry": admin_center_service.serialize_content_entry(item), "message": "Content saved."}

    return router
