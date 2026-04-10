from pydantic import BaseModel, Field


class DashboardMetricResponse(BaseModel):
    label: str
    value: str
    hint: str | None = None


class DashboardActivityResponse(BaseModel):
    id: str
    title: str
    detail: str
    category: str | None = None
    createdAt: str | None = None
    tone: str = "info"


class DashboardInsightResponse(BaseModel):
    label: str
    value: str
    detail: str | None = None


class DashboardCollectionItemResponse(BaseModel):
    id: str
    title: str
    detail: str
    meta: str | None = None
    createdAt: str | None = None


class DashboardResponse(BaseModel):
    metrics: list[DashboardMetricResponse] = Field(default_factory=list)
    recentActivity: list[DashboardActivityResponse] = Field(default_factory=list)
    activityInsights: list[DashboardInsightResponse] = Field(default_factory=list)
    recentChats: list[DashboardCollectionItemResponse] = Field(default_factory=list)
    activeTeamsList: list[DashboardCollectionItemResponse] = Field(default_factory=list)
    supportRequestsList: list[DashboardCollectionItemResponse] = Field(default_factory=list)
    paymentHistory: list[DashboardCollectionItemResponse] = Field(default_factory=list)
    unreadNotifications: int = 0
    activeTeams: int = 0
    activeChats: int = 0


class WorkspaceNotificationResponse(BaseModel):
    id: str
    category: str
    title: str
    message: str
    actionUrl: str | None = None
    actionType: str | None = None
    actionEntityId: str | None = None
    actionEntityKind: str | None = None
    actionContext: dict = Field(default_factory=dict)
    isRead: bool = False
    createdAt: str | None = None
    readAt: str | None = None


class AnalyticsPointResponse(BaseModel):
    label: str
    value: int


class AnalyticsBreakdownResponse(BaseModel):
    label: str
    value: int
    hint: str | None = None


class AnalyticsTimelineResponse(BaseModel):
    label: str
    chats: int = 0
    messages: int = 0
    notifications: int = 0
    teams: int = 0
    supportRequests: int = 0
    payments: int = 0


class AnalyticsResponse(BaseModel):
    headline: dict = Field(default_factory=dict)
    chatActivity: list[AnalyticsPointResponse] = Field(default_factory=list)
    notificationActivity: list[AnalyticsPointResponse] = Field(default_factory=list)
    teamDistribution: list[AnalyticsPointResponse] = Field(default_factory=list)
    activityMix: list[AnalyticsBreakdownResponse] = Field(default_factory=list)
    teamRoleDistribution: list[AnalyticsBreakdownResponse] = Field(default_factory=list)
    notificationCategoryBreakdown: list[AnalyticsBreakdownResponse] = Field(default_factory=list)
    supportStatusBreakdown: list[AnalyticsBreakdownResponse] = Field(default_factory=list)
    paymentStatusBreakdown: list[AnalyticsBreakdownResponse] = Field(default_factory=list)
    weeklyTimeline: list[AnalyticsTimelineResponse] = Field(default_factory=list)


class ChatThreadResponse(BaseModel):
    id: str
    title: str
    lastMessagePreview: str | None = None
    lastMessageRole: str | None = None
    createdAt: str | None = None
    updatedAt: str | None = None
    lastMessageAt: str | None = None
    messageCount: int = 0
    userMessageCount: int = 0
    assistantMessageCount: int = 0
    systemMessageCount: int = 0


class ChatMessageResponse(BaseModel):
    id: str
    role: str
    content: str
    createdAt: str | None = None


class CreateChatThreadRequest(BaseModel):
    title: str
    openingMessage: str | None = None


class CreateChatMessageRequest(BaseModel):
    role: str = "user"
    content: str


class TeamMemberResponse(BaseModel):
    id: str
    userId: str
    role: str
    status: str
    invitedByUserId: str | None = None
    joinedAt: str | None = None
    createdAt: str | None = None
    userName: str | None = None
    userEmail: str | None = None


class WorkspaceUserSummaryResponse(BaseModel):
    id: str
    fullName: str
    email: str
    publicUserCode: str | None = None


class TeamWorkspaceResponse(BaseModel):
    id: str
    name: str
    description: str | None = None
    isPersonal: bool = False
    createdAt: str | None = None
    updatedAt: str | None = None
    ownerUserId: str
    ownerName: str | None = None
    ownerEmail: str | None = None
    memberCount: int = 0
    activeMemberCount: int = 0
    adminCount: int = 0
    pausedMemberCount: int = 0
    members: list[TeamMemberResponse] = Field(default_factory=list)


class CreateTeamWorkspaceRequest(BaseModel):
    name: str
    description: str | None = None


class AddTeamMemberRequest(BaseModel):
    userId: str
    role: str = "member"


class UpdateTeamMemberRequest(BaseModel):
    role: str | None = None
    status: str | None = None
