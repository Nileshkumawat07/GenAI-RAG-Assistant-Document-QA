from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from secrets import randbelow

import boto3
from botocore.exceptions import BotoCoreError, ClientError
from twilio.base.exceptions import TwilioException
from twilio.rest import Client as TwilioClient

from app.core.config import (
    AWS_ACCESS_KEY_ID,
    AWS_REGION,
    AWS_SECRET_ACCESS_KEY,
    OTP_DEFAULT_COUNTRY_CODE,
    OTP_LENGTH,
    OTP_RESEND_COOLDOWN_SECONDS,
    OTP_TTL_SECONDS,
    SES_FROM_EMAIL,
    TWILIO_ACCOUNT_SID,
    TWILIO_AUTH_TOKEN,
    TWILIO_PHONE_NUMBER,
)


class OTPServiceError(RuntimeError):
    """Raised when OTP delivery or verification fails for an expected reason."""


@dataclass
class OTPRecord:
    code: str
    expires_at: datetime
    resend_available_at: datetime


class OTPService:
    def __init__(self) -> None:
        self._email_otps: dict[str, OTPRecord] = {}
        self._sms_otps: dict[str, OTPRecord] = {}
        self._ses_client = self._build_ses_client()
        self._twilio_client = self._build_twilio_client()

    def send_email_otp(self, email: str) -> None:
        destination = email.strip().lower()
        self._ensure_delivery_allowed(self._email_otps, destination, "email")
        code = self._generate_otp()
        self._send_email(destination, code)
        self._store_code(self._email_otps, destination, code)

    def send_sms_otp(self, mobile: str) -> None:
        destination = self._normalize_mobile(mobile)
        self._ensure_delivery_allowed(self._sms_otps, destination, "mobile")
        code = self._generate_otp()
        self._send_sms(destination, code)
        self._store_code(self._sms_otps, destination, code)

    def verify_email_otp(self, email: str, otp: str) -> None:
        destination = email.strip().lower()
        self._verify_code(self._email_otps, destination, otp)

    def verify_sms_otp(self, mobile: str, otp: str) -> None:
        destination = self._normalize_mobile(mobile)
        self._verify_code(self._sms_otps, destination, otp)

    def _build_ses_client(self):
        if not AWS_REGION or not SES_FROM_EMAIL:
            return None

        if not AWS_ACCESS_KEY_ID or not AWS_SECRET_ACCESS_KEY:
            return None

        return boto3.client(
            "ses",
            region_name=AWS_REGION,
            aws_access_key_id=AWS_ACCESS_KEY_ID,
            aws_secret_access_key=AWS_SECRET_ACCESS_KEY,
        )

    def _build_twilio_client(self):
        if not TWILIO_ACCOUNT_SID or not TWILIO_AUTH_TOKEN or not TWILIO_PHONE_NUMBER:
            return None
        return TwilioClient(TWILIO_ACCOUNT_SID, TWILIO_AUTH_TOKEN)

    def _generate_otp(self) -> str:
        lower_bound = 10 ** (OTP_LENGTH - 1)
        upper_span = 9 * lower_bound
        return str(lower_bound + randbelow(upper_span))

    def _store_code(self, store: dict[str, OTPRecord], destination: str, code: str) -> None:
        now = self._utc_now()
        store[destination] = OTPRecord(
            code=code,
            expires_at=now + timedelta(seconds=OTP_TTL_SECONDS),
            resend_available_at=now + timedelta(seconds=OTP_RESEND_COOLDOWN_SECONDS),
        )

    def _ensure_delivery_allowed(
        self,
        store: dict[str, OTPRecord],
        destination: str,
        channel_label: str,
    ) -> None:
        existing = store.get(destination)
        now = self._utc_now()
        if existing and existing.resend_available_at > now:
            wait_seconds = int((existing.resend_available_at - now).total_seconds()) + 1
            raise OTPServiceError(
                f"Please wait {wait_seconds} seconds before requesting another {channel_label} OTP."
            )

    def _verify_code(self, store: dict[str, OTPRecord], destination: str, otp: str) -> None:
        existing = store.get(destination)
        if not existing:
            raise OTPServiceError("Please send an OTP first.")

        now = self._utc_now()
        if existing.expires_at <= now:
            store.pop(destination, None)
            raise OTPServiceError("OTP has expired. Please request a new one.")

        if existing.code != otp.strip():
            raise OTPServiceError("OTP does not match.")

        store.pop(destination, None)

    def _send_email(self, destination: str, code: str) -> None:
        if not self._ses_client:
            raise OTPServiceError("Email OTP is not configured on the server.")

        subject = "Unified AI Workspace OTP"
        body = (
            f"Unified AI Workspace verification code: {code}. "
            f"This code expires in {OTP_TTL_SECONDS // 60} minutes."
        )

        try:
            self._ses_client.send_email(
                Source=SES_FROM_EMAIL,
                Destination={"ToAddresses": [destination]},
                Message={
                    "Subject": {"Data": subject},
                    "Body": {
                        "Text": {"Data": body},
                        "Html": {
                            "Data": (
                                "<html><body>"
                                "<p>Unified AI Workspace verification code:</p>"
                                f"<p><strong>{code}</strong></p>"
                                f"<p>This code expires in {OTP_TTL_SECONDS // 60} minutes.</p>"
                                "</body></html>"
                            )
                        },
                    },
                },
            )
        except (BotoCoreError, ClientError) as exc:
            raise OTPServiceError(f"Failed to send email OTP: {exc}") from exc

    def _send_sms(self, destination: str, code: str) -> None:
        if not self._twilio_client:
            raise OTPServiceError("Mobile OTP is not configured on the server.")

        try:
            self._twilio_client.messages.create(
                body=(
                    f"Unified AI Workspace OTP: {code}. "
                    f"Valid for {OTP_TTL_SECONDS // 60} minutes."
                ),
                from_=TWILIO_PHONE_NUMBER,
                to=destination,
            )
        except TwilioException as exc:
            raise OTPServiceError(f"Failed to send mobile OTP: {exc}") from exc

    def _normalize_mobile(self, mobile: str) -> str:
        digits = "".join(character for character in mobile if character.isdigit())
        if len(digits) == 10:
            country_code = OTP_DEFAULT_COUNTRY_CODE
            if not country_code.startswith("+"):
                country_code = f"+{country_code}"
            return f"{country_code}{digits}"

        if mobile.startswith("+"):
            return mobile

        raise OTPServiceError("Enter a valid mobile number.")

    @staticmethod
    def _utc_now() -> datetime:
        return datetime.now(timezone.utc)
