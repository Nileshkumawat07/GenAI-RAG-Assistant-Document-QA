from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.orm import Session

from app.api.dependencies import require_authenticated_user_id
from app.core.database import get_db
from app.schemas.workspace_hub import (
    AddTeamMemberRequest,
    AnalyticsResponse,
    ChatMessageResponse,
    ChatThreadResponse,
    CreateChatMessageRequest,
    CreateChatThreadRequest,
    CreateTeamWorkspaceRequest,
    DashboardResponse,
    TeamWorkspaceResponse,
    UpdateTeamMemberRequest,
    WorkspaceUserSummaryResponse,
    WorkspaceNotificationResponse,
)
from app.services.workspace_hub_service import WorkspaceHubService, WorkspaceHubServiceError


def build_workspace_hub_router(workspace_hub_service: WorkspaceHubService) -> APIRouter:
    router = APIRouter(prefix="/workspace", tags=["workspace"])

    @router.get("/dashboard", response_model=DashboardResponse)
    def get_dashboard(
        db: Session = Depends(get_db),
        authenticated_user_id: str = Depends(require_authenticated_user_id),
    ):
        return workspace_hub_service.get_dashboard(db, user_id=authenticated_user_id)

    @router.get("/notifications", response_model=list[WorkspaceNotificationResponse])
    def list_notifications(
        db: Session = Depends(get_db),
        authenticated_user_id: str = Depends(require_authenticated_user_id),
    ):
        return workspace_hub_service.list_notifications(db, user_id=authenticated_user_id)

    @router.post("/notifications/{notification_id}/read", response_model=WorkspaceNotificationResponse)
    def mark_notification_read(
        notification_id: str,
        db: Session = Depends(get_db),
        authenticated_user_id: str = Depends(require_authenticated_user_id),
    ):
        try:
            return workspace_hub_service.mark_notification_read(
                db,
                user_id=authenticated_user_id,
                notification_id=notification_id,
            )
        except WorkspaceHubServiceError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @router.post("/notifications/read-all")
    def mark_all_notifications_read(
        db: Session = Depends(get_db),
        authenticated_user_id: str = Depends(require_authenticated_user_id),
    ):
        return workspace_hub_service.mark_all_notifications_read(db, user_id=authenticated_user_id)

    @router.get("/analytics", response_model=AnalyticsResponse)
    def get_analytics(
        db: Session = Depends(get_db),
        authenticated_user_id: str = Depends(require_authenticated_user_id),
    ):
        return workspace_hub_service.get_analytics(db, user_id=authenticated_user_id)

    @router.get("/chats", response_model=list[ChatThreadResponse])
    def list_threads(
        db: Session = Depends(get_db),
        authenticated_user_id: str = Depends(require_authenticated_user_id),
    ):
        return workspace_hub_service.list_threads(db, user_id=authenticated_user_id)

    @router.post("/chats", response_model=ChatThreadResponse)
    def create_thread(
        payload: CreateChatThreadRequest,
        db: Session = Depends(get_db),
        authenticated_user_id: str = Depends(require_authenticated_user_id),
    ):
        try:
            return workspace_hub_service.create_thread(
                db,
                user_id=authenticated_user_id,
                title=payload.title,
                opening_message=payload.openingMessage,
            )
        except WorkspaceHubServiceError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @router.get("/chats/{thread_id}/messages", response_model=list[ChatMessageResponse])
    def list_thread_messages(
        thread_id: str,
        db: Session = Depends(get_db),
        authenticated_user_id: str = Depends(require_authenticated_user_id),
    ):
        try:
            return workspace_hub_service.list_thread_messages(db, user_id=authenticated_user_id, thread_id=thread_id)
        except WorkspaceHubServiceError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc

    @router.post("/chats/{thread_id}/messages", response_model=ChatMessageResponse)
    def add_thread_message(
        thread_id: str,
        payload: CreateChatMessageRequest,
        db: Session = Depends(get_db),
        authenticated_user_id: str = Depends(require_authenticated_user_id),
    ):
        try:
            return workspace_hub_service.add_thread_message(
                db,
                user_id=authenticated_user_id,
                thread_id=thread_id,
                role=payload.role,
                content=payload.content,
            )
        except WorkspaceHubServiceError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @router.get("/teams", response_model=list[TeamWorkspaceResponse])
    def list_teams(
        db: Session = Depends(get_db),
        authenticated_user_id: str = Depends(require_authenticated_user_id),
    ):
        return workspace_hub_service.list_teams(db, user_id=authenticated_user_id)

    @router.get("/users", response_model=list[WorkspaceUserSummaryResponse])
    def list_workspace_users(
        db: Session = Depends(get_db),
        authenticated_user_id: str = Depends(require_authenticated_user_id),
    ):
        return workspace_hub_service.list_workspace_users(db, user_id=authenticated_user_id)

    @router.post("/teams", response_model=TeamWorkspaceResponse)
    def create_team(
        payload: CreateTeamWorkspaceRequest,
        db: Session = Depends(get_db),
        authenticated_user_id: str = Depends(require_authenticated_user_id),
    ):
        try:
            return workspace_hub_service.create_team(
                db,
                user_id=authenticated_user_id,
                name=payload.name,
                description=payload.description,
            )
        except WorkspaceHubServiceError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @router.post("/teams/{team_id}/members", response_model=TeamWorkspaceResponse)
    def add_team_member(
        team_id: str,
        payload: AddTeamMemberRequest,
        db: Session = Depends(get_db),
        authenticated_user_id: str = Depends(require_authenticated_user_id),
    ):
        try:
            return workspace_hub_service.add_team_member(
                db,
                actor_user_id=authenticated_user_id,
                team_id=team_id,
                target_user_id=payload.userId,
                role=payload.role,
            )
        except WorkspaceHubServiceError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @router.patch("/teams/{team_id}/members/{membership_id}", response_model=TeamWorkspaceResponse)
    def update_team_member(
        team_id: str,
        membership_id: str,
        payload: UpdateTeamMemberRequest,
        db: Session = Depends(get_db),
        authenticated_user_id: str = Depends(require_authenticated_user_id),
    ):
        try:
            return workspace_hub_service.update_team_member(
                db,
                actor_user_id=authenticated_user_id,
                team_id=team_id,
                membership_id=membership_id,
                role=payload.role,
                status=payload.status,
            )
        except WorkspaceHubServiceError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    return router
