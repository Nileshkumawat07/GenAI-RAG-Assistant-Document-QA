from fastapi import APIRouter, Depends, File, Form, Header, HTTPException, Query, UploadFile
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.career import (
    CareerApplicationResponse,
    CareerApplicationUpdateRequest,
    CareerManagementOverviewResponse,
    CareerOpeningCreateRequest,
    CareerOpeningResponse,
    CareerOpeningUpdateRequest,
)
from app.services.admin_audit_service import AdminAuditService
from app.services.auth_service import AuthService, AuthServiceError
from app.services.career_service import CareerService, CareerServiceError


def build_career_router(career_service: CareerService, auth_service: AuthService) -> APIRouter:
    router = APIRouter(prefix="/careers", tags=["careers"])
    admin_audit_service = AdminAuditService()

    def require_authenticated_user_id(
        authorization: str | None = Header(default=None),
        db: Session = Depends(get_db),
    ) -> str:
        if not authorization or not authorization.startswith("Bearer "):
            raise HTTPException(status_code=401, detail="Missing authorization token.")
        token = authorization.split(" ", 1)[1].strip()
        if not token:
            raise HTTPException(status_code=401, detail="Missing authorization token.")
        try:
            user_id = auth_service.verify_access_token(token)
            auth_service.get_user_by_id(db, user_id=user_id)
            return user_id
        except AuthServiceError as exc:
            raise HTTPException(status_code=401, detail=str(exc)) from exc

    def require_admin_or_management(db: Session, user_id: str) -> None:
        if not (auth_service.user_is_admin(db, user_id=user_id) or auth_service.user_has_management_access(db, user_id=user_id)):
            raise HTTPException(status_code=403, detail="Admin or management access is required.")

    @router.get("/openings", response_model=list[CareerOpeningResponse])
    def list_public_openings(db: Session = Depends(get_db)):
        return career_service.list_public_openings(db)

    @router.get("/openings/manage", response_model=list[CareerOpeningResponse])
    def list_manage_openings(
        db: Session = Depends(get_db),
        authenticated_user_id: str = Depends(require_authenticated_user_id),
    ):
        require_admin_or_management(db, authenticated_user_id)
        return career_service.list_manage_openings(db)

    @router.post("/openings", response_model=CareerOpeningResponse)
    def create_opening(
        payload: CareerOpeningCreateRequest,
        db: Session = Depends(get_db),
        authenticated_user_id: str = Depends(require_authenticated_user_id),
    ):
        require_admin_or_management(db, authenticated_user_id)
        try:
            item = career_service.create_opening(db, acting_user_id=authenticated_user_id, payload=payload.model_dump())
            admin_audit_service.log_action(
                db,
                admin_user_id=authenticated_user_id,
                action_type="career_opening_created",
                target_type="career_opening",
                target_id=item["id"],
                target_label=item["title"],
                detail=f"Opening {item['title']} created for {item['department']}.",
            )
            return item
        except CareerServiceError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @router.patch("/openings/{opening_id}", response_model=CareerOpeningResponse)
    def update_opening(
        opening_id: str,
        payload: CareerOpeningUpdateRequest,
        db: Session = Depends(get_db),
        authenticated_user_id: str = Depends(require_authenticated_user_id),
    ):
        require_admin_or_management(db, authenticated_user_id)
        try:
            item = career_service.update_opening(
                db,
                opening_id=opening_id,
                acting_user_id=authenticated_user_id,
                payload=payload.model_dump(),
            )
            admin_audit_service.log_action(
                db,
                admin_user_id=authenticated_user_id,
                action_type="career_opening_updated",
                target_type="career_opening",
                target_id=item["id"],
                target_label=item["title"],
                detail=f"Opening {item['title']} updated.",
            )
            return item
        except CareerServiceError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @router.post("/applications", response_model=CareerApplicationResponse)
    def create_application(
        openingId: str = Form(...),
        fullName: str = Form(...),
        email: str = Form(...),
        mobile: str = Form(...),
        city: str = Form(default=""),
        currentCompany: str = Form(default=""),
        currentRole: str = Form(default=""),
        totalExperience: str = Form(default=""),
        noticePeriod: str = Form(default=""),
        currentCtc: str = Form(default=""),
        expectedCtc: str = Form(default=""),
        portfolioUrl: str = Form(default=""),
        linkedinUrl: str = Form(default=""),
        coverLetter: str = Form(default=""),
        resume: UploadFile | None = File(default=None),
        db: Session = Depends(get_db),
        authenticated_user_id: str = Depends(require_authenticated_user_id),
    ):
        try:
            return career_service.create_application(
                db,
                user_id=authenticated_user_id,
                opening_id=openingId,
                full_name=fullName,
                email=email,
                mobile=mobile,
                city=city,
                current_company=currentCompany,
                current_role=currentRole,
                total_experience=totalExperience,
                notice_period=noticePeriod,
                current_ctc=currentCtc,
                expected_ctc=expectedCtc,
                portfolio_url=portfolioUrl,
                linkedin_url=linkedinUrl,
                cover_letter=coverLetter,
                resume_upload=resume,
            )
        except CareerServiceError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @router.get("/applications", response_model=list[CareerApplicationResponse])
    def list_user_applications(
        user_id: str = Query(..., alias="userId"),
        db: Session = Depends(get_db),
        authenticated_user_id: str = Depends(require_authenticated_user_id),
    ):
        if user_id != authenticated_user_id:
            raise HTTPException(status_code=403, detail="You can only access your own applications.")
        try:
            return career_service.list_user_applications(db, user_id=authenticated_user_id)
        except CareerServiceError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @router.patch("/applications/{application_id}/withdraw", response_model=CareerApplicationResponse)
    def withdraw_application(
        application_id: str,
        db: Session = Depends(get_db),
        authenticated_user_id: str = Depends(require_authenticated_user_id),
    ):
        try:
            return career_service.withdraw_application(db, user_id=authenticated_user_id, application_id=application_id)
        except CareerServiceError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @router.get("/management/overview", response_model=CareerManagementOverviewResponse)
    def get_management_overview(
        db: Session = Depends(get_db),
        authenticated_user_id: str = Depends(require_authenticated_user_id),
    ):
        require_admin_or_management(db, authenticated_user_id)
        return career_service.get_management_overview(db)

    @router.patch("/applications/admin/{application_id}", response_model=CareerApplicationResponse)
    def admin_update_application(
        application_id: str,
        payload: CareerApplicationUpdateRequest,
        db: Session = Depends(get_db),
        authenticated_user_id: str = Depends(require_authenticated_user_id),
    ):
        require_admin_or_management(db, authenticated_user_id)
        try:
            item = career_service.admin_update_application(
                db,
                application_id=application_id,
                acting_user_id=authenticated_user_id,
                status=payload.status,
                admin_message=payload.adminMessage,
                assigned_manager_user_id=payload.assignedManagerUserId,
            )
            admin_audit_service.log_action(
                db,
                admin_user_id=authenticated_user_id,
                action_type="career_application_updated",
                target_type="career_application",
                target_id=item["id"],
                target_label=item["applicationCode"],
                detail=f"Application moved to {item['status']}.",
            )
            return item
        except CareerServiceError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @router.get("/applications/{application_id}/resume")
    def download_resume(
        application_id: str,
        db: Session = Depends(get_db),
        authenticated_user_id: str = Depends(require_authenticated_user_id),
    ):
        try:
            application, resume_path = career_service.get_application_resume_path(db, application_id=application_id)
            can_access = (
                application.user_id == authenticated_user_id
                or auth_service.user_is_admin(db, user_id=authenticated_user_id)
                or auth_service.user_has_management_access(db, user_id=authenticated_user_id)
            )
            if not can_access:
                raise HTTPException(status_code=403, detail="You cannot access this resume.")
            return FileResponse(
                path=resume_path,
                media_type="application/octet-stream",
                filename=application.resume_filename or resume_path.name,
            )
        except CareerServiceError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    return router
