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
    publicUserCode: str | None = None
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


class DownloadAccountDataRequest(BaseModel):
    password: str


class DeleteAccountRequest(BaseModel):
    password: str
    confirmationText: str


class UpdateManagementAccessRequest(BaseModel):
    userId: str
    isManagement: bool
    suspended: bool = False


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
    publicUserCode: str | None = None
    isManagement: bool = False
    managementAccessSuspended: bool = False
    managementGrantedAt: str | None = None
    managementGrantedByUserId: str | None = None
    managementSuspendedAt: str | None = None
    managementSuspendedByUserId: str | None = None
    emailVerified: bool
    mobileVerified: bool
    subscriptionPlanId: str | None = None
    subscriptionPlanName: str | None = None
    subscriptionStatus: str
    subscriptionAmount: int | None = None
    subscriptionCurrency: str | None = None
    subscriptionBillingCycle: str | None = None
    subscriptionActivatedAt: str | None = None
    subscriptionExpiresAt: str | None = None
    createdAt: str
    isAdmin: bool
    mode: str
    authToken: str
