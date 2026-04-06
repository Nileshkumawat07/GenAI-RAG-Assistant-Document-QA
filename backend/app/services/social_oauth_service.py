from __future__ import annotations

import base64
import hashlib
import hmac
import json
import os
import time
from dataclasses import dataclass
from urllib.parse import urlencode

import requests
from sqlalchemy import select
from sqlalchemy.orm import Session

from app.core.config import FRONTEND_ORIGIN
from app.models.social_oauth_config import SocialOAuthConfig


class SocialOAuthServiceError(RuntimeError):
    """Raised when a social provider OAuth request cannot be completed."""


@dataclass
class SocialProviderProfile:
    provider_key: str
    provider_id: str
    email: str
    display_name: str
    provider_user_id: str
    frontend_origin: str


class SocialOAuthService:
    def __init__(self) -> None:
        self._state_secret = (
            os.getenv("SOCIAL_OAUTH_STATE_SECRET")
            or os.getenv("AUTH_TOKEN_SECRET")
            or os.getenv("SECRET_KEY")
            or "genai-workspace-social-oauth-secret"
        ).encode("utf-8")
        self._state_ttl_seconds = int(os.getenv("SOCIAL_OAUTH_STATE_TTL_SECONDS", "600"))
        self._provider_defaults = {
            "facebook": {
                "provider_id": "facebook.com",
                "authorize_url": "https://www.facebook.com/v19.0/dialog/oauth",
                "token_url": "https://graph.facebook.com/v19.0/oauth/access_token",
                "profile_url": "https://graph.facebook.com/me",
                "scope": "email,public_profile",
            },
            "linkedin": {
                "provider_id": "linkedin.com",
                "authorize_url": "https://www.linkedin.com/oauth/v2/authorization",
                "token_url": "https://www.linkedin.com/oauth/v2/accessToken",
                "profile_url": "https://api.linkedin.com/v2/userinfo",
                "scope": "openid profile email",
            },
        }

    def create_authorize_url(
        self,
        db: Session,
        *,
        provider_key: str,
        user_id: str,
        frontend_origin: str,
        callback_url: str,
    ) -> str:
        normalized_key = provider_key.strip().lower()
        provider_config = self._get_provider_config(db, normalized_key)
        if not provider_config:
            raise SocialOAuthServiceError("Unsupported provider.")

        normalized_origin = (frontend_origin or FRONTEND_ORIGIN).strip().rstrip("/")
        if not normalized_origin.startswith("http://") and not normalized_origin.startswith("https://"):
            raise SocialOAuthServiceError("Invalid frontend origin.")

        state = self._sign_state(
            {
                "u": user_id,
                "p": normalized_key,
                "o": normalized_origin,
                "e": int(time.time()) + self._state_ttl_seconds,
            }
        )
        query = {
            "client_id": provider_config["client_id"],
            "redirect_uri": callback_url,
            "response_type": "code",
            "state": state,
            "scope": provider_config["scope"],
        }
        return f"{provider_config['authorize_url']}?{urlencode(query)}"

    def complete_callback(
        self,
        db: Session,
        *,
        provider_key: str,
        code: str,
        state: str,
        callback_url: str,
    ) -> SocialProviderProfile:
        payload = self._verify_state(state)
        normalized_key = provider_key.strip().lower()
        if payload["p"] != normalized_key:
            raise SocialOAuthServiceError("OAuth callback provider does not match the request.")

        provider_config = self._get_provider_config(db, normalized_key)
        if not provider_config:
            raise SocialOAuthServiceError("Unsupported provider.")

        access_token = self._exchange_code(
            provider_key=normalized_key,
            code=code,
            redirect_uri=callback_url,
            token_url=provider_config["token_url"],
            client_id=provider_config["client_id"],
            client_secret=provider_config["client_secret"],
        )
        return self._fetch_profile(
            provider_key=normalized_key,
            provider_id=provider_config["provider_id"],
            access_token=access_token,
            frontend_origin=payload["o"],
            profile_url=provider_config["profile_url"],
        )

    def ensure_provider_rows(self, db: Session) -> None:
        for provider_key in self._provider_defaults:
            existing = db.execute(
                select(SocialOAuthConfig).where(SocialOAuthConfig.provider_key == provider_key)
            ).scalar_one_or_none()
            if existing:
                continue
            db.add(
                SocialOAuthConfig(
                    provider_key=provider_key,
                    client_id="",
                    client_secret="",
                    is_enabled=False,
                )
            )
        db.commit()

    def build_popup_response_html(self, *, provider_key: str, payload: dict, success: bool) -> str:
        message = {
            "source": "provider-link",
            "success": success,
            "providerKey": provider_key,
            **payload,
        }
        return f"""<!doctype html>
<html>
  <head>
    <meta charset="utf-8" />
    <title>Provider Linking</title>
  </head>
  <body>
    <script>
      (function() {{
        var message = {json.dumps(message)};
        var targetOrigin = message.frontendOrigin || "*";
        if (window.opener && !window.opener.closed) {{
          window.opener.postMessage(message, targetOrigin);
        }}
        window.close();
      }})();
    </script>
    <p>You can close this window.</p>
  </body>
</html>"""

    def _exchange_code(
        self,
        *,
        provider_key: str,
        code: str,
        redirect_uri: str,
        token_url: str,
        client_id: str,
        client_secret: str,
    ) -> str:
        if provider_key == "facebook":
            response = requests.get(
                token_url,
                params={
                    "client_id": client_id,
                    "client_secret": client_secret,
                    "redirect_uri": redirect_uri,
                    "code": code,
                },
                timeout=20,
            )
        else:
            response = requests.post(
                token_url,
                data={
                    "grant_type": "authorization_code",
                    "code": code,
                    "redirect_uri": redirect_uri,
                    "client_id": client_id,
                    "client_secret": client_secret,
                },
                timeout=20,
            )

        data = self._read_json(response, "token exchange")
        access_token = (data.get("access_token") or "").strip()
        if not access_token:
            raise SocialOAuthServiceError("Provider did not return an access token.")
        return access_token

    def _fetch_profile(
        self,
        *,
        provider_key: str,
        provider_id: str,
        access_token: str,
        frontend_origin: str,
        profile_url: str,
    ) -> SocialProviderProfile:
        if provider_key == "facebook":
            response = requests.get(
                profile_url,
                params={
                    "fields": "id,name,email",
                    "access_token": access_token,
                },
                timeout=20,
            )
        else:
            response = requests.get(
                profile_url,
                headers={"Authorization": f"Bearer {access_token}"},
                timeout=20,
            )

        data = self._read_json(response, "profile fetch")
        email = (data.get("email") or data.get("emailAddress") or "").strip().lower()
        display_name = (
            data.get("name")
            or data.get("localizedFirstName")
            or data.get("displayName")
            or ""
        ).strip()
        provider_user_id = (
            data.get("id")
            or data.get("sub")
            or data.get("user_id")
            or ""
        ).strip()

        if not email:
            raise SocialOAuthServiceError("The provider did not return an email address for this account.")
        if not display_name:
            display_name = email.split("@", 1)[0]
        if not provider_user_id:
            raise SocialOAuthServiceError("The provider did not return an account identifier.")

        return SocialProviderProfile(
            provider_key=provider_key,
            provider_id=provider_id,
            email=email,
            display_name=display_name,
            provider_user_id=provider_user_id,
            frontend_origin=frontend_origin,
        )

    def _get_provider_config(self, db: Session, provider_key: str) -> dict:
        provider_defaults = self._provider_defaults.get(provider_key)
        if not provider_defaults:
            return {}

        config = db.execute(
            select(SocialOAuthConfig).where(SocialOAuthConfig.provider_key == provider_key)
        ).scalar_one_or_none()
        if not config or not config.is_enabled:
            raise SocialOAuthServiceError(f"{provider_key.title()} linking is not configured in MySQL yet.")
        if not config.client_id.strip() or not config.client_secret.strip():
            raise SocialOAuthServiceError(f"{provider_key.title()} OAuth credentials are missing in MySQL.")

        return {
            **provider_defaults,
            "client_id": config.client_id.strip(),
            "client_secret": config.client_secret.strip(),
        }

    def _sign_state(self, payload: dict) -> str:
        payload_bytes = json.dumps(payload, separators=(",", ":"), sort_keys=True).encode("utf-8")
        payload_b64 = base64.urlsafe_b64encode(payload_bytes).decode("utf-8").rstrip("=")
        signature = hmac.new(self._state_secret, payload_bytes, hashlib.sha256).digest()
        signature_b64 = base64.urlsafe_b64encode(signature).decode("utf-8").rstrip("=")
        return f"{payload_b64}.{signature_b64}"

    def _verify_state(self, state: str) -> dict:
        try:
            payload_b64, signature_b64 = state.split(".", 1)
            payload_bytes = base64.urlsafe_b64decode(self._restore_padding(payload_b64))
            signature = base64.urlsafe_b64decode(self._restore_padding(signature_b64))
        except Exception as exc:
            raise SocialOAuthServiceError("Invalid OAuth state.") from exc

        expected_signature = hmac.new(self._state_secret, payload_bytes, hashlib.sha256).digest()
        if not hmac.compare_digest(signature, expected_signature):
            raise SocialOAuthServiceError("Invalid OAuth state.")

        payload = json.loads(payload_bytes.decode("utf-8"))
        if int(payload.get("e", 0)) < int(time.time()):
            raise SocialOAuthServiceError("OAuth session expired. Please try linking again.")
        return payload

    @staticmethod
    def _read_json(response: requests.Response, action: str) -> dict:
        try:
            data = response.json()
        except Exception as exc:
            raise SocialOAuthServiceError(f"Provider {action} failed.") from exc

        if not response.ok:
            message = (
                data.get("error_description")
                or data.get("error", {}).get("message")
                or data.get("message")
                or f"Provider {action} failed."
            )
            raise SocialOAuthServiceError(message)
        return data

    @staticmethod
    def _restore_padding(value: str) -> bytes:
        return (value + "=" * (-len(value) % 4)).encode("utf-8")
