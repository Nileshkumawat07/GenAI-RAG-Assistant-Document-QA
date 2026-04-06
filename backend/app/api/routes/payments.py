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
        authenticated_user_id: str = Depends(require_authenticated_user_id),
    ):
        try:
            del authenticated_user_id
            return payment_service.verify_payment(
                plan_id=payload.planId,
                razorpay_order_id=payload.razorpayOrderId,
                razorpay_payment_id=payload.razorpayPaymentId,
                razorpay_signature=payload.razorpaySignature,
            )
        except PaymentServiceError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    return router
