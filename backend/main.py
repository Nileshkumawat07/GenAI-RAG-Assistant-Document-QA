from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy import inspect, text
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
    if "admin_message" in existing_columns:
        return

    with engine.begin() as connection:
        connection.execute(text("ALTER TABLE contact_requests ADD COLUMN admin_message TEXT NULL"))


def ensure_user_subscription_schema() -> None:
    inspector = inspect(engine)
    if "users" not in inspector.get_table_names():
        return

    existing_columns = {column["name"] for column in inspector.get_columns("users")}
    required_statements = {
        "subscription_plan_id": "ALTER TABLE users ADD COLUMN subscription_plan_id VARCHAR(100) NULL",
        "subscription_plan_name": "ALTER TABLE users ADD COLUMN subscription_plan_name VARCHAR(255) NULL",
        "subscription_status": "ALTER TABLE users ADD COLUMN subscription_status VARCHAR(50) NOT NULL DEFAULT 'free'",
        "subscription_amount": "ALTER TABLE users ADD COLUMN subscription_amount INTEGER NULL",
        "subscription_currency": "ALTER TABLE users ADD COLUMN subscription_currency VARCHAR(10) NULL",
        "subscription_billing_cycle": "ALTER TABLE users ADD COLUMN subscription_billing_cycle VARCHAR(50) NULL",
        "subscription_activated_at": "ALTER TABLE users ADD COLUMN subscription_activated_at DATETIME NULL",
        "subscription_payment_id": "ALTER TABLE users ADD COLUMN subscription_payment_id VARCHAR(255) NULL",
        "subscription_order_id": "ALTER TABLE users ADD COLUMN subscription_order_id VARCHAR(255) NULL",
    }

    with engine.begin() as connection:
        for column_name, statement in required_statements.items():
            if column_name in existing_columns:
                continue
            connection.execute(text(statement))


def ensure_social_oauth_config_seed(social_oauth_service: SocialOAuthService) -> None:
    with Session(engine) as db:
        social_oauth_service.ensure_provider_rows(db)


def create_app() -> FastAPI:
    app = FastAPI(title="GenAI RAG Assistant API", version="1.0.0")
    Base.metadata.create_all(bind=engine)
    ensure_user_social_link_schema()
    ensure_contact_request_schema()
    ensure_user_subscription_schema()
    rag_service = RAGService()
    otp_service = OTPService()
    auth_service = AuthService()
    contact_request_service = ContactRequestService()
    linked_provider_service = LinkedProviderService()
    social_oauth_service = SocialOAuthService()
    payment_service = PaymentService()
    ensure_social_oauth_config_seed(social_oauth_service)
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
