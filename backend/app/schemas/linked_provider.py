from pydantic import BaseModel, EmailStr


class LinkedProviderAuthorizeRequest(BaseModel):
    frontendOrigin: str


class LinkedProviderCreateRequest(BaseModel):
    providerKey: str
    providerEmail: EmailStr
    providerDisplayName: str
    providerIdentifier: str
    callbackProviderId: str
    callbackEmail: EmailStr
    callbackDisplayName: str
    callbackUserId: str
    currentPassword: str


class LinkedProviderDeleteRequest(BaseModel):
    currentPassword: str


class LinkedProviderResponse(BaseModel):
    providerKey: str
    providerEmail: EmailStr
    providerDisplayName: str
    providerIdentifier: str
    callbackProviderId: str | None = None
    callbackEmail: EmailStr | None = None
    callbackDisplayName: str | None = None
    callbackUserId: str | None = None
    callbackReceivedAt: str | None = None
    verified: bool
    linkedAt: str
