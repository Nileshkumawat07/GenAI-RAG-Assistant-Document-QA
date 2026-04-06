from pydantic import BaseModel, EmailStr


class LinkedProviderAuthorizeRequest(BaseModel):
    frontendOrigin: str | None = None


class LinkedProviderAuthorizeResponse(BaseModel):
    authorizeUrl: str


class LinkedProviderResponse(BaseModel):
    userId: str
    provider: str
    providerId: str
    email: EmailStr
