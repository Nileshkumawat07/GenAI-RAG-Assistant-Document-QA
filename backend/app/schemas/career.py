from pydantic import BaseModel, Field


class CareerOpeningCreateRequest(BaseModel):
    title: str
    department: str
    location: str
    workMode: str
    employmentType: str
    experienceLevel: str
    salaryRange: str | None = None
    summary: str
    responsibilities: list[str] = Field(default_factory=list)
    requirements: list[str] = Field(default_factory=list)
    perks: list[str] = Field(default_factory=list)
    skills: list[str] = Field(default_factory=list)
    seatsOpen: int = 1
    applicationDeadline: str | None = None
    isPublished: bool = True
    isFeatured: bool = False


class CareerOpeningUpdateRequest(CareerOpeningCreateRequest):
    pass


class CareerOpeningResponse(BaseModel):
    id: str
    openingCode: str
    title: str
    department: str
    location: str
    workMode: str
    employmentType: str
    experienceLevel: str
    salaryRange: str | None = None
    summary: str
    responsibilities: list[str]
    requirements: list[str]
    perks: list[str]
    skills: list[str]
    seatsOpen: int
    applicationDeadline: str | None = None
    isPublished: bool
    isFeatured: bool
    createdAt: str
    updatedAt: str
    totalApplications: int = 0


class CareerApplicationResponse(BaseModel):
    id: str
    applicationCode: str
    openingId: str
    openingTitle: str
    openingDepartment: str
    openingLocation: str
    fullName: str
    email: str
    mobile: str
    city: str | None = None
    currentCompany: str | None = None
    currentRole: str | None = None
    totalExperience: str | None = None
    noticePeriod: str | None = None
    currentCtc: str | None = None
    expectedCtc: str | None = None
    portfolioUrl: str | None = None
    linkedinUrl: str | None = None
    coverLetter: str | None = None
    resumeFilename: str | None = None
    hasResume: bool
    status: str
    adminMessage: str | None = None
    assignedManagerUserId: str | None = None
    assignedManagerName: str | None = None
    assignedManagerEmail: str | None = None
    assignedAt: str | None = None
    firstResponseAt: str | None = None
    decisionAt: str | None = None
    lastStatusUpdatedAt: str | None = None
    createdAt: str


class CareerApplicationUpdateRequest(BaseModel):
    status: str
    adminMessage: str | None = None
    assignedManagerUserId: str | None = None


class CareerApplicationsSummaryResponse(BaseModel):
    totalOpenings: int
    liveOpenings: int
    totalApplications: int
    submitted: int
    inReview: int
    shortlisted: int
    interviewScheduled: int
    offered: int
    hired: int
    rejected: int


class CareerManagementOverviewResponse(BaseModel):
    summary: CareerApplicationsSummaryResponse
    openings: list[CareerOpeningResponse]
    applications: list[CareerApplicationResponse]
    managementUsers: list[dict]
