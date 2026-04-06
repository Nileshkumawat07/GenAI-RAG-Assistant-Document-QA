from sqlalchemy.orm import Session

from fastapi import APIRouter, Depends, Header, HTTPException

from app.core.database import get_db
from app.schemas.linked_provider import (
    LinkedProviderCreateRequest,
    LinkedProviderDeleteRequest,
    LinkedProviderResponse,
)
from app.services.auth_service import AuthService, AuthServiceError
from app.services.linked_provider_service import LinkedProviderService, LinkedProviderServiceError


def build_linked_provider_router(linked_provider_service: LinkedProviderService, auth_service: AuthService) -> APIRouter:
    router = APIRouter(prefix="/linked-providers", tags=["linked-providers"])

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

    def serialize_item(item):
        return LinkedProviderResponse(
            providerKey=item.provider_key,
            providerEmail=item.provider_email,
            providerDisplayName=item.provider_display_name,
            providerIdentifier=item.provider_identifier,
            verified=item.verified,
            linkedAt=item.linked_at,
        )

    @router.get("", response_model=list[LinkedProviderResponse])
    def list_linked_providers(
        db: Session = Depends(get_db),
        authenticated_user_id: str = Depends(require_authenticated_user_id),
    ):
        try:
            items = linked_provider_service.list_providers(db, user_id=authenticated_user_id)
            return [serialize_item(item) for item in items]
        except LinkedProviderServiceError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @router.post("/{provider_key}", response_model=LinkedProviderResponse)
    def link_provider(
        provider_key: str,
        payload: LinkedProviderCreateRequest,
        db: Session = Depends(get_db),
        authenticated_user_id: str = Depends(require_authenticated_user_id),
    ):
        try:
            item = linked_provider_service.link_provider(
                db,
                user_id=authenticated_user_id,
                provider_key=provider_key,
                provider_email=payload.providerEmail,
                provider_display_name=payload.providerDisplayName,
                provider_identifier=payload.providerIdentifier,
                current_password=payload.currentPassword,
            )
            return serialize_item(item)
        except LinkedProviderServiceError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @router.delete("/{provider_key}")
    def unlink_provider(
        provider_key: str,
        payload: LinkedProviderDeleteRequest,
        db: Session = Depends(get_db),
        authenticated_user_id: str = Depends(require_authenticated_user_id),
    ):
        try:
            linked_provider_service.unlink_provider(
                db,
                user_id=authenticated_user_id,
                provider_key=provider_key,
                current_password=payload.currentPassword,
            )
            return {"message": "Provider unlinked successfully."}
        except LinkedProviderServiceError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    return router
