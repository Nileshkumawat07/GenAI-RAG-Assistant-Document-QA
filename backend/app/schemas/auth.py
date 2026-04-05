from datetime import date

from pydantic import BaseModel, EmailStr


class SendEmailVerificationRequest(BaseModel):
    email: EmailStr


class CheckEmailVerificationRequest(BaseModel):
    email: EmailStr


class SignupRequest(BaseModel):
    fullName: str
    username: str
    dateOfBirth: date
    gender: str
    email: EmailStr
    password: str
    alternateEmail: EmailStr | None = None
    mobile: str
    securityQuestion: str
    securityAnswer: str
    referralCode: str | None = None
    emailVerified: bool
    mobileVerified: bool


class LoginRequest(BaseModel):
    identifier: str
    password: str


class UpdateUsernameRequest(BaseModel):
    userId: str
    newUsername: str


class UpdateEmailRequest(BaseModel):
    userId: str
    newEmail: EmailStr


class UpdateMobileRequest(BaseModel):
    userId: str
    newMobile: str


class ChangePasswordRequest(BaseModel):
    userId: str
    currentPassword: str
    newPassword: str


class AuthUserResponse(BaseModel):
    id: str
    fullName: str
    username: str
    dateOfBirth: date
    gender: str
    email: EmailStr
    alternateEmail: EmailStr | None = None
    mobile: str
    securityQuestion: str
    securityAnswer: str
    referralCode: str | None = None
    emailVerified: bool
    mobileVerified: bool
    createdAt: str
