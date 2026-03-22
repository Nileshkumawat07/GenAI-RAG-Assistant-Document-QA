from pathlib import Path

from fastapi import FastAPI, File, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from config import FRONTEND_ORIGIN
from model import RAGService


app = FastAPI(title="GenAI RAG Assistant API", version="1.0.0")
rag_service = RAGService()
BASE_DIR = Path(__file__).resolve().parent
FRONTEND_BUILD_DIR = BASE_DIR.parent / "frontend" / "build"

app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_ORIGIN, "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

if (FRONTEND_BUILD_DIR / "static").exists():
    app.mount("/static", StaticFiles(directory=FRONTEND_BUILD_DIR / "static"), name="static")


class QueryRequest(BaseModel):
    question: str


@app.get("/health")
def health_check():
    return {
        "status": "ok",
        "documents_indexed": rag_service.indexed_document_count(),
        "chunks_indexed": rag_service.indexed_chunk_count(),
    }


@app.post("/documents/upload")
async def upload_document(
    file: UploadFile = File(...),
    x_session_id: str | None = Header(default=None),
):
    session_id = _require_session_id(x_session_id)
    try:
        return await rag_service.ingest(file, session_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.post("/query")
def query_documents(
    payload: QueryRequest,
    x_session_id: str | None = Header(default=None),
):
    if not payload.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty.")

    session_id = _require_session_id(x_session_id)

    try:
        return rag_service.query(payload.question.strip(), session_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/")
def serve_index():
    index_file = FRONTEND_BUILD_DIR / "index.html"
    if index_file.exists():
        return FileResponse(index_file)
    raise HTTPException(status_code=404, detail="Frontend build not found.")


@app.get("/{full_path:path}")
def serve_frontend_routes(full_path: str):
    if full_path.startswith(("health", "documents", "query", "openapi.json", "docs", "redoc")):
        raise HTTPException(status_code=404, detail="Not found.")

    asset_path = FRONTEND_BUILD_DIR / full_path
    if asset_path.exists() and asset_path.is_file():
        return FileResponse(asset_path)

    index_file = FRONTEND_BUILD_DIR / "index.html"
    if index_file.exists():
        return FileResponse(index_file)

    raise HTTPException(status_code=404, detail="Frontend build not found.")


def _require_session_id(session_id: str | None) -> str:
    if not session_id or not session_id.strip():
        raise HTTPException(status_code=400, detail="Missing X-Session-Id header.")
    return session_id.strip()


if __name__ == "__main__":
    import uvicorn

    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)
