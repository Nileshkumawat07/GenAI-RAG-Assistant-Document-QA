from fastapi import APIRouter, File, HTTPException, UploadFile

from app.services.object_detection_service import ObjectDetectionService


def build_object_detection_router() -> APIRouter:
    router = APIRouter(prefix="/object-detection", tags=["object-detection"])
    service = ObjectDetectionService()

    @router.get("/health")
    def object_detection_health():
        return service.get_status()

    @router.post("/detect")
    async def detect_objects(file: UploadFile = File(...)):
        filename = file.filename or "image"
        content_type = (file.content_type or "").lower()
        is_supported_extension = filename.lower().endswith((".jpg", ".jpeg", ".png", ".webp"))
        is_supported_content_type = content_type in {"image/jpeg", "image/png", "image/webp"}

        if not is_supported_extension and not is_supported_content_type:
            raise HTTPException(
                status_code=400,
                detail="Only JPG, JPEG, PNG, and WEBP files are allowed.",
            )

        image_bytes = await file.read()
        if not image_bytes:
            raise HTTPException(status_code=400, detail="Uploaded image is empty.")

        try:
            return service.detect_objects(image_bytes, filename, content_type)
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        except Exception as exc:
            raise HTTPException(status_code=502, detail=f"Object detection failed: {exc}") from exc

    return router
