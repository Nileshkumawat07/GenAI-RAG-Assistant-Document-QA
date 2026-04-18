from typing import Annotated

from fastapi import APIRouter, Body, Depends, File, HTTPException, UploadFile

from app.api.dependencies import require_session_id
from app.schemas.document import QueryRequest, RenameDocumentRequest
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

    @router.get("/documents/library")
    def list_documents(
        session_id: Annotated[str, Depends(require_session_id)] = "",
    ):
        return {"items": rag_service.list_session_documents(session_id)}

    @router.post("/documents/library/{filename}/activate")
    def activate_document(
        filename: str,
        session_id: Annotated[str, Depends(require_session_id)] = "",
    ):
        try:
            return rag_service.set_active_document(session_id, filename)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @router.patch("/documents/library/{filename}")
    def rename_document(
        filename: str,
        payload: RenameDocumentRequest,
        session_id: Annotated[str, Depends(require_session_id)] = "",
    ):
        try:
            return rag_service.rename_document(session_id, filename, payload.filename)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @router.post("/documents/library/{filename}/archive")
    def archive_document(
        filename: str,
        session_id: Annotated[str, Depends(require_session_id)] = "",
    ):
        try:
            return rag_service.archive_document(session_id, filename)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    @router.delete("/documents/library/{filename}")
    def delete_document(
        filename: str,
        session_id: Annotated[str, Depends(require_session_id)] = "",
    ):
        try:
            return rag_service.delete_document(session_id, filename)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc

    return router
