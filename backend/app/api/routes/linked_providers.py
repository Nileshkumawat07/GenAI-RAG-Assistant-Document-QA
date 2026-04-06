from sqlalchemy.orm import Session

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request
from fastapi.responses import HTMLResponse

from app.core.database import get_db
from app.schemas.linked_provider import (
    LinkedProviderAuthorizeRequest,
    LinkedProviderCreateRequest,
    LinkedProviderDeleteRequest,
    LinkedProviderResponse,
)
from app.services.auth_service import AuthService, AuthServiceError
from app.services.linked_provider_service import LinkedProviderService, LinkedProviderServiceError
from app.services.social_oauth_service import SocialOAuthService, SocialOAuthServiceError


def build_linked_provider_router(
    linked_provider_service: LinkedProviderService,
    auth_service: AuthService,
    social_oauth_service: SocialOAuthService,
) -> APIRouter:
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
            callbackProviderId=item.callback_provider_id,
            callbackEmail=item.callback_email,
            callbackDisplayName=item.callback_display_name,
            callbackUserId=item.callback_user_id,
            callbackReceivedAt=item.callback_received_at,
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

    @router.post("/{provider_key}/authorize-url")
    def get_provider_authorize_url(
        provider_key: str,
        payload: LinkedProviderAuthorizeRequest,
        request: Request,
        db: Session = Depends(get_db),
        authenticated_user_id: str = Depends(require_authenticated_user_id),
    ):
        try:
            callback_url = str(request.url_for("provider_oauth_callback", provider_key=provider_key))
            authorize_url = social_oauth_service.create_authorize_url(
                db,
                provider_key=provider_key,
                user_id=authenticated_user_id,
                frontend_origin=payload.frontendOrigin,
                callback_url=callback_url,
            )
            return {
                "authorizeUrl": authorize_url,
                "callbackOrigin": str(request.base_url).rstrip("/"),
            }
        except SocialOAuthServiceError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @router.get("/oauth/{provider_key}/callback", response_class=HTMLResponse, name="provider_oauth_callback")
    def provider_oauth_callback(
        provider_key: str,
        request: Request,
        code: str | None = Query(default=None),
        state: str | None = Query(default=None),
        error: str | None = Query(default=None),
        error_description: str | None = Query(default=None),
        db: Session = Depends(get_db),
    ):
        if error:
            message = error_description or error or "Provider sign-in was cancelled."
            return HTMLResponse(
                social_oauth_service.build_popup_response_html(
                    provider_key=provider_key,
                    success=False,
                    payload={
                        "message": message,
                        "frontendOrigin": "",
                    },
                )
            )

        if not code or not state:
            return HTMLResponse(
                social_oauth_service.build_popup_response_html(
                    provider_key=provider_key,
                    success=False,
                    payload={
                        "message": "Provider callback did not return the required authorization data.",
                        "frontendOrigin": "",
                    },
                )
            )

        try:
            callback_url = str(request.url_for("provider_oauth_callback", provider_key=provider_key))
            profile = social_oauth_service.complete_callback(
                db,
                provider_key=provider_key,
                code=code,
                state=state,
                callback_url=callback_url,
            )
            return HTMLResponse(
                social_oauth_service.build_popup_response_html(
                    provider_key=provider_key,
                    success=True,
                    payload={
                        "frontendOrigin": profile.frontend_origin,
                        "providerId": profile.provider_id,
                        "email": profile.email,
                        "displayName": profile.display_name,
                        "providerUserId": profile.provider_user_id,
                    },
                )
            )
        except SocialOAuthServiceError as exc:
            return HTMLResponse(
                social_oauth_service.build_popup_response_html(
                    provider_key=provider_key,
                    success=False,
                    payload={
                        "message": str(exc),
                        "frontendOrigin": "",
                    },
                )
            )

    @router.post("/{provider_key}", response_model=LinkedProviderResponse)
    def link_provider(
        provider_key: str,
        payload: LinkedProviderCreateRequest,
        db: Session = Depends(get_db),
        authenticated_user_id: str = Depends(require_authenticated_user_id),
    ):
        try:
            if payload.providerKey.strip().lower() != provider_key.strip().lower():
                raise LinkedProviderServiceError("Provider details do not match the selected account.")

            item = linked_provider_service.link_provider(
                db,
                user_id=authenticated_user_id,
                provider_key=provider_key,
                provider_email=payload.providerEmail,
                provider_display_name=payload.providerDisplayName,
                provider_identifier=payload.providerIdentifier,
                callback_provider_id=payload.callbackProviderId,
                callback_email=payload.callbackEmail,
                callback_display_name=payload.callbackDisplayName,
                callback_user_id=payload.callbackUserId,
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
