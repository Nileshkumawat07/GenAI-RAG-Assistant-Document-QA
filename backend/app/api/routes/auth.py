import csv
import hashlib
import json
import secrets
from io import BytesIO, StringIO

from datetime import datetime, timezone

from sqlalchemy.orm import Session
from sqlalchemy import delete, inspect, select, text

from fastapi import APIRouter, Depends, Header, HTTPException, Request
from fastapi.responses import HTMLResponse, StreamingResponse
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.units import mm
from reportlab.pdfgen import canvas

from app.core.database import engine, get_db
from app.core.settings_registry import (
    SENSITIVE_SETTINGS_CATEGORIES,
    build_default_settings_payload,
    normalize_settings_category_payload,
    summarize_settings_payload,
)
from app.models.admin_audit_log import AdminAuditLog
from app.models.contact_request import ContactRequest
from app.models.linked_provider import UserSocialLink
from app.models.security_event import SecurityEvent
from app.models.subscription_transaction import SubscriptionTransaction
from app.models.user import User
from app.models.user_login_session import UserLoginSession
from app.models.user_setting import UserSetting
from app.schemas.auth import (
    AuthUserResponse,
    ChangePasswordRequest,
    CheckEmailVerificationRequest,
    DeviceItemResponse,
    DeleteAccountRequest,
    DownloadAccountDataRequest,
    LoginRequest,
    ResetSettingsRequest,
    SendEmailVerificationRequest,
    SecurityEventResponse,
    SessionItemResponse,
    SignupRequest,
    SettingsCategoryResponse,
    UpdateManagementAccessRequest,
    UpdateEmailRequest,
    UpdateMobileRequest,
    UpdateProfileRequest,
    UpdateSettingsCategoryRequest,
    UpdateUsernameRequest,
)
from app.services.admin_audit_service import AdminAuditService
from app.services.auth_service import AuthService, AuthServiceError
from app.services.contact_request_service import ContactRequestService
from app.services.otp_service import OTPService, OTPServiceError
from app.services.subscription_transaction_service import SubscriptionTransactionService


def build_auth_router(otp_service: OTPService, auth_service: AuthService) -> APIRouter:
    router = APIRouter(prefix="/auth", tags=["auth"])
    admin_audit_service = AdminAuditService()
    contact_request_service = ContactRequestService()
    transaction_service = SubscriptionTransactionService()

    def extract_client_ip(request: Request) -> str | None:
        forwarded = request.headers.get("x-forwarded-for", "").strip()
        if forwarded:
            return forwarded.split(",", 1)[0].strip()
        if request.client and request.client.host:
            return request.client.host
        return None

    def extract_browser_name(user_agent: str | None) -> str | None:
        text_value = (user_agent or "").lower()
        if "edg/" in text_value:
            return "Microsoft Edge"
        if "chrome/" in text_value and "edg/" not in text_value:
            return "Google Chrome"
        if "firefox/" in text_value:
            return "Mozilla Firefox"
        if "safari/" in text_value and "chrome/" not in text_value:
            return "Safari"
        return "Unknown browser" if text_value else None

    def extract_os_name(user_agent: str | None) -> str | None:
        text_value = (user_agent or "").lower()
        if "windows" in text_value:
            return "Windows"
        if "android" in text_value:
            return "Android"
        if "iphone" in text_value or "ipad" in text_value or "ios" in text_value:
            return "iOS"
        if "mac os" in text_value or "macintosh" in text_value:
            return "macOS"
        if "linux" in text_value:
            return "Linux"
        return "Unknown OS" if text_value else None

    def extract_device_type(user_agent: str | None) -> str:
        text_value = (user_agent or "").lower()
        if "mobile" in text_value or "android" in text_value or "iphone" in text_value:
            return "mobile"
        if "ipad" in text_value or "tablet" in text_value:
            return "tablet"
        return "desktop"

    def build_device_label(browser_name: str | None, os_name: str | None, device_type: str) -> str:
        parts = [part for part in [browser_name, os_name] if part and not part.startswith("Unknown")]
        if parts:
            return " on ".join(parts[:2])
        return "Mobile device" if device_type == "mobile" else "Desktop device"

    def build_device_group_key(
        device_label: str | None,
        device_type: str | None,
        browser_name: str | None,
        os_name: str | None,
    ) -> str:
        raw = "|".join(
            [
                (device_label or "").strip().lower(),
                (device_type or "").strip().lower(),
                (browser_name or "").strip().lower(),
                (os_name or "").strip().lower(),
            ]
        )
        return hashlib.sha1(raw.encode("utf-8")).hexdigest()

    def serialize_datetime_utc(value: datetime | None) -> str | None:
        if not value:
            return None
        if value.tzinfo is None:
            value = value.replace(tzinfo=timezone.utc)
        else:
            value = value.astimezone(timezone.utc)
        return value.isoformat().replace("+00:00", "Z")

    def serialize_session_item(item: UserLoginSession, current_token_id: str | None = None) -> SessionItemResponse:
        return SessionItemResponse(
            id=item.id,
            deviceLabel=item.device_label,
            deviceType=item.device_type,
            browserName=item.browser_name,
            osName=item.os_name,
            ipAddress=item.ip_address,
            locationLabel=item.location_label,
            rememberDevice=bool(item.remember_device),
            trusted=bool(item.trusted),
            isCurrent=bool(current_token_id and item.token_id == current_token_id and not item.is_revoked),
            isRevoked=bool(item.is_revoked),
            createdAt=serialize_datetime_utc(item.created_at),
            lastSeenAt=serialize_datetime_utc(item.last_seen_at),
            revokedAt=serialize_datetime_utc(item.revoked_at),
        )

    def serialize_security_event(item: SecurityEvent) -> SecurityEventResponse:
        return SecurityEventResponse(
            id=item.id,
            eventType=item.event_type,
            severity=item.severity,
            ipAddress=item.ip_address,
            deviceLabel=item.device_label,
            detail=item.detail,
            createdAt=serialize_datetime_utc(item.created_at),
        )

    def serialize_device_items(
        items: list[UserLoginSession],
        current_token_id: str | None = None,
        *,
        include_removed: bool = False,
    ) -> list[DeviceItemResponse]:
        grouped: dict[str, list[UserLoginSession]] = {}
        for item in items:
            device_key = build_device_group_key(item.device_label, item.device_type, item.browser_name, item.os_name)
            grouped.setdefault(device_key, []).append(item)

        device_rows = []
        for device_key, sessions in grouped.items():
            active_sessions = [entry for entry in sessions if not entry.is_revoked]
            revoked_sessions = [entry for entry in sessions if entry.is_revoked]
            if not active_sessions and not (include_removed and revoked_sessions):
                continue

            if active_sessions:
                ordered = sorted(
                    active_sessions,
                    key=lambda entry: entry.last_seen_at or datetime.min.replace(tzinfo=timezone.utc),
                    reverse=True,
                )
                current_session = next(
                    (
                        entry
                        for entry in ordered
                        if current_token_id and entry.token_id == current_token_id and not entry.is_revoked
                    ),
                    None,
                )
                latest = current_session or ordered[0]
                device_rows.append(
                    DeviceItemResponse(
                        id=device_key,
                        deviceLabel=latest.device_label,
                        deviceType=latest.device_type,
                        browserName=latest.browser_name,
                        osName=latest.os_name,
                        trusted=any(bool(entry.trusted) for entry in active_sessions),
                        isCurrent=any(bool(current_token_id and entry.token_id == current_token_id and not entry.is_revoked) for entry in active_sessions),
                        isRemoved=False,
                        sessionCount=len(active_sessions),
                        lastSeenAt=serialize_datetime_utc(latest.last_seen_at),
                        removedAt=None,
                        ipAddress=latest.ip_address,
                        locationLabel=latest.location_label,
                    )
                )

            elif include_removed:
                ordered_removed = sorted(
                    revoked_sessions,
                    key=lambda entry: (
                        entry.revoked_at or entry.last_seen_at or entry.created_at or datetime.min.replace(tzinfo=timezone.utc)
                    ),
                    reverse=True,
                )
                latest_removed = ordered_removed[0]
                device_rows.append(
                    DeviceItemResponse(
                        id=device_key,
                        deviceLabel=latest_removed.device_label,
                        deviceType=latest_removed.device_type,
                        browserName=latest_removed.browser_name,
                        osName=latest_removed.os_name,
                        trusted=False,
                        isCurrent=False,
                        isRemoved=True,
                        sessionCount=len(revoked_sessions),
                        lastSeenAt=serialize_datetime_utc(latest_removed.last_seen_at),
                        removedAt=serialize_datetime_utc(latest_removed.revoked_at or latest_removed.last_seen_at),
                        ipAddress=latest_removed.ip_address,
                        locationLabel=latest_removed.location_label,
                    )
                )
        def sortable_row_timestamp(row: DeviceItemResponse) -> datetime:
            raw_value = row.removedAt or row.lastSeenAt
            if not raw_value:
                return datetime(1970, 1, 1, tzinfo=timezone.utc)
            try:
                return datetime.fromisoformat(raw_value.replace("Z", "+00:00"))
            except ValueError:
                return datetime(1970, 1, 1, tzinfo=timezone.utc)

        device_rows.sort(
            key=lambda row: (
                0 if row.isCurrent else 1 if not row.isRemoved else 2,
                -(sortable_row_timestamp(row).timestamp()),
            )
        )
        return device_rows

    def ensure_runtime_login_session_schema(db: Session) -> None:
        bind = db.get_bind()
        inspector = inspect(bind)
        table_names = set(inspector.get_table_names())

        with bind.begin() as connection:
            if "user_login_sessions" not in table_names:
                connection.execute(
                    text(
                        "CREATE TABLE user_login_sessions ("
                        "id VARCHAR(36) PRIMARY KEY, "
                        "user_id VARCHAR(36) NOT NULL, "
                        "token_id VARCHAR(64) NOT NULL, "
                        "device_label VARCHAR(160) NOT NULL, "
                        "device_type VARCHAR(40) NOT NULL, "
                        "browser_name VARCHAR(80) NULL, "
                        "os_name VARCHAR(80) NULL, "
                        "user_agent VARCHAR(500) NULL, "
                        "ip_address VARCHAR(80) NULL, "
                        "location_label VARCHAR(120) NULL, "
                        "remember_device BOOLEAN NOT NULL DEFAULT FALSE, "
                        "trusted BOOLEAN NOT NULL DEFAULT FALSE, "
                        "is_revoked BOOLEAN NOT NULL DEFAULT FALSE, "
                        "created_at DATETIME NOT NULL, "
                        "last_seen_at DATETIME NOT NULL, "
                        "revoked_at DATETIME NULL)"
                    )
                )
                return

            existing_columns = {column["name"] for column in inspector.get_columns("user_login_sessions")}
            required_statements = {
                "user_id": "ALTER TABLE user_login_sessions ADD COLUMN user_id VARCHAR(36) NOT NULL DEFAULT ''",
                "token_id": "ALTER TABLE user_login_sessions ADD COLUMN token_id VARCHAR(64) NOT NULL DEFAULT ''",
                "device_label": "ALTER TABLE user_login_sessions ADD COLUMN device_label VARCHAR(160) NOT NULL DEFAULT 'Unknown device'",
                "device_type": "ALTER TABLE user_login_sessions ADD COLUMN device_type VARCHAR(40) NOT NULL DEFAULT 'desktop'",
                "browser_name": "ALTER TABLE user_login_sessions ADD COLUMN browser_name VARCHAR(80) NULL",
                "os_name": "ALTER TABLE user_login_sessions ADD COLUMN os_name VARCHAR(80) NULL",
                "user_agent": "ALTER TABLE user_login_sessions ADD COLUMN user_agent VARCHAR(500) NULL",
                "ip_address": "ALTER TABLE user_login_sessions ADD COLUMN ip_address VARCHAR(80) NULL",
                "location_label": "ALTER TABLE user_login_sessions ADD COLUMN location_label VARCHAR(120) NULL",
                "remember_device": "ALTER TABLE user_login_sessions ADD COLUMN remember_device BOOLEAN NOT NULL DEFAULT FALSE",
                "trusted": "ALTER TABLE user_login_sessions ADD COLUMN trusted BOOLEAN NOT NULL DEFAULT FALSE",
                "is_revoked": "ALTER TABLE user_login_sessions ADD COLUMN is_revoked BOOLEAN NOT NULL DEFAULT FALSE",
                "created_at": "ALTER TABLE user_login_sessions ADD COLUMN created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP",
                "last_seen_at": "ALTER TABLE user_login_sessions ADD COLUMN last_seen_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP",
                "revoked_at": "ALTER TABLE user_login_sessions ADD COLUMN revoked_at DATETIME NULL",
            }
            for column_name, statement in required_statements.items():
                if column_name in existing_columns:
                    continue
                connection.execute(text(statement))

    def ensure_runtime_security_event_schema(db: Session) -> None:
        bind = db.get_bind()
        inspector = inspect(bind)
        table_names = set(inspector.get_table_names())

        with bind.begin() as connection:
            if "security_events" not in table_names:
                connection.execute(
                    text(
                        "CREATE TABLE security_events ("
                        "id VARCHAR(36) PRIMARY KEY, "
                        "event_type VARCHAR(60) NOT NULL, "
                        "severity VARCHAR(20) NOT NULL, "
                        "actor_user_id VARCHAR(36) NULL, "
                        "ip_address VARCHAR(80) NULL, "
                        "device_label VARCHAR(160) NULL, "
                        "detail TEXT NULL, "
                        "created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP)"
                    )
                )
                return

            existing_columns = {column["name"] for column in inspector.get_columns("security_events")}
            required_statements = {
                "event_type": "ALTER TABLE security_events ADD COLUMN event_type VARCHAR(60) NOT NULL DEFAULT 'settings_update'",
                "severity": "ALTER TABLE security_events ADD COLUMN severity VARCHAR(20) NOT NULL DEFAULT 'info'",
                "actor_user_id": "ALTER TABLE security_events ADD COLUMN actor_user_id VARCHAR(36) NULL",
                "ip_address": "ALTER TABLE security_events ADD COLUMN ip_address VARCHAR(80) NULL",
                "device_label": "ALTER TABLE security_events ADD COLUMN device_label VARCHAR(160) NULL",
                "detail": "ALTER TABLE security_events ADD COLUMN detail TEXT NULL",
                "created_at": "ALTER TABLE security_events ADD COLUMN created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP",
            }
            for column_name, statement in required_statements.items():
                if column_name in existing_columns:
                    continue
                connection.execute(text(statement))

    def log_security_event(
        db: Session,
        *,
        event_type: str,
        severity: str = "info",
        actor_user_id: str | None = None,
        request: Request | None = None,
        detail: str | None = None,
        device_label: str | None = None,
    ) -> None:
        ensure_runtime_security_event_schema(db)
        user_agent = request.headers.get("user-agent") if request else None
        db.add(
            SecurityEvent(
                id=secrets.token_hex(18),
                event_type=(event_type or "settings_update")[:60],
                severity=(severity or "info")[:20],
                actor_user_id=actor_user_id,
                ip_address=extract_client_ip(request) if request else None,
                device_label=device_label or build_device_label(extract_browser_name(user_agent), extract_os_name(user_agent), extract_device_type(user_agent)),
                detail=(detail or "")[:1000] or None,
            )
        )

    def create_login_session(db: Session, user_id: str, request: Request) -> UserLoginSession | None:
        token_id = secrets.token_hex(24)
        user_agent = request.headers.get("user-agent")
        browser_name = extract_browser_name(user_agent)
        os_name = extract_os_name(user_agent)
        device_type = extract_device_type(user_agent)
        session = UserLoginSession(
            id=str(secrets.token_hex(18)),
            user_id=user_id,
            token_id=token_id,
            device_label=build_device_label(browser_name, os_name, device_type),
            device_type=device_type,
            browser_name=browser_name,
            os_name=os_name,
            user_agent=user_agent,
            ip_address=extract_client_ip(request),
            location_label="Current network",
            remember_device=False,
            trusted=False,
        )
        try:
            db.add(session)
            db.commit()
            db.refresh(session)
            try:
                log_security_event(
                    db,
                    event_type="session_created",
                    actor_user_id=user_id,
                    request=request,
                    detail=f"Signed in from {session.device_label}.",
                    device_label=session.device_label,
                )
                db.commit()
            except Exception:
                db.rollback()
            return session
        except Exception:
            db.rollback()
            try:
                ensure_runtime_login_session_schema(db)
                db.add(session)
                db.commit()
                db.refresh(session)
                try:
                    log_security_event(
                        db,
                        event_type="session_created",
                        actor_user_id=user_id,
                        request=request,
                        detail=f"Signed in from {session.device_label}.",
                        device_label=session.device_label,
                    )
                    db.commit()
                except Exception:
                    db.rollback()
                return session
            except Exception:
                db.rollback()
                return None

    def quote_identifier(identifier: str) -> str:
        return f"`{identifier.replace('`', '``')}`"

    def serialize_scalar(value):
        if value is None or isinstance(value, (bool, int, float, str)):
            return value
        if hasattr(value, "isoformat"):
            return value.isoformat()
        return str(value)

    def append_virtual_columns(columns, extra_columns: list[tuple[str, str]]):
        existing_names = {column["name"] for column in columns}
        for name, column_type in extra_columns:
            if name in existing_names:
                continue
            columns.append(
                {
                    "name": name,
                    "type": column_type,
                    "nullable": True,
                    "default": None,
                }
            )

    def draw_pdf_line(pdf, x_mm: float, y_mm: float, label: str, value: str, *, label_width_mm: float = 42) -> None:
        pdf.setFillColor(colors.HexColor("#5b6c82"))
        pdf.setFont("Helvetica-Bold", 9)
        pdf.drawString(x_mm * mm, y_mm * mm, label)
        pdf.setFillColor(colors.HexColor("#162033"))
        pdf.setFont("Helvetica", 9)
        pdf.drawString((x_mm + label_width_mm) * mm, y_mm * mm, value)

    def serialize_admin_audit_log(item: AdminAuditLog) -> dict:
        return {
            "id": item.id,
            "adminUserId": item.admin_user_id,
            "adminName": item.admin_name,
            "adminEmail": item.admin_email,
            "actionType": item.action_type,
            "targetType": item.target_type,
            "targetId": item.target_id,
            "targetLabel": item.target_label,
            "detail": item.detail,
            "createdAt": item.created_at.isoformat() if item.created_at else None,
        }

    def build_admin_renewal_reminders(db: Session) -> list[dict]:
        now = datetime.now(timezone.utc)
        users = db.execute(
            select(User)
            .where(
                User.subscription_status == "premium",
                User.subscription_expires_at.is_not(None),
            )
            .order_by(User.subscription_expires_at.asc())
        ).scalars().all()

        reminders = []
        for user in users:
            expires_at = user.subscription_expires_at
            if not expires_at:
                continue
            if expires_at.tzinfo is None:
                expires_at = expires_at.replace(tzinfo=timezone.utc)

            seconds_until_expiry = (expires_at - now).total_seconds()
            if seconds_until_expiry < 0 or seconds_until_expiry > 14 * 24 * 60 * 60:
                continue

            days_until_expiry = max(0, int(seconds_until_expiry // (24 * 60 * 60)))
            reminders.append(
                {
                    "userId": user.id,
                    "fullName": user.full_name,
                    "email": user.email,
                    "mobile": user.mobile,
                    "publicUserCode": user.public_user_code,
                    "subscriptionPlanName": user.subscription_plan_name,
                    "subscriptionStatus": user.subscription_status,
                    "subscriptionAmount": user.subscription_amount,
                    "subscriptionCurrency": user.subscription_currency,
                    "billingCycle": user.subscription_billing_cycle,
                    "expiresAt": expires_at.isoformat(),
                    "daysUntilExpiry": days_until_expiry,
                    "urgency": "critical" if days_until_expiry <= 2 else "warning" if days_until_expiry <= 7 else "upcoming",
                    "reminderLabel": (
                        "Expires today"
                        if days_until_expiry == 0
                        else f"Expires in {days_until_expiry} day{'s' if days_until_expiry != 1 else ''}"
                    ),
                }
            )

        return reminders

    def serialize_export_value(value):
        if isinstance(value, dict):
            return json.dumps(value, ensure_ascii=True)
        if isinstance(value, list):
            return json.dumps(value, ensure_ascii=True)
        if value is None:
            return ""
        return str(value)

    def build_admin_export_rows(db: Session, section: str, search: str | None = None) -> list[dict]:
        normalized_section = (section or "").strip().lower()
        normalized_search = (search or "").strip().lower()
        if normalized_section == "requests":
            records = db.execute(
                select(ContactRequest, User)
                .join(User, User.id == ContactRequest.user_id)
                .order_by(ContactRequest.created_at.desc())
            ).all()
            rows = [
                {
                    "id": item.id,
                    "requestCode": item.request_code,
                    "category": item.category,
                    "title": item.title,
                    "status": item.status,
                    "adminMessage": item.admin_message,
                    "createdAt": item.created_at.isoformat() if item.created_at else None,
                    "userId": item.user_id,
                    "userFullName": user.full_name if user else None,
                    "userEmail": user.email if user else None,
                    "userMobile": user.mobile if user else None,
                    "values": json.loads(item.payload_json),
                }
                for item, user in records
            ]
            if normalized_search:
                rows = [
                    row for row in rows
                    if normalized_search in json.dumps(row, ensure_ascii=True).lower()
                ]
            return rows
        if normalized_section == "audit":
            return [
                serialize_admin_audit_log(item)
                for item in admin_audit_service.list_recent_actions(db, limit=500)
            ]
        if normalized_section == "renewals":
            return build_admin_renewal_reminders(db)
        if normalized_section == "users":
            return [
                {
                    "id": item.id,
                    "publicUserCode": item.public_user_code,
                    "fullName": item.full_name,
                    "username": item.username,
                    "email": item.email,
                    "mobile": item.mobile,
                    "subscriptionPlanName": item.subscription_plan_name,
                    "subscriptionStatus": item.subscription_status,
                    "subscriptionExpiresAt": item.subscription_expires_at.isoformat() if item.subscription_expires_at else None,
                    "createdAt": item.created_at.isoformat() if item.created_at else None,
                }
                for item in db.execute(select(User).order_by(User.created_at.desc())).scalars().all()
            ]
        if normalized_section == "subscriptions":
            return [
                {
                    "invoiceNumber": item.invoice_number,
                    "transactionCode": item.transaction_code,
                    "userId": item.user_id,
                    "customerCode": item.customer_code,
                    "customerName": item.customer_name,
                    "customerEmail": item.customer_email,
                    "customerMobile": item.customer_mobile,
                    "planName": item.plan_name,
                    "amount": item.amount,
                    "currency": item.currency,
                    "billingCycle": item.billing_cycle,
                    "status": item.status,
                    "activatedAt": item.activated_at.isoformat() if item.activated_at else None,
                    "expiresAt": item.expires_at.isoformat() if item.expires_at else None,
                    "canceledAt": item.canceled_at.isoformat() if item.canceled_at else None,
                    "createdAt": item.created_at.isoformat() if item.created_at else None,
                }
                for item in transaction_service.list_transactions(db)
            ]
        raise HTTPException(status_code=400, detail="Unsupported admin export section.")

    def stream_admin_export(rows: list[dict], *, section: str, export_format: str) -> StreamingResponse:
        normalized_format = (export_format or "").strip().lower()
        if normalized_format == "json":
            payload = json.dumps(rows, ensure_ascii=True, indent=2).encode("utf-8")
            return StreamingResponse(
                BytesIO(payload),
                media_type="application/json",
                headers={"Content-Disposition": f'attachment; filename="admin-{section}.json"'},
            )

        if normalized_format != "csv":
            raise HTTPException(status_code=400, detail="Unsupported admin export format.")

        fieldnames = sorted({key for row in rows for key in row.keys()})
        csv_buffer = StringIO()
        writer = csv.DictWriter(csv_buffer, fieldnames=fieldnames)
        writer.writeheader()
        for row in rows:
            writer.writerow({key: serialize_export_value(value) for key, value in row.items()})

        return StreamingResponse(
            BytesIO(csv_buffer.getvalue().encode("utf-8")),
            media_type="text/csv",
            headers={"Content-Disposition": f'attachment; filename="admin-{section}.csv"'},
        )

    def resolve_login_session(
        db: Session,
        *,
        user_id: str,
        token_id: str | None,
        request: Request | None = None,
    ) -> UserLoginSession | None:
        if token_id:
            direct_match = db.execute(
                select(UserLoginSession).where(
                    UserLoginSession.user_id == user_id,
                    UserLoginSession.token_id == token_id,
                )
            ).scalar_one_or_none()
            if direct_match:
                return direct_match

        if request is None:
            return None

        active_sessions = db.execute(
            select(UserLoginSession)
            .where(
                UserLoginSession.user_id == user_id,
                UserLoginSession.is_revoked.is_(False),
            )
            .order_by(UserLoginSession.last_seen_at.desc(), UserLoginSession.created_at.desc())
        ).scalars().all()
        if not active_sessions:
            return None
        if len(active_sessions) == 1:
            return active_sessions[0]

        user_agent = request.headers.get("user-agent")
        client_ip = extract_client_ip(request)
        browser_name = extract_browser_name(user_agent)
        os_name = extract_os_name(user_agent)
        device_type = extract_device_type(user_agent)

        ranked_matches: list[tuple[int, UserLoginSession]] = []
        for session in active_sessions:
            score = 0
            if user_agent and session.user_agent == user_agent:
                score += 8
            if client_ip and session.ip_address == client_ip:
                score += 4
            if browser_name and session.browser_name == browser_name:
                score += 2
            if os_name and session.os_name == os_name:
                score += 2
            if device_type and session.device_type == device_type:
                score += 1
            if score > 0:
                ranked_matches.append((score, session))

        if not ranked_matches:
            return None

        ranked_matches.sort(
            key=lambda item: (
                item[0],
                item[1].last_seen_at or datetime.min.replace(tzinfo=timezone.utc),
                item[1].created_at or datetime.min.replace(tzinfo=timezone.utc),
            ),
            reverse=True,
        )
        return ranked_matches[0][1]

    def resolve_authenticated_session_context(
        authorization: str | None,
        db: Session,
        request: Request | None = None,
    ) -> tuple[str, str | None]:
        if not authorization or not authorization.startswith("Bearer "):
            raise HTTPException(status_code=401, detail="Missing authorization token.")

        token = authorization.split(" ", 1)[1].strip()
        if not token:
            raise HTTPException(status_code=401, detail="Missing authorization token.")

        try:
            user_id, token_id = auth_service.verify_access_token_details(token)
            login_session = resolve_login_session(db, user_id=user_id, token_id=token_id, request=request)
            if login_session and login_session.is_revoked:
                raise AuthServiceError("This session has been signed out.")
            if login_session:
                token_id = login_session.token_id
                login_session.last_seen_at = datetime.now(timezone.utc)
                db.commit()
            auth_service.get_user_by_id(db, user_id=user_id)
            return user_id, token_id
        except AuthServiceError as exc:
            raise HTTPException(status_code=401, detail=str(exc)) from exc

    def require_authenticated_user_id(
        request: Request,
        authorization: str | None = Header(default=None),
        db: Session = Depends(get_db),
    ) -> str:
        user_id, _ = resolve_authenticated_session_context(authorization, db, request)
        return user_id

    def get_authenticated_session_context(
        authorization: str | None,
        db: Session,
        request: Request | None = None,
    ) -> tuple[str, str | None]:
        return resolve_authenticated_session_context(authorization, db, request)

    def serialize_user(user, token_id: str | None = None):
        is_admin = auth_service.is_admin_email(user.email)
        is_management = bool(getattr(user, "is_management", False))
        return AuthUserResponse(
            id=user.id,
            fullName=user.full_name,
            username=user.username,
            dateOfBirth=user.date_of_birth,
            gender=user.gender,
            email=user.email,
            alternateEmail=user.alternate_email,
            mobile=user.mobile,
            securityQuestion=user.security_question,
            securityAnswer=user.security_answer,
            referralCode=user.referral_code,
            publicUserCode=user.public_user_code,
            bio=getattr(user, "bio", None),
            profileImageUrl=getattr(user, "profile_image_url", None),
            isManagement=is_management,
            managementAccessSuspended=bool(getattr(user, "management_access_suspended", False)),
            managementGrantedAt=getattr(user, "management_granted_at", None),
            managementGrantedByUserId=getattr(user, "management_granted_by_user_id", None),
            managementSuspendedAt=getattr(user, "management_suspended_at", None),
            managementSuspendedByUserId=getattr(user, "management_suspended_by_user_id", None),
            forcePasswordReset=bool(getattr(user, "force_password_reset", False)),
            emailVerified=user.email_verified,
            mobileVerified=user.mobile_verified,
            subscriptionPlanId=user.subscription_plan_id,
            subscriptionPlanName=user.subscription_plan_name,
            subscriptionStatus=user.subscription_status,
            subscriptionAmount=user.subscription_amount,
            subscriptionCurrency=user.subscription_currency,
            subscriptionBillingCycle=user.subscription_billing_cycle,
            subscriptionActivatedAt=user.subscription_activated_at,
            subscriptionExpiresAt=user.subscription_expires_at,
            createdAt=user.created_at,
            isAdmin=is_admin,
            mode="admin" if is_admin else "management" if is_management else "member",
            authToken=auth_service.create_access_token(user_id=user.id, token_id=token_id),
        )

    def serialize_settings_category(item: UserSetting | None, category: str) -> SettingsCategoryResponse:
        payload = build_default_settings_payload(category)
        updated_at = None
        if item:
            try:
                payload = normalize_settings_category_payload(category, json.loads(item.payload_json or "{}"))
            except (json.JSONDecodeError, ValueError):
                payload = build_default_settings_payload(category)
            updated_at = item.updated_at.isoformat() if item.updated_at else None
        return SettingsCategoryResponse(category=category, payload=payload, updatedAt=updated_at)

    @router.post("/signup", response_model=AuthUserResponse)
    def signup(payload: SignupRequest, request: Request, db: Session = Depends(get_db)):
        try:
            user = auth_service.register_user(
                db,
                full_name=payload.fullName,
                username=payload.username,
                date_of_birth=payload.dateOfBirth,
                gender=payload.gender,
                email=payload.email,
                alternate_email=payload.alternateEmail,
                mobile=payload.mobile,
                security_question=payload.securityQuestion,
                security_answer=payload.securityAnswer,
                referral_code=payload.referralCode,
                password=payload.password,
                email_verified=payload.emailVerified,
                mobile_verified=payload.mobileVerified,
            )
            login_session = create_login_session(db, user.id, request)
            return serialize_user(user, token_id=login_session.token_id if login_session else None)
        except AuthServiceError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @router.post("/login", response_model=AuthUserResponse)
    def login(payload: LoginRequest, request: Request, db: Session = Depends(get_db)):
        try:
            user = auth_service.authenticate_user(
                db,
                identifier=payload.identifier,
                password=payload.password,
            )
            login_session = create_login_session(db, user.id, request)
            return serialize_user(user, token_id=login_session.token_id if login_session else None)
        except AuthServiceError as exc:
            raise HTTPException(status_code=401, detail=str(exc)) from exc

    @router.get("/session/current", response_model=AuthUserResponse)
    def get_current_session_user(
        request: Request,
        authorization: str | None = Header(default=None),
        db: Session = Depends(get_db),
    ):
        try:
            authenticated_user_id, token_id = get_authenticated_session_context(authorization, db, request)
            user = auth_service.get_user_by_id(db, user_id=authenticated_user_id)
            return serialize_user(user, token_id=token_id)
        except AuthServiceError as exc:
            raise HTTPException(status_code=401, detail=str(exc)) from exc

    @router.post("/settings/username", response_model=AuthUserResponse)
    def update_username(
        payload: UpdateUsernameRequest,
        request: Request,
        authorization: str | None = Header(default=None),
        db: Session = Depends(get_db),
    ):
        try:
            authenticated_user_id, token_id = get_authenticated_session_context(authorization, db, request)
            if payload.userId != authenticated_user_id:
                raise HTTPException(status_code=403, detail="You can only update your own account.")
            user = auth_service.update_username(db, user_id=authenticated_user_id, new_username=payload.newUsername)
            log_security_event(
                db,
                event_type="username_updated",
                actor_user_id=authenticated_user_id,
                request=request,
                detail=f"Username changed to {user.username}.",
            )
            db.commit()
            return serialize_user(user, token_id=token_id)
        except AuthServiceError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @router.post("/settings/email", response_model=AuthUserResponse)
    def update_email(
        payload: UpdateEmailRequest,
        request: Request,
        authorization: str | None = Header(default=None),
        db: Session = Depends(get_db),
    ):
        try:
            authenticated_user_id, token_id = get_authenticated_session_context(authorization, db, request)
            if payload.userId != authenticated_user_id:
                raise HTTPException(status_code=403, detail="You can only update your own account.")
            user = auth_service.update_email(db, user_id=authenticated_user_id, new_email=payload.newEmail)
            log_security_event(
                db,
                event_type="email_updated",
                severity="warning",
                actor_user_id=authenticated_user_id,
                request=request,
                detail=f"Primary email changed to {user.email}.",
            )
            db.commit()
            return serialize_user(user, token_id=token_id)
        except AuthServiceError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @router.post("/settings/profile", response_model=AuthUserResponse)
    def update_profile(
        payload: UpdateProfileRequest,
        request: Request,
        authorization: str | None = Header(default=None),
        db: Session = Depends(get_db),
    ):
        try:
            authenticated_user_id, token_id = get_authenticated_session_context(authorization, db, request)
            if payload.userId != authenticated_user_id:
                raise HTTPException(status_code=403, detail="You can only update your own account.")
            user = auth_service.update_profile(
                db,
                user_id=authenticated_user_id,
                full_name=payload.fullName,
                date_of_birth=payload.dateOfBirth,
                gender=payload.gender,
                alternate_email=payload.alternateEmail,
                bio=payload.bio,
            )
            log_security_event(
                db,
                event_type="profile_updated",
                actor_user_id=authenticated_user_id,
                request=request,
                detail="Personal profile details were updated.",
            )
            db.commit()
            return serialize_user(user, token_id=token_id)
        except AuthServiceError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @router.post("/settings/mobile", response_model=AuthUserResponse)
    def update_mobile(
        payload: UpdateMobileRequest,
        request: Request,
        authorization: str | None = Header(default=None),
        db: Session = Depends(get_db),
    ):
        try:
            authenticated_user_id, token_id = get_authenticated_session_context(authorization, db, request)
            if payload.userId != authenticated_user_id:
                raise HTTPException(status_code=403, detail="You can only update your own account.")
            user = auth_service.update_mobile(db, user_id=authenticated_user_id, new_mobile=payload.newMobile)
            log_security_event(
                db,
                event_type="mobile_updated",
                severity="warning",
                actor_user_id=authenticated_user_id,
                request=request,
                detail=f"Primary mobile number changed to {user.mobile}.",
            )
            db.commit()
            return serialize_user(user, token_id=token_id)
        except AuthServiceError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @router.post("/settings/password")
    def change_password(
        payload: ChangePasswordRequest,
        request: Request,
        db: Session = Depends(get_db),
        authenticated_user_id: str = Depends(require_authenticated_user_id),
    ):
        try:
            if payload.userId != authenticated_user_id:
                raise HTTPException(status_code=403, detail="You can only update your own account.")
            auth_service.change_password(
                db,
                user_id=authenticated_user_id,
                current_password=payload.currentPassword,
                new_password=payload.newPassword,
            )
            log_security_event(
                db,
                event_type="password_changed",
                severity="warning",
                actor_user_id=authenticated_user_id,
                request=request,
                detail="Password was updated successfully.",
            )
            db.commit()
            return {"message": "Password updated successfully."}
        except AuthServiceError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @router.post("/settings/admin/management", response_model=AuthUserResponse)
    def update_management_access(
        payload: UpdateManagementAccessRequest,
        db: Session = Depends(get_db),
        authenticated_user_id: str = Depends(require_authenticated_user_id),
    ):
        try:
            if not auth_service.user_is_admin(db, user_id=authenticated_user_id):
                raise HTTPException(status_code=403, detail="Admin access is required.")
            user = auth_service.update_management_access(
                db,
                user_id=payload.userId,
                is_management=payload.isManagement,
                suspended=payload.suspended,
                changed_by_user_id=authenticated_user_id,
            )
            admin_audit_service.log_action(
                db,
                admin_user_id=authenticated_user_id,
                action_type="management_access_updated",
                target_type="user",
                target_id=user.id,
                target_label=user.public_user_code or user.username,
                detail=(
                    f"Management access {'enabled' if user.is_management else 'disabled'} "
                    f"for {user.full_name} ({user.email}). "
                    f"Suspended: {'yes' if user.management_access_suspended else 'no'}."
                ),
            )
            return serialize_user(user)
        except AuthServiceError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @router.get("/settings/sessions", response_model=list[SessionItemResponse])
    def list_user_sessions(
        request: Request,
        authorization: str | None = Header(default=None),
        db: Session = Depends(get_db),
    ):
        user_id, current_token_id = get_authenticated_session_context(authorization, db, request)
        rows = db.execute(
            select(UserLoginSession)
            .where(UserLoginSession.user_id == user_id)
            .order_by(UserLoginSession.last_seen_at.desc(), UserLoginSession.created_at.desc())
        ).scalars().all()
        return [serialize_session_item(item, current_token_id=current_token_id) for item in rows]

    @router.post("/settings/sessions/{session_id}/revoke")
    def revoke_user_session(
        session_id: str,
        request: Request,
        authorization: str | None = Header(default=None),
        db: Session = Depends(get_db),
    ):
        user_id, current_token_id = get_authenticated_session_context(authorization, db, request)
        session_row = db.execute(
            select(UserLoginSession).where(
                UserLoginSession.id == session_id,
                UserLoginSession.user_id == user_id,
            )
        ).scalar_one_or_none()
        if not session_row:
            raise HTTPException(status_code=404, detail="Session was not found.")
        if current_token_id and session_row.token_id == current_token_id:
            raise HTTPException(status_code=400, detail="Use sign out all from the current session, or keep the current session active.")
        session_row.is_revoked = True
        session_row.revoked_at = datetime.now(timezone.utc)
        log_security_event(
            db,
            event_type="session_revoked",
            severity="warning",
            actor_user_id=user_id,
            request=request,
            detail=f"Signed out session for {session_row.device_label}.",
            device_label=session_row.device_label,
        )
        db.commit()
        return {"message": "Session signed out successfully."}

    @router.post("/settings/sessions/revoke-all")
    def revoke_all_user_sessions(
        request: Request,
        authorization: str | None = Header(default=None),
        db: Session = Depends(get_db),
    ):
        user_id, current_token_id = get_authenticated_session_context(authorization, db, request)
        rows = db.execute(
            select(UserLoginSession).where(
                UserLoginSession.user_id == user_id,
                UserLoginSession.token_id != (current_token_id or ""),
                UserLoginSession.is_revoked.is_(False),
            )
        ).scalars().all()
        now = datetime.now(timezone.utc)
        for item in rows:
            item.is_revoked = True
            item.revoked_at = now
        log_security_event(
            db,
            event_type="all_other_sessions_revoked",
            severity="warning",
            actor_user_id=user_id,
            request=request,
            detail=f"Signed out {len(rows)} other active session{'s' if len(rows) != 1 else ''}.",
        )
        db.commit()
        return {"message": "Signed out all other sessions successfully."}

    @router.get("/settings/devices", response_model=list[DeviceItemResponse])
    def list_user_devices(
        request: Request,
        authorization: str | None = Header(default=None),
        db: Session = Depends(get_db),
    ):
        user_id, current_token_id = get_authenticated_session_context(authorization, db, request)
        rows = db.execute(
            select(UserLoginSession)
            .where(UserLoginSession.user_id == user_id)
            .order_by(UserLoginSession.last_seen_at.desc(), UserLoginSession.created_at.desc())
        ).scalars().all()
        return serialize_device_items(rows, current_token_id=current_token_id)

    @router.get("/settings/devices/history", response_model=list[DeviceItemResponse])
    def list_user_device_history(
        request: Request,
        authorization: str | None = Header(default=None),
        db: Session = Depends(get_db),
    ):
        user_id, current_token_id = get_authenticated_session_context(authorization, db, request)
        rows = db.execute(
            select(UserLoginSession)
            .where(UserLoginSession.user_id == user_id)
            .order_by(UserLoginSession.last_seen_at.desc(), UserLoginSession.created_at.desc())
        ).scalars().all()
        return [item for item in serialize_device_items(rows, current_token_id=current_token_id, include_removed=True) if item.isRemoved]

    @router.get("/settings/security-events", response_model=list[SecurityEventResponse])
    def list_user_security_events(
        request: Request,
        authorization: str | None = Header(default=None),
        db: Session = Depends(get_db),
    ):
        user_id, _ = get_authenticated_session_context(authorization, db, request)
        ensure_runtime_security_event_schema(db)
        rows = db.execute(
            select(SecurityEvent)
            .where(SecurityEvent.actor_user_id == user_id)
            .order_by(SecurityEvent.created_at.desc())
            .limit(80)
        ).scalars().all()
        return [serialize_security_event(item) for item in rows]

    @router.post("/settings/devices/{session_id}/remove")
    def remove_user_device(
        session_id: str,
        request: Request,
        authorization: str | None = Header(default=None),
        db: Session = Depends(get_db),
    ):
        user_id, current_token_id = get_authenticated_session_context(authorization, db, request)
        rows = db.execute(
            select(UserLoginSession).where(
                UserLoginSession.user_id == user_id,
                UserLoginSession.is_revoked.is_(False),
            )
        ).scalars().all()
        matching_sessions = [
            item
            for item in rows
            if build_device_group_key(item.device_label, item.device_type, item.browser_name, item.os_name) == session_id
        ]
        if not matching_sessions:
            raise HTTPException(status_code=404, detail="Device was not found.")
        if current_token_id and any(item.token_id == current_token_id for item in matching_sessions):
            raise HTTPException(status_code=400, detail="The current device cannot be removed from the active session.")
        now = datetime.now(timezone.utc)
        for item in matching_sessions:
            item.is_revoked = True
            item.revoked_at = now
            item.trusted = False
        log_security_event(
            db,
            event_type="device_removed",
            severity="warning",
            actor_user_id=user_id,
            request=request,
            detail=f"Removed device {matching_sessions[0].device_label} and signed out {len(matching_sessions)} session{'s' if len(matching_sessions) != 1 else ''}.",
            device_label=matching_sessions[0].device_label,
        )
        db.commit()
        return {"message": "Device removed successfully."}

    @router.get("/settings/categories/{category}", response_model=SettingsCategoryResponse)
    def get_settings_category(
        category: str,
        db: Session = Depends(get_db),
        authenticated_user_id: str = Depends(require_authenticated_user_id),
    ):
        normalized_category = category.strip().lower()
        try:
            build_default_settings_payload(normalized_category)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        item = db.execute(
            select(UserSetting).where(
                UserSetting.user_id == authenticated_user_id,
                UserSetting.category == normalized_category,
            )
        ).scalar_one_or_none()
        return serialize_settings_category(item, normalized_category)

    @router.post("/settings/categories/{category}", response_model=SettingsCategoryResponse)
    def save_settings_category(
        category: str,
        payload: UpdateSettingsCategoryRequest,
        request: Request,
        db: Session = Depends(get_db),
        authenticated_user_id: str = Depends(require_authenticated_user_id),
    ):
        normalized_category = category.strip().lower()
        if not normalized_category:
            raise HTTPException(status_code=400, detail="Settings category is required.")
        try:
            normalized_payload = normalize_settings_category_payload(normalized_category, payload.payload or {})
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

        item = db.execute(
            select(UserSetting).where(
                UserSetting.user_id == authenticated_user_id,
                UserSetting.category == normalized_category,
            )
        ).scalar_one_or_none()
        if not item:
            item = UserSetting(
                id=secrets.token_hex(18),
                user_id=authenticated_user_id,
                category=normalized_category,
            )
            db.add(item)

        item.payload_json = json.dumps(normalized_payload, ensure_ascii=True)
        item.updated_at = datetime.now(timezone.utc)
        log_security_event(
            db,
            event_type="settings_category_saved",
            severity="warning" if normalized_category in SENSITIVE_SETTINGS_CATEGORIES else "info",
            actor_user_id=authenticated_user_id,
            request=request,
            detail=f"Updated {normalized_category} settings with {summarize_settings_payload(normalized_payload)}.",
        )
        db.commit()
        db.refresh(item)
        return serialize_settings_category(item, normalized_category)

    @router.get("/settings/admin/mysql-overview")
    def admin_mysql_overview(
        db: Session = Depends(get_db),
        authenticated_user_id: str = Depends(require_authenticated_user_id),
    ):
        is_admin = auth_service.user_is_admin(db, user_id=authenticated_user_id)
        is_management = auth_service.user_is_management(db, user_id=authenticated_user_id)
        if not (is_admin or is_management):
            raise HTTPException(status_code=403, detail="Management access is required.")
        auth_service.sync_all_user_subscriptions(db)

        inspector = inspect(engine)
        tables = []

        with engine.connect() as connection:
            users_lookup = {}
            table_names = set(inspector.get_table_names())
            if "users" in table_names:
                raw_users = connection.execute(
                    text("SELECT id, full_name, username, email FROM users")
                ).mappings().all()
                users_lookup = {
                    serialize_scalar(row["id"]): {
                        "linked_user_name": serialize_scalar(row["full_name"]),
                        "linked_user_username": serialize_scalar(row["username"]),
                        "linked_user_email": serialize_scalar(row["email"]),
                        "is_admin": auth_service.is_admin_email(serialize_scalar(row["email"])),
                    }
                    for row in raw_users
                }

            allowed_table_names = set(inspector.get_table_names())
            if not is_admin:
                allowed_table_names &= {"users", "contact_requests", "user_social_links"}

            for table_name in sorted(allowed_table_names):
                quoted_table = quote_identifier(table_name)
                columns = [
                    {
                        "name": column["name"],
                        "type": str(column["type"]),
                        "nullable": column.get("nullable", True),
                        "default": serialize_scalar(column.get("default")),
                    }
                    for column in inspector.get_columns(table_name)
                ]
                total_rows = connection.execute(
                    text(f"SELECT COUNT(*) AS total FROM {quoted_table}")
                ).scalar_one()
                raw_rows = connection.execute(
                    text(f"SELECT * FROM {quoted_table} ORDER BY 1 DESC LIMIT 100")
                ).mappings().all()
                rows = [
                    {key: serialize_scalar(value) for key, value in row.items()}
                    for row in raw_rows
                ]

                if table_name in {"contact_requests", "user_social_links", "subscription_transactions"}:
                    append_virtual_columns(
                        columns,
                        [
                            ("linked_user_name", "VARCHAR"),
                            ("linked_user_username", "VARCHAR"),
                            ("linked_user_email", "VARCHAR"),
                        ],
                    )
                    for row in rows:
                        linked_user_id = serialize_scalar(row.get("user_id"))
                        user_details = users_lookup.get(linked_user_id, {})
                        row.update(user_details)
                if table_name == "users":
                    append_virtual_columns(
                        columns,
                        [
                            ("is_admin", "BOOLEAN"),
                            ("account_type", "VARCHAR"),
                        ],
                    )
                    for row in rows:
                        row["is_admin"] = auth_service.is_admin_email(serialize_scalar(row.get("email")))
                        row["account_type"] = "admin" if row["is_admin"] else "management" if row.get("is_management") else "member"

                tables.append(
                    {
                        "tableName": table_name,
                        "columns": columns,
                        "rowCount": total_rows,
                        "rows": rows,
                    }
                )

        audit_logs = [
            serialize_admin_audit_log(item)
            for item in admin_audit_service.list_recent_actions(db, limit=120)
        ]

        return {
                    "tables": tables,
                    "statusOptions": list(contact_request_service.STATUS_OPTIONS),
            "auditLogs": audit_logs if is_admin else [],
            "renewalReminders": build_admin_renewal_reminders(db) if is_admin else [],
            "generatedAt": datetime.now(timezone.utc).isoformat(),
        }

    @router.get("/settings/admin/export")
    def export_admin_data(
        section: str,
        format: str = "csv",
        search: str | None = None,
        db: Session = Depends(get_db),
        authenticated_user_id: str = Depends(require_authenticated_user_id),
    ):
        is_admin = auth_service.user_is_admin(db, user_id=authenticated_user_id)
        is_management = auth_service.user_is_management(db, user_id=authenticated_user_id)
        if not (is_admin or is_management):
            raise HTTPException(status_code=403, detail="Management access is required.")

        normalized_section = (section or "").strip().lower()
        if not is_admin and normalized_section != "requests":
            raise HTTPException(status_code=403, detail="Management can only export contact requests.")

        export_rows = build_admin_export_rows(db, normalized_section, search)
        admin_audit_service.log_action(
            db,
            admin_user_id=authenticated_user_id,
            action_type="admin_export_generated",
            target_type="admin_panel",
            target_id=normalized_section,
            target_label=normalized_section,
            detail=(
                f"Exported administration section '{normalized_section}' as {format.lower()}."
                if not (search or "").strip()
                else f"Exported administration section '{normalized_section}' as {format.lower()} with search '{search.strip()}'."
            ),
        )
        return stream_admin_export(export_rows, section=normalized_section, export_format=format)

    @router.post("/email/send-verification")
    def send_email_verification(payload: SendEmailVerificationRequest):
        try:
            otp_service.send_email_verification(payload.email)
            return {"message": "Verification email sent successfully."}
        except OTPServiceError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @router.post("/email/check-verification")
    def check_email_verification(payload: CheckEmailVerificationRequest):
        try:
            otp_service.verify_email_status(payload.email)
            return {"message": "Email verified successfully.", "verified": True}
        except OTPServiceError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @router.get("/email/confirm", response_class=HTMLResponse)
    def confirm_email_verification(token: str):
        try:
            destination = otp_service.confirm_email_verification(token)
            return HTMLResponse(
                content=(
                    "<html><body style=\"font-family:Arial,sans-serif;padding:32px;\">"
                    "<h2>Email verified successfully</h2>"
                    f"<p>{destination} is now verified for Unified AI Workspace.</p>"
                    "<p>You can return to the signup page and click Verify.</p>"
                    "</body></html>"
                )
            )
        except OTPServiceError as exc:
            return HTMLResponse(
                status_code=400,
                content=(
                    "<html><body style=\"font-family:Arial,sans-serif;padding:32px;\">"
                    "<h2>Email verification failed</h2>"
                    f"<p>{exc}</p>"
                    "</body></html>"
                ),
            )

    @router.post("/settings/data-export/pdf")
    def download_account_data_pdf(
        payload: DownloadAccountDataRequest,
        db: Session = Depends(get_db),
        authenticated_user_id: str = Depends(require_authenticated_user_id),
    ):
        try:
            auth_service.verify_account_password(db, user_id=authenticated_user_id, password=payload.password)
            user = auth_service._get_user_model_by_id(db, authenticated_user_id)
            exported_at = auth_service._serialize_user(user)
            linked_providers = db.execute(
                select(UserSocialLink).where(UserSocialLink.user_id == authenticated_user_id)
            ).scalars().all()
            contact_requests = db.execute(
                select(ContactRequest)
                .where(ContactRequest.user_id == authenticated_user_id)
                .order_by(ContactRequest.created_at.desc())
            ).scalars().all()
            transactions = db.execute(
                select(SubscriptionTransaction)
                .where(SubscriptionTransaction.user_id == authenticated_user_id)
                .order_by(SubscriptionTransaction.created_at.desc())
            ).scalars().all()

            buffer = BytesIO()
            pdf = canvas.Canvas(buffer, pagesize=A4)
            width, height = A4

            pdf.setFillColor(colors.HexColor("#0f2f63"))
            pdf.rect(0, height - 58 * mm, width, 58 * mm, fill=1, stroke=0)
            pdf.setFillColor(colors.white)
            pdf.setFont("Helvetica-Bold", 23)
            pdf.drawString(18 * mm, height - 20 * mm, "Account Data Export")
            pdf.setFont("Helvetica", 11)
            pdf.drawString(18 * mm, height - 28 * mm, "Unified AI Workspace")
            pdf.drawString(18 * mm, height - 35 * mm, f"Member #{user.public_user_code or 'Not available'}")
            pdf.drawString(18 * mm, height - 42 * mm, f"Exported on {datetime.utcnow().strftime('%d %b %Y %H:%M UTC')}")
            pdf.drawString(18 * mm, height - 49 * mm, f"Profile created {exported_at.created_at[:10]}")

            y_mm = 228
            pdf.setFillColor(colors.HexColor("#123d7a"))
            pdf.setFont("Helvetica-Bold", 13)
            pdf.drawString(18 * mm, y_mm * mm, "Profile Overview")
            y_mm -= 8
            draw_pdf_line(pdf, 18, y_mm, "Full Name", user.full_name)
            y_mm -= 7
            draw_pdf_line(pdf, 18, y_mm, "Username", user.username)
            y_mm -= 7
            draw_pdf_line(pdf, 18, y_mm, "Email", user.email)
            y_mm -= 7
            draw_pdf_line(pdf, 18, y_mm, "Mobile", user.mobile)
            y_mm -= 7
            draw_pdf_line(pdf, 18, y_mm, "Alternate Email", user.alternate_email or "Not provided")
            y_mm -= 7
            draw_pdf_line(pdf, 18, y_mm, "Referral Code", user.referral_code or "Not provided")
            y_mm -= 7
            draw_pdf_line(pdf, 18, y_mm, "Security Question", user.security_question or "Not provided")

            y_mm -= 14
            pdf.setFillColor(colors.HexColor("#123d7a"))
            pdf.setFont("Helvetica-Bold", 13)
            pdf.drawString(18 * mm, y_mm * mm, "Subscription Snapshot")
            y_mm -= 8
            draw_pdf_line(pdf, 18, y_mm, "Plan", user.subscription_plan_name or "Free Member")
            y_mm -= 7
            draw_pdf_line(pdf, 18, y_mm, "Status", (user.subscription_status or "free").title())
            y_mm -= 7
            draw_pdf_line(
                pdf,
                18,
                y_mm,
                "Billing",
                f"{user.subscription_currency or 'INR'} {(user.subscription_amount or 0) / 100:.0f} / {user.subscription_billing_cycle or 'monthly'}"
                if user.subscription_amount
                else "Free access",
            )
            y_mm -= 7
            draw_pdf_line(
                pdf,
                18,
                y_mm,
                "Validity",
                (
                    f"{user.subscription_activated_at.strftime('%d %b %Y')} to {user.subscription_expires_at.strftime('%d %b %Y')}"
                    if user.subscription_activated_at and user.subscription_expires_at
                    else "No active subscription"
                ),
            )

            y_mm -= 14
            pdf.setFillColor(colors.HexColor("#123d7a"))
            pdf.setFont("Helvetica-Bold", 13)
            pdf.drawString(18 * mm, y_mm * mm, "Linked Providers")
            y_mm -= 8
            if linked_providers:
                for provider in linked_providers[:5]:
                    draw_pdf_line(
                        pdf,
                        18,
                        y_mm,
                        provider.provider.title(),
                        f"{provider.email} | {provider.provider_id}",
                    )
                    y_mm -= 7
            else:
                draw_pdf_line(pdf, 18, y_mm, "Status", "No linked social providers")
                y_mm -= 7

            pdf.showPage()
            width, height = A4
            pdf.setFillColor(colors.HexColor("#f2f7ff"))
            pdf.rect(0, 0, width, height, fill=1, stroke=0)
            pdf.setFillColor(colors.HexColor("#16396f"))
            pdf.setFont("Helvetica-Bold", 16)
            pdf.drawString(18 * mm, height - 18 * mm, "Payment Lifecycle And Saved Billing Data")

            y_mm = 268
            if transactions:
                for transaction in transactions[:8]:
                    pdf.setFillColor(colors.white)
                    pdf.roundRect(16 * mm, (y_mm - 27) * mm, 178 * mm, 24 * mm, 3 * mm, fill=1, stroke=0)
                    pdf.setStrokeColor(colors.HexColor("#c9d8f5"))
                    pdf.roundRect(16 * mm, (y_mm - 27) * mm, 178 * mm, 24 * mm, 3 * mm, fill=0, stroke=1)
                    pdf.setFillColor(colors.HexColor("#123d7a"))
                    pdf.setFont("Helvetica-Bold", 11)
                    pdf.drawString(20 * mm, (y_mm - 8) * mm, f"Invoice #{transaction.invoice_number} | {transaction.plan_name}")
                    pdf.setFont("Helvetica", 9)
                    pdf.setFillColor(colors.HexColor("#162033"))
                    pdf.drawString(
                        20 * mm,
                        (y_mm - 15) * mm,
                        f"Txn {transaction.transaction_code} | Payment {transaction.razorpay_payment_id} | Order {transaction.razorpay_order_id}",
                    )
                    status_copy = transaction.status.title()
                    validity_copy = f"{transaction.activated_at.strftime('%d %b %Y')} to {transaction.expires_at.strftime('%d %b %Y')}"
                    amount_copy = f"{transaction.currency} {transaction.amount / 100:.0f} / {transaction.billing_cycle}"
                    pdf.drawString(20 * mm, (y_mm - 21) * mm, f"{status_copy} | {amount_copy} | {validity_copy}")
                    y_mm -= 31
                    if y_mm < 40:
                        pdf.showPage()
                        pdf.setFillColor(colors.HexColor("#f2f7ff"))
                        pdf.rect(0, 0, width, height, fill=1, stroke=0)
                        pdf.setFillColor(colors.HexColor("#16396f"))
                        pdf.setFont("Helvetica-Bold", 16)
                        pdf.drawString(18 * mm, height - 18 * mm, "Payment Lifecycle And Saved Billing Data")
                        y_mm = 268
            else:
                pdf.setFillColor(colors.HexColor("#162033"))
                pdf.setFont("Helvetica", 11)
                pdf.drawString(18 * mm, height - 30 * mm, "No verified payment records are available yet.")

            pdf.showPage()
            width, height = A4
            pdf.setFillColor(colors.white)
            pdf.rect(0, 0, width, height, fill=1, stroke=0)
            pdf.setFillColor(colors.HexColor("#16396f"))
            pdf.setFont("Helvetica-Bold", 16)
            pdf.drawString(18 * mm, height - 18 * mm, "Support And Request History")
            y_mm = 268
            if contact_requests:
                for item in contact_requests[:12]:
                    pdf.setFillColor(colors.HexColor("#123d7a"))
                    pdf.setFont("Helvetica-Bold", 11)
                    pdf.drawString(18 * mm, y_mm * mm, f"{item.title} ({item.category.title()})")
                    pdf.setFont("Helvetica", 9)
                    pdf.setFillColor(colors.HexColor("#162033"))
                    pdf.drawString(
                        18 * mm,
                        (y_mm - 6) * mm,
                        f"Code {item.request_code or 'Not available'} | Status {item.status} | {item.created_at.strftime('%d %b %Y %H:%M')}",
                    )
                    if item.admin_message:
                        pdf.drawString(18 * mm, (y_mm - 12) * mm, f"Admin note: {item.admin_message[:96]}")
                        y_mm -= 22
                    else:
                        y_mm -= 16
                    if y_mm < 28:
                        pdf.showPage()
                        pdf.setFillColor(colors.white)
                        pdf.rect(0, 0, width, height, fill=1, stroke=0)
                        pdf.setFillColor(colors.HexColor("#16396f"))
                        pdf.setFont("Helvetica-Bold", 16)
                        pdf.drawString(18 * mm, height - 18 * mm, "Support And Request History")
                        y_mm = 268
            else:
                pdf.setFillColor(colors.HexColor("#162033"))
                pdf.setFont("Helvetica", 11)
                pdf.drawString(18 * mm, height - 30 * mm, "No support or submitted request history is available yet.")

            pdf.save()
            buffer.seek(0)
            filename = f"account-data-{user.public_user_code or user.username}.pdf"
            return StreamingResponse(
                buffer,
                media_type="application/pdf",
                headers={"Content-Disposition": f'attachment; filename="{filename}"'},
            )
        except AuthServiceError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @router.post("/settings/reset")
    def reset_settings(
        payload: ResetSettingsRequest,
        request: Request,
        db: Session = Depends(get_db),
        authenticated_user_id: str = Depends(require_authenticated_user_id),
    ):
        try:
            auth_service.verify_account_password(db, user_id=authenticated_user_id, password=payload.password)
            db.execute(delete(UserSetting).where(UserSetting.user_id == authenticated_user_id))
            log_security_event(
                db,
                event_type="settings_reset",
                severity="warning",
                actor_user_id=authenticated_user_id,
                request=request,
                detail="All saved settings categories were reset to their defaults.",
            )
            db.commit()
            return {"message": "Saved settings reset successfully."}
        except AuthServiceError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @router.post("/settings/delete-account")
    def delete_account(
        payload: DeleteAccountRequest,
        db: Session = Depends(get_db),
        authenticated_user_id: str = Depends(require_authenticated_user_id),
    ):
        try:
            auth_service.delete_user_account(
                db,
                user_id=authenticated_user_id,
                password=payload.password,
                confirmation_text=payload.confirmationText,
            )
            return {"message": "Account deleted successfully."}
        except AuthServiceError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    return router
