from __future__ import annotations

import json
import re
import uuid
from collections import defaultdict
from datetime import datetime, timedelta, timezone
from pathlib import Path

from fastapi import UploadFile, WebSocket
from sqlalchemy import and_, func, or_, select
from sqlalchemy.orm import Session

from app.core.config import CHAT_UPLOAD_MAX_BYTES, CHAT_UPLOADS_DIR
from app.core.settings_registry import build_default_settings_payload, normalize_settings_category_payload
from app.core.database import SessionLocal
from app.models.chat_community import ChatCommunity
from app.models.chat_community_group import ChatCommunityGroup
from app.models.chat_conversation_preference import ChatConversationPreference
from app.models.chat_conversation_background import ChatConversationBackground
from app.models.chat_friend_request import ChatFriendRequest
from app.models.chat_friendship import ChatFriendship
from app.models.chat_group import ChatGroup
from app.models.chat_group_member import ChatGroupMember
from app.models.chat_message import ChatMessage
from app.models.chat_message_pin import ChatMessagePin
from app.models.chat_message_reaction import ChatMessageReaction
from app.models.chat_message_star import ChatMessageStar
from app.models.user import User
from app.models.user_setting import UserSetting
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

    def set_active_conversation(self, user_id: str, conversation_key: str | None) -> None:
        if conversation_key:
            self._active_conversations[user_id] = conversation_key
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
        "video/mp4",
        "video/webm",
        "video/quicktime",
        "audio/mpeg",
        "audio/mp3",
        "audio/mp4",
        "audio/wav",
        "audio/webm",
        "audio/ogg",
        "application/pdf",
        "application/msword",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
        "application/vnd.ms-excel",
        "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "text/plain",
        "application/zip",
        "application/x-zip-compressed",
    }
    image_content_types = {"image/jpeg", "image/png", "image/webp", "image/gif"}

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
        return [
            self.serialize_user_summary(
                db,
                item,
                relationship_map.get(item.id, "none"),
                viewer_user_id=current_user_id,
            )
            for item in users
        ]

    def search_friends(self, db: Session, *, current_user_id: str, query: str) -> list[dict]:
        cleaned_query = (query or "").strip().lower()
        friends = self.list_friends(db, current_user_id=current_user_id)
        if not cleaned_query:
            return friends
        return [
            item
            for item in friends
            if cleaned_query in (item["fullName"] or "").lower() or cleaned_query in (item["username"] or "").lower()
        ]

    def get_overview(self, db: Session, *, current_user_id: str) -> dict:
        friends = self.search_friends(db, current_user_id=current_user_id, query="")
        direct_chats = [self.serialize_direct_chat_item(db, friend_user_id=item["id"], current_user_id=current_user_id) for item in friends]
        direct_chats.sort(key=lambda item: (item["lastMessageAt"] or "", item["title"].lower()), reverse=True)
        groups = self.list_groups(db, current_user_id=current_user_id)
        communities = self.list_communities(db, current_user_id=current_user_id)
        sent_requests = db.execute(
            select(ChatFriendRequest)
            .where(ChatFriendRequest.sender_user_id == current_user_id, ChatFriendRequest.status == "pending")
            .order_by(ChatFriendRequest.created_at.desc())
        ).scalars().all()
        received_requests = db.execute(
            select(ChatFriendRequest)
            .where(ChatFriendRequest.receiver_user_id == current_user_id, ChatFriendRequest.status == "pending")
            .order_by(ChatFriendRequest.created_at.desc())
        ).scalars().all()
        unread_notification_count = db.execute(
            select(func.count())
            .select_from(WorkspaceNotification)
            .where(WorkspaceNotification.user_id == current_user_id, WorkspaceNotification.is_read.is_(False))
        ).scalar_one()
        return {
            "friends": friends,
            "directChats": direct_chats,
            "groups": groups,
            "communities": communities,
            "sentRequests": [self.serialize_friend_request(db, item, current_user_id=current_user_id) for item in sent_requests],
            "receivedRequests": [self.serialize_friend_request(db, item, current_user_id=current_user_id) for item in received_requests],
            "unreadMessageCount": sum(item["unreadCount"] for item in direct_chats + groups + communities),
            "unreadRequestCount": len(received_requests),
            "unreadNotificationCount": unread_notification_count,
        }

    def send_friend_request(self, db: Session, *, current_user_id: str, receiver_user_id: str) -> dict:
        if current_user_id == receiver_user_id:
            raise ChatManagementServiceError("You cannot send a friend request to yourself.")
        receiver = self._require_user(db, receiver_user_id)
        self._ensure_not_friends(db, current_user_id=current_user_id, other_user_id=receiver_user_id)
        existing = db.execute(
            select(ChatFriendRequest).where(
                or_(
                    and_(ChatFriendRequest.sender_user_id == current_user_id, ChatFriendRequest.receiver_user_id == receiver_user_id),
                    and_(ChatFriendRequest.sender_user_id == receiver_user_id, ChatFriendRequest.receiver_user_id == current_user_id),
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
        self._create_workspace_notification(
            db,
            user_id=receiver.id,
            category="chat",
            title="New friend request",
            message=f"{self._display_name(self._require_user(db, current_user_id))} sent you a friend request.",
            action_type="open_chat_requests",
            action_entity_kind="requests",
            action_context={"focus": "requests"},
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
        self._create_workspace_notification(
            db,
            user_id=request.sender_user_id,
            category="chat",
            title="Friend request accepted",
            message=f"{self._display_name(self._require_user(db, current_user_id))} accepted your friend request.",
            action_type="open_chat",
            action_entity_id=current_user_id,
            action_entity_kind="direct",
            action_context={"conversationType": "direct", "conversationId": current_user_id, "focus": "conversation"},
        )
        db.commit()
        return {"accepted": True, "senderUserId": request.sender_user_id, "receiverUserId": request.receiver_user_id}

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
            .where(ChatFriendship.user_id == current_user_id, User.archived_at.is_(None))
        ).all()
        serialized = [self.serialize_user_summary(db, row[1], "friends", viewer_user_id=current_user_id) for row in rows]
        serialized.sort(key=lambda item: item["fullName"].lower())
        return serialized

    def list_groups(self, db: Session, *, current_user_id: str) -> list[dict]:
        memberships = db.execute(
            select(ChatGroupMember, ChatGroup)
            .join(ChatGroup, ChatGroup.id == ChatGroupMember.group_id)
            .where(ChatGroupMember.user_id == current_user_id, ChatGroup.is_deleted.is_(False), ChatGroup.group_type == "group")
            .order_by(ChatGroup.updated_at.desc())
        ).all()
        return [self.serialize_group_list_item(db, group=row[1], membership=row[0], current_user_id=current_user_id) for row in memberships]

    def list_communities(self, db: Session, *, current_user_id: str) -> list[dict]:
        memberships = db.execute(
            select(ChatCommunity, ChatGroupMember)
            .join(ChatGroupMember, ChatGroupMember.group_id == ChatCommunity.announcement_group_id)
            .where(ChatGroupMember.user_id == current_user_id)
            .order_by(ChatCommunity.updated_at.desc())
        ).all()
        return [self.serialize_community_list_item(db, community=row[0], membership=row[1], current_user_id=current_user_id) for row in memberships]

    def get_group_detail(self, db: Session, *, current_user_id: str, group_id: str) -> dict:
        group, membership = self._require_group_membership(db, group_id=group_id, user_id=current_user_id)
        return self.serialize_group_detail(db, group=group, membership=membership, current_user_id=current_user_id)

    def get_community_detail(self, db: Session, *, current_user_id: str, community_id: str) -> dict:
        community, announcement_group, membership = self._require_community_membership(db, community_id=community_id, user_id=current_user_id)
        return self.serialize_community_detail(
            db,
            community=community,
            announcement_group=announcement_group,
            membership=membership,
            current_user_id=current_user_id,
        )

    def get_messages(self, db: Session, *, current_user_id: str, friend_user_id: str) -> list[dict]:
        return self.get_conversation_messages(
            db,
            current_user_id=current_user_id,
            conversation_type="direct",
            conversation_id=friend_user_id,
            limit=100,
            before_message_id=None,
        )["items"]

    def get_conversation_messages(
        self,
        db: Session,
        *,
        current_user_id: str,
        conversation_type: str,
        conversation_id: str,
        limit: int = 40,
        before_message_id: str | None = None,
    ) -> dict:
        conversation = self._resolve_conversation(
            db,
            current_user_id=current_user_id,
            conversation_type=conversation_type,
            conversation_id=conversation_id,
        )
        visible_messages = self._visible_messages_for_conversation(
            db,
            conversation_type=conversation["apiConversationType"],
            conversation_id=conversation["apiConversationId"],
            current_user_id=current_user_id,
            limit=500,
            newest_first=True,
        )
        if before_message_id:
            pivot = next((item for item in visible_messages if item.id == before_message_id), None)
            if pivot:
                visible_messages = [item for item in visible_messages if item.created_at < pivot.created_at]
        limited = visible_messages[: max(1, min(limit, 100))]
        limited.reverse()
        lookup = {item.id: item for item in visible_messages}
        return {
            "items": [self.serialize_message(db, item, current_user_id=current_user_id, lookup=lookup) for item in limited],
            "hasMore": len(visible_messages) > len(limited),
        }

    async def update_conversation_background(
        self,
        db: Session,
        *,
        current_user_id: str,
        conversation_type: str,
        conversation_id: str,
        upload: UploadFile,
    ) -> dict:
        conversation = self._resolve_conversation(
            db,
            current_user_id=current_user_id,
            conversation_type=conversation_type,
            conversation_id=conversation_id,
        )
        content_type = (upload.content_type or "").lower().strip()
        if content_type not in self.image_content_types:
            raise ChatManagementServiceError("Conversation background must be an image file.")
        content = await upload.read()
        if not content:
            raise ChatManagementServiceError("Uploaded background is empty.")
        if len(content) > CHAT_UPLOAD_MAX_BYTES:
            raise ChatManagementServiceError("Background exceeds the maximum upload size.")

        safe_name = self._sanitize_filename(upload.filename or "background.png")
        conversation_key = self._conversation_storage_key(conversation)
        background = db.execute(
            select(ChatConversationBackground).where(
                ChatConversationBackground.conversation_type == conversation["apiConversationType"],
                ChatConversationBackground.conversation_key == conversation_key,
            )
        ).scalar_one_or_none()
        if not background:
            background = ChatConversationBackground(
                id=str(uuid.uuid4()),
                conversation_type=conversation["apiConversationType"],
                conversation_key=conversation_key,
                created_by_user_id=current_user_id,
                file_name=safe_name,
                mime_type=content_type,
                storage_path="",
                background_url="",
            )
            db.add(background)
            db.flush()

        storage_path = self._save_conversation_background_file(
            conversation_type=conversation["apiConversationType"],
            conversation_key=conversation_key,
            background_id=background.id,
            file_name=safe_name,
            content=content,
        )
        background.file_name = safe_name
        background.mime_type = content_type
        background.storage_path = str(storage_path)
        background.background_url = f"/chat/conversation-assets/{conversation['apiConversationType']}/{conversation_key}/{safe_name}"
        background.updated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(background)
        return {
            "conversationType": conversation["apiConversationType"],
            "conversationId": conversation["apiConversationId"],
            "backgroundUrl": background.background_url,
        }

    def clear_conversation_background(
        self,
        db: Session,
        *,
        current_user_id: str,
        conversation_type: str,
        conversation_id: str,
    ) -> dict:
        conversation = self._resolve_conversation(
            db,
            current_user_id=current_user_id,
            conversation_type=conversation_type,
            conversation_id=conversation_id,
        )
        conversation_key = self._conversation_storage_key(conversation)
        background = db.execute(
            select(ChatConversationBackground).where(
                ChatConversationBackground.conversation_type == conversation["apiConversationType"],
                ChatConversationBackground.conversation_key == conversation_key,
            )
        ).scalar_one_or_none()
        if background:
            try:
                Path(background.storage_path).unlink(missing_ok=True)
            except Exception:
                pass
            db.delete(background)
            db.commit()
        return {
            "conversationType": conversation["apiConversationType"],
            "conversationId": conversation["apiConversationId"],
            "backgroundUrl": None,
        }

    def get_conversation_sidebar(
        self,
        db: Session,
        *,
        current_user_id: str,
        conversation_type: str,
        conversation_id: str,
    ) -> dict:
        conversation = self._resolve_conversation(
            db,
            current_user_id=current_user_id,
            conversation_type=conversation_type,
            conversation_id=conversation_id,
        )
        preference = self._conversation_preference_for_user(
            db,
            user_id=current_user_id,
            conversation_type=conversation["apiConversationType"],
            conversation_id=conversation["apiConversationId"],
        )
        shared_media = [
            self.serialize_message(db, item, current_user_id=current_user_id)
            for item in self._visible_messages_for_conversation(
                db,
                conversation_type=conversation["apiConversationType"],
                conversation_id=conversation["apiConversationId"],
                current_user_id=current_user_id,
                limit=12,
                media_only=True,
                newest_first=True,
            )
        ]
        starred_messages = [
            self.serialize_message(db, item, current_user_id=current_user_id)
            for item in self._starred_or_pinned_messages(
                db,
                current_user_id=current_user_id,
                conversation=conversation,
                starred=True,
                pinned=False,
            )
        ]
        pinned_messages = [
            self.serialize_message(db, item, current_user_id=current_user_id)
            for item in self._starred_or_pinned_messages(
                db,
                current_user_id=current_user_id,
                conversation=conversation,
                starred=False,
                pinned=True,
            )
        ]
        storage = self.get_storage_summary(
            db,
            current_user_id=current_user_id,
            conversation_type=conversation["apiConversationType"],
            conversation_id=conversation["apiConversationId"],
        )

        if conversation["conversationType"] == "direct":
            other_user = self._require_user(db, conversation["otherUserId"])
            summary = self.serialize_user_summary(db, other_user, "friends", viewer_user_id=current_user_id)
            current_user = self._require_user(db, current_user_id)
            return {
                "conversationType": "direct",
                "conversationId": conversation["apiConversationId"],
                "title": summary["fullName"],
                "subtitle": f"@{other_user.username}",
                "avatarLabel": summary["avatarLabel"],
                "imageUrl": summary["imageUrl"],
                "bio": summary["bio"],
                "statusText": summary["statusText"],
                "presenceStatus": summary["presenceStatus"],
                "lastSeenAt": summary["lastSeenAt"],
                "memberCount": 2,
                "currentUserRole": "member",
                "backgroundUrl": self._conversation_background_url(
                    db,
                    conversation_type="direct",
                    conversation_key=self._direct_conversation_key(current_user_id, other_user.id),
                ),
                "preferences": self._serialize_conversation_preference(preference),
                "members": [
                    {
                        "id": f"direct-{current_user.id}",
                        "userId": current_user.id,
                        "role": "self",
                        "isMuted": False,
                        "joinedAt": None,
                        "lastReadAt": None,
                        "user": self.serialize_user_summary(db, current_user, "self", viewer_user_id=current_user_id),
                    },
                    {
                        "id": f"direct-{other_user.id}",
                        "userId": other_user.id,
                        "role": "friend",
                        "isMuted": bool(preference.is_muted) if preference else False,
                        "joinedAt": None,
                        "lastReadAt": None,
                        "user": summary,
                    },
                ],
                "groups": [],
                "sharedMedia": shared_media,
                "starredMessages": starred_messages,
                "pinnedMessages": pinned_messages,
                "storage": storage,
            }

        if conversation["conversationType"] == "group":
            detail = self.serialize_group_detail(
                db,
                group=conversation["group"],
                membership=conversation["membership"],
                current_user_id=current_user_id,
            )
            return {
                "conversationType": "group",
                "conversationId": detail["id"],
                "title": detail["name"],
                "subtitle": detail["description"],
                "avatarLabel": self._avatar_label(detail["name"]),
                "imageUrl": detail["imageUrl"],
                "bio": detail["description"],
                "statusText": f"{detail['memberCount']} members",
                "presenceStatus": None,
                "lastSeenAt": None,
                "memberCount": detail["memberCount"],
                "currentUserRole": detail["currentUserRole"],
                "backgroundUrl": detail["backgroundUrl"],
                "preferences": self._serialize_conversation_preference(preference, fallback_muted=detail["isMuted"]),
                "members": detail["members"],
                "groups": [],
                "sharedMedia": shared_media,
                "starredMessages": starred_messages,
                "pinnedMessages": pinned_messages,
                "storage": storage,
            }

        detail = self.serialize_community_detail(
            db,
            community=conversation["community"],
            announcement_group=conversation["group"],
            membership=conversation["membership"],
            current_user_id=current_user_id,
        )
        return {
            "conversationType": "community",
            "conversationId": detail["id"],
            "title": detail["name"],
            "subtitle": detail["description"],
            "avatarLabel": self._avatar_label(detail["name"]),
            "imageUrl": detail["imageUrl"],
            "bio": detail["description"],
            "statusText": f"{detail['memberCount']} members",
            "presenceStatus": None,
            "lastSeenAt": None,
            "memberCount": detail["memberCount"],
            "currentUserRole": detail["currentUserRole"],
            "backgroundUrl": detail["backgroundUrl"],
            "preferences": self._serialize_conversation_preference(preference, fallback_muted=detail["isMuted"]),
            "members": detail["members"],
            "groups": detail["groups"],
            "sharedMedia": shared_media,
            "starredMessages": starred_messages,
            "pinnedMessages": pinned_messages,
            "storage": storage,
        }

    def update_conversation_preferences(
        self,
        db: Session,
        *,
        current_user_id: str,
        conversation_type: str,
        conversation_id: str,
        is_muted: bool | None = None,
        is_pinned: bool | None = None,
        is_archived: bool | None = None,
        is_blocked: bool | None = None,
        disappearing_mode: str | None = None,
    ) -> dict:
        conversation = self._resolve_conversation(
            db,
            current_user_id=current_user_id,
            conversation_type=conversation_type,
            conversation_id=conversation_id,
        )
        preference = self._ensure_conversation_preference(
            db,
            user_id=current_user_id,
            conversation_type=conversation["apiConversationType"],
            conversation_id=conversation["apiConversationId"],
        )
        if is_muted is not None:
            preference.is_muted = bool(is_muted)
            if conversation["conversationType"] != "direct" and conversation["membership"]:
                conversation["membership"].is_muted = bool(is_muted)
        if is_pinned is not None:
            preference.is_pinned = bool(is_pinned)
        if is_archived is not None:
            preference.is_archived = bool(is_archived)
        if is_blocked is not None and conversation["conversationType"] == "direct":
            preference.is_blocked = bool(is_blocked)
        if disappearing_mode is not None:
            normalized_mode = (disappearing_mode or "off").strip().lower()
            if normalized_mode not in {"off", "24h", "7d", "90d"}:
                raise ChatManagementServiceError("Unsupported disappearing mode.")
            preference.disappearing_mode = normalized_mode
        preference.updated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(preference)
        return self._serialize_conversation_preference(preference)

    def clear_conversation(
        self,
        db: Session,
        *,
        current_user_id: str,
        conversation_type: str,
        conversation_id: str,
    ) -> dict:
        conversation = self._resolve_conversation(
            db,
            current_user_id=current_user_id,
            conversation_type=conversation_type,
            conversation_id=conversation_id,
        )
        preference = self._ensure_conversation_preference(
            db,
            user_id=current_user_id,
            conversation_type=conversation["apiConversationType"],
            conversation_id=conversation["apiConversationId"],
        )
        preference.last_cleared_at = datetime.now(timezone.utc)
        preference.updated_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(preference)
        return self._serialize_conversation_preference(preference)

    def get_storage_summary(
        self,
        db: Session,
        *,
        current_user_id: str,
        conversation_type: str,
        conversation_id: str,
    ) -> dict:
        items = self._visible_messages_for_conversation(
            db,
            conversation_type=conversation_type,
            conversation_id=conversation_id,
            current_user_id=current_user_id,
            limit=200,
            media_only=True,
            newest_first=True,
        )
        summary = {
            "totalBytes": sum(item.file_size or 0 for item in items),
            "totalFiles": len(items),
            "imageCount": len([item for item in items if item.message_type == "image"]),
            "videoCount": len([item for item in items if item.message_type == "video"]),
            "voiceCount": len([item for item in items if item.message_type == "voice"]),
            "fileCount": len([item for item in items if item.message_type == "file"]),
        }
        return summary

    def delete_conversation_media(
        self,
        db: Session,
        *,
        current_user_id: str,
        conversation_type: str,
        conversation_id: str,
    ) -> dict:
        conversation = self._resolve_conversation(
            db,
            current_user_id=current_user_id,
            conversation_type=conversation_type,
            conversation_id=conversation_id,
        )
        messages = self._visible_messages_for_conversation(
            db,
            conversation_type=conversation["apiConversationType"],
            conversation_id=conversation["apiConversationId"],
            current_user_id=current_user_id,
            limit=500,
            media_only=True,
            newest_first=True,
        )
        updated = 0
        for item in messages:
            if item.sender_user_id != current_user_id or not item.storage_path:
                continue
            try:
                Path(item.storage_path).unlink(missing_ok=True)
            except Exception:
                pass
            item.storage_path = None
            item.file_url = None
            item.file_name = None
            item.file_size = None
            item.mime_type = None
            if not item.body:
                item.body = "Media removed."
            item.message_type = "text"
            updated += 1
        db.commit()
        return {"deletedCount": updated, **self.get_storage_summary(db, current_user_id=current_user_id, conversation_type=conversation["apiConversationType"], conversation_id=conversation["apiConversationId"])}

    async def update_profile_photo(
        self,
        db: Session,
        *,
        current_user_id: str,
        upload: UploadFile,
    ) -> dict:
        user = self._require_user(db, current_user_id)
        content_type = (upload.content_type or "").lower().strip()
        if content_type not in self.image_content_types:
            raise ChatManagementServiceError("Profile photo must be an image file.")
        content = await upload.read()
        if not content:
            raise ChatManagementServiceError("Uploaded profile photo is empty.")
        if len(content) > CHAT_UPLOAD_MAX_BYTES:
            raise ChatManagementServiceError("Profile photo exceeds the maximum upload size.")
        safe_name = self._sanitize_filename(upload.filename or "profile.png")
        folder = CHAT_UPLOADS_DIR / "entities" / "profile" / user.id
        folder.mkdir(parents=True, exist_ok=True)
        for existing in folder.glob("*"):
            if existing.is_file():
                existing.unlink(missing_ok=True)
        file_path = folder / safe_name
        file_path.write_bytes(content)
        user.profile_image_url = f"/chat/assets/profile/{user.id}/{safe_name}"
        db.commit()
        db.refresh(user)
        return {"imageUrl": user.profile_image_url}

    def toggle_message_reaction(self, db: Session, *, current_user_id: str, message_id: str, emoji: str) -> dict:
        message = self._require_message_access(db, current_user_id=current_user_id, message_id=message_id)
        if message.deleted_for_everyone:
            raise ChatManagementServiceError("Message was not found.")
        normalized_emoji = (emoji or "").strip()[:8]
        if not normalized_emoji:
            raise ChatManagementServiceError("Reaction emoji is required.")
        existing = db.execute(
            select(ChatMessageReaction).where(
                ChatMessageReaction.message_id == message.id,
                ChatMessageReaction.user_id == current_user_id,
            )
        ).scalar_one_or_none()
        if existing and existing.emoji == normalized_emoji:
            db.delete(existing)
        elif existing:
            existing.emoji = normalized_emoji
        else:
            db.add(
                ChatMessageReaction(
                    id=str(uuid.uuid4()),
                    message_id=message.id,
                    user_id=current_user_id,
                    emoji=normalized_emoji,
                )
            )
        db.commit()
        db.refresh(message)
        return self.serialize_message(db, message, current_user_id=current_user_id)

    def toggle_message_star(self, db: Session, *, current_user_id: str, message_id: str) -> dict:
        message = self._require_message_access(db, current_user_id=current_user_id, message_id=message_id)
        if message.deleted_for_everyone:
            raise ChatManagementServiceError("Message was not found.")
        existing = db.execute(
            select(ChatMessageStar).where(
                ChatMessageStar.message_id == message.id,
                ChatMessageStar.user_id == current_user_id,
            )
        ).scalar_one_or_none()
        if existing:
            db.delete(existing)
        else:
            db.add(ChatMessageStar(id=str(uuid.uuid4()), message_id=message.id, user_id=current_user_id))
        db.commit()
        db.refresh(message)
        return self.serialize_message(db, message, current_user_id=current_user_id)

    def toggle_message_pin(self, db: Session, *, current_user_id: str, message_id: str) -> dict:
        message = self._require_message_access(db, current_user_id=current_user_id, message_id=message_id)
        if message.deleted_for_everyone:
            raise ChatManagementServiceError("Message was not found.")
        existing = db.execute(
            select(ChatMessagePin).where(
                ChatMessagePin.message_id == message.id,
                ChatMessagePin.user_id == current_user_id,
            )
        ).scalar_one_or_none()
        if existing:
            db.delete(existing)
        else:
            db.add(ChatMessagePin(id=str(uuid.uuid4()), message_id=message.id, user_id=current_user_id))
        db.commit()
        db.refresh(message)
        return self.serialize_message(db, message, current_user_id=current_user_id)

    def send_text_message(
        self,
        db: Session,
        *,
        current_user_id: str,
        receiver_user_id: str,
        body: str | None,
        reply_to_message_id: str | None,
    ) -> dict:
        return self.send_conversation_text_message(
            db,
            current_user_id=current_user_id,
            conversation_type="direct",
            conversation_id=receiver_user_id,
            body=body,
            reply_to_message_id=reply_to_message_id,
        )

    def send_conversation_text_message(
        self,
        db: Session,
        *,
        current_user_id: str,
        conversation_type: str,
        conversation_id: str,
        body: str | None,
        reply_to_message_id: str | None,
    ) -> dict:
        cleaned_body = (body or "").strip()
        if not cleaned_body:
            raise ChatManagementServiceError("Message cannot be empty.")
        conversation = self._resolve_conversation(
            db,
            current_user_id=current_user_id,
            conversation_type=conversation_type,
            conversation_id=conversation_id,
        )
        if conversation["conversationType"] == "direct":
            self._assert_direct_message_allowed(db, current_user_id=current_user_id, other_user_id=conversation["otherUserId"])
        message = self._build_message_record(
            db=db,
            current_user_id=current_user_id,
            conversation=conversation,
            body=cleaned_body,
            message_type="text",
            reply_to_message_id=reply_to_message_id,
        )
        self._apply_delivery_status(db, message, participant_ids=conversation["participantIds"], sender_user_id=current_user_id)
        db.add(message)
        self._create_message_notifications(db, conversation=conversation, sender_user_id=current_user_id, message=message)
        db.commit()
        db.refresh(message)
        return self.serialize_message(db, message, current_user_id=current_user_id)

    async def send_uploaded_message(
        self,
        db: Session,
        *,
        current_user_id: str,
        receiver_user_id: str | None = None,
        conversation_type: str = "direct",
        conversation_id: str | None = None,
        upload: UploadFile,
        body: str | None,
        reply_to_message_id: str | None,
    ) -> dict:
        effective_conversation_id = conversation_id or receiver_user_id
        if not effective_conversation_id:
            raise ChatManagementServiceError("Conversation target was not provided.")
        conversation = self._resolve_conversation(
            db,
            current_user_id=current_user_id,
            conversation_type=conversation_type,
            conversation_id=effective_conversation_id,
        )
        if conversation["conversationType"] == "direct":
            self._assert_direct_message_allowed(db, current_user_id=current_user_id, other_user_id=conversation["otherUserId"])
        content = await upload.read()
        if not content:
            raise ChatManagementServiceError("Uploaded file is empty.")
        if len(content) > CHAT_UPLOAD_MAX_BYTES:
            raise ChatManagementServiceError("File exceeds the maximum upload size.")
        content_type = (upload.content_type or "").lower().strip()
        if content_type not in self.allowed_content_types:
            raise ChatManagementServiceError("Unsupported file type.")
        safe_name = self._sanitize_filename(upload.filename or "attachment")
        message = self._build_message_record(
            db=db,
            current_user_id=current_user_id,
            conversation=conversation,
            body=(body or "").strip() or None,
            message_type=self._detect_upload_message_type(content_type),
            reply_to_message_id=reply_to_message_id,
        )
        db.add(message)
        db.flush()
        storage_path = self._save_attachment_file(owner_id=current_user_id, message_id=message.id, file_name=safe_name, content=content)
        message.file_name = upload.filename or safe_name
        message.file_size = len(content)
        message.mime_type = content_type
        message.storage_path = str(storage_path)
        message.file_url = f"/chat/files/{message.id}"
        self._apply_delivery_status(db, message, participant_ids=conversation["participantIds"], sender_user_id=current_user_id)
        self._create_message_notifications(db, conversation=conversation, sender_user_id=current_user_id, message=message)
        db.commit()
        db.refresh(message)
        return self.serialize_message(db, message, current_user_id=current_user_id)

    def edit_message(self, db: Session, *, current_user_id: str, message_id: str, body: str) -> dict:
        message = db.execute(select(ChatMessage).where(ChatMessage.id == message_id)).scalar_one_or_none()
        if not message or message.sender_user_id != current_user_id:
            raise ChatManagementServiceError("Message was not found.")
        if message.deleted_for_everyone or message.message_type != "text":
            raise ChatManagementServiceError("Only active text messages can be edited.")
        cleaned_body = (body or "").strip()
        if not cleaned_body:
            raise ChatManagementServiceError("Message cannot be empty.")
        message.body = cleaned_body
        message.edited_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(message)
        return self.serialize_message(db, message, current_user_id=current_user_id)

    def mark_conversation_read(self, db: Session, *, current_user_id: str, friend_user_id: str) -> dict:
        return self.mark_entity_read(
            db,
            current_user_id=current_user_id,
            conversation_type="direct",
            conversation_id=friend_user_id,
        )

    def mark_entity_read(self, db: Session, *, current_user_id: str, conversation_type: str, conversation_id: str) -> dict:
        conversation = self._resolve_conversation(
            db,
            current_user_id=current_user_id,
            conversation_type=conversation_type,
            conversation_id=conversation_id,
        )
        now = datetime.now(timezone.utc)
        updated_ids: list[str] = []
        if conversation["conversationType"] == "direct":
            messages = db.execute(
                select(ChatMessage).where(
                    ChatMessage.sender_user_id == conversation["otherUserId"],
                    ChatMessage.receiver_user_id == current_user_id,
                    ChatMessage.group_id.is_(None),
                    ChatMessage.read_at.is_(None),
                    ChatMessage.deleted_for_everyone.is_(False),
                )
            ).scalars().all()
            for item in messages:
                if not self._message_visible_for_user_in_conversation(
                    db,
                    item,
                    current_user_id=current_user_id,
                    conversation_type="direct",
                    conversation_id=conversation["otherUserId"],
                ):
                    continue
                item.status = "read"
                if not item.delivered_at:
                    item.delivered_at = now
                item.read_at = now
                updated_ids.append(item.id)
        else:
            conversation["membership"].last_read_at = now
            group_messages = db.execute(
                self._conversation_message_query(
                    db,
                    conversation_type=conversation["conversationType"],
                    conversation_id=conversation["apiConversationId"],
                    current_user_id=current_user_id,
                )
            ).scalars().all()
            updated_ids = [
                item.id
                for item in group_messages
                if item.sender_user_id != current_user_id
                and self._message_visible_for_user_in_conversation(
                    db,
                    item,
                    current_user_id=current_user_id,
                    conversation_type=conversation["apiConversationType"],
                    conversation_id=conversation["apiConversationId"],
                )
            ]
        db.commit()
        return {"updatedIds": updated_ids, "readAt": self._serialize_datetime(now)}

    def delete_message(self, db: Session, *, current_user_id: str, message_id: str, scope: str) -> dict:
        message = db.execute(select(ChatMessage).where(ChatMessage.id == message_id)).scalar_one_or_none()
        if not message:
            raise ChatManagementServiceError("Message was not found.")
        if message.group_id:
            self._require_group_membership(db, group_id=message.group_id, user_id=current_user_id)
        elif message.sender_user_id != current_user_id and message.receiver_user_id != current_user_id:
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
            message.hidden_for_user_ids = None
            message.body = None
            message.file_url = None
            message.storage_path = None
            message.file_name = None
            message.file_size = None
            message.mime_type = None
            message.reply_to_message_id = None
        else:
            hidden_ids = self._deserialize_user_id_list(message.hidden_for_user_ids)
            if current_user_id not in hidden_ids:
                hidden_ids.append(current_user_id)
            message.hidden_for_user_ids = self._serialize_user_id_list(hidden_ids)
            if message.sender_user_id == current_user_id:
                message.deleted_by_sender = True
            if message.receiver_user_id == current_user_id:
                message.deleted_by_receiver = True
        db.commit()
        return {"messageId": message.id, "scope": normalized_scope, "deletedForEveryone": bool(message.deleted_for_everyone)}

    def get_message_download_path(self, db: Session, *, current_user_id: str, message_id: str) -> tuple[Path, str, str | None]:
        message = db.execute(select(ChatMessage).where(ChatMessage.id == message_id)).scalar_one_or_none()
        if not message or not message.storage_path or not message.file_name:
            raise ChatManagementServiceError("File was not found.")
        if message.group_id:
            self._require_group_membership(db, group_id=message.group_id, user_id=current_user_id)
        elif message.sender_user_id != current_user_id and message.receiver_user_id != current_user_id:
            raise ChatManagementServiceError("File was not found.")
        if self._message_hidden_for_user(message, current_user_id) or self._message_is_expired(message):
            raise ChatManagementServiceError("File was not found.")
        file_path = Path(message.storage_path)
        if not file_path.exists():
            raise ChatManagementServiceError("File is no longer available.")
        return file_path, message.file_name, message.mime_type

    def get_entity_asset_path(
        self,
        db: Session,
        *,
        current_user_id: str,
        entity_type: str,
        entity_id: str,
        file_name: str,
    ) -> tuple[Path, str | None]:
        safe_entity_type = (entity_type or "").strip().lower()
        safe_file_name = self._sanitize_filename(file_name or "")
        if safe_entity_type not in {"group", "community", "profile"} or not safe_file_name:
            raise ChatManagementServiceError("Asset was not found.")
        if safe_entity_type == "group":
            self._require_group_membership(db, group_id=entity_id, user_id=current_user_id)
        elif safe_entity_type == "community":
            self._require_community_membership(db, community_id=entity_id, user_id=current_user_id)
        else:
            if current_user_id != entity_id and not self._users_are_friends(db, first_user_id=current_user_id, second_user_id=entity_id):
                raise ChatManagementServiceError("Asset was not found.")
            if current_user_id != entity_id and not self._profile_visible_to(db, target_user_id=entity_id, viewer_user_id=current_user_id):
                raise ChatManagementServiceError("Asset was not found.")
        file_path = CHAT_UPLOADS_DIR / "entities" / safe_entity_type / entity_id / safe_file_name
        if not file_path.exists():
            raise ChatManagementServiceError("Asset was not found.")
        return file_path, "image/png" if safe_file_name.lower().endswith(".png") else None

    def get_conversation_asset_path(
        self,
        db: Session,
        *,
        current_user_id: str,
        conversation_type: str,
        conversation_key: str,
        file_name: str,
    ) -> tuple[Path, str | None]:
        safe_conversation_type = (conversation_type or "").strip().lower()
        safe_conversation_key = (conversation_key or "").strip()
        safe_file_name = self._sanitize_filename(file_name or "")
        if safe_conversation_type not in {"direct", "group", "community"} or not safe_conversation_key or not safe_file_name:
            raise ChatManagementServiceError("Asset was not found.")
        self._assert_background_access(
            db,
            current_user_id=current_user_id,
            conversation_type=safe_conversation_type,
            conversation_key=safe_conversation_key,
        )
        background = db.execute(
            select(ChatConversationBackground).where(
                ChatConversationBackground.conversation_type == safe_conversation_type,
                ChatConversationBackground.conversation_key == safe_conversation_key,
                ChatConversationBackground.file_name == safe_file_name,
            )
        ).scalar_one_or_none()
        if not background:
            raise ChatManagementServiceError("Asset was not found.")
        file_path = CHAT_UPLOADS_DIR / "conversation-backgrounds" / safe_conversation_type / safe_conversation_key / safe_file_name
        if not file_path.exists():
            raise ChatManagementServiceError("Asset was not found.")
        return file_path, background.mime_type

    def create_group(
        self,
        db: Session,
        *,
        current_user_id: str,
        name: str,
        description: str | None,
        member_ids: list[str],
        image_file: UploadFile | None = None,
    ) -> dict:
        cleaned_name = (name or "").strip()
        if len(cleaned_name) < 3:
            raise ChatManagementServiceError("Group name must be at least 3 characters.")
        clean_member_ids = list(dict.fromkeys([item for item in member_ids if item and item != current_user_id]))
        for member_id in clean_member_ids:
            self._ensure_friends(db, current_user_id=current_user_id, other_user_id=member_id)
        now = datetime.now(timezone.utc)
        group = ChatGroup(
            id=str(uuid.uuid4()),
            name=cleaned_name,
            description=(description or "").strip() or None,
            created_by_user_id=current_user_id,
            group_type="group",
            created_at=now,
            updated_at=now,
        )
        db.add(group)
        db.flush()
        self._add_group_member(db, group_id=group.id, user_id=current_user_id, role="admin", added_by_user_id=current_user_id)
        for member_id in clean_member_ids:
            self._add_group_member(db, group_id=group.id, user_id=member_id, role="member", added_by_user_id=current_user_id)
        if image_file:
            self._store_entity_image(group, "group", image_file)
        for member_id in clean_member_ids:
            self._create_workspace_notification(
                db,
                user_id=member_id,
                category="chat",
                title=f"Added to {group.name}",
                message=f"{self._display_name(self._require_user(db, current_user_id))} added you to a group chat.",
                action_type="open_chat",
                action_entity_id=group.id,
                action_entity_kind="group",
                action_context={"conversationType": "group", "conversationId": group.id, "focus": "conversation"},
            )
        db.commit()
        return self.get_group_detail(db, current_user_id=current_user_id, group_id=group.id)

    def update_group(
        self,
        db: Session,
        *,
        current_user_id: str,
        group_id: str,
        name: str | None,
        description: str | None,
        is_muted: bool | None,
        image_file: UploadFile | None = None,
    ) -> dict:
        group, membership = self._require_group_membership(db, group_id=group_id, user_id=current_user_id)
        if is_muted is not None:
            membership.is_muted = bool(is_muted)
            preference = self._ensure_conversation_preference(
                db,
                user_id=current_user_id,
                conversation_type="group",
                conversation_id=group_id,
            )
            preference.is_muted = bool(is_muted)
            preference.updated_at = datetime.now(timezone.utc)
        if name is not None or description is not None or image_file is not None:
            self._ensure_group_admin(membership)
            if name is not None:
                cleaned_name = name.strip()
                if len(cleaned_name) < 3:
                    raise ChatManagementServiceError("Group name must be at least 3 characters.")
                group.name = cleaned_name
            if description is not None:
                group.description = description.strip() or None
            if image_file is not None:
                self._store_entity_image(group, "group", image_file)
            group.updated_at = datetime.now(timezone.utc)
        db.commit()
        return self.get_group_detail(db, current_user_id=current_user_id, group_id=group.id)

    def add_group_members(self, db: Session, *, current_user_id: str, group_id: str, user_ids: list[str]) -> dict:
        group, membership = self._require_group_membership(db, group_id=group_id, user_id=current_user_id)
        self._ensure_group_admin(membership)
        for user_id in list(dict.fromkeys([item for item in user_ids if item])):
            if user_id == current_user_id or self._group_member_record(db, group_id=group.id, user_id=user_id):
                continue
            self._ensure_friends(db, current_user_id=current_user_id, other_user_id=user_id)
            self._add_group_member(db, group_id=group.id, user_id=user_id, role="member", added_by_user_id=current_user_id)
            self._create_workspace_notification(
                db,
                user_id=user_id,
                category="chat",
                title=f"Added to {group.name}",
                message=f"{self._display_name(self._require_user(db, current_user_id))} added you to a group chat.",
                action_type="open_chat",
                action_entity_id=group.id,
                action_entity_kind="group",
                action_context={"conversationType": "group", "conversationId": group.id, "focus": "conversation"},
            )
        group.updated_at = datetime.now(timezone.utc)
        db.commit()
        return self.get_group_detail(db, current_user_id=current_user_id, group_id=group.id)

    def remove_group_member(self, db: Session, *, current_user_id: str, group_id: str, user_id: str) -> dict:
        group, membership = self._require_group_membership(db, group_id=group_id, user_id=current_user_id)
        self._ensure_group_admin(membership)
        member = self._group_member_record(db, group_id=group.id, user_id=user_id)
        if not member:
            raise ChatManagementServiceError("Group member was not found.")
        if user_id == group.created_by_user_id:
            raise ChatManagementServiceError("The group creator cannot be removed.")
        db.delete(member)
        group.updated_at = datetime.now(timezone.utc)
        db.commit()
        return self.get_group_detail(db, current_user_id=current_user_id, group_id=group.id)

    def update_group_member_role(self, db: Session, *, current_user_id: str, group_id: str, user_id: str, role: str) -> dict:
        group, membership = self._require_group_membership(db, group_id=group_id, user_id=current_user_id)
        self._ensure_group_admin(membership)
        member = self._group_member_record(db, group_id=group.id, user_id=user_id)
        if not member:
            raise ChatManagementServiceError("Group member was not found.")
        normalized_role = (role or "").strip().lower()
        if normalized_role not in {"admin", "member"}:
            raise ChatManagementServiceError("Unsupported member role.")
        member.role = normalized_role
        group.updated_at = datetime.now(timezone.utc)
        db.commit()
        return self.get_group_detail(db, current_user_id=current_user_id, group_id=group.id)

    def exit_group(self, db: Session, *, current_user_id: str, group_id: str) -> dict:
        group, membership = self._require_group_membership(db, group_id=group_id, user_id=current_user_id)
        if current_user_id == group.created_by_user_id:
            raise ChatManagementServiceError("The group creator must delete the group or promote another admin first.")
        db.delete(membership)
        group.updated_at = datetime.now(timezone.utc)
        db.commit()
        return {"exited": True, "groupId": group.id}

    def delete_group(self, db: Session, *, current_user_id: str, group_id: str) -> dict:
        group, membership = self._require_group_membership(db, group_id=group_id, user_id=current_user_id)
        self._ensure_group_admin(membership)
        if group.created_by_user_id != current_user_id:
            raise ChatManagementServiceError("Only the group creator can delete the group.")
        group.is_deleted = True
        group.updated_at = datetime.now(timezone.utc)
        db.commit()
        return {"deleted": True, "groupId": group.id}

    def create_community(
        self,
        db: Session,
        *,
        current_user_id: str,
        name: str,
        description: str | None,
        image_file: UploadFile | None = None,
    ) -> dict:
        cleaned_name = (name or "").strip()
        if len(cleaned_name) < 3:
            raise ChatManagementServiceError("Community name must be at least 3 characters.")
        now = datetime.now(timezone.utc)
        announcement_group = ChatGroup(
            id=str(uuid.uuid4()),
            name=f"{cleaned_name} Announcements",
            description="Community announcement channel",
            created_by_user_id=current_user_id,
            group_type="community_announcement",
            created_at=now,
            updated_at=now,
        )
        db.add(announcement_group)
        db.flush()
        self._add_group_member(db, group_id=announcement_group.id, user_id=current_user_id, role="admin", added_by_user_id=current_user_id)
        community = ChatCommunity(
            id=str(uuid.uuid4()),
            name=cleaned_name,
            description=(description or "").strip() or None,
            image_url=None,
            created_by_user_id=current_user_id,
            announcement_group_id=announcement_group.id,
            created_at=now,
            updated_at=now,
        )
        db.add(community)
        db.flush()
        if image_file:
            self._store_entity_image(community, "community", image_file)
        db.commit()
        return self.get_community_detail(db, current_user_id=current_user_id, community_id=community.id)

    def update_community(
        self,
        db: Session,
        *,
        current_user_id: str,
        community_id: str,
        name: str | None,
        description: str | None,
        is_muted: bool | None,
        image_file: UploadFile | None = None,
    ) -> dict:
        community, _, membership = self._require_community_membership(db, community_id=community_id, user_id=current_user_id)
        if is_muted is not None:
            membership.is_muted = bool(is_muted)
            preference = self._ensure_conversation_preference(
                db,
                user_id=current_user_id,
                conversation_type="community",
                conversation_id=community_id,
            )
            preference.is_muted = bool(is_muted)
            preference.updated_at = datetime.now(timezone.utc)
        if name is not None or description is not None or image_file is not None:
            self._ensure_group_admin(membership)
            if name is not None:
                cleaned_name = name.strip()
                if len(cleaned_name) < 3:
                    raise ChatManagementServiceError("Community name must be at least 3 characters.")
                community.name = cleaned_name
            if description is not None:
                community.description = description.strip() or None
            if image_file is not None:
                self._store_entity_image(community, "community", image_file)
            community.updated_at = datetime.now(timezone.utc)
        db.commit()
        return self.get_community_detail(db, current_user_id=current_user_id, community_id=community.id)

    def join_community(self, db: Session, *, current_user_id: str, community_id: str) -> dict:
        community = self._require_community(db, community_id=community_id)
        membership = self._group_member_record(db, group_id=community.announcement_group_id, user_id=current_user_id)
        if not membership:
            self._add_group_member(
                db,
                group_id=community.announcement_group_id,
                user_id=current_user_id,
                role="member",
                added_by_user_id=community.created_by_user_id,
            )
            community.updated_at = datetime.now(timezone.utc)
            db.commit()
        return self.get_community_detail(db, current_user_id=current_user_id, community_id=community.id)

    def leave_community(self, db: Session, *, current_user_id: str, community_id: str) -> dict:
        community, _, membership = self._require_community_membership(db, community_id=community_id, user_id=current_user_id)
        if current_user_id == community.created_by_user_id:
            raise ChatManagementServiceError("The community creator cannot leave the community.")
        db.delete(membership)
        community.updated_at = datetime.now(timezone.utc)
        db.commit()
        return {"left": True, "communityId": community.id}

    def add_group_to_community(self, db: Session, *, current_user_id: str, community_id: str, group_id: str) -> dict:
        community, _, membership = self._require_community_membership(db, community_id=community_id, user_id=current_user_id)
        self._ensure_group_admin(membership)
        self._require_group_membership(db, group_id=group_id, user_id=current_user_id)
        existing = db.execute(
            select(ChatCommunityGroup).where(ChatCommunityGroup.community_id == community.id, ChatCommunityGroup.group_id == group_id)
        ).scalar_one_or_none()
        if not existing:
            db.add(ChatCommunityGroup(id=str(uuid.uuid4()), community_id=community.id, group_id=group_id))
        community.updated_at = datetime.now(timezone.utc)
        db.commit()
        return self.get_community_detail(db, current_user_id=current_user_id, community_id=community.id)

    def remove_group_from_community(self, db: Session, *, current_user_id: str, community_id: str, group_id: str) -> dict:
        community, _, membership = self._require_community_membership(db, community_id=community_id, user_id=current_user_id)
        self._ensure_group_admin(membership)
        link = db.execute(
            select(ChatCommunityGroup).where(ChatCommunityGroup.community_id == community.id, ChatCommunityGroup.group_id == group_id)
        ).scalar_one_or_none()
        if not link:
            raise ChatManagementServiceError("Community group link was not found.")
        db.delete(link)
        community.updated_at = datetime.now(timezone.utc)
        db.commit()
        return self.get_community_detail(db, current_user_id=current_user_id, community_id=community.id)

    async def connect_websocket(self, user_id: str, websocket: WebSocket) -> None:
        await self.manager.connect(user_id, websocket)
        await self._broadcast_presence_change(user_id, "online")

    async def disconnect_websocket(self, user_id: str, websocket: WebSocket) -> None:
        self.manager.disconnect(user_id, websocket)
        await self._broadcast_presence_change(user_id, "offline")

    async def handle_active_conversation(self, *, user_id: str, conversation_type: str | None, conversation_id: str | None) -> None:
        effective_type = (conversation_type or "").strip().lower()
        effective_id = (conversation_id or "").strip()
        self.manager.set_active_conversation(
            user_id,
            self._conversation_key(effective_type, effective_id) if effective_type and effective_id else None,
        )
        if not effective_type or not effective_id:
            return
        with SessionLocal() as db:
            result = self.mark_entity_read(
                db,
                current_user_id=user_id,
                conversation_type=effective_type,
                conversation_id=effective_id,
            )
            conversation = self._resolve_conversation(
                db,
                current_user_id=user_id,
                conversation_type=effective_type,
                conversation_id=effective_id,
            )
            share_read_receipts = effective_type != "direct" or self._read_receipts_enabled(db, user_id=user_id)
        for participant_id in conversation["participantIds"]:
            if participant_id == user_id:
                continue
            if not share_read_receipts:
                continue
            for message_id in result["updatedIds"]:
                await self.manager.send_event(
                    participant_id,
                    {"type": "message:status", "messageId": message_id, "status": "read", "readAt": result["readAt"]},
                )

    async def handle_typing_event(self, *, user_id: str, conversation_type: str, conversation_id: str, is_typing: bool) -> None:
        with SessionLocal() as db:
            conversation = self._resolve_conversation(
                db,
                current_user_id=user_id,
                conversation_type=conversation_type,
                conversation_id=conversation_id,
            )
            if conversation["conversationType"] == "direct":
                self._assert_direct_message_allowed(db, current_user_id=user_id, other_user_id=conversation["otherUserId"])
        payload = {
            "type": "typing" if is_typing else "stop_typing",
            "userId": user_id,
            "conversationType": conversation["apiConversationType"],
            "conversationId": conversation["apiConversationId"],
            "isTyping": bool(is_typing),
        }
        for participant_id in conversation["participantIds"]:
            if participant_id != user_id:
                await self.manager.send_event(participant_id, payload)

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

    async def emit_message_created(self, db: Session, *, message_id: str) -> None:
        message = db.execute(select(ChatMessage).where(ChatMessage.id == message_id)).scalar_one()
        for participant_id in self._participant_ids_for_message(db, message):
            conversation_id = self._serialize_message_conversation_id(db, message, current_user_id=participant_id)
            await self.manager.send_event(
                participant_id,
                {"type": "message:new", "message": self.serialize_message(db, message, current_user_id=participant_id)},
            )
            await self.manager.send_event(participant_id, {"type": "overview:refresh"})
            await self.manager.send_event(
                participant_id,
                {
                    "type": "conversation:refresh",
                    "conversationType": message.conversation_type or "direct",
                    "conversationId": conversation_id,
                },
            )
            if participant_id != message.sender_user_id:
                preference = self._conversation_preference_for_user(
                    db,
                    user_id=participant_id,
                    conversation_type=message.conversation_type or "direct",
                    conversation_id=conversation_id,
                )
                recipient_membership = None
                if message.group_id:
                    recipient_membership = self._group_member_record(db, group_id=message.group_id, user_id=participant_id)
                if (
                    not (preference and preference.is_muted)
                    and not (recipient_membership and recipient_membership.is_muted)
                    and self._notifications_enabled_for_conversation(db, user_id=participant_id, conversation_type=message.conversation_type or "direct")
                    and bool(self._chat_settings_form(db, user_id=participant_id, category="chat-notifications").get("inAppToasts", True))
                    and self.manager.get_active_conversation(participant_id) != self._conversation_key(message.conversation_type or "direct", conversation_id)
                ):
                    await self.manager.send_event(
                        participant_id,
                        {
                            "type": "notification:new",
                            "conversationType": message.conversation_type or "direct",
                            "conversationId": conversation_id,
                            "messageId": message.id,
                        },
                    )

    async def emit_message_updated(self, db: Session, *, message_id: str) -> None:
        message = db.execute(select(ChatMessage).where(ChatMessage.id == message_id)).scalar_one()
        for participant_id in self._participant_ids_for_message(db, message):
            conversation_id = self._serialize_message_conversation_id(db, message, current_user_id=participant_id)
            await self.manager.send_event(
                participant_id,
                {"type": "message:updated", "message": self.serialize_message(db, message, current_user_id=participant_id)},
            )
            await self.manager.send_event(
                participant_id,
                {
                    "type": "conversation:refresh",
                    "conversationType": message.conversation_type or "direct",
                    "conversationId": conversation_id,
                },
            )

    async def emit_message_deleted(self, db: Session, *, message_id: str, payload: dict) -> None:
        message = db.execute(select(ChatMessage).where(ChatMessage.id == message_id)).scalar_one_or_none()
        if not message:
            return
        event = {"type": "message:deleted", "messageId": message_id, **payload}
        for participant_id in self._participant_ids_for_message(db, message):
            conversation_id = self._serialize_message_conversation_id(db, message, current_user_id=participant_id)
            await self.manager.send_event(participant_id, event)
            await self.manager.send_event(participant_id, {"type": "overview:refresh"})
            await self.manager.send_event(
                participant_id,
                {
                    "type": "conversation:refresh",
                    "conversationType": message.conversation_type or "direct",
                    "conversationId": conversation_id,
                },
            )

    async def emit_group_refresh(self, *, group_id: str) -> None:
        with SessionLocal() as db:
            participant_ids = self._group_member_ids(db, group_id=group_id)
        for user_id in participant_ids:
            await self.manager.send_event(user_id, {"type": "overview:refresh"})
            await self.manager.send_event(user_id, {"type": "group:refresh", "groupId": group_id})

    async def emit_community_refresh(self, *, community_id: str) -> None:
        with SessionLocal() as db:
            community = self._require_community(db, community_id=community_id)
            participant_ids = self._group_member_ids(db, group_id=community.announcement_group_id)
        for user_id in participant_ids:
            await self.manager.send_event(user_id, {"type": "overview:refresh"})
            await self.manager.send_event(user_id, {"type": "community:refresh", "communityId": community_id})

    async def emit_conversation_refresh(self, db: Session, *, current_user_id: str, conversation_type: str, conversation_id: str) -> None:
        participant_ids = self._conversation_participant_ids(
            db,
            current_user_id=current_user_id,
            conversation_type=conversation_type,
            conversation_id=conversation_id,
        )
        normalized_type = (conversation_type or "").strip().lower()
        for user_id in participant_ids:
            await self.manager.send_event(user_id, {"type": "overview:refresh"})
            await self.manager.send_event(
                user_id,
                {
                    "type": "conversation:refresh",
                    "conversationType": normalized_type,
                    "conversationId": conversation_id,
                },
            )
            if normalized_type == "group":
                await self.manager.send_event(user_id, {"type": "group:refresh", "groupId": conversation_id})
            elif normalized_type == "community":
                await self.manager.send_event(user_id, {"type": "community:refresh", "communityId": conversation_id})

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
        relationship_map = self._relationship_state_map(db, current_user_id=current_user_id, other_user_ids=[sender.id, receiver.id])
        return {
            "id": item.id,
            "sender": self.serialize_user_summary(
                db,
                sender,
                "self" if sender.id == current_user_id else relationship_map.get(sender.id, "none"),
                viewer_user_id=current_user_id,
            ),
            "receiver": self.serialize_user_summary(
                db,
                receiver,
                "self" if receiver.id == current_user_id else relationship_map.get(receiver.id, "none"),
                viewer_user_id=current_user_id,
            ),
            "status": item.status,
            "createdAt": self._serialize_datetime(item.created_at),
            "respondedAt": self._serialize_datetime(item.responded_at),
        }

    def serialize_user_summary(
        self,
        db: Session,
        user: User,
        relationship_state: str,
        *,
        viewer_user_id: str | None = None,
    ) -> dict:
        viewer_id = viewer_user_id or user.id
        is_online = self.manager.is_online(user.id)
        last_seen_at = self.manager.get_last_seen_at(user.id) or user.last_login_at
        full_name = self._display_name(user)
        can_view_last_seen = viewer_id == user.id or self._last_seen_visible_to(db, target_user_id=user.id, viewer_user_id=viewer_id)
        can_view_profile = viewer_id == user.id or self._profile_visible_to(db, target_user_id=user.id, viewer_user_id=viewer_id)
        return {
            "id": user.id,
            "username": user.username,
            "fullName": full_name,
            "avatarLabel": self._avatar_label(full_name),
            "imageUrl": user.profile_image_url if can_view_profile else None,
            "bio": user.bio if can_view_profile else None,
            "presenceStatus": "online" if is_online and can_view_last_seen else "offline",
            "lastSeenAt": self._serialize_datetime(last_seen_at) if can_view_last_seen else None,
            "relationshipState": relationship_state,
            "statusText": "Online" if is_online and can_view_last_seen else ("Offline" if can_view_last_seen else "Hidden"),
        }

    def serialize_direct_chat_item(self, db: Session, *, friend_user_id: str, current_user_id: str) -> dict:
        friend = self._require_user(db, friend_user_id)
        preference = self._conversation_preference_for_user(
            db,
            user_id=current_user_id,
            conversation_type="direct",
            conversation_id=friend_user_id,
        )
        background_url = self._conversation_background_url(
            db,
            conversation_type="direct",
            conversation_key=self._direct_conversation_key(current_user_id, friend_user_id),
        )
        latest_message = self._latest_visible_conversation_message(
            db,
            conversation_type="direct",
            conversation_id=friend_user_id,
            current_user_id=current_user_id,
        )
        unread_count = self._direct_unread_count(db, friend_user_id=friend_user_id, current_user_id=current_user_id)
        summary = self.serialize_user_summary(db, friend, "friends", viewer_user_id=current_user_id)
        return {
            "id": friend.id,
            "title": summary["fullName"],
            "subtitle": summary["bio"] or f"@{friend.username}",
            "avatarLabel": summary["avatarLabel"],
            "imageUrl": summary["imageUrl"],
            "conversationType": "direct",
            "entityType": "chat",
            "unreadCount": unread_count,
            "lastMessagePreview": self._message_preview(latest_message),
            "lastMessageAt": self._serialize_datetime(latest_message.created_at if latest_message else None),
            "lastMessageStatus": latest_message.status if latest_message and latest_message.sender_user_id == current_user_id else None,
            "presenceStatus": summary["presenceStatus"],
            "lastSeenAt": summary["lastSeenAt"],
            "statusText": summary["statusText"],
            "memberCount": 2,
            "role": "friend",
            "isMuted": bool(preference.is_muted) if preference else False,
            "isPinned": bool(preference.is_pinned) if preference else False,
            "isArchived": bool(preference.is_archived) if preference else False,
            "announcementGroupId": None,
            "linkedGroupCount": 0,
            "communityId": None,
            "backgroundUrl": background_url,
        }

    def serialize_group_list_item(self, db: Session, *, group: ChatGroup, membership: ChatGroupMember, current_user_id: str) -> dict:
        preference = self._conversation_preference_for_user(
            db,
            user_id=current_user_id,
            conversation_type="group",
            conversation_id=group.id,
        )
        background_url = self._conversation_background_url(db, conversation_type="group", conversation_key=group.id)
        latest_message = self._latest_visible_conversation_message(
            db,
            conversation_type="group",
            conversation_id=group.id,
            current_user_id=current_user_id,
        )
        return {
            "id": group.id,
            "title": group.name,
            "subtitle": group.description,
            "avatarLabel": self._avatar_label(group.name),
            "imageUrl": group.image_url,
            "conversationType": "group",
            "entityType": "group",
            "unreadCount": self._conversation_unread_count(
                db,
                current_user_id=current_user_id,
                conversation_type="group",
                conversation_id=group.id,
            ),
            "lastMessagePreview": self._message_preview(latest_message),
            "lastMessageAt": self._serialize_datetime(latest_message.created_at if latest_message else None),
            "lastMessageStatus": latest_message.status if latest_message and latest_message.sender_user_id == current_user_id else None,
            "presenceStatus": None,
            "lastSeenAt": None,
            "statusText": f"{self._group_member_count(db, group_id=group.id)} members",
            "memberCount": self._group_member_count(db, group_id=group.id),
            "role": membership.role,
            "isMuted": bool(preference.is_muted if preference else membership.is_muted),
            "isPinned": bool(preference.is_pinned) if preference else False,
            "isArchived": bool(preference.is_archived) if preference else False,
            "announcementGroupId": None,
            "linkedGroupCount": 0,
            "communityId": None,
            "backgroundUrl": background_url,
        }

    def serialize_community_list_item(self, db: Session, *, community: ChatCommunity, membership: ChatGroupMember, current_user_id: str) -> dict:
        preference = self._conversation_preference_for_user(
            db,
            user_id=current_user_id,
            conversation_type="community",
            conversation_id=community.id,
        )
        background_url = self._conversation_background_url(db, conversation_type="community", conversation_key=community.id)
        latest_message = self._latest_visible_conversation_message(
            db,
            conversation_type="community",
            conversation_id=community.id,
            current_user_id=current_user_id,
        )
        linked_group_count = db.execute(
            select(func.count()).select_from(ChatCommunityGroup).where(ChatCommunityGroup.community_id == community.id)
        ).scalar_one()
        return {
            "id": community.id,
            "title": community.name,
            "subtitle": community.description,
            "avatarLabel": self._avatar_label(community.name),
            "imageUrl": community.image_url,
            "conversationType": "community",
            "entityType": "community",
            "unreadCount": self._conversation_unread_count(
                db,
                current_user_id=current_user_id,
                conversation_type="community",
                conversation_id=community.id,
            ),
            "lastMessagePreview": self._message_preview(latest_message),
            "lastMessageAt": self._serialize_datetime(latest_message.created_at if latest_message else None),
            "lastMessageStatus": latest_message.status if latest_message and latest_message.sender_user_id == current_user_id else None,
            "presenceStatus": None,
            "lastSeenAt": None,
            "statusText": f"{self._group_member_count(db, group_id=community.announcement_group_id)} members",
            "memberCount": self._group_member_count(db, group_id=community.announcement_group_id),
            "role": membership.role,
            "isMuted": bool(preference.is_muted if preference else membership.is_muted),
            "isPinned": bool(preference.is_pinned) if preference else False,
            "isArchived": bool(preference.is_archived) if preference else False,
            "announcementGroupId": community.announcement_group_id,
            "linkedGroupCount": linked_group_count,
            "communityId": community.id,
            "backgroundUrl": background_url,
        }

    def serialize_group_detail(self, db: Session, *, group: ChatGroup, membership: ChatGroupMember, current_user_id: str) -> dict:
        member_rows = self._group_member_rows(db, group_id=group.id)
        return {
            "id": group.id,
            "name": group.name,
            "description": group.description,
            "imageUrl": group.image_url,
            "conversationType": "group",
            "groupType": group.group_type,
            "memberCount": len(member_rows),
            "isMuted": bool(membership.is_muted),
            "currentUserRole": membership.role,
            "backgroundUrl": self._conversation_background_url(db, conversation_type="group", conversation_key=group.id),
            "members": [self.serialize_group_member(db, row[0], row[1], viewer_user_id=current_user_id) for row in member_rows],
        }

    def serialize_community_detail(self, db: Session, *, community: ChatCommunity, announcement_group: ChatGroup, membership: ChatGroupMember, current_user_id: str) -> dict:
        member_rows = self._group_member_rows(db, group_id=announcement_group.id)
        group_links = db.execute(
            select(ChatCommunityGroup, ChatGroup)
            .join(ChatGroup, ChatGroup.id == ChatCommunityGroup.group_id)
            .where(ChatCommunityGroup.community_id == community.id, ChatGroup.is_deleted.is_(False))
            .order_by(ChatGroup.updated_at.desc())
        ).all()
        return {
            "id": community.id,
            "name": community.name,
            "description": community.description,
            "imageUrl": community.image_url,
            "announcementGroupId": announcement_group.id,
            "memberCount": len(member_rows),
            "currentUserRole": membership.role,
            "isMuted": bool(membership.is_muted),
            "backgroundUrl": self._conversation_background_url(db, conversation_type="community", conversation_key=community.id),
            "groups": [{"id": group.id, "name": group.name, "description": group.description, "imageUrl": group.image_url, "memberCount": self._group_member_count(db, group_id=group.id)} for _, group in group_links],
            "members": [self.serialize_group_member(db, row[0], row[1], viewer_user_id=current_user_id) for row in member_rows],
        }

    def serialize_group_member(
        self,
        db: Session,
        membership: ChatGroupMember,
        user: User,
        *,
        viewer_user_id: str | None = None,
    ) -> dict:
        return {
            "id": membership.id,
            "userId": user.id,
            "role": membership.role,
            "isMuted": bool(membership.is_muted),
            "joinedAt": self._serialize_datetime(membership.joined_at),
            "lastReadAt": self._serialize_datetime(membership.last_read_at),
            "user": self.serialize_user_summary(db, user, "friends", viewer_user_id=viewer_user_id),
        }

    def serialize_message(self, db: Session, item: ChatMessage, *, current_user_id: str, lookup: dict[str, ChatMessage] | None = None) -> dict:
        reply_source = (lookup or {}).get(item.reply_to_message_id) if item.reply_to_message_id else None
        if not reply_source and item.reply_to_message_id:
            reply_source = db.execute(select(ChatMessage).where(ChatMessage.id == item.reply_to_message_id)).scalar_one_or_none()
        sender = self._require_user(db, item.sender_user_id)
        reply_preview = None
        if reply_source:
            reply_preview = {
                "id": reply_source.id,
                "senderName": self._display_name(self._require_user(db, reply_source.sender_user_id)),
                "body": self._message_preview(reply_source),
                "messageType": reply_source.message_type,
            }
        body = "This message was removed." if item.deleted_for_everyone else item.body
        visible_status = item.status
        visible_read_at = item.read_at
        if (
            item.group_id is None
            and current_user_id == item.sender_user_id
            and item.receiver_user_id
            and not self._read_receipts_enabled(db, user_id=item.receiver_user_id)
            and item.status == "read"
        ):
            visible_status = "delivered" if item.delivered_at else "sent"
            visible_read_at = None
        return {
            "id": item.id,
            "senderId": item.sender_user_id,
            "senderName": self._display_name(sender),
            "receiverId": item.receiver_user_id if item.group_id is None else None,
            "groupId": item.group_id,
            "conversationType": item.conversation_type or "direct",
            "conversationId": self._serialize_message_conversation_id(db, item, current_user_id=current_user_id),
            "body": body,
            "messageType": item.message_type,
            "fileUrl": None if item.deleted_for_everyone else item.file_url,
            "fileName": None if item.deleted_for_everyone else item.file_name,
            "fileSize": None if item.deleted_for_everyone else item.file_size,
            "mimeType": None if item.deleted_for_everyone else item.mime_type,
            "status": visible_status,
            "createdAt": self._serialize_datetime(item.created_at),
            "editedAt": self._serialize_datetime(item.edited_at),
            "deliveredAt": self._serialize_datetime(item.delivered_at),
            "readAt": self._serialize_datetime(visible_read_at),
            "expiresAt": self._serialize_datetime(item.expires_at),
            "deletedForEveryone": bool(item.deleted_for_everyone),
            "replyToMessageId": item.reply_to_message_id,
            "replyPreview": reply_preview,
            "reactions": self._serialize_message_reactions(db, message_id=item.id, current_user_id=current_user_id),
            "isStarred": self._message_is_starred(db, message_id=item.id, current_user_id=current_user_id),
            "isPinned": self._message_is_pinned(db, message_id=item.id, current_user_id=current_user_id),
            "canEdit": item.sender_user_id == current_user_id and item.message_type == "text" and not item.deleted_for_everyone,
            "canDeleteForEveryone": item.sender_user_id == current_user_id,
        }

    def _resolve_conversation(self, db: Session, *, current_user_id: str, conversation_type: str, conversation_id: str) -> dict:
        normalized_type = (conversation_type or "direct").strip().lower()
        normalized_id = (conversation_id or "").strip()
        if normalized_type == "direct":
            self._ensure_friends(db, current_user_id=current_user_id, other_user_id=normalized_id)
            return {"conversationType": "direct", "apiConversationType": "direct", "apiConversationId": normalized_id, "participantIds": [current_user_id, normalized_id], "otherUserId": normalized_id, "membership": None}
        if normalized_type == "group":
            group, membership = self._require_group_membership(db, group_id=normalized_id, user_id=current_user_id)
            return {"conversationType": "group", "apiConversationType": "group", "apiConversationId": group.id, "participantIds": self._group_member_ids(db, group_id=group.id), "group": group, "membership": membership}
        if normalized_type == "community":
            community, announcement_group, membership = self._require_community_membership(db, community_id=normalized_id, user_id=current_user_id)
            return {"conversationType": "community", "apiConversationType": "community", "apiConversationId": community.id, "participantIds": self._group_member_ids(db, group_id=announcement_group.id), "group": announcement_group, "community": community, "membership": membership}
        raise ChatManagementServiceError("Conversation type is not supported.")

    def _build_message_record(
        self,
        *,
        db: Session,
        current_user_id: str,
        conversation: dict,
        body: str | None,
        message_type: str,
        reply_to_message_id: str | None,
    ) -> ChatMessage:
        return ChatMessage(
            id=str(uuid.uuid4()),
            sender_user_id=current_user_id,
            receiver_user_id=conversation.get("otherUserId") or current_user_id,
            group_id=conversation.get("group").id if conversation.get("group") else None,
            conversation_type=conversation["conversationType"],
            body=body,
            message_type=message_type,
            reply_to_message_id=reply_to_message_id,
            status="sent",
            expires_at=self._conversation_expiration_at(
                db,
                user_id=current_user_id,
                conversation_type=conversation["apiConversationType"],
                conversation_id=conversation["apiConversationId"],
            ),
        )

    def _apply_delivery_status(self, db: Session, message: ChatMessage, *, participant_ids: list[str], sender_user_id: str) -> None:
        now = datetime.now(timezone.utc)
        recipients = [item for item in participant_ids if item != sender_user_id]
        if message.group_id is None and recipients:
            receiver_user_id = recipients[0]
            if self.manager.get_active_conversation(receiver_user_id) == self._conversation_key("direct", sender_user_id):
                message.delivered_at = now
                if self._read_receipts_enabled(db, user_id=receiver_user_id):
                    message.status = "read"
                    message.read_at = now
                else:
                    message.status = "delivered"
            elif self.manager.is_online(receiver_user_id):
                message.status = "delivered"
                message.delivered_at = now
        elif any(self.manager.is_online(user_id) for user_id in recipients):
            message.status = "delivered"
            message.delivered_at = now

    def _create_message_notifications(self, db: Session, *, conversation: dict, sender_user_id: str, message: ChatMessage) -> None:
        sender = self._require_user(db, sender_user_id)
        for recipient_id in conversation["participantIds"]:
            if recipient_id == sender_user_id:
                continue
            if self.manager.get_active_conversation(recipient_id) == self._conversation_key(conversation["apiConversationType"], conversation["apiConversationId"]):
                continue
            if not self._notifications_enabled_for_conversation(db, user_id=recipient_id, conversation_type=conversation["conversationType"]):
                continue
            preference = self._conversation_preference_for_user(
                db,
                user_id=recipient_id,
                conversation_type=conversation["apiConversationType"],
                conversation_id=conversation["apiConversationId"],
            )
            if preference and preference.is_muted:
                continue
            if conversation.get("group"):
                recipient_member = self._group_member_record(db, group_id=conversation["group"].id, user_id=recipient_id)
                if recipient_member and recipient_member.is_muted:
                    continue
            title = f"New message from {self._display_name(sender)}"
            if conversation["conversationType"] == "group":
                title = f"New message in {conversation['group'].name}"
            if conversation["conversationType"] == "community":
                title = f"New announcement in {conversation['community'].name}"
            self._create_workspace_notification(
                db,
                user_id=recipient_id,
                category="chat",
                title=title,
                message=self._message_preview(message),
                action_type="open_chat",
                action_entity_id=conversation["apiConversationId"],
                action_entity_kind=conversation["apiConversationType"],
                action_context={"conversationType": conversation["apiConversationType"], "conversationId": conversation["apiConversationId"], "focus": "conversation"},
            )

    def _create_workspace_notification(self, db: Session, *, user_id: str, category: str, title: str, message: str | None, action_type: str | None, action_entity_id: str | None = None, action_entity_kind: str | None = None, action_context: dict | None = None) -> None:
        db.add(
            WorkspaceNotification(
                id=str(uuid.uuid4()),
                user_id=user_id,
                category=category,
                title=title,
                message=message or "",
                action_url="#/workspace",
                action_type=action_type,
                action_entity_id=action_entity_id,
                action_entity_kind=action_entity_kind,
                action_context=json.dumps(action_context or {}),
                created_at=datetime.now(timezone.utc),
            )
        )

    def _relationship_state_map(self, db: Session, *, current_user_id: str, other_user_ids: list[str]) -> dict[str, str]:
        relationship_map = {user_id: "none" for user_id in other_user_ids}
        if not other_user_ids:
            return relationship_map
        for friend_id in db.execute(select(ChatFriendship.friend_user_id).where(ChatFriendship.user_id == current_user_id, ChatFriendship.friend_user_id.in_(other_user_ids))).scalars().all():
            relationship_map[friend_id] = "friends"
        request_rows = db.execute(
            select(ChatFriendRequest).where(
                ChatFriendRequest.status == "pending",
                or_(
                    and_(ChatFriendRequest.sender_user_id == current_user_id, ChatFriendRequest.receiver_user_id.in_(other_user_ids)),
                    and_(ChatFriendRequest.receiver_user_id == current_user_id, ChatFriendRequest.sender_user_id.in_(other_user_ids)),
                ),
            )
        ).scalars().all()
        for item in request_rows:
            if relationship_map.get(item.sender_user_id) == "friends" or relationship_map.get(item.receiver_user_id) == "friends":
                continue
            relationship_map[item.receiver_user_id if item.sender_user_id == current_user_id else item.sender_user_id] = "pending_sent" if item.sender_user_id == current_user_id else "pending_received"
        return relationship_map

    def _create_friendship_pair(self, db: Session, first_user_id: str, second_user_id: str) -> None:
        for user_id, friend_id in [(first_user_id, second_user_id), (second_user_id, first_user_id)]:
            if db.execute(select(ChatFriendship).where(ChatFriendship.user_id == user_id, ChatFriendship.friend_user_id == friend_id)).scalar_one_or_none():
                continue
            db.add(ChatFriendship(id=str(uuid.uuid4()), user_id=user_id, friend_user_id=friend_id))

    def _add_group_member(self, db: Session, *, group_id: str, user_id: str, role: str, added_by_user_id: str | None) -> None:
        db.add(ChatGroupMember(id=str(uuid.uuid4()), group_id=group_id, user_id=user_id, role=role, added_by_user_id=added_by_user_id))

    def _ensure_not_friends(self, db: Session, *, current_user_id: str, other_user_id: str) -> None:
        if db.execute(select(ChatFriendship).where(ChatFriendship.user_id == current_user_id, ChatFriendship.friend_user_id == other_user_id)).scalar_one_or_none():
            raise ChatManagementServiceError("You are already friends.")

    def _ensure_friends(self, db: Session, *, current_user_id: str, other_user_id: str) -> None:
        if not db.execute(select(ChatFriendship).where(ChatFriendship.user_id == current_user_id, ChatFriendship.friend_user_id == other_user_id)).scalar_one_or_none():
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

    def _require_group(self, db: Session, *, group_id: str) -> ChatGroup:
        group = db.execute(select(ChatGroup).where(ChatGroup.id == group_id, ChatGroup.is_deleted.is_(False))).scalar_one_or_none()
        if not group:
            raise ChatManagementServiceError("Group was not found.")
        return group

    def _require_group_membership(self, db: Session, *, group_id: str, user_id: str) -> tuple[ChatGroup, ChatGroupMember]:
        group = self._require_group(db, group_id=group_id)
        membership = self._group_member_record(db, group_id=group.id, user_id=user_id)
        if not membership:
            raise ChatManagementServiceError("You do not have access to that group.")
        return group, membership

    def _require_community(self, db: Session, *, community_id: str) -> ChatCommunity:
        community = db.execute(select(ChatCommunity).where(ChatCommunity.id == community_id)).scalar_one_or_none()
        if not community:
            raise ChatManagementServiceError("Community was not found.")
        return community

    def _require_community_membership(self, db: Session, *, community_id: str, user_id: str) -> tuple[ChatCommunity, ChatGroup, ChatGroupMember]:
        community = self._require_community(db, community_id=community_id)
        announcement_group = self._require_group(db, group_id=community.announcement_group_id)
        membership = self._group_member_record(db, group_id=announcement_group.id, user_id=user_id)
        if not membership:
            raise ChatManagementServiceError("You do not have access to that community.")
        return community, announcement_group, membership

    def _ensure_group_admin(self, membership: ChatGroupMember) -> None:
        if membership.role != "admin":
            raise ChatManagementServiceError("Only admins can perform that action.")

    def _group_member_record(self, db: Session, *, group_id: str, user_id: str) -> ChatGroupMember | None:
        return db.execute(select(ChatGroupMember).where(ChatGroupMember.group_id == group_id, ChatGroupMember.user_id == user_id)).scalar_one_or_none()

    def _group_member_rows(self, db: Session, *, group_id: str) -> list[tuple[ChatGroupMember, User]]:
        return db.execute(
            select(ChatGroupMember, User)
            .join(User, User.id == ChatGroupMember.user_id)
            .where(ChatGroupMember.group_id == group_id, User.archived_at.is_(None))
            .order_by(ChatGroupMember.role.desc(), User.full_name.asc())
        ).all()

    def _group_member_ids(self, db: Session, *, group_id: str) -> list[str]:
        return db.execute(select(ChatGroupMember.user_id).where(ChatGroupMember.group_id == group_id)).scalars().all()

    def _group_member_count(self, db: Session, *, group_id: str) -> int:
        return db.execute(select(func.count()).select_from(ChatGroupMember).where(ChatGroupMember.group_id == group_id)).scalar_one()

    def _conversation_preference_for_user(
        self,
        db: Session,
        *,
        user_id: str,
        conversation_type: str,
        conversation_id: str,
    ) -> ChatConversationPreference | None:
        return db.execute(
            select(ChatConversationPreference).where(
                ChatConversationPreference.user_id == user_id,
                ChatConversationPreference.conversation_type == (conversation_type or "").strip().lower(),
                ChatConversationPreference.conversation_id == (conversation_id or "").strip(),
            )
        ).scalar_one_or_none()

    def _ensure_conversation_preference(
        self,
        db: Session,
        *,
        user_id: str,
        conversation_type: str,
        conversation_id: str,
    ) -> ChatConversationPreference:
        existing = self._conversation_preference_for_user(
            db,
            user_id=user_id,
            conversation_type=conversation_type,
            conversation_id=conversation_id,
        )
        if existing:
            return existing
        item = ChatConversationPreference(
            id=str(uuid.uuid4()),
            user_id=user_id,
            conversation_type=(conversation_type or "").strip().lower(),
            conversation_id=(conversation_id or "").strip(),
        )
        db.add(item)
        db.flush()
        return item

    def _serialize_conversation_preference(
        self,
        preference: ChatConversationPreference | None,
        *,
        fallback_muted: bool = False,
    ) -> dict:
        return {
            "isMuted": bool(preference.is_muted) if preference else bool(fallback_muted),
            "isPinned": bool(preference.is_pinned) if preference else False,
            "isArchived": bool(preference.is_archived) if preference else False,
            "isBlocked": bool(preference.is_blocked) if preference else False,
            "disappearingMode": preference.disappearing_mode if preference else "off",
            "lastClearedAt": self._serialize_datetime(preference.last_cleared_at if preference else None),
        }

    def _chat_settings_form(self, db: Session, *, user_id: str, category: str) -> dict:
        payload = build_default_settings_payload(category)
        item = db.execute(
            select(UserSetting).where(
                UserSetting.user_id == user_id,
                UserSetting.category == category,
            )
        ).scalar_one_or_none()
        if not item:
            return payload.get("form", payload.get("values", {}))
        try:
            payload = normalize_settings_category_payload(category, json.loads(item.payload_json or "{}"))
        except (ValueError, json.JSONDecodeError):
            payload = build_default_settings_payload(category)
        return payload.get("form", payload.get("values", {}))

    def _users_are_friends(self, db: Session, *, first_user_id: str, second_user_id: str) -> bool:
        if first_user_id == second_user_id:
            return True
        return bool(
            db.execute(
                select(ChatFriendship).where(
                    ChatFriendship.user_id == first_user_id,
                    ChatFriendship.friend_user_id == second_user_id,
                )
            ).scalar_one_or_none()
        )

    def _last_seen_visible_to(self, db: Session, *, target_user_id: str, viewer_user_id: str) -> bool:
        settings = self._chat_settings_form(db, user_id=target_user_id, category="chat-privacy")
        visibility = (settings.get("lastSeenVisibility") or "contacts").strip().lower()
        if visibility == "everyone":
            return True
        if visibility == "nobody":
            return False
        return self._users_are_friends(db, first_user_id=target_user_id, second_user_id=viewer_user_id)

    def _profile_visible_to(self, db: Session, *, target_user_id: str, viewer_user_id: str) -> bool:
        settings = self._chat_settings_form(db, user_id=target_user_id, category="chat-privacy")
        visibility = (settings.get("profileVisibility") or "contacts").strip().lower()
        if visibility == "everyone":
            return True
        if visibility == "nobody":
            return False
        return self._users_are_friends(db, first_user_id=target_user_id, second_user_id=viewer_user_id)

    def _read_receipts_enabled(self, db: Session, *, user_id: str) -> bool:
        settings = self._chat_settings_form(db, user_id=user_id, category="chat-privacy")
        return bool(settings.get("readReceiptsEnabled", True))

    def _notifications_enabled_for_conversation(self, db: Session, *, user_id: str, conversation_type: str) -> bool:
        settings = self._chat_settings_form(db, user_id=user_id, category="chat-notifications")
        if conversation_type == "group":
            return bool(settings.get("groupNotifications", True))
        if conversation_type == "community":
            return bool(settings.get("communityNotifications", True))
        return bool(settings.get("messageNotifications", True))

    def _conversation_clear_cutoff(
        self,
        db: Session,
        *,
        current_user_id: str,
        conversation_type: str,
        conversation_id: str,
    ) -> datetime | None:
        preference = self._conversation_preference_for_user(
            db,
            user_id=current_user_id,
            conversation_type=conversation_type,
            conversation_id=conversation_id,
        )
        return preference.last_cleared_at if preference else None

    def _message_is_expired(self, message: ChatMessage) -> bool:
        if not message.expires_at:
            return False
        expires_at = message.expires_at.replace(tzinfo=timezone.utc) if message.expires_at.tzinfo is None else message.expires_at.astimezone(timezone.utc)
        return expires_at <= datetime.now(timezone.utc)

    def _message_visible_for_user_in_conversation(
        self,
        db: Session,
        message: ChatMessage,
        *,
        current_user_id: str,
        conversation_type: str,
        conversation_id: str,
    ) -> bool:
        if self._message_hidden_for_user(message, current_user_id):
            return False
        if self._message_is_expired(message):
            return False
        cleared_at = self._conversation_clear_cutoff(
            db,
            current_user_id=current_user_id,
            conversation_type=conversation_type,
            conversation_id=conversation_id,
        )
        if cleared_at and message.created_at and message.created_at <= cleared_at:
            return False
        return True

    def _visible_messages_for_conversation(
        self,
        db: Session,
        *,
        conversation_type: str,
        conversation_id: str,
        current_user_id: str,
        limit: int = 200,
        media_only: bool = False,
        newest_first: bool = False,
    ) -> list[ChatMessage]:
        query = self._conversation_message_query(
            db,
            conversation_type=conversation_type,
            conversation_id=conversation_id,
            current_user_id=current_user_id,
        )
        ordered = db.execute(
            query.order_by(ChatMessage.created_at.desc() if newest_first else ChatMessage.created_at.asc())
        ).scalars().all()
        visible = [
            item
            for item in ordered
            if self._message_visible_for_user_in_conversation(
                db,
                item,
                current_user_id=current_user_id,
                conversation_type=conversation_type,
                conversation_id=conversation_id,
            )
            and (not media_only or bool(item.file_url))
        ]
        return visible[: max(1, min(limit, 500))]

    def _latest_visible_conversation_message(
        self,
        db: Session,
        *,
        conversation_type: str,
        conversation_id: str,
        current_user_id: str,
    ) -> ChatMessage | None:
        items = self._visible_messages_for_conversation(
            db,
            conversation_type=conversation_type,
            conversation_id=conversation_id,
            current_user_id=current_user_id,
            limit=1,
            newest_first=True,
        )
        return items[0] if items else None

    def _direct_unread_count(self, db: Session, *, friend_user_id: str, current_user_id: str) -> int:
        messages = db.execute(
            select(ChatMessage).where(
                ChatMessage.sender_user_id == friend_user_id,
                ChatMessage.receiver_user_id == current_user_id,
                ChatMessage.group_id.is_(None),
                ChatMessage.read_at.is_(None),
                ChatMessage.deleted_for_everyone.is_(False),
            )
        ).scalars().all()
        return len(
            [
                item
                for item in messages
                if self._message_visible_for_user_in_conversation(
                    db,
                    item,
                    current_user_id=current_user_id,
                    conversation_type="direct",
                    conversation_id=friend_user_id,
                )
            ]
        )

    def _conversation_unread_count(
        self,
        db: Session,
        *,
        current_user_id: str,
        conversation_type: str,
        conversation_id: str,
    ) -> int:
        if conversation_type == "direct":
            return self._direct_unread_count(db, friend_user_id=conversation_id, current_user_id=current_user_id)
        if conversation_type == "group":
            return self._group_unread_count(db, group_id=conversation_id, current_user_id=current_user_id)
        if conversation_type == "community":
            community, announcement_group, membership = self._require_community_membership(
                db,
                community_id=conversation_id,
                user_id=current_user_id,
            )
            messages = db.execute(
                select(ChatMessage).where(
                    ChatMessage.group_id == announcement_group.id,
                    ChatMessage.sender_user_id != current_user_id,
                    ChatMessage.deleted_for_everyone.is_(False),
                )
            ).scalars().all()
            cleared_at = self._conversation_clear_cutoff(
                db,
                current_user_id=current_user_id,
                conversation_type="community",
                conversation_id=community.id,
            )
            cutoff = max([value for value in [membership.last_read_at, cleared_at] if value is not None], default=None)
            return len(
                [
                    item
                    for item in messages
                    if (not cutoff or item.created_at > cutoff)
                    and self._message_visible_for_user_in_conversation(
                        db,
                        item,
                        current_user_id=current_user_id,
                        conversation_type="community",
                        conversation_id=community.id,
                    )
                ]
            )
        return 0

    def _group_unread_count(self, db: Session, *, group_id: str, current_user_id: str) -> int:
        membership = self._group_member_record(db, group_id=group_id, user_id=current_user_id)
        if not membership:
            return 0
        messages = db.execute(
            select(ChatMessage).where(
                ChatMessage.group_id == group_id,
                ChatMessage.sender_user_id != current_user_id,
                ChatMessage.deleted_for_everyone.is_(False),
            )
        ).scalars().all()
        cleared_at = self._conversation_clear_cutoff(
            db,
            current_user_id=current_user_id,
            conversation_type="group",
            conversation_id=group_id,
        )
        cutoff = max([value for value in [membership.last_read_at, cleared_at] if value is not None], default=None)
        return len(
            [
                item
                for item in messages
                if (not cutoff or item.created_at > cutoff)
                and self._message_visible_for_user_in_conversation(
                    db,
                    item,
                    current_user_id=current_user_id,
                    conversation_type="group",
                    conversation_id=group_id,
                )
            ]
        )

    def _message_is_starred(self, db: Session, *, message_id: str, current_user_id: str) -> bool:
        return bool(
            db.execute(
                select(ChatMessageStar).where(
                    ChatMessageStar.message_id == message_id,
                    ChatMessageStar.user_id == current_user_id,
                )
            ).scalar_one_or_none()
        )

    def _message_is_pinned(self, db: Session, *, message_id: str, current_user_id: str) -> bool:
        return bool(
            db.execute(
                select(ChatMessagePin).where(
                    ChatMessagePin.message_id == message_id,
                    ChatMessagePin.user_id == current_user_id,
                )
            ).scalar_one_or_none()
        )

    def _serialize_message_reactions(self, db: Session, *, message_id: str, current_user_id: str) -> list[dict]:
        reactions = db.execute(select(ChatMessageReaction).where(ChatMessageReaction.message_id == message_id)).scalars().all()
        grouped: dict[str, dict] = {}
        for item in reactions:
            grouped.setdefault(item.emoji, {"emoji": item.emoji, "count": 0, "reactedByCurrentUser": False})
            grouped[item.emoji]["count"] += 1
            if item.user_id == current_user_id:
                grouped[item.emoji]["reactedByCurrentUser"] = True
        return sorted(grouped.values(), key=lambda item: (-item["count"], item["emoji"]))

    def _starred_or_pinned_messages(
        self,
        db: Session,
        *,
        current_user_id: str,
        conversation: dict,
        starred: bool,
        pinned: bool,
    ) -> list[ChatMessage]:
        table = ChatMessageStar if starred else ChatMessagePin
        rows = db.execute(
            select(ChatMessage)
            .join(table, table.message_id == ChatMessage.id)
            .where(table.user_id == current_user_id)
            .order_by(ChatMessage.created_at.desc())
        ).scalars().all()
        return [
            item
            for item in rows
            if item.conversation_type == conversation["conversationType"]
            and self._serialize_message_conversation_id(db, item, current_user_id=current_user_id) == conversation["apiConversationId"]
            and self._message_visible_for_user_in_conversation(
                db,
                item,
                current_user_id=current_user_id,
                conversation_type=conversation["apiConversationType"],
                conversation_id=conversation["apiConversationId"],
            )
        ][:12]

    def _require_message_access(self, db: Session, *, current_user_id: str, message_id: str) -> ChatMessage:
        message = db.execute(select(ChatMessage).where(ChatMessage.id == message_id)).scalar_one_or_none()
        if not message:
            raise ChatManagementServiceError("Message was not found.")
        if message.group_id:
            if message.conversation_type == "community":
                community = db.execute(select(ChatCommunity).where(ChatCommunity.announcement_group_id == message.group_id)).scalar_one_or_none()
                if community:
                    self._require_community_membership(db, community_id=community.id, user_id=current_user_id)
                else:
                    self._require_group_membership(db, group_id=message.group_id, user_id=current_user_id)
            else:
                self._require_group_membership(db, group_id=message.group_id, user_id=current_user_id)
        elif current_user_id not in {message.sender_user_id, message.receiver_user_id}:
            raise ChatManagementServiceError("Message was not found.")
        if self._message_is_expired(message):
            raise ChatManagementServiceError("Message was not found.")
        return message

    def _conversation_expiration_at(
        self,
        db: Session,
        *,
        user_id: str,
        conversation_type: str,
        conversation_id: str,
    ) -> datetime | None:
        preference = self._conversation_preference_for_user(
            db,
            user_id=user_id,
            conversation_type=conversation_type,
            conversation_id=conversation_id,
        )
        mode = (preference.disappearing_mode if preference else "off").strip().lower()
        if mode == "24h":
            return datetime.now(timezone.utc).replace(microsecond=0) + timedelta(days=1)
        if mode == "7d":
            return datetime.now(timezone.utc).replace(microsecond=0) + timedelta(days=7)
        if mode == "90d":
            return datetime.now(timezone.utc).replace(microsecond=0) + timedelta(days=90)
        return None

    def _detect_upload_message_type(self, content_type: str) -> str:
        if (content_type or "").startswith("image/"):
            return "image"
        if (content_type or "").startswith("video/"):
            return "video"
        if (content_type or "").startswith("audio/"):
            return "voice"
        return "file"

    def _assert_direct_message_allowed(self, db: Session, *, current_user_id: str, other_user_id: str) -> None:
        if any(
            bool(item and item.is_blocked)
            for item in [
                self._conversation_preference_for_user(
                    db,
                    user_id=current_user_id,
                    conversation_type="direct",
                    conversation_id=other_user_id,
                ),
                self._conversation_preference_for_user(
                    db,
                    user_id=other_user_id,
                    conversation_type="direct",
                    conversation_id=current_user_id,
                ),
            ]
        ):
            raise ChatManagementServiceError("This direct conversation is blocked.")

    def _message_preview(self, message: ChatMessage | None) -> str | None:
        if not message:
            return None
        if message.deleted_for_everyone:
            return "This message was removed."
        if message.body:
            return message.body[:120]
        if message.message_type == "image":
            return "Image"
        if message.message_type == "video":
            return "Video"
        if message.message_type == "voice":
            return "Voice message"
        if message.file_name:
            return message.file_name
        return "Attachment"

    def _message_hidden_for_user(self, message: ChatMessage, current_user_id: str) -> bool:
        if message.deleted_for_everyone:
            return False
        hidden_ids = self._deserialize_user_id_list(message.hidden_for_user_ids)
        if current_user_id in hidden_ids:
            return True
        return bool(message.group_id is None and ((message.sender_user_id == current_user_id and message.deleted_by_sender) or (message.receiver_user_id == current_user_id and message.deleted_by_receiver)))

    def _conversation_message_query(self, db: Session, *, conversation_type: str, conversation_id: str, current_user_id: str | None = None):
        if conversation_type == "direct":
            return select(ChatMessage).where(
                ChatMessage.group_id.is_(None),
                or_(
                    and_(ChatMessage.sender_user_id == current_user_id, ChatMessage.receiver_user_id == conversation_id),
                    and_(ChatMessage.sender_user_id == conversation_id, ChatMessage.receiver_user_id == current_user_id),
                ),
            )
        if conversation_type == "group":
            return select(ChatMessage).where(ChatMessage.group_id == conversation_id)
        if conversation_type == "community":
            community = self._require_community(db, community_id=conversation_id)
            return select(ChatMessage).where(ChatMessage.group_id == community.announcement_group_id)
        raise ChatManagementServiceError("Conversation type is not supported.")

    def _participant_ids_for_message(self, db: Session, message: ChatMessage) -> list[str]:
        return self._group_member_ids(db, group_id=message.group_id) if message.group_id else [message.sender_user_id, message.receiver_user_id]

    def _conversation_background_url(self, db: Session, *, conversation_type: str, conversation_key: str) -> str | None:
        record = db.execute(
            select(ChatConversationBackground.background_url).where(
                ChatConversationBackground.conversation_type == conversation_type,
                ChatConversationBackground.conversation_key == conversation_key,
            )
        ).scalar_one_or_none()
        return record

    def _conversation_storage_key(self, conversation: dict) -> str:
        if conversation["apiConversationType"] == "direct":
            return self._direct_conversation_key(conversation["participantIds"][0], conversation["participantIds"][1])
        return conversation["apiConversationId"]

    def _direct_conversation_key(self, first_user_id: str, second_user_id: str) -> str:
        return "__".join(sorted([first_user_id, second_user_id]))

    def _conversation_participant_ids(self, db: Session, *, current_user_id: str, conversation_type: str, conversation_id: str) -> list[str]:
        normalized_type = (conversation_type or "").strip().lower()
        normalized_id = (conversation_id or "").strip()
        if normalized_type == "direct":
            return [current_user_id, normalized_id]
        if normalized_type == "group":
            return self._group_member_ids(db, group_id=normalized_id)
        if normalized_type == "community":
            community = self._require_community(db, community_id=normalized_id)
            return self._group_member_ids(db, group_id=community.announcement_group_id)
        raise ChatManagementServiceError("Conversation was not found.")

    def _assert_background_access(self, db: Session, *, current_user_id: str, conversation_type: str, conversation_key: str) -> None:
        if conversation_type == "direct":
            first_user_id, second_user_id = (conversation_key.split("__", 1) + [""])[:2]
            if current_user_id not in {first_user_id, second_user_id}:
                raise ChatManagementServiceError("Asset was not found.")
            other_user_id = second_user_id if current_user_id == first_user_id else first_user_id
            self._ensure_friends(db, current_user_id=current_user_id, other_user_id=other_user_id)
            return
        if conversation_type == "group":
            self._require_group_membership(db, group_id=conversation_key, user_id=current_user_id)
            return
        if conversation_type == "community":
            self._require_community_membership(db, community_id=conversation_key, user_id=current_user_id)
            return
        raise ChatManagementServiceError("Asset was not found.")

    def _serialize_message_conversation_id(self, db: Session, message: ChatMessage, *, current_user_id: str) -> str:
        if message.conversation_type == "direct":
            return message.receiver_user_id if message.sender_user_id == current_user_id else message.sender_user_id
        if message.conversation_type == "group":
            return message.group_id or ""
        if message.conversation_type == "community":
            community = db.execute(select(ChatCommunity).where(ChatCommunity.announcement_group_id == message.group_id)).scalar_one_or_none()
            return community.id if community else (message.group_id or "")
        return message.group_id or ""

    async def _broadcast_presence_change(self, user_id: str, status: str) -> None:
        with SessionLocal() as db:
            friend_ids = db.execute(select(ChatFriendship.friend_user_id).where(ChatFriendship.user_id == user_id)).scalars().all()
        payload = {"type": "presence", "userId": user_id, "status": status, "lastSeenAt": self._serialize_datetime(self.manager.get_last_seen_at(user_id))}
        for friend_id in friend_ids:
            await self.manager.send_event(friend_id, payload)

    def _save_attachment_file(self, *, owner_id: str, message_id: str, file_name: str, content: bytes) -> Path:
        folder = CHAT_UPLOADS_DIR / owner_id
        folder.mkdir(parents=True, exist_ok=True)
        file_path = folder / f"{message_id}-{file_name}"
        file_path.write_bytes(content)
        return file_path

    def _save_conversation_background_file(self, *, conversation_type: str, conversation_key: str, background_id: str, file_name: str, content: bytes) -> Path:
        folder = CHAT_UPLOADS_DIR / "conversation-backgrounds" / conversation_type / conversation_key
        folder.mkdir(parents=True, exist_ok=True)
        for existing in folder.glob("*"):
            if existing.is_file():
                existing.unlink(missing_ok=True)
        file_path = folder / file_name
        file_path.write_bytes(content)
        return file_path

    def _store_entity_image(self, entity: ChatGroup | ChatCommunity, entity_type: str, upload: UploadFile) -> None:
        content_type = (upload.content_type or "").lower().strip()
        if content_type not in self.image_content_types:
            raise ChatManagementServiceError("Group and community images must be image files.")
        content = upload.file.read()
        if not content:
            raise ChatManagementServiceError("Uploaded image is empty.")
        if len(content) > CHAT_UPLOAD_MAX_BYTES:
            raise ChatManagementServiceError("Image exceeds the maximum upload size.")
        safe_name = self._sanitize_filename(upload.filename or "image.png")
        folder = CHAT_UPLOADS_DIR / "entities" / entity_type / entity.id
        folder.mkdir(parents=True, exist_ok=True)
        (folder / safe_name).write_bytes(content)
        entity.image_url = f"/chat/assets/{entity_type}/{entity.id}/{safe_name}"

    @staticmethod
    def _avatar_label(value: str) -> str:
        cleaned = (value or "").strip()
        return "".join(part[0] for part in cleaned.split()[:2]).upper() or (cleaned[:1].upper() if cleaned else "C")

    @staticmethod
    def _display_name(user: User) -> str:
        return (user.full_name or user.username or user.email or "User").strip()

    @staticmethod
    def _sanitize_filename(file_name: str) -> str:
        return re.sub(r"[^A-Za-z0-9._-]", "_", (Path(file_name).name.strip() or "attachment"))[:180]

    @staticmethod
    def _deserialize_user_id_list(raw_value: str | None) -> list[str]:
        if not raw_value:
            return []
        try:
            parsed = json.loads(raw_value)
            if isinstance(parsed, list):
                return [str(item) for item in parsed if str(item).strip()]
        except Exception:
            pass
        return [item for item in raw_value.split(",") if item]

    @staticmethod
    def _serialize_user_id_list(values: list[str]) -> str:
        return json.dumps(sorted(set(values)))

    @staticmethod
    def _conversation_key(conversation_type: str, conversation_id: str) -> str:
        return f"{conversation_type}:{conversation_id}"

    @staticmethod
    def _serialize_datetime(value: datetime | None) -> str | None:
        if not value:
            return None
        return (value.replace(tzinfo=timezone.utc) if value.tzinfo is None else value.astimezone(timezone.utc)).isoformat().replace("+00:00", "Z")
