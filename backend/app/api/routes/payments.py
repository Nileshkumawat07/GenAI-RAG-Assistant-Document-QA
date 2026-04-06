from sqlalchemy.orm import Session

from fastapi import APIRouter, Depends, Header, HTTPException

from app.core.database import get_db
from app.schemas.payment import (
    CreateRazorpayOrderRequest,
    RazorpayOrderResponse,
    VerifyRazorpayPaymentRequest,
)
from app.services.auth_service import AuthService, AuthServiceError
from app.services.payment_service import PaymentService, PaymentServiceError


def build_payment_router(payment_service: PaymentService, auth_service: AuthService) -> APIRouter:
    router = APIRouter(prefix="/payments", tags=["payments"])

    def serialize_user(user):
        return {
            "id": user.id,
            "fullName": user.full_name,
            "username": user.username,
            "dateOfBirth": user.date_of_birth,
            "gender": user.gender,
            "email": user.email,
            "alternateEmail": user.alternate_email,
            "mobile": user.mobile,
            "securityQuestion": user.security_question,
            "securityAnswer": user.security_answer,
            "referralCode": user.referral_code,
            "emailVerified": user.email_verified,
            "mobileVerified": user.mobile_verified,
            "subscriptionPlanId": user.subscription_plan_id,
            "subscriptionPlanName": user.subscription_plan_name,
            "subscriptionStatus": user.subscription_status,
            "subscriptionAmount": user.subscription_amount,
            "subscriptionCurrency": user.subscription_currency,
            "subscriptionBillingCycle": user.subscription_billing_cycle,
            "subscriptionActivatedAt": user.subscription_activated_at.isoformat() if user.subscription_activated_at else None,
            "createdAt": user.created_at.isoformat(),
            "isAdmin": auth_service.is_admin_email(user.email),
            "mode": "admin" if auth_service.is_admin_email(user.email) else "member",
            "authToken": auth_service.create_access_token(user_id=user.id),
        }

    def require_authenticated_user_id(
        authorization: str | None = Header(default=None),
        db: Session = Depends(get_db),
    ) -> str:
        if not authorization or not authorization.startswith("Bearer "):
            raise HTTPException(status_code=401, detail="Missing authorization token.")

        token = authorization.split(" ", 1)[1].strip()
        if not token:
            raise HTTPException(status_code=401, detail="Missing authorization token.")

        try:
            user_id = auth_service.verify_access_token(token)
            auth_service.get_user_by_id(db, user_id=user_id)
            return user_id
        except AuthServiceError as exc:
            raise HTTPException(status_code=401, detail=str(exc)) from exc

    @router.post("/razorpay/order", response_model=RazorpayOrderResponse)
    def create_razorpay_order(
        payload: CreateRazorpayOrderRequest,
        authenticated_user_id: str = Depends(require_authenticated_user_id),
    ):
        try:
            return payment_service.create_razorpay_order(payload.planId, authenticated_user_id)
        except PaymentServiceError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @router.post("/razorpay/verify")
    def verify_razorpay_payment(
        payload: VerifyRazorpayPaymentRequest,
        db: Session = Depends(get_db),
        authenticated_user_id: str = Depends(require_authenticated_user_id),
    ):
        try:
            verification = payment_service.verify_payment(
                plan_id=payload.planId,
                razorpay_order_id=payload.razorpayOrderId,
                razorpay_payment_id=payload.razorpayPaymentId,
                razorpay_signature=payload.razorpaySignature,
            )
            updated_user = payment_service.activate_plan_for_user(
                db,
                user_id=authenticated_user_id,
                plan_id=payload.planId,
                razorpay_order_id=payload.razorpayOrderId,
                razorpay_payment_id=payload.razorpayPaymentId,
            )
            return {
                **verification,
                "user": serialize_user(updated_user),
            }
        except PaymentServiceError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    return router
