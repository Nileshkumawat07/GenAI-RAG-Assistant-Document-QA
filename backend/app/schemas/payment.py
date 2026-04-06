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

