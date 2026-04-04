from pydantic import BaseModel, EmailStr


class SendEmailVerificationRequest(BaseModel):
    email: EmailStr


class CheckEmailVerificationRequest(BaseModel):
    email: EmailStr
