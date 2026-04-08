import secrets
from datetime import date
from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect, or_, select, text
from sqlalchemy.orm import Session

from app.api.routes.auth import build_auth_router
from app.api.routes.contact_requests import build_contact_request_router
from app.api.routes.documents import build_document_router
from app.api.routes.frontend import build_frontend_router, mount_frontend
from app.api.routes.health import build_health_router
from app.api.routes.image_generation import build_image_generation_router
from app.api.routes.linked_providers import build_linked_provider_router
from app.api.routes.object_detection import build_object_detection_router
from app.api.routes.payments import build_payment_router
from app.core.config import FRONTEND_ORIGIN
from app.core.database import Base, engine
import app.models  # Ensure ORM models are registered before create_all().
from app.models.user import User
from app.services.auth_service import AuthService
from app.services.contact_request_service import ContactRequestService
from app.services.linked_provider_service import LinkedProviderService
from app.services.otp_service import OTPService
from app.services.payment_service import PaymentService
from app.services.rag_service import RAGService
from app.services.social_oauth_service import SocialOAuthService


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
        "is_management": "ALTER TABLE users ADD COLUMN is_management BOOLEAN NOT NULL DEFAULT FALSE",
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
    ensure_subscription_transaction_schema()
    ensure_public_codes()
    ensure_contact_request_code_schema()
    rag_service = RAGService()
    otp_service = OTPService()
    auth_service = AuthService()
    contact_request_service = ContactRequestService()
    linked_provider_service = LinkedProviderService()
    social_oauth_service = SocialOAuthService()
    payment_service = PaymentService()
    ensure_social_oauth_config_seed(social_oauth_service)
    ensure_manual_test_users(auth_service)
    base_dir = Path(__file__).resolve().parent
    frontend_build_dir = base_dir.parent / "frontend" / "build"

    app.add_middleware(
        CORSMiddleware,
        allow_origins=[FRONTEND_ORIGIN, "http://127.0.0.1:3000"],
        allow_credentials=True,
        allow_methods=["*"],
        allow_headers=["*"],
    )

    mount_frontend(app, frontend_build_dir)
    app.include_router(build_health_router(rag_service))
    app.include_router(build_auth_router(otp_service, auth_service))
    app.include_router(build_contact_request_router(contact_request_service, auth_service))
    app.include_router(build_linked_provider_router(linked_provider_service, auth_service, social_oauth_service))
    app.include_router(build_payment_router(payment_service, auth_service))
    app.include_router(build_document_router(rag_service))
    app.include_router(build_object_detection_router())
    app.include_router(build_image_generation_router())
    app.include_router(build_frontend_router(frontend_build_dir))
    return app


app = create_app()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)
