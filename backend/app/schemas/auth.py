from pydantic import BaseModel, EmailStr, field_validator


class SendEmailOtpRequest(BaseModel):
    email: EmailStr


class SendSmsOtpRequest(BaseModel):
    mobile: str

    @field_validator("mobile")
    @classmethod
    def validate_mobile(cls, value: str) -> str:
        digits = "".join(character for character in value if character.isdigit())
        if len(digits) != 10:
            raise ValueError("Enter a valid 10-digit mobile number.")
        return digits


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


class VerifySmsOtpRequest(BaseModel):
    mobile: str
    otp: str

    @field_validator("mobile")
    @classmethod
    def validate_mobile(cls, value: str) -> str:
        digits = "".join(character for character in value if character.isdigit())
        if len(digits) != 10:
            raise ValueError("Enter a valid 10-digit mobile number.")
        return digits

    @field_validator("otp")
    @classmethod
    def validate_otp(cls, value: str) -> str:
        otp = value.strip()
        if len(otp) != 6 or not otp.isdigit():
            raise ValueError("OTP must be a 6-digit code.")
        return otp
