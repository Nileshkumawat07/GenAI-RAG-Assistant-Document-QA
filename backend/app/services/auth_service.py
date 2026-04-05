from __future__ import annotations

import base64
import hashlib
import hmac
import secrets
import uuid
from dataclasses import dataclass
from datetime import date

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.models.user import User


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
    created_at: str


class AuthService:
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
            created_at=user.created_at.isoformat(),
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
