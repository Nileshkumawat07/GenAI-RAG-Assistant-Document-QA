from pydantic import BaseModel, EmailStr, field_validator


class SendEmailOtpRequest(BaseModel):
    email: EmailStr


class VerifyEmailOtpRequest(BaseModel):
    email: EmailStr
    otp: str

    @field_validator("otp")
    @classmethod
    def validate_otp(cls, value: str) -> str:
        otp = value.strip()
        if len(otp) != 6 or not otp.isdigit():
            raise ValueError("OTP must be a 6-digit code.")
        return otp
