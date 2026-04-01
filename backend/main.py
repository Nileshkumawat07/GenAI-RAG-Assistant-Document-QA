from pathlib import Path

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes.documents import build_document_router
from app.api.routes.frontend import build_frontend_router, mount_frontend
from app.api.routes.health import build_health_router
from app.api.routes.object_detection import build_object_detection_router
from app.core.config import FRONTEND_ORIGIN
from app.services.rag_service import RAGService


def create_app() -> FastAPI:
    app = FastAPI(title="GenAI RAG Assistant API", version="1.0.0")
    rag_service = RAGService()
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
    app.include_router(build_document_router(rag_service))
    app.include_router(build_object_detection_router())
    app.include_router(build_frontend_router(frontend_build_dir))
    return app


app = create_app()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)
