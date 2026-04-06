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
from app.core.config import FRONTEND_ORIGIN
from app.core.database import Base, engine
import app.models  # Ensure ORM models are registered before create_all().
from app.services.auth_service import AuthService
from app.services.contact_request_service import ContactRequestService
from app.services.linked_provider_service import LinkedProviderService
from app.services.otp_service import OTPService
from app.services.rag_service import RAGService
from app.services.social_oauth_service import SocialOAuthService


def ensure_linked_provider_schema() -> None:
    inspector = inspect(engine)
    if "linked_providers" not in inspector.get_table_names():
        return

    existing_columns = {column["name"] for column in inspector.get_columns("linked_providers")}
    statements: list[str] = []

    if "callback_provider_id" not in existing_columns:
        statements.append("ALTER TABLE linked_providers ADD COLUMN callback_provider_id VARCHAR(100) NULL")
    if "callback_email" not in existing_columns:
        statements.append("ALTER TABLE linked_providers ADD COLUMN callback_email VARCHAR(255) NULL")
    if "callback_display_name" not in existing_columns:
        statements.append("ALTER TABLE linked_providers ADD COLUMN callback_display_name VARCHAR(255) NULL")
    if "callback_user_id" not in existing_columns:
        statements.append("ALTER TABLE linked_providers ADD COLUMN callback_user_id VARCHAR(255) NULL")
    if "callback_received_at" not in existing_columns:
        statements.append("ALTER TABLE linked_providers ADD COLUMN callback_received_at DATETIME NULL")

    if not statements:
        return

    with engine.begin() as connection:
        for statement in statements:
            connection.execute(text(statement))


def ensure_social_oauth_config_seed(social_oauth_service: SocialOAuthService) -> None:
    with Session(engine) as db:
        social_oauth_service.ensure_provider_rows(db)


def create_app() -> FastAPI:
    app = FastAPI(title="GenAI RAG Assistant API", version="1.0.0")
    Base.metadata.create_all(bind=engine)
    ensure_linked_provider_schema()
    rag_service = RAGService()
    otp_service = OTPService()
    auth_service = AuthService()
    contact_request_service = ContactRequestService()
    linked_provider_service = LinkedProviderService(auth_service)
    social_oauth_service = SocialOAuthService()
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
    app.include_router(build_document_router(rag_service))
    app.include_router(build_object_detection_router())
    app.include_router(build_image_generation_router())
    app.include_router(build_frontend_router(frontend_build_dir))
    return app


app = create_app()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)
