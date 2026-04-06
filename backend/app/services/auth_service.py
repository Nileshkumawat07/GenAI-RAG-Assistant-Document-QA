from __future__ import annotations

import base64
import hashlib
import hmac
import os
import secrets
import uuid
from dataclasses import dataclass
from datetime import date

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.models.user import User

ADMIN_EMAILS = {"knilesh769@gmail.com"}


class AuthServiceError(RuntimeError):
    """Raised when signup or login fails for an expected reason."""


@dataclass
class UserPayload:
    id: str
    full_name: str
    username: str
    date_of_birth: date
    gender: str
    email: str
    alternate_email: str | None
    mobile: str
    security_question: str
    security_answer: str
    referral_code: str | None
    email_verified: bool
    mobile_verified: bool
    subscription_plan_id: str | None
    subscription_plan_name: str | None
    subscription_status: str
    subscription_amount: int | None
    subscription_currency: str | None
    subscription_billing_cycle: str | None
    subscription_activated_at: str | None
    created_at: str
    is_admin: bool


class AuthService:
    def __init__(self) -> None:
        self._token_secret = (os.getenv("AUTH_TOKEN_SECRET") or os.getenv("SECRET_KEY") or "genai-workspace-auth-secret").encode("utf-8")

    def get_user_by_id(self, db: Session, *, user_id: str) -> UserPayload:
        user = db.execute(select(User).where(User.id == user_id)).scalar_one_or_none()
        if not user:
            raise AuthServiceError("User account was not found.")

        return self._serialize_user(user)

    def create_access_token(self, *, user_id: str) -> str:
        payload = user_id.encode("utf-8")
        signature = hmac.new(self._token_secret, payload, hashlib.sha256).digest()
        return f"{base64.urlsafe_b64encode(payload).decode().rstrip('=')}.{base64.urlsafe_b64encode(signature).decode().rstrip('=')}"

    def is_admin_email(self, email: str | None) -> bool:
        return (email or "").strip().lower() in ADMIN_EMAILS

    def user_is_admin(self, db: Session, *, user_id: str) -> bool:
        user = self._get_user_model_by_id(db, user_id)
        return self.is_admin_email(user.email)

    def verify_access_token(self, token: str) -> str:
        try:
            payload_b64, signature_b64 = token.split(".", 1)
            payload = base64.urlsafe_b64decode(self._restore_padding(payload_b64))
            signature = base64.urlsafe_b64decode(self._restore_padding(signature_b64))
        except Exception as exc:
            raise AuthServiceError("Invalid session token.") from exc

        expected_signature = hmac.new(self._token_secret, payload, hashlib.sha256).digest()
        if not hmac.compare_digest(signature, expected_signature):
            raise AuthServiceError("Invalid session token.")

        user_id = payload.decode("utf-8").strip()
        if not user_id:
            raise AuthServiceError("Invalid session token.")
        return user_id

    def register_user(
        self,
        db: Session,
        *,
        full_name: str,
        username: str,
        date_of_birth,
        gender: str,
        email: str,
        alternate_email: str | None,
        mobile: str,
        security_question: str,
        security_answer: str,
        referral_code: str | None,
        password: str,
        email_verified: bool,
        mobile_verified: bool,
    ) -> UserPayload:
        normalized_email = email.strip().lower()
        normalized_username = username.strip().lower()
        normalized_mobile = mobile.strip()

        existing = db.execute(
            select(User).where(
                or_(
                    User.email == normalized_email,
                    User.username == normalized_username,
                    User.mobile == normalized_mobile,
                )
            )
        ).scalar_one_or_none()

        if existing:
            raise AuthServiceError("An account with this email, username, or mobile number already exists.")

        user = User(
            id=str(uuid.uuid4()),
            full_name=full_name.strip(),
            username=normalized_username,
            date_of_birth=date_of_birth,
            gender=gender.strip(),
            email=normalized_email,
            alternate_email=alternate_email.strip().lower() if alternate_email and alternate_email.strip() else None,
            mobile=normalized_mobile,
            security_question=security_question.strip(),
            security_answer=security_answer.strip(),
            referral_code=referral_code.strip() if referral_code and referral_code.strip() else None,
            password_hash=self._hash_password(password),
            email_verified=email_verified,
            mobile_verified=mobile_verified,
        )
        db.add(user)
        db.commit()
        db.refresh(user)
        return self._serialize_user(user)

    def authenticate_user(self, db: Session, *, identifier: str, password: str) -> UserPayload:
        normalized_identifier = identifier.strip().lower()
        user = db.execute(
            select(User).where(
                or_(
                    User.email == normalized_identifier,
                    User.username == normalized_identifier,
                )
            )
        ).scalar_one_or_none()

        if not user or not self._verify_password(password, user.password_hash):
            raise AuthServiceError("Invalid email/username or password.")

        return self._serialize_user(user)

    def update_username(self, db: Session, *, user_id: str, new_username: str) -> UserPayload:
        user = self._get_user_model_by_id(db, user_id)
        normalized_username = new_username.strip().lower()

        if len(normalized_username) < 4:
            raise AuthServiceError("Username must be at least 4 characters.")

        if normalized_username == user.username:
            raise AuthServiceError("Enter a different username.")

        existing = db.execute(
            select(User).where(User.username == normalized_username, User.id != user_id)
        ).scalar_one_or_none()
        if existing:
            raise AuthServiceError("That username is already in use.")

        user.username = normalized_username
        db.commit()
        db.refresh(user)
        return self._serialize_user(user)

    def update_email(self, db: Session, *, user_id: str, new_email: str) -> UserPayload:
        user = self._get_user_model_by_id(db, user_id)
        normalized_email = new_email.strip().lower()

        if normalized_email == user.email:
            raise AuthServiceError("Enter a different email address.")

        existing = db.execute(
            select(User).where(User.email == normalized_email, User.id != user_id)
        ).scalar_one_or_none()
        if existing:
            raise AuthServiceError("That email address is already in use.")

        user.email = normalized_email
        user.email_verified = True
        db.commit()
        db.refresh(user)
        return self._serialize_user(user)

    def update_mobile(self, db: Session, *, user_id: str, new_mobile: str) -> UserPayload:
        user = self._get_user_model_by_id(db, user_id)
        normalized_mobile = new_mobile.strip()

        if normalized_mobile == user.mobile:
            raise AuthServiceError("Enter a different mobile number.")

        existing = db.execute(
            select(User).where(User.mobile == normalized_mobile, User.id != user_id)
        ).scalar_one_or_none()
        if existing:
            raise AuthServiceError("That mobile number is already in use.")

        user.mobile = normalized_mobile
        user.mobile_verified = True
        db.commit()
        db.refresh(user)
        return self._serialize_user(user)

    def change_password(
        self,
        db: Session,
        *,
        user_id: str,
        current_password: str,
        new_password: str,
    ) -> None:
        user = self._get_user_model_by_id(db, user_id)

        if not self._verify_password(current_password, user.password_hash):
            raise AuthServiceError("Current password is incorrect.")

        if current_password == new_password:
            raise AuthServiceError("Choose a new password that is different from the current one.")

        user.password_hash = self._hash_password(new_password)
        db.commit()

    def _get_user_model_by_id(self, db: Session, user_id: str) -> User:
        user = db.execute(select(User).where(User.id == user_id)).scalar_one_or_none()
        if not user:
            raise AuthServiceError("User account was not found.")

        return user

    def _serialize_user(self, user: User) -> UserPayload:
        return UserPayload(
            id=user.id,
            full_name=user.full_name,
            username=user.username,
            date_of_birth=user.date_of_birth,
            gender=user.gender,
            email=user.email,
            alternate_email=user.alternate_email,
            mobile=user.mobile,
            security_question=user.security_question,
            security_answer=user.security_answer,
            referral_code=user.referral_code,
            email_verified=user.email_verified,
            mobile_verified=user.mobile_verified,
            subscription_plan_id=user.subscription_plan_id,
            subscription_plan_name=user.subscription_plan_name,
            subscription_status=user.subscription_status or "free",
            subscription_amount=user.subscription_amount,
            subscription_currency=user.subscription_currency,
            subscription_billing_cycle=user.subscription_billing_cycle,
            subscription_activated_at=user.subscription_activated_at.isoformat() if user.subscription_activated_at else None,
            created_at=user.created_at.isoformat(),
            is_admin=self.is_admin_email(user.email),
        )

    @staticmethod
    def _hash_password(password: str) -> str:
        salt = secrets.token_bytes(16)
        digest = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 100_000)
        return f"{base64.b64encode(salt).decode()}${base64.b64encode(digest).decode()}"

    @staticmethod
    def _verify_password(password: str, stored_hash: str) -> bool:
        try:
            salt_b64, digest_b64 = stored_hash.split("$", 1)
            salt = base64.b64decode(salt_b64.encode())
            expected = base64.b64decode(digest_b64.encode())
        except Exception:
            return False

        actual = hashlib.pbkdf2_hmac("sha256", password.encode("utf-8"), salt, 100_000)
        return hmac.compare_digest(actual, expected)

    @staticmethod
    def _restore_padding(value: str) -> bytes:
        return (value + "=" * (-len(value) % 4)).encode("utf-8")
