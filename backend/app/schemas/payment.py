from pydantic import BaseModel


class CreateRazorpayOrderRequest(BaseModel):
    planId: str


class RazorpayOrderResponse(BaseModel):
    planId: str
    planName: str
    category: str
    amount: int
    currency: str
    orderId: str
    keyId: str
    companyName: str
    description: str


class VerifyRazorpayPaymentRequest(BaseModel):
    planId: str
    razorpayOrderId: str
    razorpayPaymentId: str
    razorpaySignature: str


class CancelSubscriptionRequest(BaseModel):
    currentPassword: str


class InvoiceSummaryResponse(BaseModel):
    invoiceNumber: str
    transactionCode: str
    customerCode: str | None = None
    customerName: str | None = None
    customerEmail: str | None = None
    customerMobile: str | None = None
    companyName: str | None = None
    planId: str
    planName: str
    amount: int
    currency: str
    billingCycle: str
    status: str
    razorpayOrderId: str
    razorpayPaymentId: str
    activatedAt: str
    expiresAt: str
    canceledAt: str | None = None
    createdAt: str
