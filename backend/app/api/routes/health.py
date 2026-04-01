from fastapi import APIRouter

from app.services.rag_service import RAGService


def build_health_router(rag_service: RAGService) -> APIRouter:
    router = APIRouter(tags=["health"])

    @router.get("/health")
    def health_check():
        return {
            "status": "ok",
            "documents_indexed": rag_service.indexed_document_count(),
            "chunks_indexed": rag_service.indexed_chunk_count(),
        }

    return router
