from sqlalchemy.orm import Session

from io import BytesIO

from fastapi import APIRouter, Depends, Header, HTTPException
from fastapi.responses import StreamingResponse
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas

from app.core.database import get_db
from app.schemas.payment import (
    CancelSubscriptionRequest,
    CreateRazorpayOrderRequest,
    InvoiceSummaryResponse,
    RazorpayOrderResponse,
    VerifyRazorpayPaymentRequest,
)
from app.services.auth_service import AuthService, AuthServiceError
from app.services.payment_service import PaymentService, PaymentServiceError
from app.services.subscription_transaction_service import SubscriptionTransactionService


def build_payment_router(payment_service: PaymentService, auth_service: AuthService) -> APIRouter:
    router = APIRouter(prefix="/payments", tags=["payments"])
    transaction_service = SubscriptionTransactionService()

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
            "publicUserCode": user.public_user_code,
            "emailVerified": user.email_verified,
            "mobileVerified": user.mobile_verified,
            "subscriptionPlanId": user.subscription_plan_id,
            "subscriptionPlanName": user.subscription_plan_name,
            "subscriptionStatus": user.subscription_status,
            "subscriptionAmount": user.subscription_amount,
            "subscriptionCurrency": user.subscription_currency,
            "subscriptionBillingCycle": user.subscription_billing_cycle,
            "subscriptionActivatedAt": user.subscription_activated_at.isoformat() if user.subscription_activated_at else None,
            "subscriptionExpiresAt": user.subscription_expires_at.isoformat() if user.subscription_expires_at else None,
            "createdAt": user.created_at.isoformat(),
            "isAdmin": auth_service.is_admin_email(user.email),
            "mode": "admin" if auth_service.is_admin_email(user.email) else "member",
            "authToken": auth_service.create_access_token(user_id=user.id),
        }

    def serialize_invoice(item):
        return InvoiceSummaryResponse(
            invoiceNumber=item.invoice_number,
            transactionCode=item.transaction_code,
            customerCode=item.customer_code,
            customerName=item.customer_name or "Not available",
            customerEmail=item.customer_email or "Not available",
            customerMobile=item.customer_mobile or "Not available",
            companyName=item.company_name or "Unified AI Workspace",
            planId=item.plan_id,
            planName=item.plan_name,
            amount=item.amount,
            currency=item.currency,
            billingCycle=item.billing_cycle,
            status=item.status,
            razorpayOrderId=item.razorpay_order_id,
            razorpayPaymentId=item.razorpay_payment_id,
            activatedAt=item.activated_at.isoformat(),
            expiresAt=item.expires_at.isoformat(),
            canceledAt=item.canceled_at.isoformat() if item.canceled_at else None,
            createdAt=item.created_at.isoformat(),
        )

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
        db: Session = Depends(get_db),
        authenticated_user_id: str = Depends(require_authenticated_user_id),
    ):
        try:
            return payment_service.create_razorpay_order(db, payload.planId, authenticated_user_id)
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

    @router.get("/invoices", response_model=list[InvoiceSummaryResponse])
    def list_invoices(
        db: Session = Depends(get_db),
        authenticated_user_id: str = Depends(require_authenticated_user_id),
    ):
        invoices = transaction_service.list_transactions_for_user(db, user_id=authenticated_user_id)
        return [serialize_invoice(item) for item in invoices]

    @router.post("/subscription/cancel")
    def cancel_subscription(
        payload: CancelSubscriptionRequest,
        db: Session = Depends(get_db),
        authenticated_user_id: str = Depends(require_authenticated_user_id),
    ):
        try:
            auth_service.verify_account_password(
                db,
                user_id=authenticated_user_id,
                password=payload.currentPassword,
            )
            user = payment_service.cancel_user_subscription(db, user_id=authenticated_user_id)
            return {
                "message": "Subscription canceled successfully.",
                "user": serialize_user(user),
            }
        except AuthServiceError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        except PaymentServiceError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @router.get("/invoices/{invoice_number}/pdf")
    def download_invoice_pdf(
        invoice_number: str,
        db: Session = Depends(get_db),
        authenticated_user_id: str = Depends(require_authenticated_user_id),
    ):
        invoice = transaction_service.get_user_transaction_by_invoice(
            db,
            user_id=authenticated_user_id,
            invoice_number=invoice_number,
        )
        if not invoice:
            raise HTTPException(status_code=404, detail="Invoice was not found.")

        buffer = BytesIO()
        pdf = canvas.Canvas(buffer, pagesize=A4)
        width, height = A4

        pdf.setFillColor(colors.HexColor("#0f2f63"))
        pdf.rect(0, height - 70 * mm, width, 70 * mm, fill=1, stroke=0)
        pdf.setFillColor(colors.white)
        pdf.setFont("Helvetica-Bold", 24)
        pdf.drawString(22 * mm, height - 26 * mm, "Premium Subscription Invoice")
        pdf.setFont("Helvetica", 11)
        pdf.drawString(22 * mm, height - 34 * mm, invoice.company_name or "Unified AI Workspace")
        pdf.drawString(22 * mm, height - 41 * mm, f"Invoice #{invoice.invoice_number}")
        pdf.drawString(22 * mm, height - 48 * mm, f"Transaction #{invoice.transaction_code}")

        pdf.setFillColor(colors.HexColor("#122b55"))
        pdf.roundRect(22 * mm, height - 120 * mm, 78 * mm, 35 * mm, 5 * mm, fill=0, stroke=1)
        pdf.roundRect(108 * mm, height - 120 * mm, 80 * mm, 35 * mm, 5 * mm, fill=0, stroke=1)

        pdf.setFont("Helvetica-Bold", 12)
        pdf.drawString(26 * mm, height - 93 * mm, "Billed To")
        pdf.drawString(112 * mm, height - 93 * mm, "Plan Details")
        pdf.setFont("Helvetica", 10)
        pdf.drawString(26 * mm, height - 101 * mm, invoice.customer_name or "Not available")
        pdf.drawString(26 * mm, height - 107 * mm, invoice.customer_email or "Not available")
        pdf.drawString(26 * mm, height - 113 * mm, invoice.customer_mobile or "Not available")
        pdf.drawString(112 * mm, height - 101 * mm, invoice.plan_name)
        pdf.drawString(112 * mm, height - 107 * mm, f"{invoice.currency} {invoice.amount / 100:.2f}")
        pdf.drawString(112 * mm, height - 113 * mm, f"Cycle: {invoice.billing_cycle}")

        pdf.setFont("Helvetica-Bold", 13)
        pdf.drawString(22 * mm, height - 137 * mm, "Payment Summary")
        rows = [
            ("Status", invoice.status.title()),
            ("Activated At", invoice.activated_at.strftime("%d %b %Y %H:%M")),
            ("Valid Till", invoice.expires_at.strftime("%d %b %Y %H:%M")),
            ("Razorpay Order ID", invoice.razorpay_order_id),
            ("Razorpay Payment ID", invoice.razorpay_payment_id),
            ("Customer Code", invoice.customer_code or "Not available"),
        ]
        current_y = height - 147 * mm
        pdf.setFont("Helvetica", 10)
        for label, value in rows:
            pdf.setFillColor(colors.HexColor("#516173"))
            pdf.drawString(24 * mm, current_y, label)
            pdf.setFillColor(colors.black)
            pdf.drawString(70 * mm, current_y, str(value))
            current_y -= 8 * mm

        pdf.setFillColor(colors.HexColor("#eef4ff"))
        pdf.roundRect(22 * mm, 30 * mm, width - 44 * mm, 24 * mm, 4 * mm, fill=1, stroke=0)
        pdf.setFillColor(colors.HexColor("#16396f"))
        pdf.setFont("Helvetica-Bold", 11)
        pdf.drawString(28 * mm, 44 * mm, "Thank you for choosing our premium workspace.")
        pdf.setFont("Helvetica", 9)
        pdf.drawString(28 * mm, 37 * mm, "This invoice was generated automatically from your verified Razorpay payment.")

        pdf.showPage()
        pdf.save()
        buffer.seek(0)
        return StreamingResponse(
            buffer,
            media_type="application/pdf",
            headers={"Content-Disposition": f'attachment; filename="invoice-{invoice.invoice_number}.pdf"'},
        )

    return router
