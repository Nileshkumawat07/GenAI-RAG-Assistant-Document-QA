from pydantic import BaseModel

from app.schemas.contact import ContactRequestResponse


class ManagementSummaryResponse(BaseModel):
    totalManagementUsers: int
    openRequests: int
    inReviewRequests: int
    completedToday: int


class ManagementUserResponse(BaseModel):
    id: str
    publicUserCode: str | None = None
    fullName: str
    username: str
    email: str
    mobile: str
    isManagement: bool
    accessSuspended: bool
    managementGrantedAt: str | None = None
    managementGrantedByUserId: str | None = None
    managementGrantedByName: str | None = None
    managementSuspendedAt: str | None = None
    managementSuspendedByUserId: str | None = None
    managementSuspendedByName: str | None = None
    requestCount: int = 0
    handledRequestCount: int = 0
    pendingAssignedCount: int = 0
    averageResponseMinutes: float | None = None
    lastActionAt: str | None = None


class ManagementNoteResponse(BaseModel):
    id: str
    authorUserId: str
    authorName: str | None = None
    requestId: str | None = None
    targetUserId: str | None = None
    noteText: str
    createdAt: str


class ManagementReplyTemplateResponse(BaseModel):
    id: str
    title: str
    category: str | None = None
    body: str
    isActive: bool
    createdByUserId: str | None = None
    createdAt: str
    updatedAt: str


class ManagementActionResponse(BaseModel):
    id: str
    actorUserId: str | None = None
    actorName: str | None = None
    actorEmail: str | None = None
    actionType: str
    targetType: str
    targetId: str | None = None
    targetLabel: str | None = None
    detail: str | None = None
    createdAt: str | None = None


class ManagementActivityItemResponse(BaseModel):
    managerUserId: str
    managerName: str
    handledRequests: int
    pendingQueue: int
    averageResponseMinutes: float | None = None
    completedToday: int


class ManagementOverviewResponse(BaseModel):
    summary: ManagementSummaryResponse
    managementUsers: list[ManagementUserResponse]
    requests: list[ContactRequestResponse]
    notes: list[ManagementNoteResponse]
    replyTemplates: list[ManagementReplyTemplateResponse]
    recentActions: list[ManagementActionResponse]
    activityDashboard: list[ManagementActivityItemResponse]


class ManagementNoteCreateRequest(BaseModel):
    requestId: str | None = None
    targetUserId: str | None = None
    noteText: str


class ManagementReplyTemplateCreateRequest(BaseModel):
    title: str
    category: str | None = None
    body: str


class ManagementBulkStatusRequest(BaseModel):
    requestIds: list[str]
    status: str

