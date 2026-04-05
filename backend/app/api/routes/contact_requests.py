from sqlalchemy.orm import Session

from fastapi import APIRouter, Depends, HTTPException, Query

from app.core.database import get_db
from app.schemas.contact import (
    ContactRequestCreate,
    ContactRequestResponse,
    ContactRequestUpdateStatus,
)
from app.services.contact_request_service import ContactRequestService, ContactRequestServiceError


def build_contact_request_router(contact_request_service: ContactRequestService) -> APIRouter:
    router = APIRouter(prefix="/contact-requests", tags=["contact-requests"])

    def serialize_contact_request(item):
        return ContactRequestResponse(
            id=item.id,
            userId=item.user_id,
            category=item.category,
            title=item.title,
            requestCode=item.request_code,
            status=item.status,
            values=item.values,
            createdAt=item.created_at,
        )

    @router.post("", response_model=ContactRequestResponse)
    def create_contact_request(payload: ContactRequestCreate, db: Session = Depends(get_db)):
        try:
            item = contact_request_service.create_request(
                db,
                user_id=payload.userId,
                category=payload.category,
                title=payload.title,
                values=payload.values,
            )
            return serialize_contact_request(item)
        except ContactRequestServiceError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @router.get("", response_model=list[ContactRequestResponse])
    def list_contact_requests(user_id: str = Query(..., alias="userId"), db: Session = Depends(get_db)):
        try:
            items = contact_request_service.list_requests(db, user_id=user_id)
            return [serialize_contact_request(item) for item in items]
        except ContactRequestServiceError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @router.patch("/{request_id}", response_model=ContactRequestResponse)
    def update_contact_request_status(
        request_id: str,
        payload: ContactRequestUpdateStatus,
        db: Session = Depends(get_db),
    ):
        try:
            item = contact_request_service.update_status(
                db,
                user_id=payload.userId,
                request_id=request_id,
                status=payload.status,
            )
            return serialize_contact_request(item)
        except ContactRequestServiceError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @router.delete("/{request_id}")
    def delete_contact_request(request_id: str, user_id: str = Query(..., alias="userId"), db: Session = Depends(get_db)):
        try:
            contact_request_service.delete_request(db, user_id=user_id, request_id=request_id)
            return {"message": "Contact request deleted successfully."}
        except ContactRequestServiceError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    return router
