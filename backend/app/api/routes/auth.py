from fastapi import APIRouter, HTTPException

from app.schemas.auth import SendEmailOtpRequest, VerifyEmailOtpRequest
from app.services.otp_service import OTPService, OTPServiceError


def build_auth_router(otp_service: OTPService) -> APIRouter:
    router = APIRouter(prefix="/auth", tags=["auth"])

    @router.post("/otp/email/send")
    def send_email_otp(payload: SendEmailOtpRequest):
        try:
            otp_service.send_email_otp(payload.email)
            return {"message": "Email OTP sent successfully."}
        except OTPServiceError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @router.post("/otp/email/verify")
    def verify_email_otp(payload: VerifyEmailOtpRequest):
        try:
            otp_service.verify_email_otp(payload.email, payload.otp)
            return {"message": "Email OTP verified successfully."}
        except OTPServiceError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    return router
