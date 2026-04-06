from sqlalchemy.orm import Session

from fastapi import APIRouter, Depends, Header, HTTPException, Query, Request
from fastapi.responses import HTMLResponse, RedirectResponse

from app.core.config import APP_BASE_URL
from app.core.database import get_db
from app.schemas.linked_provider import (
    LinkedProviderAuthorizeRequest,
    LinkedProviderAuthorizeResponse,
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
    router = APIRouter(tags=["linked-providers"])

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

    def serialize_item(item) -> LinkedProviderResponse:
        return LinkedProviderResponse(
            userId=item.user_id,
            provider=item.provider,
            providerId=item.provider_id,
            email=item.email,
        )

    def build_callback_url(request: Request, provider_key: str) -> str:
        public_base_url = APP_BASE_URL or str(request.base_url).rstrip("/")
        return f"{public_base_url.rstrip('/')}/auth/{provider_key}/callback"

    def handle_provider_oauth_callback(
        provider_key: str,
        request: Request,
        code: str | None,
        state: str | None,
        error: str | None,
        error_description: str | None,
        db: Session,
    ) -> HTMLResponse:
        if error:
            message = error_description or error or "Provider sign-in was cancelled."
            return HTMLResponse(
                social_oauth_service.build_popup_response_html(
                    provider_key=provider_key,
                    success=False,
                    payload={"message": message, "frontendOrigin": ""},
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
            callback_url = build_callback_url(request, provider_key)
            profile = social_oauth_service.complete_callback(
                db,
                provider_key=provider_key,
                code=code,
                state=state,
                callback_url=callback_url,
            )
            linked_item = linked_provider_service.link_provider(
                db,
                user_id=profile.user_id,
                provider=provider_key,
                provider_id=profile.provider_user_id,
                email=profile.email,
            )
            return HTMLResponse(
                social_oauth_service.build_popup_response_html(
                    provider_key=provider_key,
                    success=True,
                    payload={
                        "frontendOrigin": profile.frontend_origin,
                        "userId": linked_item.user_id,
                        "provider": linked_item.provider,
                        "providerId": linked_item.provider_id,
                        "email": linked_item.email,
                        "displayName": profile.display_name,
                    },
                )
            )
        except (SocialOAuthServiceError, LinkedProviderServiceError) as exc:
            return HTMLResponse(
                social_oauth_service.build_popup_response_html(
                    provider_key=provider_key,
                    success=False,
                    payload={"message": str(exc), "frontendOrigin": ""},
                )
            )

    @router.get("/linked-providers", response_model=list[LinkedProviderResponse])
    def list_linked_providers(
        db: Session = Depends(get_db),
        authenticated_user_id: str = Depends(require_authenticated_user_id),
    ):
        try:
            items = linked_provider_service.list_providers(db, user_id=authenticated_user_id)
            return [serialize_item(item) for item in items]
        except LinkedProviderServiceError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @router.post("/linked-providers/{provider_key}/authorize-url", response_model=LinkedProviderAuthorizeResponse)
    def get_provider_authorize_url(
        provider_key: str,
        payload: LinkedProviderAuthorizeRequest,
        request: Request,
        db: Session = Depends(get_db),
        authenticated_user_id: str = Depends(require_authenticated_user_id),
    ):
        try:
            callback_url = build_callback_url(request, provider_key)
            authorize_url = social_oauth_service.create_authorize_url(
                db,
                provider_key=provider_key,
                user_id=authenticated_user_id,
                frontend_origin=payload.frontendOrigin or "",
                callback_url=callback_url,
            )
            return LinkedProviderAuthorizeResponse(authorizeUrl=authorize_url)
        except SocialOAuthServiceError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @router.get("/linked-providers/{provider_key}/connect")
    def redirect_to_provider(
        provider_key: str,
        request: Request,
        frontend_origin: str | None = Query(default=None, alias="frontendOrigin"),
        db: Session = Depends(get_db),
        authenticated_user_id: str = Depends(require_authenticated_user_id),
    ):
        try:
            callback_url = build_callback_url(request, provider_key)
            authorize_url = social_oauth_service.create_authorize_url(
                db,
                provider_key=provider_key,
                user_id=authenticated_user_id,
                frontend_origin=frontend_origin or "",
                callback_url=callback_url,
            )
            return RedirectResponse(url=authorize_url, status_code=307)
        except SocialOAuthServiceError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @router.get("/linked-providers/oauth/{provider_key}/callback", response_class=HTMLResponse, name="provider_oauth_callback")
    def provider_oauth_callback(
        provider_key: str,
        request: Request,
        code: str | None = Query(default=None),
        state: str | None = Query(default=None),
        error: str | None = Query(default=None),
        error_description: str | None = Query(default=None),
        db: Session = Depends(get_db),
    ):
        return handle_provider_oauth_callback(
            provider_key=provider_key,
            request=request,
            code=code,
            state=state,
            error=error,
            error_description=error_description,
            db=db,
        )

    @router.get("/auth/{provider_key}/callback", response_class=HTMLResponse)
    def provider_oauth_callback_auth_alias(
        provider_key: str,
        request: Request,
        code: str | None = Query(default=None),
        state: str | None = Query(default=None),
        error: str | None = Query(default=None),
        error_description: str | None = Query(default=None),
        db: Session = Depends(get_db),
    ):
        return handle_provider_oauth_callback(
            provider_key=provider_key,
            request=request,
            code=code,
            state=state,
            error=error,
            error_description=error_description,
            db=db,
        )

    @router.delete("/linked-providers/{provider_key}")
    def unlink_provider(
        provider_key: str,
        db: Session = Depends(get_db),
        authenticated_user_id: str = Depends(require_authenticated_user_id),
    ):
        try:
            linked_provider_service.unlink_provider(
                db,
                user_id=authenticated_user_id,
                provider=provider_key,
            )
            return {"message": "Provider unlinked successfully."}
        except LinkedProviderServiceError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    return router
