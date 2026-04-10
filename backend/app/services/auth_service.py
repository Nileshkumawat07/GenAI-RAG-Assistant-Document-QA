from __future__ import annotations

import base64
import hashlib
import hmac
import os
import secrets
import uuid
from dataclasses import dataclass
from datetime import date, datetime, timezone

from sqlalchemy import or_, select
from sqlalchemy.orm import Session

from app.models.contact_request import ContactRequest
from app.models.linked_provider import UserSocialLink
from app.models.subscription_transaction import SubscriptionTransaction
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
    public_user_code: str | None
    bio: str | None
    profile_image_url: str | None
    is_management: bool
    management_access_suspended: bool
    management_granted_at: str | None
    management_granted_by_user_id: str | None
    management_suspended_at: str | None
    management_suspended_by_user_id: str | None
    force_password_reset: bool
    email_verified: bool
    mobile_verified: bool
    subscription_plan_id: str | None
    subscription_plan_name: str | None
    subscription_status: str
    subscription_amount: int | None
    subscription_currency: str | None
    subscription_billing_cycle: str | None
    subscription_activated_at: str | None
    subscription_expires_at: str | None
    created_at: str
    is_admin: bool


class AuthService:
    def __init__(self) -> None:
        self._token_secret = (os.getenv("AUTH_TOKEN_SECRET") or os.getenv("SECRET_KEY") or "genai-workspace-auth-secret").encode("utf-8")

    def get_user_by_id(self, db: Session, *, user_id: str) -> UserPayload:
        user = db.execute(select(User).where(User.id == user_id)).scalar_one_or_none()
        if not user:
            raise AuthServiceError("User account was not found.")

        self.ensure_user_is_active(user)
        self.sync_user_subscription(db, user)
        return self._serialize_user(user)

    def create_access_token(self, *, user_id: str, token_id: str | None = None) -> str:
        payload = f"{user_id}:{token_id or ''}".encode("utf-8")
        signature = hmac.new(self._token_secret, payload, hashlib.sha256).digest()
        return f"{base64.urlsafe_b64encode(payload).decode().rstrip('=')}.{base64.urlsafe_b64encode(signature).decode().rstrip('=')}"

    def is_admin_email(self, email: str | None) -> bool:
        return (email or "").strip().lower() in ADMIN_EMAILS

    def user_is_admin(self, db: Session, *, user_id: str) -> bool:
        user = self._get_user_model_by_id(db, user_id)
        return self.is_admin_email(user.email)

    def user_is_management(self, db: Session, *, user_id: str) -> bool:
        user = self._get_user_model_by_id(db, user_id)
        return bool(user.is_management)

    def user_has_management_access(self, db: Session, *, user_id: str) -> bool:
        user = self._get_user_model_by_id(db, user_id)
        return self.is_admin_email(user.email) or (bool(user.is_management) and not bool(user.management_access_suspended))

    def ensure_user_is_active(self, user: User) -> None:
        if bool(getattr(user, "account_locked", False)):
            raise AuthServiceError("This account is locked. Contact support or an administrator.")

    def verify_access_token(self, token: str) -> str:
        user_id, _ = self.verify_access_token_details(token)
        return user_id

    def verify_access_token_details(self, token: str) -> tuple[str, str | None]:
        try:
            payload_b64, signature_b64 = token.split(".", 1)
            payload = base64.urlsafe_b64decode(self._restore_padding(payload_b64))
            signature = base64.urlsafe_b64decode(self._restore_padding(signature_b64))
        except Exception as exc:
            raise AuthServiceError("Invalid session token.") from exc

        expected_signature = hmac.new(self._token_secret, payload, hashlib.sha256).digest()
        if not hmac.compare_digest(signature, expected_signature):
            raise AuthServiceError("Invalid session token.")

        raw_payload = payload.decode("utf-8").strip()
        if not raw_payload:
            raise AuthServiceError("Invalid session token.")

        if ":" in raw_payload:
            user_id, token_id = raw_payload.split(":", 1)
            token_id = token_id or None
        else:
            user_id, token_id = raw_payload, None
        if not user_id:
            raise AuthServiceError("Invalid session token.")
        return user_id, token_id

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
            public_user_code=self._generate_public_user_code(db),
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
        self.ensure_user_is_active(user)

        user.last_login_at = datetime.now(timezone.utc)
        db.commit()
        db.refresh(user)
        self.sync_user_subscription(db, user)
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
        user.force_password_reset = False
        db.commit()

    def verify_account_password(self, db: Session, *, user_id: str, password: str) -> User:
        user = self._get_user_model_by_id(db, user_id)
        if not self._verify_password(password, user.password_hash):
            raise AuthServiceError("Current password is incorrect.")
        return user

    def delete_user_account(self, db: Session, *, user_id: str, password: str, confirmation_text: str) -> None:
        user = self.verify_account_password(db, user_id=user_id, password=password)
        if (confirmation_text or "").strip().upper() != "DELETE":
            raise AuthServiceError("Type DELETE to confirm account removal.")

        social_links = db.execute(
            select(UserSocialLink).where(UserSocialLink.user_id == user.id)
        ).scalars().all()
        contact_requests = db.execute(
            select(ContactRequest).where(ContactRequest.user_id == user.id)
        ).scalars().all()
        subscription_transactions = db.execute(
            select(SubscriptionTransaction).where(SubscriptionTransaction.user_id == user.id)
        ).scalars().all()

        for item in social_links:
            db.delete(item)
        for item in contact_requests:
            db.delete(item)
        for item in subscription_transactions:
            db.delete(item)
        db.delete(user)
        db.commit()

    def update_management_access(
        self,
        db: Session,
        *,
        user_id: str,
        is_management: bool,
        suspended: bool = False,
        changed_by_user_id: str | None = None,
    ) -> UserPayload:
        user = self._get_user_model_by_id(db, user_id)
        if self.is_admin_email(user.email):
            raise AuthServiceError("Admin accounts already have administration access.")

        now = datetime.now(timezone.utc)
        user.is_management = is_management
        if is_management:
            if not user.management_granted_at:
                user.management_granted_at = now
            if changed_by_user_id:
                user.management_granted_by_user_id = changed_by_user_id
            user.management_access_suspended = bool(suspended)
            if suspended:
                user.management_suspended_at = now
                user.management_suspended_by_user_id = changed_by_user_id
            else:
                user.management_suspended_at = None
                user.management_suspended_by_user_id = None
        else:
            user.management_access_suspended = False
            user.management_suspended_at = None
            user.management_suspended_by_user_id = None
        db.commit()
        db.refresh(user)
        return self._serialize_user(user)

    def update_profile(
        self,
        db: Session,
        *,
        user_id: str,
        full_name: str,
        date_of_birth,
        gender: str,
        alternate_email: str | None,
        bio: str | None = None,
    ) -> UserPayload:
        user = self._get_user_model_by_id(db, user_id)
        normalized_full_name = (full_name or "").strip()
        normalized_gender = (gender or "").strip()
        normalized_alternate_email = alternate_email.strip().lower() if alternate_email and alternate_email.strip() else None

        if not normalized_full_name:
            raise AuthServiceError("Full name is required.")
        if not normalized_gender:
            raise AuthServiceError("Gender is required.")

        if normalized_alternate_email and normalized_alternate_email != user.alternate_email:
            existing = db.execute(
                select(User).where(User.email == normalized_alternate_email, User.id != user_id)
            ).scalar_one_or_none()
            if existing:
                raise AuthServiceError("That alternate email is already in use.")

        user.full_name = normalized_full_name
        user.date_of_birth = date_of_birth
        user.gender = normalized_gender
        user.alternate_email = normalized_alternate_email
        user.bio = (bio or "").strip()[:280] or None
        db.commit()
        db.refresh(user)
        return self._serialize_user(user)

    def _get_user_model_by_id(self, db: Session, user_id: str) -> User:
        user = db.execute(select(User).where(User.id == user_id)).scalar_one_or_none()
        if not user:
            raise AuthServiceError("User account was not found.")

        self.ensure_user_is_active(user)
        self.sync_user_subscription(db, user)
        return user

    def sync_user_subscription(self, db: Session, user: User) -> User:
        now = datetime.now(timezone.utc)
        expires_at = user.subscription_expires_at
        if expires_at and expires_at.tzinfo is None:
            expires_at = expires_at.replace(tzinfo=timezone.utc)

        if user.subscription_status == "premium" and expires_at and expires_at <= now:
            user.subscription_status = "expired"
            user.subscription_plan_id = None
            user.subscription_plan_name = None
            user.subscription_amount = None
            user.subscription_currency = None
            user.subscription_billing_cycle = None
            user.subscription_activated_at = None
            user.subscription_expires_at = None
            user.subscription_payment_id = None
            user.subscription_order_id = None
            transactions = db.execute(
                select(SubscriptionTransaction).where(
                    SubscriptionTransaction.user_id == user.id,
                    SubscriptionTransaction.status == "verified",
                )
            ).scalars().all()
            for transaction in transactions:
                transaction.status = "expired"
            db.commit()
            db.refresh(user)
        return user

    def sync_all_user_subscriptions(self, db: Session) -> None:
        users = db.execute(select(User)).scalars().all()
        for user in users:
            self.sync_user_subscription(db, user)

    def _generate_public_user_code(self, db: Session) -> str:
        for _ in range(20):
            code = f"{secrets.randbelow(1_000_000):06d}"
            exists = db.execute(select(User.id).where(User.public_user_code == code)).scalar_one_or_none()
            if not exists:
                return code
        raise AuthServiceError("Unable to generate a short user code.")

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
            public_user_code=user.public_user_code,
            bio=user.bio,
            profile_image_url=user.profile_image_url,
            is_management=bool(user.is_management),
            management_access_suspended=bool(user.management_access_suspended),
            management_granted_at=user.management_granted_at.isoformat() if user.management_granted_at else None,
            management_granted_by_user_id=user.management_granted_by_user_id,
            management_suspended_at=user.management_suspended_at.isoformat() if user.management_suspended_at else None,
            management_suspended_by_user_id=user.management_suspended_by_user_id,
            force_password_reset=bool(user.force_password_reset),
            email_verified=user.email_verified,
            mobile_verified=user.mobile_verified,
            subscription_plan_id=user.subscription_plan_id,
            subscription_plan_name=user.subscription_plan_name,
            subscription_status=user.subscription_status or "free",
            subscription_amount=user.subscription_amount,
            subscription_currency=user.subscription_currency,
            subscription_billing_cycle=user.subscription_billing_cycle,
            subscription_activated_at=user.subscription_activated_at.isoformat() if user.subscription_activated_at else None,
            subscription_expires_at=user.subscription_expires_at.isoformat() if user.subscription_expires_at else None,
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
