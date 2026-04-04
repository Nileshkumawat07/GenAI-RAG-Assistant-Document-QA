from __future__ import annotations

import smtplib
from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from email.mime.multipart import MIMEMultipart
from email.mime.text import MIMEText
from secrets import token_urlsafe

from app.core.config import (
    APP_BASE_URL,
    OTP_RESEND_COOLDOWN_SECONDS,
    OTP_TTL_SECONDS,
    SMTP_FROM_EMAIL,
    SMTP_HOST,
    SMTP_PASSWORD,
    SMTP_PORT,
    SMTP_USERNAME,
)


class OTPServiceError(RuntimeError):
    """Raised when OTP delivery or verification fails for an expected reason."""


@dataclass
class EmailVerificationRecord:
    token: str
    expires_at: datetime
    resend_available_at: datetime
    verified: bool = False


class OTPService:
    def __init__(self) -> None:
        self._email_verifications: dict[str, EmailVerificationRecord] = {}
        self._verification_tokens: dict[str, str] = {}

    def send_email_verification(self, email: str) -> None:
        destination = email.strip().lower()
        self._ensure_delivery_allowed(destination)
        token = self._generate_token()
        self._store_verification(destination, token)
        self._send_email(destination, token)

    def verify_email_status(self, email: str) -> None:
        destination = email.strip().lower()
        existing = self._email_verifications.get(destination)
        if not existing:
            raise OTPServiceError("Send the verification link first.")

        now = self._utc_now()
        if existing.expires_at <= now:
            self._delete_verification(destination, existing.token)
            raise OTPServiceError("The verification link has expired. Please send a new one.")

        if not existing.verified:
            raise OTPServiceError("Open the email link first, then click Verify.")

    def confirm_email_verification(self, token: str) -> str:
        normalized_token = token.strip()
        destination = self._verification_tokens.get(normalized_token)
        if not destination:
            raise OTPServiceError("The verification link is invalid.")

        existing = self._email_verifications.get(destination)
        if not existing or existing.token != normalized_token:
            raise OTPServiceError("The verification link is no longer active.")

        now = self._utc_now()
        if existing.expires_at <= now:
            self._delete_verification(destination, existing.token)
            raise OTPServiceError("The verification link has expired. Please request a new one.")

        existing.verified = True
        return destination

    def _generate_token(self) -> str:
        return token_urlsafe(32)

    def _store_verification(self, destination: str, token: str) -> None:
        now = self._utc_now()
        existing = self._email_verifications.get(destination)
        if existing:
            self._verification_tokens.pop(existing.token, None)

        self._email_verifications[destination] = EmailVerificationRecord(
            token=token,
            expires_at=now + timedelta(seconds=OTP_TTL_SECONDS),
            resend_available_at=now + timedelta(seconds=OTP_RESEND_COOLDOWN_SECONDS),
        )
        self._verification_tokens[token] = destination

    def _ensure_delivery_allowed(self, destination: str) -> None:
        existing = self._email_verifications.get(destination)
        now = self._utc_now()
        if existing and existing.resend_available_at > now:
            wait_seconds = int((existing.resend_available_at - now).total_seconds()) + 1
            raise OTPServiceError(
                f"Please wait {wait_seconds} seconds before requesting another email link."
            )

    def _delete_verification(self, destination: str, token: str) -> None:
        self._email_verifications.pop(destination, None)
        self._verification_tokens.pop(token, None)

    def _send_email(self, destination: str, token: str) -> None:
        if not SMTP_HOST or not SMTP_USERNAME or not SMTP_PASSWORD or not SMTP_FROM_EMAIL:
            raise OTPServiceError("Email verification is not configured on the server.")

        verification_link = f"{APP_BASE_URL}/auth/email/confirm?token={token}"

        subject = "Verify Your Unified AI Workspace Email"
        text_body = (
            "Verify your Unified AI Workspace email by opening this link:\n"
            f"{verification_link}\n\n"
            f"This link expires in {OTP_TTL_SECONDS // 60} minutes."
        )
        html_body = (
            "<html><body>"
            "<p>Verify your Unified AI Workspace email by opening this link:</p>"
            f'<p><a href="{verification_link}">Verify Email</a></p>'
            f"<p>If the button does not open, use this link:</p><p>{verification_link}</p>"
            f"<p>This link expires in {OTP_TTL_SECONDS // 60} minutes.</p>"
            "</body></html>"
        )

        message = MIMEMultipart("alternative")
        message["Subject"] = subject
        message["From"] = SMTP_FROM_EMAIL
        message["To"] = destination
        message.attach(MIMEText(text_body, "plain", "utf-8"))
        message.attach(MIMEText(html_body, "html", "utf-8"))

        try:
            with smtplib.SMTP(SMTP_HOST, SMTP_PORT, timeout=30) as server:
                server.starttls()
                server.login(SMTP_USERNAME, SMTP_PASSWORD)
                server.sendmail(SMTP_FROM_EMAIL, [destination], message.as_string())
        except Exception as exc:
            raise OTPServiceError(f"Failed to send verification email: {exc}") from exc

    @staticmethod
    def _utc_now() -> datetime:
        return datetime.now(timezone.utc)
