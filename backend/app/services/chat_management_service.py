from __future__ import annotations

import re
import uuid
from collections import defaultdict
from datetime import datetime, timezone
from pathlib import Path

from fastapi import UploadFile, WebSocket
from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session

from app.core.config import CHAT_UPLOAD_MAX_BYTES, CHAT_UPLOADS_DIR
from app.core.database import SessionLocal
from app.models.chat_friend_request import ChatFriendRequest
from app.models.chat_friendship import ChatFriendship
from app.models.chat_message import ChatMessage
from app.models.user import User
from app.models.workspace_notification import WorkspaceNotification
from app.services.auth_service import AuthService


class ChatManagementServiceError(RuntimeError):
    """Raised when a chat management action fails for an expected reason."""


class ChatConnectionManager:
    def __init__(self) -> None:
        self._connections: dict[str, set[WebSocket]] = defaultdict(set)
        self._last_seen_at: dict[str, datetime] = {}
        self._active_conversations: dict[str, str] = {}

    async def connect(self, user_id: str, websocket: WebSocket) -> None:
        await websocket.accept()
        self._connections[user_id].add(websocket)
        self._last_seen_at.pop(user_id, None)

    def disconnect(self, user_id: str, websocket: WebSocket) -> None:
        sockets = self._connections.get(user_id)
        if sockets and websocket in sockets:
            sockets.remove(websocket)
        if sockets and len(sockets) == 0:
            self._connections.pop(user_id, None)
            self._last_seen_at[user_id] = datetime.now(timezone.utc)
            self._active_conversations.pop(user_id, None)

    def is_online(self, user_id: str) -> bool:
        return bool(self._connections.get(user_id))

    def get_last_seen_at(self, user_id: str) -> datetime | None:
        return self._last_seen_at.get(user_id)

    def set_active_conversation(self, user_id: str, target_user_id: str | None) -> None:
        if target_user_id:
            self._active_conversations[user_id] = target_user_id
        else:
            self._active_conversations.pop(user_id, None)

    def get_active_conversation(self, user_id: str) -> str | None:
        return self._active_conversations.get(user_id)

    async def send_event(self, user_id: str, payload: dict) -> None:
        sockets = list(self._connections.get(user_id, set()))
        disconnected: list[WebSocket] = []
        for socket in sockets:
            try:
                await socket.send_json(payload)
            except Exception:
                disconnected.append(socket)
        for socket in disconnected:
            self.disconnect(user_id, socket)


class ChatManagementService:
    allowed_content_types = {
        "image/jpeg",
        "image/png",
        "image/webp",
        "image/gif",
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "text/plain",
        "application/zip",
        "application/x-zip-compressed",
    }

    def __init__(self, auth_service: AuthService) -> None:
        self.auth_service = auth_service
        self.manager = ChatConnectionManager()
        CHAT_UPLOADS_DIR.mkdir(parents=True, exist_ok=True)

    def search_users(self, db: Session, *, current_user_id: str, query: str) -> list[dict]:
        cleaned_query = (query or "").strip().lower()
        if len(cleaned_query) < 1:
            return []

        users = db.execute(
            select(User)
            .where(
                User.id != current_user_id,
                User.archived_at.is_(None),
                or_(
                    func.lower(User.username).like(f"%{cleaned_query}%"),
                    func.lower(User.full_name).like(f"%{cleaned_query}%"),
                ),
            )
            .order_by(User.username.asc())
            .limit(12)
        ).scalars().all()
        relationship_map = self._relationship_state_map(
            db,
            current_user_id=current_user_id,
            other_user_ids=[item.id for item in users],
        )
        return [self.serialize_user_summary(item, relationship_map.get(item.id, "none")) for item in users]

    def get_overview(self, db: Session, *, current_user_id: str) -> dict:
        friends = self.list_friends(db, current_user_id=current_user_id)
        sent_requests = db.execute(
            select(ChatFriendRequest)
            .where(
                ChatFriendRequest.sender_user_id == current_user_id,
                ChatFriendRequest.status == "pending",
            )
            .order_by(ChatFriendRequest.created_at.desc())
        ).scalars().all()
        received_requests = db.execute(
            select(ChatFriendRequest)
            .where(
                ChatFriendRequest.receiver_user_id == current_user_id,
                ChatFriendRequest.status == "pending",
            )
            .order_by(ChatFriendRequest.created_at.desc())
        ).scalars().all()
        unread_message_count = db.execute(
            select(func.count())
            .select_from(ChatMessage)
            .where(
                ChatMessage.receiver_user_id == current_user_id,
                ChatMessage.read_at.is_(None),
                ChatMessage.deleted_for_everyone.is_(False),
                ChatMessage.deleted_by_receiver.is_(False),
            )
        ).scalar_one()
        return {
            "friends": friends,
            "sentRequests": [self.serialize_friend_request(db, item, current_user_id=current_user_id) for item in sent_requests],
            "receivedRequests": [self.serialize_friend_request(db, item, current_user_id=current_user_id) for item in received_requests],
            "unreadMessageCount": unread_message_count,
            "unreadRequestCount": len(received_requests),
        }

    def send_friend_request(self, db: Session, *, current_user_id: str, receiver_user_id: str) -> dict:
        if current_user_id == receiver_user_id:
            raise ChatManagementServiceError("You cannot send a friend request to yourself.")

        receiver = self._require_user(db, receiver_user_id)
        self._ensure_not_friends(db, current_user_id=current_user_id, other_user_id=receiver_user_id)

        existing = db.execute(
            select(ChatFriendRequest).where(
                or_(
                    and_(
                        ChatFriendRequest.sender_user_id == current_user_id,
                        ChatFriendRequest.receiver_user_id == receiver_user_id,
                    ),
                    and_(
                        ChatFriendRequest.sender_user_id == receiver_user_id,
                        ChatFriendRequest.receiver_user_id == current_user_id,
                    ),
                )
            )
        ).scalars().all()
        for item in existing:
            if item.status == "pending":
                if item.sender_user_id == current_user_id:
                    raise ChatManagementServiceError("Friend request already sent.")
                raise ChatManagementServiceError("This user already sent you a friend request.")
            db.delete(item)

        request = ChatFriendRequest(
            id=str(uuid.uuid4()),
            sender_user_id=current_user_id,
            receiver_user_id=receiver_user_id,
            status="pending",
        )
        db.add(request)
        db.add(
            WorkspaceNotification(
                id=str(uuid.uuid4()),
                user_id=receiver.id,
                category="chat",
                title="New friend request",
                message=f"{self._display_name(self._require_user(db, current_user_id))} sent you a friend request.",
                action_url="#/workspace",
                created_at=datetime.now(timezone.utc),
            )
        )
        db.commit()
        db.refresh(request)
        return self.serialize_friend_request(db, request, current_user_id=current_user_id)

    def accept_friend_request(self, db: Session, *, current_user_id: str, request_id: str) -> dict:
        request = self._require_friend_request(db, request_id=request_id)
        if request.receiver_user_id != current_user_id or request.status != "pending":
            raise ChatManagementServiceError("Friend request was not found.")

        self._create_friendship_pair(db, request.sender_user_id, request.receiver_user_id)
        request.status = "accepted"
        request.responded_at = datetime.now(timezone.utc)
        db.add(
            WorkspaceNotification(
                id=str(uuid.uuid4()),
                user_id=request.sender_user_id,
                category="chat",
                title="Friend request accepted",
                message=f"{self._display_name(self._require_user(db, current_user_id))} accepted your friend request.",
                action_url="#/workspace",
                created_at=datetime.now(timezone.utc),
            )
        )
        db.commit()
        return {
            "accepted": True,
            "senderUserId": request.sender_user_id,
            "receiverUserId": request.receiver_user_id,
        }

    def reject_friend_request(self, db: Session, *, current_user_id: str, request_id: str) -> dict:
        request = self._require_friend_request(db, request_id=request_id)
        if request.receiver_user_id != current_user_id or request.status != "pending":
            raise ChatManagementServiceError("Friend request was not found.")
        db.delete(request)
        db.commit()
        return {"rejected": True}

    def list_friends(self, db: Session, *, current_user_id: str) -> list[dict]:
        rows = db.execute(
            select(ChatFriendship, User)
            .join(User, User.id == ChatFriendship.friend_user_id)
            .where(
                ChatFriendship.user_id == current_user_id,
                User.archived_at.is_(None),
            )
        ).all()
        serialized = [self.serialize_friend_item(db, friendship=row[0], user=row[1], current_user_id=current_user_id) for row in rows]
        serialized.sort(key=lambda item: (item["lastMessageAt"] or "", item["fullName"].lower()), reverse=True)
        return serialized

    def get_messages(self, db: Session, *, current_user_id: str, friend_user_id: str) -> list[dict]:
        self._ensure_friends(db, current_user_id=current_user_id, other_user_id=friend_user_id)
        messages = db.execute(
            select(ChatMessage)
            .where(
                or_(
                    and_(
                        ChatMessage.sender_user_id == current_user_id,
                        ChatMessage.receiver_user_id == friend_user_id,
                    ),
                    and_(
                        ChatMessage.sender_user_id == friend_user_id,
                        ChatMessage.receiver_user_id == current_user_id,
                    ),
                )
            )
            .order_by(ChatMessage.created_at.asc())
        ).scalars().all()
        lookup = {item.id: item for item in messages}
        serialized = []
        for item in messages:
            if self._message_hidden_for_user(item, current_user_id):
                continue
            serialized.append(self.serialize_message(db, item, current_user_id=current_user_id, lookup=lookup))
        return serialized

    def send_text_message(
        self,
        db: Session,
        *,
        current_user_id: str,
        receiver_user_id: str,
        body: str | None,
        reply_to_message_id: str | None,
    ) -> dict:
        cleaned_body = (body or "").strip()
        if not cleaned_body:
            raise ChatManagementServiceError("Message cannot be empty.")
        return self._create_message(
            db,
            current_user_id=current_user_id,
            receiver_user_id=receiver_user_id,
            body=cleaned_body,
            reply_to_message_id=reply_to_message_id,
        )

    async def send_uploaded_message(
        self,
        db: Session,
        *,
        current_user_id: str,
        receiver_user_id: str,
        upload: UploadFile,
        body: str | None,
        reply_to_message_id: str | None,
    ) -> dict:
        self._ensure_friends(db, current_user_id=current_user_id, other_user_id=receiver_user_id)
        content = await upload.read()
        if not content:
            raise ChatManagementServiceError("Uploaded file is empty.")
        if len(content) > CHAT_UPLOAD_MAX_BYTES:
            raise ChatManagementServiceError("File exceeds the maximum upload size.")

        content_type = (upload.content_type or "").lower().strip()
        if content_type not in self.allowed_content_types:
            raise ChatManagementServiceError("Unsupported file type.")

        safe_name = self._sanitize_filename(upload.filename or "attachment")
        message_type = "image" if content_type.startswith("image/") else "file"
        message = self._build_message_record(
            current_user_id=current_user_id,
            receiver_user_id=receiver_user_id,
            body=(body or "").strip() or None,
            message_type=message_type,
            reply_to_message_id=reply_to_message_id,
        )
        db.add(message)
        db.flush()

        user_dir = CHAT_UPLOADS_DIR / current_user_id
        user_dir.mkdir(parents=True, exist_ok=True)
        storage_path = user_dir / f"{message.id}-{safe_name}"
        storage_path.write_bytes(content)

        message.file_name = upload.filename or safe_name
        message.file_size = len(content)
        message.mime_type = content_type
        message.storage_path = str(storage_path)
        message.file_url = f"/chat/files/{message.id}"
        self._apply_delivery_status(message, receiver_user_id=receiver_user_id)
        self._create_message_notification(db, sender_user_id=current_user_id, receiver_user_id=receiver_user_id, message=message)
        db.commit()
        db.refresh(message)
        return self.serialize_message(db, message, current_user_id=current_user_id)

    def mark_conversation_read(self, db: Session, *, current_user_id: str, friend_user_id: str) -> dict:
        self._ensure_friends(db, current_user_id=current_user_id, other_user_id=friend_user_id)
        now = datetime.now(timezone.utc)
        messages = db.execute(
            select(ChatMessage)
            .where(
                ChatMessage.sender_user_id == friend_user_id,
                ChatMessage.receiver_user_id == current_user_id,
                ChatMessage.read_at.is_(None),
                ChatMessage.deleted_for_everyone.is_(False),
                ChatMessage.deleted_by_receiver.is_(False),
            )
        ).scalars().all()
        updated_ids: list[str] = []
        for item in messages:
            item.status = "read"
            if not item.delivered_at:
                item.delivered_at = now
            item.read_at = now
            updated_ids.append(item.id)
        db.commit()
        return {"updatedIds": updated_ids, "readAt": self._serialize_datetime(now)}

    def delete_message(self, db: Session, *, current_user_id: str, message_id: str, scope: str) -> dict:
        message = db.execute(
            select(ChatMessage).where(
                ChatMessage.id == message_id,
                or_(
                    ChatMessage.sender_user_id == current_user_id,
                    ChatMessage.receiver_user_id == current_user_id,
                ),
            )
        ).scalar_one_or_none()
        if not message:
            raise ChatManagementServiceError("Message was not found.")

        normalized_scope = (scope or "me").strip().lower()
        if normalized_scope not in {"me", "everyone"}:
            raise ChatManagementServiceError("Unsupported delete scope.")

        if normalized_scope == "everyone":
            if message.sender_user_id != current_user_id:
                raise ChatManagementServiceError("Only the sender can delete a message for everyone.")
            message.deleted_for_everyone = True
            message.deleted_by_sender = True
            message.deleted_by_receiver = True
            message.body = None
            message.file_url = None
            message.storage_path = None
            message.file_name = None
            message.file_size = None
            message.mime_type = None
            message.reply_to_message_id = None
        elif message.sender_user_id == current_user_id:
            message.deleted_by_sender = True
        else:
            message.deleted_by_receiver = True

        db.commit()
        return {
            "messageId": message.id,
            "scope": normalized_scope,
            "deletedForEveryone": bool(message.deleted_for_everyone),
        }

    def get_message_download_path(self, db: Session, *, current_user_id: str, message_id: str) -> tuple[Path, str, str | None]:
        message = db.execute(
            select(ChatMessage).where(
                ChatMessage.id == message_id,
                or_(
                    ChatMessage.sender_user_id == current_user_id,
                    ChatMessage.receiver_user_id == current_user_id,
                ),
            )
        ).scalar_one_or_none()
        if not message or not message.storage_path or not message.file_name:
            raise ChatManagementServiceError("File was not found.")
        if self._message_hidden_for_user(message, current_user_id):
            raise ChatManagementServiceError("File was not found.")
        file_path = Path(message.storage_path)
        if not file_path.exists():
            raise ChatManagementServiceError("File is no longer available.")
        return file_path, message.file_name, message.mime_type

    async def connect_websocket(self, user_id: str, websocket: WebSocket) -> None:
        await self.manager.connect(user_id, websocket)
        await self._broadcast_presence_change(user_id, "online")

    async def disconnect_websocket(self, user_id: str, websocket: WebSocket) -> None:
        self.manager.disconnect(user_id, websocket)
        await self._broadcast_presence_change(user_id, "offline")

    async def handle_active_conversation(self, *, user_id: str, target_user_id: str | None) -> None:
        self.manager.set_active_conversation(user_id, target_user_id)
        if target_user_id:
            with SessionLocal() as db:
                result = self.mark_conversation_read(db, current_user_id=user_id, friend_user_id=target_user_id)
            for message_id in result["updatedIds"]:
                await self.manager.send_event(
                    target_user_id,
                    {
                        "type": "message:status",
                        "messageId": message_id,
                        "status": "read",
                        "readAt": result["readAt"],
                    },
                )

    async def handle_typing_event(self, *, user_id: str, target_user_id: str, is_typing: bool) -> None:
        await self.manager.send_event(
            target_user_id,
            {
                "type": "typing",
                "userId": user_id,
                "targetUserId": target_user_id,
                "isTyping": bool(is_typing),
            },
        )

    async def emit_friend_request_update(self, *, sender_user_id: str, receiver_user_id: str) -> None:
        await self.manager.send_event(receiver_user_id, {"type": "friend_request:new", "fromUserId": sender_user_id})
        await self.manager.send_event(sender_user_id, {"type": "overview:refresh"})
        await self.manager.send_event(receiver_user_id, {"type": "overview:refresh"})

    async def emit_friendship_update(self, *, user_ids: list[str]) -> None:
        for user_id in user_ids:
            await self.manager.send_event(user_id, {"type": "friends:refresh"})
            await self.manager.send_event(user_id, {"type": "overview:refresh"})
        for user_id in user_ids:
            await self._broadcast_presence_change(user_id, "online" if self.manager.is_online(user_id) else "offline")

    async def emit_message_created(self, db: Session, *, message_id: str, sender_user_id: str, receiver_user_id: str) -> None:
        message = db.execute(select(ChatMessage).where(ChatMessage.id == message_id)).scalar_one()
        await self.manager.send_event(
            sender_user_id,
            {
                "type": "message:new",
                "message": self.serialize_message(db, message, current_user_id=sender_user_id),
            },
        )
        await self.manager.send_event(
            receiver_user_id,
            {
                "type": "message:new",
                "message": self.serialize_message(db, message, current_user_id=receiver_user_id),
            },
        )
        await self.manager.send_event(sender_user_id, {"type": "overview:refresh"})
        await self.manager.send_event(receiver_user_id, {"type": "overview:refresh"})
        if message.status in {"delivered", "read"}:
            await self.manager.send_event(
                sender_user_id,
                {
                    "type": "message:status",
                    "messageId": message.id,
                    "status": message.status,
                    "deliveredAt": self._serialize_datetime(message.delivered_at),
                    "readAt": self._serialize_datetime(message.read_at),
                },
            )

    async def emit_message_deleted(self, *, message_id: str, sender_user_id: str, receiver_user_id: str, payload: dict) -> None:
        event = {"type": "message:deleted", "messageId": message_id, **payload}
        await self.manager.send_event(sender_user_id, event)
        await self.manager.send_event(receiver_user_id, event)
        await self.manager.send_event(sender_user_id, {"type": "overview:refresh"})
        await self.manager.send_event(receiver_user_id, {"type": "overview:refresh"})

    def authenticate_websocket_user(self, token: str | None) -> str:
        if not token:
            raise ChatManagementServiceError("Missing websocket token.")
        with SessionLocal() as db:
            user_id = self.auth_service.verify_access_token(token)
            self.auth_service.get_user_by_id(db, user_id=user_id)
            return user_id

    def serialize_friend_request(self, db: Session, item: ChatFriendRequest, *, current_user_id: str) -> dict:
        sender = self._require_user(db, item.sender_user_id)
        receiver = self._require_user(db, item.receiver_user_id)
        relationship_map = self._relationship_state_map(
            db,
            current_user_id=current_user_id,
            other_user_ids=[sender.id, receiver.id],
        )
        return {
            "id": item.id,
            "sender": self.serialize_user_summary(sender, "self" if sender.id == current_user_id else relationship_map.get(sender.id, "none")),
            "receiver": self.serialize_user_summary(receiver, "self" if receiver.id == current_user_id else relationship_map.get(receiver.id, "none")),
            "status": item.status,
            "createdAt": self._serialize_datetime(item.created_at),
            "respondedAt": self._serialize_datetime(item.responded_at),
        }

    def serialize_friend_item(self, db: Session, *, friendship: ChatFriendship, user: User, current_user_id: str) -> dict:
        latest_message = db.execute(
            select(ChatMessage)
            .where(
                or_(
                    and_(
                        ChatMessage.sender_user_id == current_user_id,
                        ChatMessage.receiver_user_id == user.id,
                    ),
                    and_(
                        ChatMessage.sender_user_id == user.id,
                        ChatMessage.receiver_user_id == current_user_id,
                    ),
                )
            )
            .order_by(ChatMessage.created_at.desc())
        ).scalars().first()
        unread_count = db.execute(
            select(func.count())
            .select_from(ChatMessage)
            .where(
                ChatMessage.sender_user_id == user.id,
                ChatMessage.receiver_user_id == current_user_id,
                ChatMessage.read_at.is_(None),
                ChatMessage.deleted_for_everyone.is_(False),
                ChatMessage.deleted_by_receiver.is_(False),
            )
        ).scalar_one()
        summary = self.serialize_user_summary(user, "friends")
        summary.update(
            {
                "unreadCount": unread_count,
                "lastMessagePreview": self._message_preview(latest_message),
                "lastMessageAt": self._serialize_datetime(latest_message.created_at if latest_message else None),
                "lastMessageStatus": latest_message.status if latest_message and latest_message.sender_user_id == current_user_id else None,
            }
        )
        return summary

    def serialize_user_summary(self, user: User, relationship_state: str) -> dict:
        is_online = self.manager.is_online(user.id)
        last_seen_at = self.manager.get_last_seen_at(user.id) or user.last_login_at
        full_name = self._display_name(user)
        avatar_label = "".join(part[0] for part in full_name.split()[:2]).upper() or full_name[:1].upper() or "U"
        return {
            "id": user.id,
            "username": user.username,
            "fullName": full_name,
            "avatarLabel": avatar_label,
            "presenceStatus": "online" if is_online else "offline",
            "lastSeenAt": self._serialize_datetime(last_seen_at),
            "relationshipState": relationship_state,
            "statusText": "Online" if is_online else "Offline",
        }

    def serialize_message(
        self,
        db: Session,
        item: ChatMessage,
        *,
        current_user_id: str,
        lookup: dict[str, ChatMessage] | None = None,
    ) -> dict:
        deleted_for_everyone = bool(item.deleted_for_everyone)
        reply_source = (lookup or {}).get(item.reply_to_message_id) if item.reply_to_message_id else None
        if not reply_source and item.reply_to_message_id:
            reply_source = db.execute(select(ChatMessage).where(ChatMessage.id == item.reply_to_message_id)).scalar_one_or_none()

        body = item.body
        file_url = item.file_url
        file_name = item.file_name
        file_size = item.file_size
        mime_type = item.mime_type
        if deleted_for_everyone:
            body = "This message was removed."
            file_url = None
            file_name = None
            file_size = None
            mime_type = None

        reply_preview = None
        if reply_source:
            reply_sender = self._require_user(db, reply_source.sender_user_id)
            reply_preview = {
                "id": reply_source.id,
                "senderName": self._display_name(reply_sender),
                "body": self._message_preview(reply_source),
                "messageType": reply_source.message_type,
            }

        return {
            "id": item.id,
            "senderId": item.sender_user_id,
            "receiverId": item.receiver_user_id,
            "body": body,
            "messageType": item.message_type,
            "fileUrl": file_url,
            "fileName": file_name,
            "fileSize": file_size,
            "mimeType": mime_type,
            "status": item.status,
            "createdAt": self._serialize_datetime(item.created_at),
            "deliveredAt": self._serialize_datetime(item.delivered_at),
            "readAt": self._serialize_datetime(item.read_at),
            "deletedForEveryone": deleted_for_everyone,
            "replyToMessageId": item.reply_to_message_id,
            "replyPreview": reply_preview,
        }

    def _create_message(
        self,
        db: Session,
        *,
        current_user_id: str,
        receiver_user_id: str,
        body: str | None,
        reply_to_message_id: str | None,
    ) -> dict:
        self._ensure_friends(db, current_user_id=current_user_id, other_user_id=receiver_user_id)
        message = self._build_message_record(
            current_user_id=current_user_id,
            receiver_user_id=receiver_user_id,
            body=body,
            message_type="text",
            reply_to_message_id=reply_to_message_id,
        )
        self._apply_delivery_status(message, receiver_user_id=receiver_user_id)
        db.add(message)
        self._create_message_notification(db, sender_user_id=current_user_id, receiver_user_id=receiver_user_id, message=message)
        db.commit()
        db.refresh(message)
        return self.serialize_message(db, message, current_user_id=current_user_id)

    def _build_message_record(
        self,
        *,
        current_user_id: str,
        receiver_user_id: str,
        body: str | None,
        message_type: str,
        reply_to_message_id: str | None,
    ) -> ChatMessage:
        return ChatMessage(
            id=str(uuid.uuid4()),
            sender_user_id=current_user_id,
            receiver_user_id=receiver_user_id,
            body=body,
            message_type=message_type,
            reply_to_message_id=reply_to_message_id,
            status="sent",
        )

    def _apply_delivery_status(self, message: ChatMessage, *, receiver_user_id: str) -> None:
        now = datetime.now(timezone.utc)
        if self.manager.get_active_conversation(receiver_user_id) == message.sender_user_id:
            message.status = "read"
            message.delivered_at = now
            message.read_at = now
            return
        if self.manager.is_online(receiver_user_id):
            message.status = "delivered"
            message.delivered_at = now

    def _create_message_notification(self, db: Session, *, sender_user_id: str, receiver_user_id: str, message: ChatMessage) -> None:
        if self.manager.get_active_conversation(receiver_user_id) == sender_user_id:
            return
        sender = self._require_user(db, sender_user_id)
        db.add(
            WorkspaceNotification(
                id=str(uuid.uuid4()),
                user_id=receiver_user_id,
                category="chat",
                title=f"New message from {self._display_name(sender)}",
                message=self._message_preview(message),
                action_url="#/workspace",
                created_at=datetime.now(timezone.utc),
            )
        )

    def _relationship_state_map(self, db: Session, *, current_user_id: str, other_user_ids: list[str]) -> dict[str, str]:
        if not other_user_ids:
            return {}
        relationship_map = {user_id: "none" for user_id in other_user_ids}
        friendship_rows = db.execute(
            select(ChatFriendship.friend_user_id).where(
                ChatFriendship.user_id == current_user_id,
                ChatFriendship.friend_user_id.in_(other_user_ids),
            )
        ).scalars().all()
        for friend_id in friendship_rows:
            relationship_map[friend_id] = "friends"

        request_rows = db.execute(
            select(ChatFriendRequest).where(
                ChatFriendRequest.status == "pending",
                or_(
                    and_(
                        ChatFriendRequest.sender_user_id == current_user_id,
                        ChatFriendRequest.receiver_user_id.in_(other_user_ids),
                    ),
                    and_(
                        ChatFriendRequest.receiver_user_id == current_user_id,
                        ChatFriendRequest.sender_user_id.in_(other_user_ids),
                    ),
                ),
            )
        ).scalars().all()
        for item in request_rows:
            if relationship_map.get(item.sender_user_id) == "friends" or relationship_map.get(item.receiver_user_id) == "friends":
                continue
            if item.sender_user_id == current_user_id:
                relationship_map[item.receiver_user_id] = "pending_sent"
            else:
                relationship_map[item.sender_user_id] = "pending_received"
        return relationship_map

    def _create_friendship_pair(self, db: Session, first_user_id: str, second_user_id: str) -> None:
        for user_id, friend_id in [(first_user_id, second_user_id), (second_user_id, first_user_id)]:
            existing = db.execute(
                select(ChatFriendship).where(
                    ChatFriendship.user_id == user_id,
                    ChatFriendship.friend_user_id == friend_id,
                )
            ).scalar_one_or_none()
            if existing:
                continue
            db.add(
                ChatFriendship(
                    id=str(uuid.uuid4()),
                    user_id=user_id,
                    friend_user_id=friend_id,
                )
            )

    def _ensure_not_friends(self, db: Session, *, current_user_id: str, other_user_id: str) -> None:
        existing = db.execute(
            select(ChatFriendship).where(
                ChatFriendship.user_id == current_user_id,
                ChatFriendship.friend_user_id == other_user_id,
            )
        ).scalar_one_or_none()
        if existing:
            raise ChatManagementServiceError("You are already friends.")

    def _ensure_friends(self, db: Session, *, current_user_id: str, other_user_id: str) -> None:
        existing = db.execute(
            select(ChatFriendship).where(
                ChatFriendship.user_id == current_user_id,
                ChatFriendship.friend_user_id == other_user_id,
            )
        ).scalar_one_or_none()
        if not existing:
            raise ChatManagementServiceError("You can only chat with friends.")

    def _require_user(self, db: Session, user_id: str) -> User:
        user = db.execute(select(User).where(User.id == user_id, User.archived_at.is_(None))).scalar_one_or_none()
        if not user:
            raise ChatManagementServiceError("User was not found.")
        return user

    def _require_friend_request(self, db: Session, *, request_id: str) -> ChatFriendRequest:
        item = db.execute(select(ChatFriendRequest).where(ChatFriendRequest.id == request_id)).scalar_one_or_none()
        if not item:
            raise ChatManagementServiceError("Friend request was not found.")
        return item

    def _message_preview(self, message: ChatMessage | None) -> str | None:
        if not message:
            return None
        if message.deleted_for_everyone:
            return "This message was removed."
        if message.body:
            return message.body[:120]
        if message.message_type == "image":
            return "Image"
        if message.file_name:
            return message.file_name
        return "Attachment"

    def _message_hidden_for_user(self, message: ChatMessage, current_user_id: str) -> bool:
        if message.deleted_for_everyone:
            return False
        if message.sender_user_id == current_user_id and message.deleted_by_sender:
            return True
        if message.receiver_user_id == current_user_id and message.deleted_by_receiver:
            return True
        return False

    async def _broadcast_presence_change(self, user_id: str, status: str) -> None:
        with SessionLocal() as db:
            friend_ids = db.execute(
                select(ChatFriendship.friend_user_id).where(ChatFriendship.user_id == user_id)
            ).scalars().all()
        payload = {
            "type": "presence",
            "userId": user_id,
            "status": status,
            "lastSeenAt": self._serialize_datetime(self.manager.get_last_seen_at(user_id)),
        }
        for friend_id in friend_ids:
            await self.manager.send_event(friend_id, payload)

    @staticmethod
    def _display_name(user: User) -> str:
        return (user.full_name or user.username or user.email or "User").strip()

    @staticmethod
    def _sanitize_filename(file_name: str) -> str:
        base_name = Path(file_name).name.strip() or "attachment"
        cleaned = re.sub(r"[^A-Za-z0-9._-]", "_", base_name)
        return cleaned[:180]

    @staticmethod
    def _serialize_datetime(value: datetime | None) -> str | None:
        if not value:
            return None
        if value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        else:
            value = value.astimezone(timezone.utc)
        return value.isoformat().replace("+00:00", "Z")
