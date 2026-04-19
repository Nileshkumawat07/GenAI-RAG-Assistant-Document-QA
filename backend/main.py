import secrets
from datetime import date
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect, or_, select, text
from sqlalchemy.orm import Session

from app.api.routes.auth import build_auth_router
from app.api.routes.admin_center import build_admin_center_router
from app.api.routes.contact_requests import build_contact_request_router
from app.api.routes.chat_management import build_chat_management_router
from app.api.routes.careers import build_career_router
from app.api.routes.content import build_content_router
from app.api.routes.documents import build_document_router
from app.api.routes.frontend import build_frontend_router, mount_frontend
from app.api.routes.health import build_health_router
from app.api.routes.image_generation import build_image_generation_router
from app.api.routes.linked_providers import build_linked_provider_router
from app.api.routes.management import build_management_router
from app.api.routes.object_detection import build_object_detection_router
from app.api.routes.payments import build_payment_router
from app.api.routes.workspace_hub import build_workspace_hub_router
from app.core.config import ALLOWED_FRONTEND_ORIGINS
from app.core.database import Base, engine
import app.models  # Ensure ORM models are registered before create_all().
from app.models.user import User
from app.services.auth_service import AuthService
from app.services.admin_center_service import AdminCenterService
from app.services.contact_request_service import ContactRequestService
from app.services.chat_management_service import ChatManagementService
from app.services.career_service import CareerService
from app.services.linked_provider_service import LinkedProviderService
from app.services.management_service import ManagementService
from app.services.otp_service import OTPService
from app.services.payment_service import PaymentService
from app.services.rag_service import RAGService
from app.services.social_oauth_service import SocialOAuthService
from app.services.workspace_hub_service import WorkspaceHubService


def ensure_user_social_link_schema() -> None:
    inspector = inspect(engine)
    if "user_social_links" not in inspector.get_table_names():
        return

    existing_columns = {column["name"] for column in inspector.get_columns("user_social_links")}
    if {"user_id", "provider", "provider_id", "email"}.issubset(existing_columns):
        return

    with engine.begin() as connection:
        connection.execute(text("DROP TABLE IF EXISTS user_social_links"))
    Base.metadata.create_all(bind=engine)


def ensure_contact_request_schema() -> None:
    inspector = inspect(engine)
    if "contact_requests" not in inspector.get_table_names():
        return

    existing_columns = {column["name"] for column in inspector.get_columns("contact_requests")}
    with engine.begin() as connection:
        if "admin_message" not in existing_columns:
            connection.execute(text("ALTER TABLE contact_requests ADD COLUMN admin_message TEXT NULL"))
        required_statements = {
            "assigned_manager_user_id": "ALTER TABLE contact_requests ADD COLUMN assigned_manager_user_id VARCHAR(36) NULL",
            "assigned_by_user_id": "ALTER TABLE contact_requests ADD COLUMN assigned_by_user_id VARCHAR(36) NULL",
            "assigned_at": "ALTER TABLE contact_requests ADD COLUMN assigned_at DATETIME NULL",
            "first_response_at": "ALTER TABLE contact_requests ADD COLUMN first_response_at DATETIME NULL",
            "completed_at": "ALTER TABLE contact_requests ADD COLUMN completed_at DATETIME NULL",
            "last_status_updated_at": "ALTER TABLE contact_requests ADD COLUMN last_status_updated_at DATETIME NULL",
            "last_status_updated_by_user_id": "ALTER TABLE contact_requests ADD COLUMN last_status_updated_by_user_id VARCHAR(36) NULL",
            "priority_score": "ALTER TABLE contact_requests ADD COLUMN priority_score INTEGER NULL",
            "due_at": "ALTER TABLE contact_requests ADD COLUMN due_at DATETIME NULL",
            "breached_at": "ALTER TABLE contact_requests ADD COLUMN breached_at DATETIME NULL",
            "escalation_level": "ALTER TABLE contact_requests ADD COLUMN escalation_level INTEGER NOT NULL DEFAULT 0",
            "queue_owner": "ALTER TABLE contact_requests ADD COLUMN queue_owner VARCHAR(80) NULL",
            "source_channel": "ALTER TABLE contact_requests ADD COLUMN source_channel VARCHAR(40) NOT NULL DEFAULT 'web'",
        }
        for column_name, statement in required_statements.items():
            if column_name in existing_columns:
                continue
            connection.execute(text(statement))


def ensure_contact_request_code_schema() -> None:
    inspector = inspect(engine)
    if "contact_requests" not in inspector.get_table_names():
        return

    existing_columns = {column["name"]: column for column in inspector.get_columns("contact_requests")}
    request_code_column = existing_columns.get("request_code")
    if not request_code_column:
        return

    current_length = getattr(request_code_column["type"], "length", None)
    if current_length == 6:
        return

    with engine.begin() as connection:
        connection.execute(text("ALTER TABLE contact_requests MODIFY COLUMN request_code VARCHAR(6) NULL"))


def ensure_user_subscription_schema() -> None:
    inspector = inspect(engine)
    if "users" not in inspector.get_table_names():
        return

    existing_columns = {column["name"] for column in inspector.get_columns("users")}
    required_statements = {
        "public_user_code": "ALTER TABLE users ADD COLUMN public_user_code VARCHAR(6) NULL",
        "bio": "ALTER TABLE users ADD COLUMN bio TEXT NULL",
        "profile_image_url": "ALTER TABLE users ADD COLUMN profile_image_url VARCHAR(500) NULL",
        "is_management": "ALTER TABLE users ADD COLUMN is_management BOOLEAN NOT NULL DEFAULT FALSE",
        "management_access_suspended": "ALTER TABLE users ADD COLUMN management_access_suspended BOOLEAN NOT NULL DEFAULT FALSE",
        "management_granted_at": "ALTER TABLE users ADD COLUMN management_granted_at DATETIME NULL",
        "management_granted_by_user_id": "ALTER TABLE users ADD COLUMN management_granted_by_user_id VARCHAR(36) NULL",
        "management_suspended_at": "ALTER TABLE users ADD COLUMN management_suspended_at DATETIME NULL",
        "management_suspended_by_user_id": "ALTER TABLE users ADD COLUMN management_suspended_by_user_id VARCHAR(36) NULL",
        "account_locked": "ALTER TABLE users ADD COLUMN account_locked BOOLEAN NOT NULL DEFAULT FALSE",
        "locked_at": "ALTER TABLE users ADD COLUMN locked_at DATETIME NULL",
        "locked_by_user_id": "ALTER TABLE users ADD COLUMN locked_by_user_id VARCHAR(36) NULL",
        "reactivated_at": "ALTER TABLE users ADD COLUMN reactivated_at DATETIME NULL",
        "reactivated_by_user_id": "ALTER TABLE users ADD COLUMN reactivated_by_user_id VARCHAR(36) NULL",
        "force_password_reset": "ALTER TABLE users ADD COLUMN force_password_reset BOOLEAN NOT NULL DEFAULT FALSE",
        "archived_at": "ALTER TABLE users ADD COLUMN archived_at DATETIME NULL",
        "archived_by_user_id": "ALTER TABLE users ADD COLUMN archived_by_user_id VARCHAR(36) NULL",
        "merged_into_user_id": "ALTER TABLE users ADD COLUMN merged_into_user_id VARCHAR(36) NULL",
        "last_login_at": "ALTER TABLE users ADD COLUMN last_login_at DATETIME NULL",
        "admin_2fa_required": "ALTER TABLE users ADD COLUMN admin_2fa_required BOOLEAN NOT NULL DEFAULT FALSE",
        "subscription_plan_id": "ALTER TABLE users ADD COLUMN subscription_plan_id VARCHAR(100) NULL",
        "subscription_plan_name": "ALTER TABLE users ADD COLUMN subscription_plan_name VARCHAR(255) NULL",
        "subscription_status": "ALTER TABLE users ADD COLUMN subscription_status VARCHAR(50) NOT NULL DEFAULT 'free'",
        "subscription_amount": "ALTER TABLE users ADD COLUMN subscription_amount INTEGER NULL",
        "subscription_currency": "ALTER TABLE users ADD COLUMN subscription_currency VARCHAR(10) NULL",
        "subscription_billing_cycle": "ALTER TABLE users ADD COLUMN subscription_billing_cycle VARCHAR(50) NULL",
        "subscription_activated_at": "ALTER TABLE users ADD COLUMN subscription_activated_at DATETIME NULL",
        "subscription_expires_at": "ALTER TABLE users ADD COLUMN subscription_expires_at DATETIME NULL",
        "subscription_payment_id": "ALTER TABLE users ADD COLUMN subscription_payment_id VARCHAR(255) NULL",
        "subscription_order_id": "ALTER TABLE users ADD COLUMN subscription_order_id VARCHAR(255) NULL",
    }

    with engine.begin() as connection:
        for column_name, statement in required_statements.items():
            if column_name in existing_columns:
                continue
            connection.execute(text(statement))


def ensure_user_settings_schema() -> None:
    inspector = inspect(engine)
    table_names = set(inspector.get_table_names())
    if "user_settings" in table_names:
        return

    with engine.begin() as connection:
        connection.execute(
            text(
                "CREATE TABLE user_settings ("
                "id VARCHAR(36) PRIMARY KEY, "
                "user_id VARCHAR(36) NOT NULL, "
                "category VARCHAR(80) NOT NULL, "
                "payload_json TEXT NOT NULL, "
                "created_at DATETIME NOT NULL, "
                "updated_at DATETIME NOT NULL)"
            )
        )


def ensure_user_login_sessions_schema() -> None:
    inspector = inspect(engine)
    table_names = set(inspector.get_table_names())
    with engine.begin() as connection:
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


def ensure_management_support_schema() -> None:
    inspector = inspect(engine)
    table_names = set(inspector.get_table_names())
    with engine.begin() as connection:
        if "management_notes" not in table_names:
            connection.execute(
                text(
                    "CREATE TABLE management_notes ("
                    "id VARCHAR(36) PRIMARY KEY, "
                    "author_user_id VARCHAR(36) NOT NULL, "
                    "request_id VARCHAR(36) NULL, "
                    "target_user_id VARCHAR(36) NULL, "
                    "note_text TEXT NOT NULL, "
                    "created_at DATETIME NOT NULL)"
                )
            )

        if "reply_templates" not in table_names:
            connection.execute(
                text(
                    "CREATE TABLE reply_templates ("
                    "id VARCHAR(36) PRIMARY KEY, "
                    "title VARCHAR(140) NOT NULL, "
                    "category VARCHAR(50) NULL, "
                    "body TEXT NOT NULL, "
                    "created_by_user_id VARCHAR(36) NULL, "
                    "is_active BOOLEAN NOT NULL DEFAULT TRUE, "
                    "created_at DATETIME NOT NULL, "
                    "updated_at DATETIME NOT NULL)"
                )
            )


def ensure_workspace_hub_schema() -> None:
    inspector = inspect(engine)
    table_names = set(inspector.get_table_names())
    required_tables = {
        "workspace_notifications",
        "workspace_chat_threads",
        "workspace_chat_messages",
        "team_workspaces",
        "team_members",
    }
    if required_tables.issubset(table_names):
        return

    tables_to_create = [
        table
        for table in Base.metadata.sorted_tables
        if table.name in required_tables and table.name not in table_names
    ]
    if tables_to_create:
        Base.metadata.create_all(bind=engine, tables=tables_to_create)


def ensure_chat_management_schema() -> None:
    inspector = inspect(engine)
    table_names = set(inspector.get_table_names())
    required_tables = {
        "chat_groups",
        "chat_group_members",
        "chat_communities",
        "chat_community_groups",
    }
    tables_to_create = [
        table
        for table in Base.metadata.sorted_tables
        if table.name in required_tables and table.name not in table_names
    ]
    if tables_to_create:
        Base.metadata.create_all(bind=engine, tables=tables_to_create)

    with engine.begin() as connection:
        if "chat_messages" in table_names:
            existing_columns = {column["name"] for column in inspector.get_columns("chat_messages")}
            required_statements = {
                "group_id": "ALTER TABLE chat_messages ADD COLUMN group_id VARCHAR(36) NULL",
                "conversation_type": "ALTER TABLE chat_messages ADD COLUMN conversation_type VARCHAR(30) NOT NULL DEFAULT 'direct'",
                "hidden_for_user_ids": "ALTER TABLE chat_messages ADD COLUMN hidden_for_user_ids TEXT NULL",
                "edited_at": "ALTER TABLE chat_messages ADD COLUMN edited_at DATETIME NULL",
                "expires_at": "ALTER TABLE chat_messages ADD COLUMN expires_at DATETIME NULL",
            }
            for column_name, statement in required_statements.items():
                if column_name not in existing_columns:
                    connection.execute(text(statement))

        if "workspace_notifications" in table_names:
            existing_columns = {column["name"] for column in inspector.get_columns("workspace_notifications")}
            required_statements = {
                "action_type": "ALTER TABLE workspace_notifications ADD COLUMN action_type VARCHAR(80) NULL",
                "action_entity_id": "ALTER TABLE workspace_notifications ADD COLUMN action_entity_id VARCHAR(36) NULL",
                "action_entity_kind": "ALTER TABLE workspace_notifications ADD COLUMN action_entity_kind VARCHAR(40) NULL",
                "action_context": "ALTER TABLE workspace_notifications ADD COLUMN action_context TEXT NULL",
            }
            for column_name, statement in required_statements.items():
                if column_name not in existing_columns:
                    connection.execute(text(statement))


def ensure_reply_template_seed(management_service: ManagementService) -> None:
    with Session(engine) as db:
        management_service.ensure_default_reply_templates(db)


def ensure_admin_center_seed(admin_center_service: AdminCenterService) -> None:
    with Session(engine) as db:
        admin_center_service.ensure_seed_data(db)


def ensure_subscription_transaction_schema() -> None:
    inspector = inspect(engine)
    if "subscription_transactions" not in inspector.get_table_names():
        return

    existing_columns = {column["name"] for column in inspector.get_columns("subscription_transactions")}
    required_statements = {
        "invoice_number": "ALTER TABLE subscription_transactions ADD COLUMN invoice_number VARCHAR(6) NULL",
        "customer_code": "ALTER TABLE subscription_transactions ADD COLUMN customer_code VARCHAR(6) NULL",
        "customer_name": "ALTER TABLE subscription_transactions ADD COLUMN customer_name VARCHAR(255) NULL",
        "customer_email": "ALTER TABLE subscription_transactions ADD COLUMN customer_email VARCHAR(255) NULL",
        "customer_mobile": "ALTER TABLE subscription_transactions ADD COLUMN customer_mobile VARCHAR(20) NULL",
        "company_name": "ALTER TABLE subscription_transactions ADD COLUMN company_name VARCHAR(255) NULL",
        "canceled_at": "ALTER TABLE subscription_transactions ADD COLUMN canceled_at DATETIME NULL",
        "refund_status": "ALTER TABLE subscription_transactions ADD COLUMN refund_status VARCHAR(40) NULL",
        "dispute_status": "ALTER TABLE subscription_transactions ADD COLUMN dispute_status VARCHAR(40) NULL",
        "retry_count": "ALTER TABLE subscription_transactions ADD COLUMN retry_count INTEGER NOT NULL DEFAULT 0",
        "billing_admin_note": "ALTER TABLE subscription_transactions ADD COLUMN billing_admin_note VARCHAR(255) NULL",
    }
    with engine.begin() as connection:
        for column_name, statement in required_statements.items():
            if column_name in existing_columns:
                continue
            connection.execute(text(statement))

        rows = connection.execute(
            text("SELECT id, user_id, invoice_number, customer_code, customer_name, customer_email, customer_mobile, company_name FROM subscription_transactions")
        ).mappings().all()
        users_lookup = {}
        if "users" in inspector.get_table_names():
            user_rows = connection.execute(
                text("SELECT id, public_user_code, full_name, email, mobile FROM users")
            ).mappings().all()
            users_lookup = {row["id"]: row for row in user_rows}

        existing_invoice_codes = {row["invoice_number"] for row in rows if row["invoice_number"]}
        for row in rows:
            user_row = users_lookup.get(row["user_id"])
            next_invoice_number = row["invoice_number"] or generate_short_numeric_code(existing_invoice_codes)
            connection.execute(
                text(
                    "UPDATE subscription_transactions "
                    "SET invoice_number = :invoice_number, "
                    "customer_code = COALESCE(customer_code, :customer_code), "
                    "customer_name = COALESCE(customer_name, :customer_name), "
                    "customer_email = COALESCE(customer_email, :customer_email), "
                    "customer_mobile = COALESCE(customer_mobile, :customer_mobile), "
                    "company_name = COALESCE(company_name, :company_name) "
                    "WHERE id = :id"
                ),
                {
                    "invoice_number": next_invoice_number,
                    "customer_code": user_row["public_user_code"] if user_row else None,
                    "customer_name": user_row["full_name"] if user_row else "Not available",
                    "customer_email": user_row["email"] if user_row else "Not available",
                    "customer_mobile": user_row["mobile"] if user_row else "Not available",
                    "company_name": "Unified AI Workspace",
                    "id": row["id"],
                },
            )


def generate_short_numeric_code(existing_codes: set[str]) -> str:
    while True:
        code = f"{secrets.randbelow(1_000_000):06d}"
        if code not in existing_codes:
            existing_codes.add(code)
            return code


def ensure_public_codes() -> None:
    inspector = inspect(engine)
    table_names = set(inspector.get_table_names())
    with engine.begin() as connection:
        if "users" in table_names:
            rows = connection.execute(text("SELECT id, public_user_code FROM users")).mappings().all()
            existing_codes = {row["public_user_code"] for row in rows if row["public_user_code"]}
            for row in rows:
                if row["public_user_code"]:
                    continue
                connection.execute(
                    text("UPDATE users SET public_user_code = :code WHERE id = :id"),
                    {"code": generate_short_numeric_code(existing_codes), "id": row["id"]},
                )

        if "contact_requests" in table_names:
            rows = connection.execute(text("SELECT id, request_code FROM contact_requests")).mappings().all()
            existing_codes = {row["request_code"] for row in rows if row["request_code"] and len(str(row["request_code"])) == 6}
            for row in rows:
                if row["request_code"] and len(str(row["request_code"])) == 6 and str(row["request_code"]).isdigit():
                    continue
                connection.execute(
                    text("UPDATE contact_requests SET request_code = :code WHERE id = :id"),
                    {"code": generate_short_numeric_code(existing_codes), "id": row["id"]},
                )



def ensure_social_oauth_config_seed(social_oauth_service: SocialOAuthService) -> None:
    with Session(engine) as db:
        social_oauth_service.ensure_provider_rows(db)


def ensure_manual_test_users(auth_service: AuthService) -> None:
    manual_users = [
        {
            "full_name": "Rishvi Sharma",
            "username": "rishvi",
            "email": "rishvi@example.com",
            "alternate_email": "rishvi.alt@example.com",
            "mobile": "9000000001",
            "gender": "Female",
        },
        {
            "full_name": "Aastha Patil",
            "username": "aastha",
            "email": "aastha@example.com",
            "alternate_email": "aastha.alt@example.com",
            "mobile": "9000000002",
            "gender": "Female",
        },
        {
            "full_name": "Rutkar Deshmukh",
            "username": "rutkar",
            "email": "rutkar@example.com",
            "alternate_email": "rutkar.alt@example.com",
            "mobile": "9000000003",
            "gender": "Male",
        },
    ]

    with Session(engine) as db:
        for item in manual_users:
            existing_user = db.execute(
                select(User).where(
                    or_(
                        User.username == item["username"],
                        User.email == item["email"],
                        User.mobile == item["mobile"],
                    )
                )
            ).scalar_one_or_none()
            if existing_user:
                continue

            auth_service.register_user(
                db,
                full_name=item["full_name"],
                username=item["username"],
                date_of_birth=date(2000, 1, 1),
                gender=item["gender"],
                email=item["email"],
                alternate_email=item["alternate_email"],
                mobile=item["mobile"],
                security_question="What is your favorite color?",
                security_answer="Blue",
                referral_code="DUMMY001",
                password="Nilesh@9890",
                email_verified=True,
                mobile_verified=True,
            )


def create_app() -> FastAPI:
    app = FastAPI(title="GenAI RAG Assistant API", version="1.0.0")
    Base.metadata.create_all(bind=engine)
    ensure_user_social_link_schema()
    ensure_contact_request_schema()
    ensure_user_subscription_schema()
    ensure_user_settings_schema()
    ensure_user_login_sessions_schema()
    ensure_subscription_transaction_schema()
    ensure_workspace_hub_schema()
    ensure_chat_management_schema()
    ensure_public_codes()
    ensure_contact_request_code_schema()
    rag_service = RAGService()
    otp_service = OTPService()
    auth_service = AuthService()
    contact_request_service = ContactRequestService()
    career_service = CareerService()
    linked_provider_service = LinkedProviderService()
    management_service = ManagementService(auth_service)
    admin_center_service = AdminCenterService(auth_service)
    social_oauth_service = SocialOAuthService()
    payment_service = PaymentService()
    chat_management_service = ChatManagementService(auth_service)
    workspace_hub_service = WorkspaceHubService(realtime_notifier=chat_management_service.manager.send_event)
    ensure_social_oauth_config_seed(social_oauth_service)
    ensure_management_support_schema()
    ensure_reply_template_seed(management_service)
    ensure_admin_center_seed(admin_center_service)
    ensure_manual_test_users(auth_service)
    base_dir = Path(__file__).resolve().parent
    frontend_build_dir = base_dir.parent / "frontend" / "build"

    app.add_middleware(
        CORSMiddleware,
        allow_origins=[
            *ALLOWED_FRONTEND_ORIGINS,
            "http://127.0.0.1:3000",
        ],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    mount_frontend(app, frontend_build_dir)
    app.include_router(build_health_router(rag_service))
    app.include_router(build_auth_router(otp_service, auth_service))
    app.include_router(build_contact_request_router(contact_request_service, auth_service))
    app.include_router(build_career_router(career_service, auth_service))
    app.include_router(build_content_router(admin_center_service, auth_service))
    app.include_router(build_management_router(management_service, auth_service))
    app.include_router(build_admin_center_router(admin_center_service, auth_service))
    app.include_router(build_linked_provider_router(linked_provider_service, auth_service, social_oauth_service))
    app.include_router(build_payment_router(payment_service, auth_service))
    app.include_router(build_workspace_hub_router(workspace_hub_service))
    app.include_router(build_chat_management_router(chat_management_service))
    app.include_router(build_document_router(rag_service))
    app.include_router(build_object_detection_router())
    app.include_router(build_image_generation_router())
    app.include_router(build_frontend_router(frontend_build_dir))
    return app


app = create_app()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)
