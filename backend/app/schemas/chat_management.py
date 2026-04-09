from pydantic import BaseModel, Field


class ChatUserSummaryResponse(BaseModel):
    id: str
    username: str
    fullName: str
    avatarLabel: str
    presenceStatus: str = "offline"
    lastSeenAt: str | None = None
    relationshipState: str = "none"
    statusText: str | None = None


class FriendRequestResponse(BaseModel):
    id: str
    sender: ChatUserSummaryResponse
    receiver: ChatUserSummaryResponse
    status: str
    createdAt: str | None = None
    respondedAt: str | None = None


class ChatFriendItemResponse(ChatUserSummaryResponse):
    unreadCount: int = 0
    lastMessagePreview: str | None = None
    lastMessageAt: str | None = None
    lastMessageStatus: str | None = None


class ReplyPreviewResponse(BaseModel):
    id: str
    senderName: str
    body: str | None = None
    messageType: str = "text"


class ChatMessageResponse(BaseModel):
    id: str
    senderId: str
    receiverId: str
    body: str | None = None
    messageType: str = "text"
    fileUrl: str | None = None
    fileName: str | None = None
    fileSize: int | None = None
    mimeType: str | None = None
    status: str = "sent"
    createdAt: str | None = None
    deliveredAt: str | None = None
    readAt: str | None = None
    deletedForEveryone: bool = False
    replyToMessageId: str | None = None
    replyPreview: ReplyPreviewResponse | None = None


class ChatOverviewResponse(BaseModel):
    friends: list[ChatFriendItemResponse] = Field(default_factory=list)
    sentRequests: list[FriendRequestResponse] = Field(default_factory=list)
    receivedRequests: list[FriendRequestResponse] = Field(default_factory=list)
    unreadMessageCount: int = 0
    unreadRequestCount: int = 0


class SendFriendRequestRequest(BaseModel):
    receiverId: str


class SendMessageRequest(BaseModel):
    receiverId: str
    body: str | None = None
    replyToMessageId: str | None = None


class DeleteMessageRequest(BaseModel):
    scope: str = "me"
