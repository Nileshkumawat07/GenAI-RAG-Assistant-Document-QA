from fastapi import APIRouter, HTTPException

from app.schemas.image_generation import ImageGenerationRequest
from app.services.image_generation_service import ImageGenerationService


def build_image_generation_router() -> APIRouter:
    router = APIRouter(prefix="/image-generation", tags=["image-generation"])
    service = ImageGenerationService()

    @router.get("/health")
    def image_generation_health():
        return service.get_status()

    @router.post("/generate")
    def generate_image(payload: ImageGenerationRequest):
        try:
            return service.generate_image(
                prompt=payload.prompt,
                negative_prompt=payload.negative_prompt or "",
                seed=payload.seed,
            )
        except ValueError as exc:
            raise HTTPException(status_code=400, detail=str(exc)) from exc
        except RuntimeError as exc:
            raise HTTPException(status_code=503, detail=str(exc)) from exc
        except Exception as exc:
            raise HTTPException(status_code=502, detail=f"Image generation failed: {exc}") from exc

    return router
