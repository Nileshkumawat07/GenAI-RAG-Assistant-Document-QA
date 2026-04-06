from __future__ import annotations

import uuid
from dataclasses import dataclass

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
    verified: bool
    linked_at: str


class LinkedProviderService:
    SUPPORTED_PROVIDERS = {"google", "facebook", "linkedin"}

    def __init__(self, auth_service: AuthService) -> None:
        self.auth_service = auth_service

    def list_providers(self, db: Session, *, user_id: str) -> list[LinkedProviderPayload]:
        self._require_user(db, user_id)
        items = db.execute(
            select(LinkedProvider).where(LinkedProvider.user_id == user_id).order_by(LinkedProvider.provider_key.asc())
        ).scalars().all()
        return [self._serialize(item) for item in items]

    def upsert_verified_provider(
        self,
        db: Session,
        *,
        user_id: str,
        provider_key: str,
        provider_email: str,
        provider_display_name: str,
        provider_identifier: str,
    ) -> LinkedProviderPayload:
        user = self._require_user_model(db, user_id)

        normalized_key = provider_key.strip().lower()
        if normalized_key not in self.SUPPORTED_PROVIDERS:
            raise LinkedProviderServiceError("Unsupported provider.")

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
                provider_email=provider_email.strip().lower(),
                provider_display_name=provider_display_name.strip(),
                provider_identifier=provider_identifier.strip(),
                verified=True,
            )
            db.add(item)

        item.provider_email = provider_email.strip().lower()
        item.provider_display_name = provider_display_name.strip()
        item.provider_identifier = provider_identifier.strip()
        item.verified = True
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

    def _serialize(self, item: LinkedProvider) -> LinkedProviderPayload:
        return LinkedProviderPayload(
            provider_key=item.provider_key,
            provider_email=item.provider_email,
            provider_display_name=item.provider_display_name,
            provider_identifier=item.provider_identifier,
            verified=item.verified,
            linked_at=item.linked_at.isoformat(),
        )
