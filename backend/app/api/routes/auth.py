from sqlalchemy.orm import Session

from fastapi import APIRouter, Depends, HTTPException
from fastapi.responses import HTMLResponse

from app.core.database import get_db
from app.schemas.auth import (
    AuthUserResponse,
    CheckEmailVerificationRequest,
    LoginRequest,
    SendEmailVerificationRequest,
    SignupRequest,
)
from app.services.auth_service import AuthService, AuthServiceError
from app.services.otp_service import OTPService, OTPServiceError


def build_auth_router(otp_service: OTPService, auth_service: AuthService) -> APIRouter:
    router = APIRouter(prefix="/auth", tags=["auth"])

    @router.post("/signup", response_model=AuthUserResponse)
    def signup(payload: SignupRequest, db: Session = Depends(get_db)):
        try:
            user = auth_service.register_user(
                db,
                full_name=payload.fullName,
                username=payload.username,
                date_of_birth=payload.dateOfBirth,
                gender=payload.gender,
                email=payload.email,
                alternate_email=payload.alternateEmail,
                mobile=payload.mobile,
                security_question=payload.securityQuestion,
                security_answer=payload.securityAnswer,
                referral_code=payload.referralCode,
                password=payload.password,
                email_verified=payload.emailVerified,
                mobile_verified=payload.mobileVerified,
            )
            return AuthUserResponse(
                id=user.id,
                fullName=user.full_name,
                username=user.username,
                email=user.email,
                mobile=user.mobile,
                emailVerified=user.email_verified,
                mobileVerified=user.mobile_verified,
                createdAt=user.created_at,
            )
        except AuthServiceError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @router.post("/login", response_model=AuthUserResponse)
    def login(payload: LoginRequest, db: Session = Depends(get_db)):
        try:
            user = auth_service.authenticate_user(
                db,
                identifier=payload.identifier,
                password=payload.password,
            )
            return AuthUserResponse(
                id=user.id,
                fullName=user.full_name,
                username=user.username,
                email=user.email,
                mobile=user.mobile,
                emailVerified=user.email_verified,
                mobileVerified=user.mobile_verified,
                createdAt=user.created_at,
            )
        except AuthServiceError as exc:
            raise HTTPException(status_code=401, detail=str(exc)) from exc

    @router.post("/email/send-verification")
    def send_email_verification(payload: SendEmailVerificationRequest):
        try:
            otp_service.send_email_verification(payload.email)
            return {"message": "Verification email sent successfully."}
        except OTPServiceError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @router.post("/email/check-verification")
    def check_email_verification(payload: CheckEmailVerificationRequest):
        try:
            otp_service.verify_email_status(payload.email)
            return {"message": "Email verified successfully.", "verified": True}
        except OTPServiceError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @router.get("/email/confirm", response_class=HTMLResponse)
    def confirm_email_verification(token: str):
        try:
            destination = otp_service.confirm_email_verification(token)
            return HTMLResponse(
                content=(
                    "<html><body style=\"font-family:Arial,sans-serif;padding:32px;\">"
                    "<h2>Email verified successfully</h2>"
                    f"<p>{destination} is now verified for Unified AI Workspace.</p>"
                    "<p>You can return to the signup page and click Verify.</p>"
                    "</body></html>"
                )
            )
        except OTPServiceError as exc:
            return HTMLResponse(
                status_code=400,
                content=(
                    "<html><body style=\"font-family:Arial,sans-serif;padding:32px;\">"
                    "<h2>Email verification failed</h2>"
                    f"<p>{exc}</p>"
                    "</body></html>"
                ),
            )

    return router
