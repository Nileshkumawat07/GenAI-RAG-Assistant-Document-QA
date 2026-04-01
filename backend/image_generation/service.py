class ImageGenerationService:
    """Placeholder image generation service for future implementation."""

    def get_status(self) -> dict:
        return {
            "status": "ready",
            "message": "Image generation scaffold is available.",
        }

    def generate(self, prompt: str) -> dict:
        return {
            "status": "not_implemented",
            "message": "Image generation is not implemented yet.",
            "prompt": prompt,
        }
