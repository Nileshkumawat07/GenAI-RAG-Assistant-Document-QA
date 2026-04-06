from __future__ import annotations

from dataclasses import dataclass

from sqlalchemy.exc import IntegrityError
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.models.linked_provider import UserSocialLink
from app.models.user import User


class LinkedProviderServiceError(RuntimeError):
    """Raised when social-account linking fails for an expected reason."""


@dataclass
class LinkedProviderPayload:
    user_id: str
    provider: str
    provider_id: str
    email: str


class LinkedProviderService:
    SUPPORTED_PROVIDERS = {"facebook", "linkedin"}

    def list_providers(self, db: Session, *, user_id: str) -> list[LinkedProviderPayload]:
        self._require_user(db, user_id)
        items = db.execute(
            select(UserSocialLink)
            .where(UserSocialLink.user_id == user_id)
            .order_by(UserSocialLink.provider.asc())
        ).scalars().all()
        return [self._serialize(item) for item in items]

    def link_provider(
        self,
        db: Session,
        *,
        user_id: str,
        provider: str,
        provider_id: str,
        email: str,
    ) -> LinkedProviderPayload:
        self._require_user(db, user_id)

        normalized_provider = provider.strip().lower()
        normalized_provider_id = provider_id.strip()
        normalized_email = email.strip().lower()

        if normalized_provider not in self.SUPPORTED_PROVIDERS:
            raise LinkedProviderServiceError("Unsupported provider.")
        if not normalized_provider_id:
            raise LinkedProviderServiceError("Provider account identifier is required.")
        if not normalized_email:
            raise LinkedProviderServiceError("Provider email is required.")

        existing_for_user = db.execute(
            select(UserSocialLink).where(
                UserSocialLink.user_id == user_id,
                UserSocialLink.provider == normalized_provider,
            )
        ).scalar_one_or_none()
        if existing_for_user:
            raise LinkedProviderServiceError(f"{normalized_provider.title()} is already linked to this account.")

        existing_provider_account = db.execute(
            select(UserSocialLink).where(
                UserSocialLink.provider == normalized_provider,
                UserSocialLink.provider_id == normalized_provider_id,
            )
        ).scalar_one_or_none()
        if existing_provider_account:
            raise LinkedProviderServiceError(
                f"This {normalized_provider.title()} account is already linked to another user."
            )

        item = UserSocialLink(
            user_id=user_id,
            provider=normalized_provider,
            provider_id=normalized_provider_id,
            email=normalized_email,
        )
        db.add(item)
        try:
            db.commit()
        except IntegrityError as exc:
            db.rollback()
            raise LinkedProviderServiceError(
                f"{normalized_provider.title()} could not be linked because it is already connected."
            ) from exc
        db.refresh(item)
        return self._serialize(item)

    def unlink_provider(self, db: Session, *, user_id: str, provider: str) -> None:
        self._require_user(db, user_id)

        normalized_provider = provider.strip().lower()
        item = db.execute(
            select(UserSocialLink).where(
                UserSocialLink.user_id == user_id,
                UserSocialLink.provider == normalized_provider,
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

    @staticmethod
    def _serialize(item: UserSocialLink) -> LinkedProviderPayload:
        return LinkedProviderPayload(
            user_id=item.user_id,
            provider=item.provider,
            provider_id=item.provider_id,
            email=item.email,
        )
