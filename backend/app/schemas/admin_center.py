from pydantic import BaseModel


class AdminUserUpdateRequest(BaseModel):
    fullName: str | None = None
    username: str | None = None
    email: str | None = None
    mobile: str | None = None
    emailVerified: bool | None = None
    mobileVerified: bool | None = None
    admin2faRequired: bool | None = None


class AdminUserActionRequest(BaseModel):
    reason: str | None = None
    currentPassword: str | None = None
    targetUserId: str | None = None


class AdminUserMergeRequest(BaseModel):
    sourceUserId: str
    targetUserId: str


class AdminRoleAssignmentRequest(BaseModel):
    userId: str
    roleName: str


class AdminQueryRequest(BaseModel):
    sql: str


class AdminContentUpdateRequest(BaseModel):
    pageKey: str
    sectionKey: str
    title: str
    bodyJson: str
    isPublished: bool = True


class BillingAdminUpdateRequest(BaseModel):
    transactionId: str
    refundStatus: str | None = None
    disputeStatus: str | None = None
    billingAdminNote: str | None = None
    retryCount: int | None = None


class CommunicationTemplateCreateRequest(BaseModel):
    channel: str
    category: str | None = None
    title: str
    body: str
    requiresApproval: bool = False
