import csv
import json
from io import BytesIO, StringIO

from fastapi import APIRouter, Depends, Header, HTTPException, Query
from fastapi.responses import StreamingResponse
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas
from sqlalchemy.orm import Session

from app.core.database import get_db
from app.schemas.management import (
    ManagementBulkStatusRequest,
    ManagementNoteCreateRequest,
    ManagementNoteResponse,
    ManagementOverviewResponse,
    ManagementReplyTemplateCreateRequest,
    ManagementReplyTemplateResponse,
)
from app.services.admin_audit_service import AdminAuditService
from app.services.auth_service import AuthService, AuthServiceError
from app.services.contact_request_service import ContactRequestService, ContactRequestServiceError
from app.services.management_service import ManagementService, ManagementServiceError


def build_management_router(management_service: ManagementService, auth_service: AuthService) -> APIRouter:
    router = APIRouter(prefix="/management", tags=["management"])
    admin_audit_service = AdminAuditService()
    contact_request_service = ContactRequestService()

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

    def require_management_access(db: Session, authenticated_user_id: str) -> None:
        if not auth_service.user_has_management_access(db, user_id=authenticated_user_id):
            raise HTTPException(status_code=403, detail="Management access is required.")

    def require_admin_access(db: Session, authenticated_user_id: str) -> None:
        if not auth_service.user_is_admin(db, user_id=authenticated_user_id):
            raise HTTPException(status_code=403, detail="Admin access is required.")

    def stream_report(rows: list[dict], report_format: str) -> StreamingResponse:
        normalized_format = (report_format or "").strip().lower()
        if normalized_format == "csv":
            fieldnames = sorted({key for row in rows for key in row.keys()})
            csv_buffer = StringIO()
            writer = csv.DictWriter(csv_buffer, fieldnames=fieldnames)
            writer.writeheader()
            for row in rows:
                writer.writerow(row)
            payload = csv_buffer.getvalue().encode("utf-8")
            return StreamingResponse(
                BytesIO(payload),
                media_type="text/csv",
                headers={"Content-Disposition": 'attachment; filename="management-report.csv"'},
            )
        if normalized_format == "json":
            payload = json.dumps(rows, ensure_ascii=True, indent=2).encode("utf-8")
            return StreamingResponse(
                BytesIO(payload),
                media_type="application/json",
                headers={"Content-Disposition": 'attachment; filename="management-report.json"'},
            )
        if normalized_format != "pdf":
            raise HTTPException(status_code=400, detail="Unsupported report format.")

        buffer = BytesIO()
        pdf = canvas.Canvas(buffer, pagesize=A4)
        width, height = A4
        y = height - 18 * mm
        pdf.setFont("Helvetica-Bold", 14)
        pdf.drawString(15 * mm, y, "Management Report")
        y -= 10 * mm
        pdf.setFont("Helvetica", 9)
        for row in rows[:120]:
            line = " | ".join(f"{key}: {value}" for key, value in row.items() if value not in (None, ""))
            if y < 15 * mm:
                pdf.showPage()
                pdf.setFont("Helvetica", 9)
                y = height - 15 * mm
            pdf.drawString(15 * mm, y, line[:145])
            y -= 6 * mm
        pdf.save()
        buffer.seek(0)
        return StreamingResponse(
            buffer,
            media_type="application/pdf",
            headers={"Content-Disposition": 'attachment; filename="management-report.pdf"'},
        )

    @router.get("/overview", response_model=ManagementOverviewResponse)
    def get_management_overview(
        db: Session = Depends(get_db),
        authenticated_user_id: str = Depends(require_authenticated_user_id),
    ):
        require_management_access(db, authenticated_user_id)
        return management_service.get_overview(db)

    @router.post("/notes", response_model=ManagementNoteResponse)
    def create_management_note(
        payload: ManagementNoteCreateRequest,
        db: Session = Depends(get_db),
        authenticated_user_id: str = Depends(require_authenticated_user_id),
    ):
        require_management_access(db, authenticated_user_id)
        try:
            note = management_service.create_note(
                db,
                author_user_id=authenticated_user_id,
                request_id=payload.requestId,
                target_user_id=payload.targetUserId,
                note_text=payload.noteText,
            )
            admin_audit_service.log_action(
                db,
                admin_user_id=authenticated_user_id,
                action_type="management_note_created",
                target_type="management_note",
                target_id=note.id,
                target_label=payload.requestId or payload.targetUserId or note.id,
                detail=f"Internal note added. {(payload.noteText or '').strip()[:180]}",
            )
            overview = management_service.get_overview(db)
            return next(item for item in overview["notes"] if item["id"] == note.id)
        except ManagementServiceError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @router.post("/reply-templates", response_model=ManagementReplyTemplateResponse)
    def create_reply_template(
        payload: ManagementReplyTemplateCreateRequest,
        db: Session = Depends(get_db),
        authenticated_user_id: str = Depends(require_authenticated_user_id),
    ):
        require_admin_access(db, authenticated_user_id)
        try:
            item = management_service.create_reply_template(
                db,
                created_by_user_id=authenticated_user_id,
                title=payload.title,
                category=payload.category,
                body=payload.body,
            )
            admin_audit_service.log_action(
                db,
                admin_user_id=authenticated_user_id,
                action_type="reply_template_created",
                target_type="reply_template",
                target_id=item.id,
                target_label=item.title,
                detail=f"Reply template '{item.title}' created.",
            )
            return management_service.serialize_reply_template(item)
        except ManagementServiceError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @router.post("/requests/bulk-status")
    def bulk_update_management_requests(
        payload: ManagementBulkStatusRequest,
        db: Session = Depends(get_db),
        authenticated_user_id: str = Depends(require_authenticated_user_id),
    ):
        require_management_access(db, authenticated_user_id)
        try:
            updated_items = contact_request_service.bulk_update_status(
                db,
                request_ids=payload.requestIds,
                status=payload.status,
                acting_user_id=authenticated_user_id,
            )
            admin_audit_service.log_action(
                db,
                admin_user_id=authenticated_user_id,
                action_type="bulk_request_status_updated",
                target_type="contact_request",
                target_label=f"{len(updated_items)} requests",
                detail=f"Bulk updated {len(updated_items)} requests to {payload.status}.",
            )
            return {"updatedCount": len(updated_items)}
        except ContactRequestServiceError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @router.get("/report")
    def export_management_report(
        format: str = Query(default="csv"),
        db: Session = Depends(get_db),
        authenticated_user_id: str = Depends(require_authenticated_user_id),
    ):
        require_management_access(db, authenticated_user_id)
        rows = management_service.list_report_rows(db)
        admin_audit_service.log_action(
            db,
            admin_user_id=authenticated_user_id,
            action_type="management_report_exported",
            target_type="management_report",
            target_label=format.lower(),
            detail=f"Management report exported as {format.lower()}.",
        )
        return stream_report(rows, format)

    return router

