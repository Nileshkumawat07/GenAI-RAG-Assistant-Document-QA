from pathlib import Path

from fastapi import FastAPI, File, Header, HTTPException, UploadFile
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles
from pydantic import BaseModel

from config import FRONTEND_ORIGIN
from model import RAGService


# Main FastAPI app used by the backend server.
app = FastAPI(title="GenAI RAG Assistant API", version="1.0.0")

# Service object that handles document upload, indexing, and answering.
rag_service = RAGService()

# Backend folder path.
BASE_DIR = Path(__file__).resolve().parent

# React production build folder used when serving the frontend from FastAPI.
FRONTEND_BUILD_DIR = BASE_DIR.parent / "frontend" / "build"

# Allow the frontend to call the backend from approved browser origins.
app.add_middleware(
    CORSMiddleware,
    allow_origins=[FRONTEND_ORIGIN, "http://127.0.0.1:3000"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Serve built frontend static files only if a production build exists.
if (FRONTEND_BUILD_DIR / "static").exists():
    app.mount("/static", StaticFiles(directory=FRONTEND_BUILD_DIR / "static"), name="static")


class QueryRequest(BaseModel):
    # Question sent by the user.
    question: str


@app.get("/health")
def health_check():
    # Simple health endpoint used to check whether the service is running.
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
    # Each upload is tied to one browser session.
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
    # Empty questions are rejected before retrieval starts.
    if not payload.question.strip():
        raise HTTPException(status_code=400, detail="Question cannot be empty.")

    # Use the same session that uploaded the current file.
    session_id = _require_session_id(x_session_id)

    try:
        return rag_service.query(payload.question.strip(), session_id)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc


@app.get("/")
def serve_index():
    # Return the React app entry file in production mode.
    index_file = FRONTEND_BUILD_DIR / "index.html"
    if index_file.exists():
        return FileResponse(index_file)
    raise HTTPException(status_code=404, detail="Frontend build not found.")


@app.get("/{full_path:path}")
def serve_frontend_routes(full_path: str):
    # Keep API routes separate from frontend routes.
    if full_path.startswith(("health", "documents", "query", "openapi.json", "docs", "redoc")):
        raise HTTPException(status_code=404, detail="Not found.")

    # Return the requested frontend asset if it exists.
    asset_path = FRONTEND_BUILD_DIR / full_path
    if asset_path.exists() and asset_path.is_file():
        return FileResponse(asset_path)

    # Otherwise return `index.html` so React can handle client-side routing.
    index_file = FRONTEND_BUILD_DIR / "index.html"
    if index_file.exists():
        return FileResponse(index_file)

    raise HTTPException(status_code=404, detail="Frontend build not found.")


def _require_session_id(session_id: str | None) -> str:
    # Session id is required to keep different users' documents isolated.
    if not session_id or not session_id.strip():
        raise HTTPException(status_code=400, detail="Missing X-Session-Id header.")
    return session_id.strip()


if __name__ == "__main__":
    import uvicorn

    # Local run command for development.
    uvicorn.run("main:app", host="0.0.0.0", port=8000, reload=False)
