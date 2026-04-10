from __future__ import annotations

import re
from datetime import datetime, timezone
from typing import Any


SUPPORTED_SETTINGS_CATEGORIES = {
    "account",
    "security",
    "privacy",
    "verification",
    "notifications",
    "communication-preferences",
    "appearance",
    "accessibility",
    "sessions",
    "devices",
    "linked-accounts",
    "connected-apps",
    "integrations",
    "api-webhooks",
    "billing",
    "plans-upgrades",
    "usage-limits",
    "storage",
    "backups",
    "activity",
    "audit-logs",
    "security-logs",
    "region",
    "workspace-branding",
    "ai-preferences",
    "roles-permissions",
    "team-management",
    "admin-controls",
    "compliance",
    "consent",
    "legal",
    "support",
    "support-tickets",
    "release-notes",
    "system-status",
    "experiments",
    "labs-beta-features",
    "data-export",
    "danger-zone",
    "chat-security",
    "chat-notifications",
    "chat-privacy",
    "chat-preferences",
    "chat-storage",
}

SENSITIVE_SETTINGS_CATEGORIES = {
    "security",
    "privacy",
    "sessions",
    "devices",
    "linked-accounts",
    "connected-apps",
    "integrations",
    "api-webhooks",
    "compliance",
    "consent",
    "legal",
    "danger-zone",
    "chat-security",
    "chat-privacy",
}

_SETTINGS_KEY_PATTERN = re.compile(r"^[A-Za-z][A-Za-z0-9_-]{0,63}$")

STRUCTURED_FORM_DEFAULTS = {
    "security": {
        "twoStepEnabled": False,
    },
    "privacy": {
        "allowAdPersonalization": False,
        "enableCookieTracking": True,
    },
    "notifications": {
        "emailAlerts": True,
        "smsNotifications": False,
        "inAppAlerts": True,
    },
    "region": {
        "timezone": "Asia/Kolkata",
        "dateFormat": "DD/MM/YYYY",
        "country": "India",
    },
    "appearance": {
        "theme": "Light",
        "language": "English",
        "fontSize": "Medium",
    },
    "chat-security": {
        "twoStepEnabled": False,
        "otpChannel": "sms",
    },
    "chat-notifications": {
        "messageNotifications": True,
        "groupNotifications": True,
        "communityNotifications": True,
        "inAppToasts": True,
    },
    "chat-privacy": {
        "lastSeenVisibility": "contacts",
        "profileVisibility": "contacts",
        "readReceiptsEnabled": True,
    },
    "chat-preferences": {
        "autoDownloadMedia": True,
        "autoDownloadPhotos": True,
        "autoDownloadVideos": False,
        "autoDownloadFiles": False,
    },
    "chat-storage": {
        "mediaCleanupWarnings": True,
        "keepArchivedChatsVisible": False,
    },
}

STRUCTURED_SELECT_OPTIONS = {
    "appearance": {
        "theme": {"Light", "Dark", "System"},
        "fontSize": {"Small", "Medium", "Large"},
    },
    "chat-security": {
        "otpChannel": {"sms", "email"},
    },
    "chat-privacy": {
        "lastSeenVisibility": {"everyone", "contacts", "nobody"},
        "profileVisibility": {"everyone", "contacts", "nobody"},
    },
}


def _coerce_bool(value: Any, default: bool = False) -> bool:
    if isinstance(value, bool):
        return value
    if isinstance(value, str):
        normalized = value.strip().lower()
        if normalized in {"true", "1", "yes", "enabled", "on"}:
            return True
        if normalized in {"false", "0", "no", "disabled", "off"}:
            return False
    if isinstance(value, (int, float)):
        return bool(value)
    return default


def _coerce_text(value: Any, default: str = "", max_length: int = 160) -> str:
    if value is None:
        return default
    text_value = str(value).strip()
    if not text_value:
        return default
    return text_value[:max_length]


def _coerce_timestamp(value: Any) -> str:
    if isinstance(value, str):
        text_value = value.strip()
        if text_value:
            return text_value[:40]
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def _sanitize_scalar(value: Any) -> str | bool | int | float | None:
    if value is None:
        return None
    if isinstance(value, bool):
        return value
    if isinstance(value, int) and not isinstance(value, bool):
        return max(min(value, 1_000_000), -1_000_000)
    if isinstance(value, float):
        return max(min(value, 1_000_000.0), -1_000_000.0)
    return _coerce_text(value, default="", max_length=240)


def _sanitize_generic_values(raw_payload: Any) -> dict:
    source = raw_payload
    if isinstance(raw_payload, dict) and isinstance(raw_payload.get("values"), dict):
        source = raw_payload.get("values")
    if not isinstance(source, dict):
        source = {}

    cleaned: dict[str, str | bool | int | float | None] = {}
    for key, value in list(source.items())[:60]:
        if not isinstance(key, str):
            continue
        normalized_key = key.strip()
        if not normalized_key or not _SETTINGS_KEY_PATTERN.match(normalized_key):
            continue
        cleaned[normalized_key] = _sanitize_scalar(value)
    return cleaned


def _normalize_structured_form(category: str, raw_payload: Any) -> dict:
    defaults = STRUCTURED_FORM_DEFAULTS[category]
    source = raw_payload if isinstance(raw_payload, dict) else {}
    form_source = source.get("form") if isinstance(source.get("form"), dict) else source
    value_source = source.get("values") if isinstance(source.get("values"), dict) else {}

    cleaned_form = {}
    for key, default_value in defaults.items():
        candidate = form_source.get(key, value_source.get(key, default_value))
        if isinstance(default_value, bool):
            cleaned_form[key] = _coerce_bool(candidate, default_value)
            continue

        text_value = _coerce_text(candidate, default=str(default_value), max_length=120)
        allowed_values = STRUCTURED_SELECT_OPTIONS.get(category, {}).get(key)
        if allowed_values and text_value not in allowed_values:
            text_value = str(default_value)
        cleaned_form[key] = text_value

    return {
        "form": cleaned_form,
        "values": dict(cleaned_form),
    }


def _normalize_activity_payload(raw_payload: Any) -> dict:
    source = raw_payload if isinstance(raw_payload, dict) else {}
    entries = source.get("entries")
    if not isinstance(entries, list):
        entries = []

    normalized_entries = []
    for index, item in enumerate(entries[:50]):
        if not isinstance(item, dict):
            continue
        text_value = _coerce_text(item.get("text"), default="", max_length=260)
        if not text_value:
            continue
        identifier = _coerce_text(item.get("id"), default=f"activity-{index}", max_length=80)
        normalized_entries.append(
            {
                "id": identifier,
                "text": text_value,
                "createdAt": _coerce_timestamp(item.get("createdAt")),
            }
        )

    return {"entries": normalized_entries}


def build_default_settings_payload(category: str) -> dict:
    normalized_category = (category or "").strip().lower()
    if normalized_category not in SUPPORTED_SETTINGS_CATEGORIES:
        raise ValueError("Unsupported settings category.")
    if normalized_category in STRUCTURED_FORM_DEFAULTS:
        return _normalize_structured_form(normalized_category, {})
    if normalized_category == "activity":
        return {"entries": []}
    return {"values": {}}


def normalize_settings_category_payload(category: str, raw_payload: Any) -> dict:
    normalized_category = (category or "").strip().lower()
    if normalized_category not in SUPPORTED_SETTINGS_CATEGORIES:
        raise ValueError("Unsupported settings category.")
    if normalized_category in STRUCTURED_FORM_DEFAULTS:
        return _normalize_structured_form(normalized_category, raw_payload)
    if normalized_category == "activity":
        return _normalize_activity_payload(raw_payload)
    return {"values": _sanitize_generic_values(raw_payload)}


def summarize_settings_payload(payload: dict) -> str:
    if not isinstance(payload, dict):
        return "No saved values"
    if isinstance(payload.get("entries"), list):
        entry_count = len(payload["entries"])
        return f"{entry_count} activity entr{'y' if entry_count == 1 else 'ies'}"
    if isinstance(payload.get("form"), dict):
        configured = 0
        for value in payload["form"].values():
            if isinstance(value, bool):
                configured += 1 if value else 0
            elif value not in {None, ""}:
                configured += 1
        return f"{configured} configured form value{'s' if configured != 1 else ''}"
    if isinstance(payload.get("values"), dict):
        configured = 0
        for value in payload["values"].values():
            if isinstance(value, bool):
                configured += 1 if value else 0
            elif value not in {None, ""}:
                configured += 1
        return f"{configured} configured saved value{'s' if configured != 1 else ''}"
    return "No saved values"
