from typing import Optional

from pydantic import BaseModel


class ContactRequestCreate(BaseModel):
    userId: str
    category: str
    title: str
    values: dict[str, str]


class ContactRequestUpdateStatus(BaseModel):
    userId: Optional[str] = None
    status: str
    adminMessage: Optional[str] = None


class ContactRequestResponse(BaseModel):
    id: str
    userId: str
    category: str
    title: str
    requestCode: str | None = None
    status: str
    adminMessage: str | None = None
    values: dict[str, str]
    createdAt: str
    userFullName: str | None = None
    userEmail: str | None = None
    userMobile: str | None = None
