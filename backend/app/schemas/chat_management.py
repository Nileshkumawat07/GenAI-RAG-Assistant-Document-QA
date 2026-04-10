from pydantic import BaseModel, Field


class ChatUserSummaryResponse(BaseModel):
    id: str
    username: str
    fullName: str
    avatarLabel: str
    imageUrl: str | None = None
    bio: str | None = None
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


class ChatListItemResponse(BaseModel):
    id: str
    title: str
    subtitle: str | None = None
    avatarLabel: str
    imageUrl: str | None = None
    conversationType: str = "direct"
    entityType: str = "chat"
    unreadCount: int = 0
    lastMessagePreview: str | None = None
    lastMessageAt: str | None = None
    lastMessageStatus: str | None = None
    presenceStatus: str | None = None
    lastSeenAt: str | None = None
    statusText: str | None = None
    memberCount: int = 0
    role: str | None = None
    isMuted: bool = False
    isPinned: bool = False
    isArchived: bool = False
    announcementGroupId: str | None = None
    linkedGroupCount: int = 0
    communityId: str | None = None
    backgroundUrl: str | None = None


class GroupMemberResponse(BaseModel):
    id: str
    userId: str
    role: str
    isMuted: bool = False
    joinedAt: str | None = None
    lastReadAt: str | None = None
    user: ChatUserSummaryResponse


class GroupDetailResponse(BaseModel):
    id: str
    name: str
    description: str | None = None
    imageUrl: str | None = None
    conversationType: str = "group"
    groupType: str = "group"
    memberCount: int = 0
    isMuted: bool = False
    currentUserRole: str | None = None
    backgroundUrl: str | None = None
    members: list[GroupMemberResponse] = Field(default_factory=list)


class CommunityGroupResponse(BaseModel):
    id: str
    name: str
    description: str | None = None
    imageUrl: str | None = None
    memberCount: int = 0


class CommunityDetailResponse(BaseModel):
    id: str
    name: str
    description: str | None = None
    imageUrl: str | None = None
    announcementGroupId: str
    memberCount: int = 0
    currentUserRole: str | None = None
    isMuted: bool = False
    backgroundUrl: str | None = None
    groups: list[CommunityGroupResponse] = Field(default_factory=list)
    members: list[GroupMemberResponse] = Field(default_factory=list)


class ConversationBackgroundResponse(BaseModel):
    conversationType: str
    conversationId: str
    backgroundUrl: str | None = None


class ReplyPreviewResponse(BaseModel):
    id: str
    senderName: str
    body: str | None = None
    messageType: str = "text"


class ChatReactionResponse(BaseModel):
    emoji: str
    count: int = 0
    reactedByCurrentUser: bool = False


class ChatMessageResponse(BaseModel):
    id: str
    senderId: str
    senderName: str
    receiverId: str | None = None
    groupId: str | None = None
    conversationType: str = "direct"
    conversationId: str
    body: str | None = None
    messageType: str = "text"
    fileUrl: str | None = None
    fileName: str | None = None
    fileSize: int | None = None
    mimeType: str | None = None
    status: str = "sent"
    createdAt: str | None = None
    editedAt: str | None = None
    deliveredAt: str | None = None
    readAt: str | None = None
    expiresAt: str | None = None
    deletedForEveryone: bool = False
    replyToMessageId: str | None = None
    replyPreview: ReplyPreviewResponse | None = None
    reactions: list[ChatReactionResponse] = Field(default_factory=list)
    isStarred: bool = False
    isPinned: bool = False
    canEdit: bool = False
    canDeleteForEveryone: bool = False


class ChatMessagePageResponse(BaseModel):
    items: list[ChatMessageResponse] = Field(default_factory=list)
    hasMore: bool = False


class ChatOverviewResponse(BaseModel):
    friends: list[ChatUserSummaryResponse] = Field(default_factory=list)
    directChats: list[ChatListItemResponse] = Field(default_factory=list)
    groups: list[ChatListItemResponse] = Field(default_factory=list)
    communities: list[ChatListItemResponse] = Field(default_factory=list)
    sentRequests: list[FriendRequestResponse] = Field(default_factory=list)
    receivedRequests: list[FriendRequestResponse] = Field(default_factory=list)
    unreadMessageCount: int = 0
    unreadRequestCount: int = 0
    unreadNotificationCount: int = 0


class ChatConversationPreferenceResponse(BaseModel):
    isMuted: bool = False
    isPinned: bool = False
    isArchived: bool = False
    isBlocked: bool = False
    disappearingMode: str = "off"
    lastClearedAt: str | None = None


class ChatStorageSummaryResponse(BaseModel):
    totalBytes: int = 0
    totalFiles: int = 0
    imageCount: int = 0
    videoCount: int = 0
    voiceCount: int = 0
    fileCount: int = 0


class ChatConversationSidebarResponse(BaseModel):
    conversationType: str
    conversationId: str
    title: str
    subtitle: str | None = None
    avatarLabel: str
    imageUrl: str | None = None
    bio: str | None = None
    statusText: str | None = None
    presenceStatus: str | None = None
    lastSeenAt: str | None = None
    memberCount: int = 0
    currentUserRole: str | None = None
    backgroundUrl: str | None = None
    preferences: ChatConversationPreferenceResponse = Field(default_factory=ChatConversationPreferenceResponse)
    members: list[GroupMemberResponse] = Field(default_factory=list)
    groups: list[CommunityGroupResponse] = Field(default_factory=list)
    sharedMedia: list[ChatMessageResponse] = Field(default_factory=list)
    starredMessages: list[ChatMessageResponse] = Field(default_factory=list)
    pinnedMessages: list[ChatMessageResponse] = Field(default_factory=list)
    storage: ChatStorageSummaryResponse = Field(default_factory=ChatStorageSummaryResponse)


class SendFriendRequestRequest(BaseModel):
    receiverId: str


class SendMessageRequest(BaseModel):
    receiverId: str | None = None
    conversationType: str = "direct"
    conversationId: str | None = None
    body: str | None = None
    replyToMessageId: str | None = None


class EditMessageRequest(BaseModel):
    body: str


class DeleteMessageRequest(BaseModel):
    scope: str = "me"


class UpdateConversationPreferencesRequest(BaseModel):
    isMuted: bool | None = None
    isPinned: bool | None = None
    isArchived: bool | None = None
    isBlocked: bool | None = None
    disappearingMode: str | None = None


class MessageReactionRequest(BaseModel):
    emoji: str


class CreateGroupRequest(BaseModel):
    name: str
    description: str | None = None
    memberIds: list[str] = Field(default_factory=list)


class UpdateGroupRequest(BaseModel):
    name: str | None = None
    description: str | None = None
    isMuted: bool | None = None


class GroupMembersRequest(BaseModel):
    userIds: list[str] = Field(default_factory=list)


class UpdateGroupMemberRoleRequest(BaseModel):
    role: str


class CreateCommunityRequest(BaseModel):
    name: str
    description: str | None = None


class UpdateCommunityRequest(BaseModel):
    name: str | None = None
    description: str | None = None
    isMuted: bool | None = None


class CommunityGroupLinkRequest(BaseModel):
    groupId: str
