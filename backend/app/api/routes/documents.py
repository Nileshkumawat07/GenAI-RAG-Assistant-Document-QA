from typing import Annotated

from fastapi import APIRouter, Depends, File, HTTPException, UploadFile

from app.api.dependencies import require_session_id
from app.schemas.document import QueryRequest
from app.services.rag_service import RAGService


def build_document_router(rag_service: RAGService) -> APIRouter:
    router = APIRouter(tags=["documents"])

    @router.post("/documents/upload")
    async def upload_document(
        file: UploadFile = File(...),
        session_id: Annotated[str, Depends(require_session_id)] = "",
    ):
        try:
            return await rag_service.ingest(file, session_id)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @router.post("/query")
    def query_documents(
        payload: QueryRequest,
        session_id: Annotated[str, Depends(require_session_id)] = "",
    ):
        if not payload.question.strip():
            raise HTTPException(status_code=400, detail="Question cannot be empty.")

        try:
            return rag_service.query(payload.question.strip(), session_id)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        except RuntimeError as exc:
            raise HTTPException(status_code=502, detail=str(exc)) from exc

    return router
