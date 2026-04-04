from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from secrets import randbelow

import boto3
from botocore.exceptions import BotoCoreError, ClientError

from app.core.config import (
    AWS_ACCESS_KEY_ID,
    AWS_REGION,
    AWS_SECRET_ACCESS_KEY,
    OTP_LENGTH,
    OTP_RESEND_COOLDOWN_SECONDS,
    OTP_TTL_SECONDS,
    SES_FROM_EMAIL,
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
        self._ses_client = self._build_ses_client()

    def send_email_otp(self, email: str) -> None:
        destination = email.strip().lower()
        self._ensure_delivery_allowed(destination)
        code = self._generate_otp()
        self._send_email(destination, code)
        self._store_code(destination, code)

    def verify_email_otp(self, email: str, otp: str) -> None:
        destination = email.strip().lower()
        existing = self._email_otps.get(destination)
        if not existing:
            raise OTPServiceError("Please send an OTP first.")

        now = self._utc_now()
        if existing.expires_at <= now:
            self._email_otps.pop(destination, None)
            raise OTPServiceError("OTP has expired. Please request a new one.")

        if existing.code != otp.strip():
            raise OTPServiceError("OTP does not match.")

        self._email_otps.pop(destination, None)

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

    def _generate_otp(self) -> str:
        lower_bound = 10 ** (OTP_LENGTH - 1)
        upper_span = 9 * lower_bound
        return str(lower_bound + randbelow(upper_span))

    def _store_code(self, destination: str, code: str) -> None:
        now = self._utc_now()
        self._email_otps[destination] = OTPRecord(
            code=code,
            expires_at=now + timedelta(seconds=OTP_TTL_SECONDS),
            resend_available_at=now + timedelta(seconds=OTP_RESEND_COOLDOWN_SECONDS),
        )

    def _ensure_delivery_allowed(self, destination: str) -> None:
        existing = self._email_otps.get(destination)
        now = self._utc_now()
        if existing and existing.resend_available_at > now:
            wait_seconds = int((existing.resend_available_at - now).total_seconds()) + 1
            raise OTPServiceError(
                f"Please wait {wait_seconds} seconds before requesting another email OTP."
            )

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

    @staticmethod
    def _utc_now() -> datetime:
        return datetime.now(timezone.utc)
