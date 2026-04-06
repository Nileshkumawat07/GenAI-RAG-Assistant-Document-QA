import hmac
from datetime import datetime, timezone
from hashlib import sha256

import razorpay
from sqlalchemy.orm import Session

from app.core.config import RAZORPAY_COMPANY_NAME, RAZORPAY_KEY_ID, RAZORPAY_KEY_SECRET
from app.models.user import User


class PaymentServiceError(Exception):
    pass


class PaymentService:
    PLAN_CATALOG = {
        "education-lite": {
            "plan_id": "education-lite",
            "plan_name": "Education Lite",
            "category": "education",
            "amount": 39900,
            "currency": "INR",
            "description": "Student-friendly document AI workspace for focused study and assignments.",
        },
        "individual-starter": {
            "plan_id": "individual-starter",
            "plan_name": "Individual Starter",
            "category": "individual",
            "amount": 69900,
            "currency": "INR",
            "description": "Solo plan for personal research, uploads, and quick workspace access.",
        },
        "developer-pro": {
            "plan_id": "developer-pro",
            "plan_name": "Developer Pro",
            "category": "developer",
            "amount": 99900,
            "currency": "INR",
            "description": "Developer-ready plan with faster workflows, testing support, and integrations.",
        },
        "business-growth": {
            "plan_id": "business-growth",
            "plan_name": "Business Growth",
            "category": "business",
            "amount": 149900,
            "currency": "INR",
            "description": "Growing team plan for collaboration, support, and production use.",
        },
        "enterprise-scale": {
            "plan_id": "enterprise-scale",
            "plan_name": "Enterprise Scale",
            "category": "enterprise",
            "amount": 299900,
            "currency": "INR",
            "description": "Top-tier workspace access with priority service and premium controls.",
        },
    }

    def __init__(self) -> None:
        self.key_id = RAZORPAY_KEY_ID
        self.key_secret = RAZORPAY_KEY_SECRET
        self.company_name = RAZORPAY_COMPANY_NAME
        self.client = (
            razorpay.Client(auth=(self.key_id, self.key_secret))
            if self.key_id and self.key_secret
            else None
        )

    def _require_client(self) -> razorpay.Client:
        if not self.client:
            raise PaymentServiceError("Razorpay is not configured on the server.")
        return self.client

    def get_plan(self, plan_id: str) -> dict:
        plan = self.PLAN_CATALOG.get(plan_id)
        if not plan:
            raise PaymentServiceError("Invalid pricing plan selected.")
        return plan

    def create_razorpay_order(self, plan_id: str, user_id: str) -> dict:
        plan = self.get_plan(plan_id)
        client = self._require_client()
        try:
            order = client.order.create(
                {
                    "amount": plan["amount"],
                    "currency": plan["currency"],
                    "receipt": f"{user_id[:8]}-{plan_id[:20]}",
                    "notes": {
                        "user_id": user_id,
                        "plan_id": plan_id,
                        "plan_name": plan["plan_name"],
                    },
                }
            )
        except Exception as exc:
            raise PaymentServiceError(f"Razorpay order creation failed: {exc}") from exc
        return {
            "planId": plan["plan_id"],
            "planName": plan["plan_name"],
            "category": plan["category"],
            "amount": plan["amount"],
            "currency": plan["currency"],
            "orderId": order["id"],
            "keyId": self.key_id,
            "companyName": self.company_name,
            "description": plan["description"],
        }

    def activate_plan_for_user(
        self,
        db: Session,
        *,
        user_id: str,
        plan_id: str,
        razorpay_order_id: str,
        razorpay_payment_id: str,
    ) -> User:
        plan = self.get_plan(plan_id)
        user = db.get(User, user_id)
        if not user:
            raise PaymentServiceError("User account was not found.")

        user.subscription_plan_id = plan["plan_id"]
        user.subscription_plan_name = plan["plan_name"]
        user.subscription_status = "premium"
        user.subscription_amount = plan["amount"]
        user.subscription_currency = plan["currency"]
        user.subscription_billing_cycle = "monthly"
        user.subscription_activated_at = datetime.now(timezone.utc)
        user.subscription_payment_id = razorpay_payment_id
        user.subscription_order_id = razorpay_order_id

        db.commit()
        db.refresh(user)
        return user

    def verify_payment(
        self,
        *,
        plan_id: str,
        razorpay_order_id: str,
        razorpay_payment_id: str,
        razorpay_signature: str,
    ) -> dict:
        self.get_plan(plan_id)
        if not self.key_secret:
            raise PaymentServiceError("Razorpay is not configured on the server.")

        payload = f"{razorpay_order_id}|{razorpay_payment_id}"
        expected_signature = hmac.new(
            self.key_secret.encode("utf-8"),
            payload.encode("utf-8"),
            sha256,
        ).hexdigest()

        if not hmac.compare_digest(expected_signature, razorpay_signature):
            raise PaymentServiceError("Payment signature verification failed.")

        return {
            "verified": True,
            "message": "Payment verified successfully.",
            "planId": plan_id,
            "razorpayOrderId": razorpay_order_id,
            "razorpayPaymentId": razorpay_payment_id,
        }
