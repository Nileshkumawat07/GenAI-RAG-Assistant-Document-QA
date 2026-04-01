from typing import Optional

from pydantic import BaseModel, Field


class ImageGenerationRequest(BaseModel):
    prompt: str = Field(..., min_length=1, description="Text prompt for image generation.")
    negative_prompt: Optional[str] = Field(
        default="",
        description="Optional negative prompt to steer the image away from unwanted elements.",
    )
    seed: Optional[int] = Field(
        default=None,
        ge=0,
        description="Optional deterministic seed. Omit to generate a random one.",
    )
