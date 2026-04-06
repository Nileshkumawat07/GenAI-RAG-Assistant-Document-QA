from pydantic import BaseModel, EmailStr


class LinkedProviderCreateRequest(BaseModel):
    providerKey: str
    providerEmail: EmailStr
    providerDisplayName: str
    providerIdentifier: str
    currentPassword: str


class LinkedProviderDeleteRequest(BaseModel):
    currentPassword: str


class LinkedProviderResponse(BaseModel):
    providerKey: str
    providerEmail: EmailStr
    providerDisplayName: str
    providerIdentifier: str
    verified: bool
    linkedAt: str
