from __future__ import annotations

import uuid
from dataclasses import dataclass
from datetime import datetime, timezone

from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.linked_provider import LinkedProvider
from app.models.user import User
from app.services.auth_service import AuthService, AuthServiceError


class LinkedProviderServiceError(RuntimeError):
    """Raised when linked-provider operations fail for an expected reason."""


@dataclass
class LinkedProviderPayload:
    provider_key: str
    provider_email: str
    provider_display_name: str
    provider_identifier: str
    callback_provider_id: str | None
    callback_email: str | None
    callback_display_name: str | None
    callback_user_id: str | None
    callback_received_at: str | None
    verified: bool
    linked_at: str


class LinkedProviderService:
    SUPPORTED_PROVIDERS = {"google", "facebook", "linkedin"}
    CALLBACK_PROVIDER_IDS = {
        "google": {"google.com"},
        "facebook": {"facebook.com"},
        "linkedin": {"oidc.linkedin", "linkedin.com", "linkedin"},
    }

    def __init__(self, auth_service: AuthService) -> None:
        self.auth_service = auth_service

    def list_providers(self, db: Session, *, user_id: str) -> list[LinkedProviderPayload]:
        self._require_user(db, user_id)
        items = db.execute(
            select(LinkedProvider).where(LinkedProvider.user_id == user_id).order_by(LinkedProvider.provider_key.asc())
        ).scalars().all()
        return [self._serialize(item) for item in items]

    def link_provider(
        self,
        db: Session,
        *,
        user_id: str,
        provider_key: str,
        provider_email: str,
        provider_display_name: str,
        provider_identifier: str,
        callback_provider_id: str,
        callback_email: str,
        callback_display_name: str,
        callback_user_id: str,
        current_password: str,
    ) -> LinkedProviderPayload:
        user = self._require_user_model(db, user_id)
        self._verify_password(current_password, user.password_hash)

        normalized_key = provider_key.strip().lower()
        if normalized_key not in self.SUPPORTED_PROVIDERS:
            raise LinkedProviderServiceError("Unsupported provider.")

        normalized_email = provider_email.strip().lower()
        normalized_display_name = provider_display_name.strip()
        normalized_identifier = provider_identifier.strip()
        normalized_callback_provider = callback_provider_id.strip().lower()
        normalized_callback_email = callback_email.strip().lower()
        normalized_callback_display_name = callback_display_name.strip()
        normalized_callback_user_id = callback_user_id.strip()

        self._validate_callback(
            provider_key=normalized_key,
            provider_email=normalized_email,
            provider_display_name=normalized_display_name,
            provider_identifier=normalized_identifier,
            callback_provider_id=normalized_callback_provider,
            callback_email=normalized_callback_email,
            callback_display_name=normalized_callback_display_name,
            callback_user_id=normalized_callback_user_id,
        )

        if normalized_key == "google" and user.email.lower().endswith("@gmail.com"):
            raise LinkedProviderServiceError("Google stays linked as the primary Gmail provider for this account.")

        existing = db.execute(
            select(LinkedProvider).where(
                LinkedProvider.user_id == user_id,
                LinkedProvider.provider_key == normalized_key,
            )
        ).scalar_one_or_none()

        if existing:
            item = existing
        else:
            item = LinkedProvider(
                id=str(uuid.uuid4()),
                user_id=user_id,
                provider_key=normalized_key,
                provider_email=normalized_email,
                provider_display_name=normalized_display_name,
                provider_identifier=normalized_identifier,
                verified=True,
            )
            db.add(item)

        now = datetime.now(timezone.utc)
        item.provider_email = normalized_email
        item.provider_display_name = normalized_display_name
        item.provider_identifier = normalized_identifier
        item.callback_provider_id = normalized_callback_provider
        item.callback_email = normalized_callback_email
        item.callback_display_name = normalized_callback_display_name
        item.callback_user_id = normalized_callback_user_id
        item.callback_received_at = now
        item.verified = True
        item.linked_at = now
        db.commit()
        db.refresh(item)
        return self._serialize(item)

    def unlink_provider(
        self,
        db: Session,
        *,
        user_id: str,
        provider_key: str,
        current_password: str,
    ) -> None:
        user = self._require_user_model(db, user_id)
        self._verify_password(current_password, user.password_hash)

        normalized_key = provider_key.strip().lower()
        if normalized_key == "google" and user.email.lower().endswith("@gmail.com"):
            raise LinkedProviderServiceError("Google cannot be unlinked from a Gmail-based account.")

        item = db.execute(
            select(LinkedProvider).where(
                LinkedProvider.user_id == user_id,
                LinkedProvider.provider_key == normalized_key,
            )
        ).scalar_one_or_none()
        if not item:
            raise LinkedProviderServiceError("Provider link was not found.")

        db.delete(item)
        db.commit()

    def _require_user(self, db: Session, user_id: str) -> None:
        user = db.execute(select(User.id).where(User.id == user_id)).scalar_one_or_none()
        if not user:
            raise LinkedProviderServiceError("User account was not found.")

    def _require_user_model(self, db: Session, user_id: str) -> User:
        user = db.execute(select(User).where(User.id == user_id)).scalar_one_or_none()
        if not user:
            raise LinkedProviderServiceError("User account was not found.")
        return user

    def _verify_password(self, current_password: str, stored_hash: str) -> None:
        if not self.auth_service._verify_password(current_password, stored_hash):
            raise LinkedProviderServiceError("Current password is incorrect.")

    def _validate_callback(
        self,
        *,
        provider_key: str,
        provider_email: str,
        provider_display_name: str,
        provider_identifier: str,
        callback_provider_id: str,
        callback_email: str,
        callback_display_name: str,
        callback_user_id: str,
    ) -> None:
        if not provider_email:
            raise LinkedProviderServiceError("Provider email is required.")
        if not provider_display_name:
            raise LinkedProviderServiceError("Provider profile name is required.")
        if not provider_identifier:
            raise LinkedProviderServiceError("Provider account identifier is required.")
        if not callback_provider_id:
            raise LinkedProviderServiceError("Provider validation callback is missing.")
        if callback_provider_id not in self.CALLBACK_PROVIDER_IDS[provider_key]:
            raise LinkedProviderServiceError("Provider validation callback does not match the selected provider.")
        if not callback_email:
            raise LinkedProviderServiceError("Validated provider email was not returned by the provider.")
        if callback_email != provider_email:
            raise LinkedProviderServiceError("Validated provider email does not match the account being linked.")
        if not callback_display_name:
            raise LinkedProviderServiceError("Validated provider profile name was not returned by the provider.")
        if not callback_user_id:
            raise LinkedProviderServiceError("Validated provider account identifier was not returned by the provider.")
        if callback_user_id != provider_identifier:
            raise LinkedProviderServiceError("Validated provider identifier does not match the account being linked.")

    def _serialize(self, item: LinkedProvider) -> LinkedProviderPayload:
        return LinkedProviderPayload(
            provider_key=item.provider_key,
            provider_email=item.provider_email,
            provider_display_name=item.provider_display_name,
            provider_identifier=item.provider_identifier,
            callback_provider_id=item.callback_provider_id,
            callback_email=item.callback_email,
            callback_display_name=item.callback_display_name,
            callback_user_id=item.callback_user_id,
            callback_received_at=item.callback_received_at.isoformat() if item.callback_received_at else None,
            verified=item.verified,
            linked_at=item.linked_at.isoformat(),
        )
