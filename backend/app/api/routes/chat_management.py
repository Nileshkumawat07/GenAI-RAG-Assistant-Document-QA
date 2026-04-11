import logging

from fastapi import APIRouter, Depends, File, Form, Header, HTTPException, Query, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse
from sqlalchemy.orm import Session

from app.api.dependencies import require_authenticated_user_id
from app.core.database import get_db
from app.schemas.chat_management import (
    ChatListItemResponse,
    ChatMessageContextResponse,
    ChatConversationPreferenceResponse,
    ChatConversationSidebarResponse,
    ChatMessagePageResponse,
    ChatMessageResponse,
    ChatOverviewResponse,
    ChatSearchResponse,
    ChatStorageSummaryResponse,
    ChatUserSummaryResponse,
    CommunityDetailResponse,
    CommunityGroupLinkRequest,
    ConversationBackgroundResponse,
    CreateCommunityRequest,
    CreateGroupRequest,
    DeleteMessageRequest,
    EditMessageRequest,
    FriendRequestResponse,
    GroupDetailResponse,
    GroupMembersRequest,
    MessageReactionRequest,
    SendFriendRequestRequest,
    SendMessageRequest,
    UpdateConversationPreferencesRequest,
    UpdateCommunityRequest,
    UpdateGroupMemberRoleRequest,
    UpdateGroupRequest,
)
from app.services.chat_management_service import ChatManagementService, ChatManagementServiceError

logger = logging.getLogger(__name__)


def build_chat_management_router(chat_management_service: ChatManagementService) -> APIRouter:
    router = APIRouter(prefix="/chat", tags=["chat"])

    def resolve_download_user_id(*, authorization: str | None, token: str | None) -> str:
        raw_token = token
        if not raw_token and authorization and authorization.startswith("Bearer "):
            raw_token = authorization.split(" ", 1)[1].strip()
        try:
            return chat_management_service.authenticate_websocket_user(raw_token)
        except ChatManagementServiceError as exc:
            raise HTTPException(status_code=401, detail=str(exc)) from exc

    @router.get("/overview", response_model=ChatOverviewResponse)
    async def get_overview(db: Session = Depends(get_db), authenticated_user_id: str = Depends(require_authenticated_user_id)):
        return chat_management_service.get_overview(db, current_user_id=authenticated_user_id)

    @router.get("/users/search", response_model=list[ChatUserSummaryResponse])
    async def search_users(q: str = Query(default=""), db: Session = Depends(get_db), authenticated_user_id: str = Depends(require_authenticated_user_id)):
        return chat_management_service.search_users(db, current_user_id=authenticated_user_id, query=q)

    @router.get("/search", response_model=ChatSearchResponse)
    async def search_chat(q: str = Query(default=""), db: Session = Depends(get_db), authenticated_user_id: str = Depends(require_authenticated_user_id)):
        return chat_management_service.search_chat(db, current_user_id=authenticated_user_id, query=q)

    @router.get("/friends/search", response_model=list[ChatUserSummaryResponse])
    async def search_friends(q: str = Query(default=""), db: Session = Depends(get_db), authenticated_user_id: str = Depends(require_authenticated_user_id)):
        return chat_management_service.search_friends(db, current_user_id=authenticated_user_id, query=q)

    @router.get("/friends", response_model=list[ChatUserSummaryResponse])
    async def list_friends(db: Session = Depends(get_db), authenticated_user_id: str = Depends(require_authenticated_user_id)):
        return chat_management_service.list_friends(db, current_user_id=authenticated_user_id)

    @router.delete("/friends/{friend_user_id}")
    async def remove_friend(friend_user_id: str, db: Session = Depends(get_db), authenticated_user_id: str = Depends(require_authenticated_user_id)):
        try:
            result = chat_management_service.remove_friend(db, current_user_id=authenticated_user_id, friend_user_id=friend_user_id)
            await chat_management_service.emit_friendship_update(user_ids=[authenticated_user_id, friend_user_id])
            return result
        except ChatManagementServiceError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @router.get("/groups", response_model=list[ChatListItemResponse])
    async def list_groups(db: Session = Depends(get_db), authenticated_user_id: str = Depends(require_authenticated_user_id)):
        return chat_management_service.list_groups(db, current_user_id=authenticated_user_id)

    @router.get("/communities", response_model=list[ChatListItemResponse])
    async def list_communities(db: Session = Depends(get_db), authenticated_user_id: str = Depends(require_authenticated_user_id)):
        return chat_management_service.list_communities(db, current_user_id=authenticated_user_id)

    @router.post("/friend-requests", response_model=FriendRequestResponse)
    async def send_friend_request(payload: SendFriendRequestRequest, db: Session = Depends(get_db), authenticated_user_id: str = Depends(require_authenticated_user_id)):
        try:
            result = chat_management_service.send_friend_request(db, current_user_id=authenticated_user_id, receiver_user_id=payload.receiverId)
            await chat_management_service.emit_friend_request_update(sender_user_id=authenticated_user_id, receiver_user_id=payload.receiverId)
            return result
        except ChatManagementServiceError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @router.post("/friend-requests/{request_id}/accept")
    async def accept_friend_request(request_id: str, db: Session = Depends(get_db), authenticated_user_id: str = Depends(require_authenticated_user_id)):
        try:
            result = chat_management_service.accept_friend_request(db, current_user_id=authenticated_user_id, request_id=request_id)
            await chat_management_service.emit_friendship_update(user_ids=[result["senderUserId"], result["receiverUserId"]])
            return result
        except ChatManagementServiceError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @router.post("/friend-requests/{request_id}/reject")
    async def reject_friend_request(request_id: str, db: Session = Depends(get_db), authenticated_user_id: str = Depends(require_authenticated_user_id)):
        try:
            return chat_management_service.reject_friend_request(db, current_user_id=authenticated_user_id, request_id=request_id)
        except ChatManagementServiceError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @router.get("/groups/{group_id}", response_model=GroupDetailResponse)
    async def get_group_detail(group_id: str, db: Session = Depends(get_db), authenticated_user_id: str = Depends(require_authenticated_user_id)):
        try:
            return chat_management_service.get_group_detail(db, current_user_id=authenticated_user_id, group_id=group_id)
        except ChatManagementServiceError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @router.post("/groups", response_model=GroupDetailResponse)
    async def create_group(
        name: str = Form(...),
        description: str = Form(default=""),
        member_ids: str = Form(default="[]"),
        image: UploadFile | None = File(default=None),
        db: Session = Depends(get_db),
        authenticated_user_id: str = Depends(require_authenticated_user_id),
    ):
        try:
            payload = CreateGroupRequest(name=name, description=description or None, memberIds=member_ids and __import__("json").loads(member_ids) or [])
            result = chat_management_service.create_group(
                db,
                current_user_id=authenticated_user_id,
                name=payload.name,
                description=payload.description,
                member_ids=payload.memberIds,
                image_file=image,
            )
            await chat_management_service.emit_group_refresh(group_id=result["id"])
            return result
        except (ChatManagementServiceError, ValueError) as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @router.patch("/groups/{group_id}", response_model=GroupDetailResponse)
    async def update_group(
        group_id: str,
        name: str = Form(default=""),
        description: str = Form(default=""),
        is_muted: str = Form(default=""),
        image: UploadFile | None = File(default=None),
        db: Session = Depends(get_db),
        authenticated_user_id: str = Depends(require_authenticated_user_id),
    ):
        try:
            payload = UpdateGroupRequest(
                name=name or None,
                description=description if description != "" else None,
                isMuted=None if is_muted == "" else is_muted.lower() == "true",
            )
            result = chat_management_service.update_group(
                db,
                current_user_id=authenticated_user_id,
                group_id=group_id,
                name=payload.name,
                description=payload.description,
                is_muted=payload.isMuted,
                image_file=image,
            )
            await chat_management_service.emit_group_refresh(group_id=group_id)
            return result
        except ChatManagementServiceError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @router.post("/groups/{group_id}/members", response_model=GroupDetailResponse)
    async def add_group_members(group_id: str, payload: GroupMembersRequest, db: Session = Depends(get_db), authenticated_user_id: str = Depends(require_authenticated_user_id)):
        try:
            result = chat_management_service.add_group_members(db, current_user_id=authenticated_user_id, group_id=group_id, user_ids=payload.userIds)
            await chat_management_service.emit_group_refresh(group_id=group_id)
            return result
        except ChatManagementServiceError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @router.delete("/groups/{group_id}/members/{user_id}", response_model=GroupDetailResponse)
    async def remove_group_member(group_id: str, user_id: str, db: Session = Depends(get_db), authenticated_user_id: str = Depends(require_authenticated_user_id)):
        try:
            result = chat_management_service.remove_group_member(db, current_user_id=authenticated_user_id, group_id=group_id, user_id=user_id)
            await chat_management_service.emit_group_refresh(group_id=group_id)
            return result
        except ChatManagementServiceError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @router.patch("/groups/{group_id}/members/{user_id}", response_model=GroupDetailResponse)
    async def update_group_member_role(group_id: str, user_id: str, payload: UpdateGroupMemberRoleRequest, db: Session = Depends(get_db), authenticated_user_id: str = Depends(require_authenticated_user_id)):
        try:
            result = chat_management_service.update_group_member_role(db, current_user_id=authenticated_user_id, group_id=group_id, user_id=user_id, role=payload.role)
            await chat_management_service.emit_group_refresh(group_id=group_id)
            return result
        except ChatManagementServiceError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @router.post("/groups/{group_id}/exit")
    async def exit_group(group_id: str, db: Session = Depends(get_db), authenticated_user_id: str = Depends(require_authenticated_user_id)):
        try:
            result = chat_management_service.exit_group(db, current_user_id=authenticated_user_id, group_id=group_id)
            await chat_management_service.emit_group_refresh(group_id=group_id)
            return result
        except ChatManagementServiceError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @router.delete("/groups/{group_id}")
    async def delete_group(group_id: str, db: Session = Depends(get_db), authenticated_user_id: str = Depends(require_authenticated_user_id)):
        try:
            result = chat_management_service.delete_group(db, current_user_id=authenticated_user_id, group_id=group_id)
            await chat_management_service.emit_group_refresh(group_id=group_id)
            return result
        except ChatManagementServiceError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @router.get("/communities/{community_id}", response_model=CommunityDetailResponse)
    async def get_community_detail(community_id: str, db: Session = Depends(get_db), authenticated_user_id: str = Depends(require_authenticated_user_id)):
        try:
            return chat_management_service.get_community_detail(db, current_user_id=authenticated_user_id, community_id=community_id)
        except ChatManagementServiceError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @router.post("/communities", response_model=CommunityDetailResponse)
    async def create_community(
        name: str = Form(...),
        description: str = Form(default=""),
        image: UploadFile | None = File(default=None),
        db: Session = Depends(get_db),
        authenticated_user_id: str = Depends(require_authenticated_user_id),
    ):
        try:
            payload = CreateCommunityRequest(name=name, description=description or None)
            result = chat_management_service.create_community(db, current_user_id=authenticated_user_id, name=payload.name, description=payload.description, image_file=image)
            await chat_management_service.emit_community_refresh(community_id=result["id"])
            return result
        except ChatManagementServiceError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @router.patch("/communities/{community_id}", response_model=CommunityDetailResponse)
    async def update_community(
        community_id: str,
        name: str = Form(default=""),
        description: str = Form(default=""),
        is_muted: str = Form(default=""),
        image: UploadFile | None = File(default=None),
        db: Session = Depends(get_db),
        authenticated_user_id: str = Depends(require_authenticated_user_id),
    ):
        try:
            payload = UpdateCommunityRequest(name=name or None, description=description if description != "" else None, isMuted=None if is_muted == "" else is_muted.lower() == "true")
            result = chat_management_service.update_community(db, current_user_id=authenticated_user_id, community_id=community_id, name=payload.name, description=payload.description, is_muted=payload.isMuted, image_file=image)
            await chat_management_service.emit_community_refresh(community_id=community_id)
            return result
        except ChatManagementServiceError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @router.post("/communities/{community_id}/join", response_model=CommunityDetailResponse)
    async def join_community(community_id: str, db: Session = Depends(get_db), authenticated_user_id: str = Depends(require_authenticated_user_id)):
        try:
            result = chat_management_service.join_community(db, current_user_id=authenticated_user_id, community_id=community_id)
            await chat_management_service.emit_community_refresh(community_id=community_id)
            return result
        except ChatManagementServiceError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @router.post("/communities/{community_id}/leave")
    async def leave_community(community_id: str, db: Session = Depends(get_db), authenticated_user_id: str = Depends(require_authenticated_user_id)):
        try:
            result = chat_management_service.leave_community(db, current_user_id=authenticated_user_id, community_id=community_id)
            await chat_management_service.emit_community_refresh(community_id=community_id)
            return result
        except ChatManagementServiceError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @router.delete("/communities/{community_id}")
    async def delete_community(community_id: str, db: Session = Depends(get_db), authenticated_user_id: str = Depends(require_authenticated_user_id)):
        try:
            result = chat_management_service.delete_community(db, current_user_id=authenticated_user_id, community_id=community_id)
            await chat_management_service.emit_community_refresh(community_id=community_id)
            return result
        except ChatManagementServiceError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @router.post("/communities/{community_id}/groups", response_model=CommunityDetailResponse)
    async def add_group_to_community(community_id: str, payload: CommunityGroupLinkRequest, db: Session = Depends(get_db), authenticated_user_id: str = Depends(require_authenticated_user_id)):
        try:
            result = chat_management_service.add_group_to_community(db, current_user_id=authenticated_user_id, community_id=community_id, group_id=payload.groupId)
            await chat_management_service.emit_community_refresh(community_id=community_id)
            return result
        except ChatManagementServiceError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @router.delete("/communities/{community_id}/groups/{group_id}", response_model=CommunityDetailResponse)
    async def remove_group_from_community(community_id: str, group_id: str, db: Session = Depends(get_db), authenticated_user_id: str = Depends(require_authenticated_user_id)):
        try:
            result = chat_management_service.remove_group_from_community(db, current_user_id=authenticated_user_id, community_id=community_id, group_id=group_id)
            await chat_management_service.emit_community_refresh(community_id=community_id)
            return result
        except ChatManagementServiceError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @router.get("/conversations/{conversation_type}/{conversation_id}/messages", response_model=ChatMessagePageResponse)
    async def get_conversation_messages(conversation_type: str, conversation_id: str, before_message_id: str | None = Query(default=None), limit: int = Query(default=40), db: Session = Depends(get_db), authenticated_user_id: str = Depends(require_authenticated_user_id)):
        try:
            return chat_management_service.get_conversation_messages(db, current_user_id=authenticated_user_id, conversation_type=conversation_type, conversation_id=conversation_id, limit=limit, before_message_id=before_message_id)
        except ChatManagementServiceError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @router.get("/conversations/{conversation_type}/{conversation_id}/messages/{message_id}/context", response_model=ChatMessageContextResponse)
    async def get_conversation_message_context(
        conversation_type: str,
        conversation_id: str,
        message_id: str,
        window: int = Query(default=14),
        db: Session = Depends(get_db),
        authenticated_user_id: str = Depends(require_authenticated_user_id),
    ):
        try:
            return chat_management_service.get_message_context(
                db,
                current_user_id=authenticated_user_id,
                conversation_type=conversation_type,
                conversation_id=conversation_id,
                message_id=message_id,
                window=window,
            )
        except ChatManagementServiceError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @router.get("/conversations/{conversation_type}/{conversation_id}/sidebar", response_model=ChatConversationSidebarResponse)
    async def get_conversation_sidebar(conversation_type: str, conversation_id: str, db: Session = Depends(get_db), authenticated_user_id: str = Depends(require_authenticated_user_id)):
        try:
            return chat_management_service.get_conversation_sidebar(
                db,
                current_user_id=authenticated_user_id,
                conversation_type=conversation_type,
                conversation_id=conversation_id,
            )
        except ChatManagementServiceError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @router.patch("/conversations/{conversation_type}/{conversation_id}/preferences", response_model=ChatConversationPreferenceResponse)
    async def update_conversation_preferences(
        conversation_type: str,
        conversation_id: str,
        payload: UpdateConversationPreferencesRequest,
        db: Session = Depends(get_db),
        authenticated_user_id: str = Depends(require_authenticated_user_id),
    ):
        try:
            result = chat_management_service.update_conversation_preferences(
                db,
                current_user_id=authenticated_user_id,
                conversation_type=conversation_type,
                conversation_id=conversation_id,
                is_muted=payload.isMuted,
                is_pinned=payload.isPinned,
                is_archived=payload.isArchived,
                is_blocked=payload.isBlocked,
                disappearing_mode=payload.disappearingMode,
            )
            await chat_management_service.emit_conversation_refresh(
                db,
                current_user_id=authenticated_user_id,
                conversation_type=conversation_type,
                conversation_id=conversation_id,
            )
            return result
        except ChatManagementServiceError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @router.post("/conversations/{conversation_type}/{conversation_id}/clear", response_model=ChatConversationPreferenceResponse)
    async def clear_conversation(
        conversation_type: str,
        conversation_id: str,
        db: Session = Depends(get_db),
        authenticated_user_id: str = Depends(require_authenticated_user_id),
    ):
        try:
            result = chat_management_service.clear_conversation(
                db,
                current_user_id=authenticated_user_id,
                conversation_type=conversation_type,
                conversation_id=conversation_id,
            )
            await chat_management_service.emit_conversation_refresh(
                db,
                current_user_id=authenticated_user_id,
                conversation_type=conversation_type,
                conversation_id=conversation_id,
            )
            return result
        except ChatManagementServiceError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @router.get("/conversations/{conversation_type}/{conversation_id}/storage", response_model=ChatStorageSummaryResponse)
    async def get_conversation_storage(
        conversation_type: str,
        conversation_id: str,
        db: Session = Depends(get_db),
        authenticated_user_id: str = Depends(require_authenticated_user_id),
    ):
        try:
            return chat_management_service.get_storage_summary(
                db,
                current_user_id=authenticated_user_id,
                conversation_type=conversation_type,
                conversation_id=conversation_id,
            )
        except ChatManagementServiceError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @router.post("/conversations/{conversation_type}/{conversation_id}/delete-media")
    async def delete_conversation_media(
        conversation_type: str,
        conversation_id: str,
        db: Session = Depends(get_db),
        authenticated_user_id: str = Depends(require_authenticated_user_id),
    ):
        try:
            result = chat_management_service.delete_conversation_media(
                db,
                current_user_id=authenticated_user_id,
                conversation_type=conversation_type,
                conversation_id=conversation_id,
            )
            await chat_management_service.emit_conversation_refresh(
                db,
                current_user_id=authenticated_user_id,
                conversation_type=conversation_type,
                conversation_id=conversation_id,
            )
            return result
        except ChatManagementServiceError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @router.post("/conversations/{conversation_type}/{conversation_id}/background", response_model=ConversationBackgroundResponse)
    async def update_conversation_background(
        conversation_type: str,
        conversation_id: str,
        file: UploadFile = File(...),
        db: Session = Depends(get_db),
        authenticated_user_id: str = Depends(require_authenticated_user_id),
    ):
        try:
            result = await chat_management_service.update_conversation_background(
                db,
                current_user_id=authenticated_user_id,
                conversation_type=conversation_type,
                conversation_id=conversation_id,
                upload=file,
            )
            await chat_management_service.emit_conversation_refresh(
                db,
                current_user_id=authenticated_user_id,
                conversation_type=conversation_type,
                conversation_id=conversation_id,
            )
            return result
        except ChatManagementServiceError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @router.delete("/conversations/{conversation_type}/{conversation_id}/background", response_model=ConversationBackgroundResponse)
    async def clear_conversation_background(
        conversation_type: str,
        conversation_id: str,
        db: Session = Depends(get_db),
        authenticated_user_id: str = Depends(require_authenticated_user_id),
    ):
        try:
            result = chat_management_service.clear_conversation_background(
                db,
                current_user_id=authenticated_user_id,
                conversation_type=conversation_type,
                conversation_id=conversation_id,
            )
            await chat_management_service.emit_conversation_refresh(
                db,
                current_user_id=authenticated_user_id,
                conversation_type=conversation_type,
                conversation_id=conversation_id,
            )
            return result
        except ChatManagementServiceError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @router.get("/conversations/{friend_user_id}/messages", response_model=list[ChatMessageResponse])
    async def get_direct_messages(friend_user_id: str, db: Session = Depends(get_db), authenticated_user_id: str = Depends(require_authenticated_user_id)):
        try:
            return chat_management_service.get_messages(db, current_user_id=authenticated_user_id, friend_user_id=friend_user_id)
        except ChatManagementServiceError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @router.post("/messages", response_model=ChatMessageResponse)
    async def send_message(payload: SendMessageRequest, db: Session = Depends(get_db), authenticated_user_id: str = Depends(require_authenticated_user_id)):
        try:
            conversation_type = payload.conversationType or "direct"
            conversation_id = payload.conversationId or payload.receiverId
            if conversation_type == "direct" and not conversation_id:
                raise ChatManagementServiceError("Receiver was not provided.")
            result = chat_management_service.send_conversation_text_message(db, current_user_id=authenticated_user_id, conversation_type=conversation_type, conversation_id=conversation_id or "", body=payload.body, reply_to_message_id=payload.replyToMessageId)
            await chat_management_service.emit_message_created(db, message_id=result["id"])
            return result
        except ChatManagementServiceError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @router.post("/messages/upload", response_model=ChatMessageResponse)
    async def upload_message_file(
        receiver_id: str = Form(default=""),
        conversation_type: str = Form(default="direct"),
        conversation_id: str = Form(default=""),
        body: str = Form(default=""),
        reply_to_message_id: str = Form(default=""),
        file: UploadFile = File(...),
        db: Session = Depends(get_db),
        authenticated_user_id: str = Depends(require_authenticated_user_id),
    ):
        try:
            result = await chat_management_service.send_uploaded_message(
                db,
                current_user_id=authenticated_user_id,
                receiver_user_id=receiver_id or None,
                conversation_type=conversation_type or "direct",
                conversation_id=conversation_id or None,
                upload=file,
                body=body,
                reply_to_message_id=reply_to_message_id or None,
            )
            await chat_management_service.emit_message_created(db, message_id=result["id"])
            return result
        except ChatManagementServiceError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @router.patch("/messages/{message_id}", response_model=ChatMessageResponse)
    async def edit_message(message_id: str, payload: EditMessageRequest, db: Session = Depends(get_db), authenticated_user_id: str = Depends(require_authenticated_user_id)):
        try:
            result = chat_management_service.edit_message(db, current_user_id=authenticated_user_id, message_id=message_id, body=payload.body)
            await chat_management_service.emit_message_updated(db, message_id=message_id)
            return result
        except ChatManagementServiceError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @router.post("/messages/{message_id}/reaction", response_model=ChatMessageResponse)
    async def toggle_message_reaction(
        message_id: str,
        payload: MessageReactionRequest,
        db: Session = Depends(get_db),
        authenticated_user_id: str = Depends(require_authenticated_user_id),
    ):
        try:
            result = chat_management_service.toggle_message_reaction(
                db,
                current_user_id=authenticated_user_id,
                message_id=message_id,
                emoji=payload.emoji,
            )
            await chat_management_service.emit_message_updated(db, message_id=message_id)
            return result
        except ChatManagementServiceError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @router.post("/messages/{message_id}/star", response_model=ChatMessageResponse)
    async def toggle_message_star(message_id: str, db: Session = Depends(get_db), authenticated_user_id: str = Depends(require_authenticated_user_id)):
        try:
            result = chat_management_service.toggle_message_star(
                db,
                current_user_id=authenticated_user_id,
                message_id=message_id,
            )
            await chat_management_service.emit_message_updated(db, message_id=message_id)
            return result
        except ChatManagementServiceError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @router.post("/messages/{message_id}/pin", response_model=ChatMessageResponse)
    async def toggle_message_pin(message_id: str, db: Session = Depends(get_db), authenticated_user_id: str = Depends(require_authenticated_user_id)):
        try:
            result = chat_management_service.toggle_message_pin(
                db,
                current_user_id=authenticated_user_id,
                message_id=message_id,
            )
            await chat_management_service.emit_message_updated(db, message_id=message_id)
            return result
        except ChatManagementServiceError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @router.post("/conversations/{conversation_type}/{conversation_id}/read")
    async def mark_conversation_read(conversation_type: str, conversation_id: str, db: Session = Depends(get_db), authenticated_user_id: str = Depends(require_authenticated_user_id)):
        try:
            return chat_management_service.mark_entity_read(db, current_user_id=authenticated_user_id, conversation_type=conversation_type, conversation_id=conversation_id)
        except ChatManagementServiceError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @router.post("/conversations/{friend_user_id}/read")
    async def mark_direct_conversation_read(friend_user_id: str, db: Session = Depends(get_db), authenticated_user_id: str = Depends(require_authenticated_user_id)):
        try:
            return chat_management_service.mark_conversation_read(db, current_user_id=authenticated_user_id, friend_user_id=friend_user_id)
        except ChatManagementServiceError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @router.post("/messages/{message_id}/delete")
    async def delete_message(message_id: str, payload: DeleteMessageRequest, db: Session = Depends(get_db), authenticated_user_id: str = Depends(require_authenticated_user_id)):
        try:
            result = chat_management_service.delete_message(db, current_user_id=authenticated_user_id, message_id=message_id, scope=payload.scope)
            await chat_management_service.emit_message_deleted(db, message_id=message_id, payload=result)
            return result
        except ChatManagementServiceError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @router.get("/files/{message_id}")
    async def download_message_file(message_id: str, token: str | None = Query(default=None), authorization: str | None = Header(default=None), db: Session = Depends(get_db)):
        current_user_id = resolve_download_user_id(authorization=authorization, token=token)
        try:
            file_path, file_name, mime_type = chat_management_service.get_message_download_path(db, current_user_id=current_user_id, message_id=message_id)
            return FileResponse(file_path, filename=file_name, media_type=mime_type)
        except ChatManagementServiceError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc

    @router.get("/assets/{entity_type}/{entity_id}/{file_name}")
    async def download_entity_asset(entity_type: str, entity_id: str, file_name: str, token: str | None = Query(default=None), authorization: str | None = Header(default=None), db: Session = Depends(get_db)):
        current_user_id = resolve_download_user_id(authorization=authorization, token=token)
        try:
            file_path, mime_type = chat_management_service.get_entity_asset_path(db, current_user_id=current_user_id, entity_type=entity_type, entity_id=entity_id, file_name=file_name)
            return FileResponse(file_path, media_type=mime_type)
        except ChatManagementServiceError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc

    @router.post("/profile/photo")
    async def upload_profile_photo(
        file: UploadFile = File(...),
        db: Session = Depends(get_db),
        authenticated_user_id: str = Depends(require_authenticated_user_id),
    ):
        try:
            return await chat_management_service.update_profile_photo(
                db,
                current_user_id=authenticated_user_id,
                upload=file,
            )
        except ChatManagementServiceError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @router.get("/conversation-assets/{conversation_type}/{conversation_key}/{file_name}")
    async def download_conversation_asset(conversation_type: str, conversation_key: str, file_name: str, token: str | None = Query(default=None), authorization: str | None = Header(default=None), db: Session = Depends(get_db)):
        current_user_id = resolve_download_user_id(authorization=authorization, token=token)
        try:
            file_path, mime_type = chat_management_service.get_conversation_asset_path(
                db,
                current_user_id=current_user_id,
                conversation_type=conversation_type,
                conversation_key=conversation_key,
                file_name=file_name,
            )
            return FileResponse(file_path, media_type=mime_type)
        except ChatManagementServiceError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc
    from fastapi import Cookie
    @router.websocket("/ws")
    async def chat_socket(websocket: WebSocket):
        await websocket.accept()
        try:
            
            token = websocket.query_params.get("token")
            
            
            if not token:
                await websocket.close(code=1008)
                return
            
            authenticated_user_id = chat_management_service.authenticate_websocket_user(token)
        except ChatManagementServiceError as exc:
            logger.warning(
                "Chat websocket authentication failed from %s: %s",
                getattr(websocket.client, "host", "unknown"),
                str(exc),
            )
            await websocket.close(code=1008)
            return
        logger.info(
            "Chat websocket connected for user %s from %s",
            authenticated_user_id,
            getattr(websocket.client, "host", "unknown"),
        )
        await chat_management_service.connect_websocket(authenticated_user_id, websocket)
        try:
            while True:
                payload = await websocket.receive_json()
                event_type = (payload.get("type") or "").strip().lower()
                if event_type == "typing":
                    await chat_management_service.handle_typing_event(
                        user_id=authenticated_user_id,
                        conversation_type=(payload.get("conversationType") or "direct").strip(),
                        conversation_id=(payload.get("conversationId") or "").strip(),
                        is_typing=bool(payload.get("isTyping")),
                    )
                elif event_type == "stop_typing":
                    await chat_management_service.handle_typing_event(
                        user_id=authenticated_user_id,
                        conversation_type=(payload.get("conversationType") or "direct").strip(),
                        conversation_id=(payload.get("conversationId") or "").strip(),
                        is_typing=False,
                    )
                elif event_type == "active_chat":
                    await chat_management_service.handle_active_conversation(
                        user_id=authenticated_user_id,
                        conversation_type=(payload.get("conversationType") or "").strip() or None,
                        conversation_id=(payload.get("conversationId") or "").strip() or None,
                    )
                elif event_type == "seen":
                    try:
                        await chat_management_service.handle_seen_event(
                            user_id=authenticated_user_id,
                            conversation_type=(payload.get("conversationType") or "direct").strip(),
                            conversation_id=(payload.get("conversationId") or "").strip(),
                        )
                    except ChatManagementServiceError as exc:
                        await websocket.send_json({"type": "message:error", "detail": str(exc)})
                elif event_type == "send_message":
                    try:
                        await chat_management_service.handle_socket_send_message(
                            user_id=authenticated_user_id,
                            conversation_type=(payload.get("conversationType") or "direct").strip(),
                            conversation_id=((payload.get("conversationId") or payload.get("receiverId")) or "").strip(),
                            body=payload.get("body"),
                            reply_to_message_id=(payload.get("replyToMessageId") or "").strip() or None,
                        )
                    except ChatManagementServiceError as exc:
                        logger.warning(
                            "Chat websocket send_message failed for user %s: %s",
                            authenticated_user_id,
                            str(exc),
                        )
                        await websocket.send_json({"type": "message:error", "detail": str(exc)})
        except WebSocketDisconnect:
            logger.info("Chat websocket disconnected for user %s", authenticated_user_id)
            await chat_management_service.disconnect_websocket(authenticated_user_id, websocket)

    return router
