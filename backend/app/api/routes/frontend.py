from pathlib import Path

from fastapi import APIRouter, HTTPException
from fastapi.responses import FileResponse
from fastapi.staticfiles import StaticFiles


def mount_frontend(app, frontend_build_dir: Path) -> None:
    if (frontend_build_dir / "static").exists():
        app.mount("/static", StaticFiles(directory=frontend_build_dir / "static"), name="static")


def build_frontend_router(frontend_build_dir: Path) -> APIRouter:
    router = APIRouter(tags=["frontend"])

    @router.get("/")
    def serve_index():
        index_file = frontend_build_dir / "index.html"
        if index_file.exists():
            return FileResponse(index_file)
        raise HTTPException(status_code=404, detail="Frontend build not found.")

    @router.get("/{full_path:path}")
    def serve_frontend_routes(full_path: str):
        if full_path.startswith(
            ("health", "documents", "query", "object-detection", "image-generation", "contact-requests", "linked-providers", "workspace", "chat", "openapi.json", "docs", "redoc")
        ):
            raise HTTPException(status_code=404, detail="Not found.")

        asset_path = frontend_build_dir / full_path
        if asset_path.exists() and asset_path.is_file():
            return FileResponse(asset_path)

        index_file = frontend_build_dir / "index.html"
        if index_file.exists():
            return FileResponse(index_file)

        raise HTTPException(status_code=404, detail="Frontend build not found.")

    return router
