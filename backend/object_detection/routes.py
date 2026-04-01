from fastapi import APIRouter, File, HTTPException, UploadFile

from .service import ObjectDetectionService


router = APIRouter(prefix="/object-detection", tags=["object-detection"])
service = ObjectDetectionService()


@router.get("/health")
def object_detection_health():
    return service.get_status()


@router.post("/detect")
async def detect_objects(file: UploadFile = File(...)):
    filename = file.filename or "image"
    if not filename.lower().endswith((".jpg", ".jpeg", ".png", ".webp")):
        raise HTTPException(status_code=400, detail="Only JPG, JPEG, PNG, and WEBP files are allowed.")

    image_bytes = await file.read()
    if not image_bytes:
        raise HTTPException(status_code=400, detail="Uploaded image is empty.")

    try:
        return service.detect_objects(image_bytes, filename)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(status_code=502, detail=f"Object detection failed: {exc}") from exc
