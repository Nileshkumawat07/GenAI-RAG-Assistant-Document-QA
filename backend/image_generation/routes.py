from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from .service import ImageGenerationService


router = APIRouter(prefix="/image-generation", tags=["image-generation"])
service = ImageGenerationService()


class ImageGenerationRequest(BaseModel):
    prompt: str


@router.get("/health")
def image_generation_health():
    return service.get_status()


@router.post("/generate")
def generate_image(payload: ImageGenerationRequest):
    if not payload.prompt.strip():
        raise HTTPException(status_code=400, detail="Prompt cannot be empty.")

    return service.generate(payload.prompt.strip())
