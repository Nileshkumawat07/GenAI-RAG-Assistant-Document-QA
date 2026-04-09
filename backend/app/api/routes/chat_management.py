from fastapi import APIRouter, Depends, File, Form, Header, HTTPException, Query, UploadFile, WebSocket, WebSocketDisconnect
from fastapi.responses import FileResponse
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.api.dependencies import require_authenticated_user_id
from app.core.database import get_db
from app.models.chat_message import ChatMessage
from app.schemas.chat_management import (
    ChatFriendItemResponse,
    ChatMessageResponse,
    ChatOverviewResponse,
    ChatUserSummaryResponse,
    DeleteMessageRequest,
    FriendRequestResponse,
    SendFriendRequestRequest,
    SendMessageRequest,
)
from app.services.chat_management_service import ChatManagementService, ChatManagementServiceError


def build_chat_management_router(chat_management_service: ChatManagementService) -> APIRouter:
    router = APIRouter(prefix="/chat", tags=["chat"])

    def resolve_download_user_id(
        *,
        authorization: str | None,
        token: str | None,
    ) -> str:
        raw_token = token
        if not raw_token and authorization and authorization.startswith("Bearer "):
            raw_token = authorization.split(" ", 1)[1].strip()
        try:
            return chat_management_service.authenticate_websocket_user(raw_token)
        except ChatManagementServiceError as exc:
            raise HTTPException(status_code=401, detail=str(exc)) from exc

    @router.get("/overview", response_model=ChatOverviewResponse)
    async def get_overview(
        db: Session = Depends(get_db),
        authenticated_user_id: str = Depends(require_authenticated_user_id),
    ):
        return chat_management_service.get_overview(db, current_user_id=authenticated_user_id)

    @router.get("/users/search", response_model=list[ChatUserSummaryResponse])
    async def search_users(
        q: str = Query(default=""),
        db: Session = Depends(get_db),
        authenticated_user_id: str = Depends(require_authenticated_user_id),
    ):
        return chat_management_service.search_users(db, current_user_id=authenticated_user_id, query=q)

    @router.post("/friend-requests", response_model=FriendRequestResponse)
    async def send_friend_request(
        payload: SendFriendRequestRequest,
        db: Session = Depends(get_db),
        authenticated_user_id: str = Depends(require_authenticated_user_id),
    ):
        try:
            result = chat_management_service.send_friend_request(
                db,
                current_user_id=authenticated_user_id,
                receiver_user_id=payload.receiverId,
            )
            await chat_management_service.emit_friend_request_update(
                sender_user_id=authenticated_user_id,
                receiver_user_id=payload.receiverId,
            )
            return result
        except ChatManagementServiceError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @router.post("/friend-requests/{request_id}/accept")
    async def accept_friend_request(
        request_id: str,
        db: Session = Depends(get_db),
        authenticated_user_id: str = Depends(require_authenticated_user_id),
    ):
        try:
            result = chat_management_service.accept_friend_request(
                db,
                current_user_id=authenticated_user_id,
                request_id=request_id,
            )
            await chat_management_service.emit_friendship_update(
                user_ids=[result["senderUserId"], result["receiverUserId"]]
            )
            return result
        except ChatManagementServiceError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @router.post("/friend-requests/{request_id}/reject")
    async def reject_friend_request(
        request_id: str,
        db: Session = Depends(get_db),
        authenticated_user_id: str = Depends(require_authenticated_user_id),
    ):
        try:
            return chat_management_service.reject_friend_request(
                db,
                current_user_id=authenticated_user_id,
                request_id=request_id,
            )
        except ChatManagementServiceError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @router.get("/friends", response_model=list[ChatFriendItemResponse])
    async def list_friends(
        db: Session = Depends(get_db),
        authenticated_user_id: str = Depends(require_authenticated_user_id),
    ):
        return chat_management_service.list_friends(db, current_user_id=authenticated_user_id)

    @router.get("/conversations/{friend_user_id}/messages", response_model=list[ChatMessageResponse])
    async def get_messages(
        friend_user_id: str,
        db: Session = Depends(get_db),
        authenticated_user_id: str = Depends(require_authenticated_user_id),
    ):
        try:
            return chat_management_service.get_messages(
                db,
                current_user_id=authenticated_user_id,
                friend_user_id=friend_user_id,
            )
        except ChatManagementServiceError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @router.post("/messages", response_model=ChatMessageResponse)
    async def send_message(
        payload: SendMessageRequest,
        db: Session = Depends(get_db),
        authenticated_user_id: str = Depends(require_authenticated_user_id),
    ):
        try:
            result = chat_management_service.send_text_message(
                db,
                current_user_id=authenticated_user_id,
                receiver_user_id=payload.receiverId,
                body=payload.body,
                reply_to_message_id=payload.replyToMessageId,
            )
            await chat_management_service.emit_message_created(
                db,
                message_id=result["id"],
                sender_user_id=authenticated_user_id,
                receiver_user_id=payload.receiverId,
            )
            return result
        except ChatManagementServiceError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @router.post("/messages/upload", response_model=ChatMessageResponse)
    async def upload_message_file(
        receiver_id: str = Form(...),
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
                receiver_user_id=receiver_id,
                upload=file,
                body=body,
                reply_to_message_id=reply_to_message_id or None,
            )
            await chat_management_service.emit_message_created(
                db,
                message_id=result["id"],
                sender_user_id=authenticated_user_id,
                receiver_user_id=receiver_id,
            )
            return result
        except ChatManagementServiceError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @router.post("/conversations/{friend_user_id}/read")
    async def mark_conversation_read(
        friend_user_id: str,
        db: Session = Depends(get_db),
        authenticated_user_id: str = Depends(require_authenticated_user_id),
    ):
        try:
            result = chat_management_service.mark_conversation_read(
                db,
                current_user_id=authenticated_user_id,
                friend_user_id=friend_user_id,
            )
            for message_id in result["updatedIds"]:
                await chat_management_service.manager.send_event(
                    friend_user_id,
                    {
                        "type": "message:status",
                        "messageId": message_id,
                        "status": "read",
                        "readAt": result["readAt"],
                    },
                )
            return result
        except ChatManagementServiceError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @router.post("/messages/{message_id}/delete")
    async def delete_message(
        message_id: str,
        payload: DeleteMessageRequest,
        db: Session = Depends(get_db),
        authenticated_user_id: str = Depends(require_authenticated_user_id),
    ):
        message = db.execute(select(ChatMessage).where(ChatMessage.id == message_id)).scalar_one_or_none()
        try:
            result = chat_management_service.delete_message(
                db,
                current_user_id=authenticated_user_id,
                message_id=message_id,
                scope=payload.scope,
            )
            if message:
                if result["scope"] == "me":
                    await chat_management_service.manager.send_event(
                        authenticated_user_id,
                        {"type": "message:deleted", "messageId": message_id, **result},
                    )
                    await chat_management_service.manager.send_event(authenticated_user_id, {"type": "overview:refresh"})
                else:
                    await chat_management_service.emit_message_deleted(
                        message_id=message_id,
                        sender_user_id=message.sender_user_id,
                        receiver_user_id=message.receiver_user_id,
                        payload=result,
                    )
            return result
        except ChatManagementServiceError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @router.get("/files/{message_id}")
    async def download_message_file(
        message_id: str,
        token: str | None = Query(default=None),
        authorization: str | None = Header(default=None),
        db: Session = Depends(get_db),
    ):
        current_user_id = resolve_download_user_id(authorization=authorization, token=token)
        try:
            file_path, file_name, mime_type = chat_management_service.get_message_download_path(
                db,
                current_user_id=current_user_id,
                message_id=message_id,
            )
            return FileResponse(file_path, filename=file_name, media_type=mime_type)
        except ChatManagementServiceError as exc:
            raise HTTPException(status_code=404, detail=str(exc)) from exc

    @router.websocket("/ws")
    async def chat_socket(websocket: WebSocket, token: str | None = Query(default=None)):
        try:
            authenticated_user_id = chat_management_service.authenticate_websocket_user(token)
        except ChatManagementServiceError:
            await websocket.close(code=1008)
            return

        await chat_management_service.connect_websocket(authenticated_user_id, websocket)
        try:
            while True:
                payload = await websocket.receive_json()
                event_type = (payload.get("type") or "").strip().lower()
                if event_type == "typing":
                    await chat_management_service.handle_typing_event(
                        user_id=authenticated_user_id,
                        target_user_id=(payload.get("targetUserId") or "").strip(),
                        is_typing=bool(payload.get("isTyping")),
                    )
                elif event_type == "active_chat":
                    await chat_management_service.handle_active_conversation(
                        user_id=authenticated_user_id,
                        target_user_id=(payload.get("targetUserId") or "").strip() or None,
                    )
        except WebSocketDisconnect:
            await chat_management_service.disconnect_websocket(authenticated_user_id, websocket)

    return router
