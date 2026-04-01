import base64
import io
import random
import ssl

import torch
from diffusers import EulerDiscreteScheduler, StableDiffusionXLPipeline, UNet2DConditionModel
from huggingface_hub import hf_hub_download
from safetensors.torch import load_file

from app.core.config import (
    IMAGE_GENERATION_BASE_MODEL,
    IMAGE_GENERATION_GUIDANCE_SCALE,
    IMAGE_GENERATION_HEIGHT,
    IMAGE_GENERATION_LOCAL_FILES_ONLY,
    IMAGE_GENERATION_REPO,
    IMAGE_GENERATION_STEPS,
    IMAGE_GENERATION_UNET_WEIGHTS,
    IMAGE_GENERATION_WIDTH,
)


class ImageGenerationService:
    """Generate images with a locally available SDXL Lightning pipeline."""

    def __init__(self) -> None:
        self.pipeline: StableDiffusionXLPipeline | None = None
        self.device = "cuda" if torch.cuda.is_available() else "cpu"
        self.dtype = torch.float16 if self.device == "cuda" else torch.float32
        self.xformers_enabled = False
        if self.device == "cuda":
            torch.backends.cuda.matmul.allow_tf32 = True
            torch.backends.cudnn.allow_tf32 = True
            torch.set_float32_matmul_precision("high")

    def get_status(self) -> dict:
        mode_message = (
            "The SDXL Lightning pipeline loads from local model files on first request."
            if IMAGE_GENERATION_LOCAL_FILES_ONLY
            else "The SDXL Lightning pipeline downloads required model files on first request if they are not cached yet."
        )
        performance_hint = (
            "GPU detected. Generation should be much faster."
            if self.device == "cuda"
            else "GPU not detected. Image generation is running on CPU and may take a few minutes per request."
        )
        return {
            "status": "ready",
            "message": f"Image generation route is available. {mode_message}",
            "base_model": IMAGE_GENERATION_BASE_MODEL,
            "weights_repo": IMAGE_GENERATION_REPO,
            "weights_file": IMAGE_GENERATION_UNET_WEIGHTS,
            "steps": IMAGE_GENERATION_STEPS,
            "local_files_only": IMAGE_GENERATION_LOCAL_FILES_ONLY,
            "device": self.device,
            "performance_hint": performance_hint,
        }

    def generate_image(self, prompt: str, negative_prompt: str = "", seed: int | None = None) -> dict:
        cleaned_prompt = prompt.strip()
        if not cleaned_prompt:
            raise ValueError("Prompt cannot be empty.")

        pipe = self._get_pipeline()
        resolved_seed = seed if seed is not None else random.randint(0, 2_147_483_647)
        generator = torch.Generator(device=self.device).manual_seed(resolved_seed)

        result = pipe(
            prompt=cleaned_prompt,
            negative_prompt=negative_prompt.strip() or None,
            num_inference_steps=IMAGE_GENERATION_STEPS,
            guidance_scale=IMAGE_GENERATION_GUIDANCE_SCALE,
            width=IMAGE_GENERATION_WIDTH,
            height=IMAGE_GENERATION_HEIGHT,
            generator=generator,
        )

        image = result.images[0]
        buffer = io.BytesIO()
        image.save(buffer, format="PNG")

        return {
            "prompt": cleaned_prompt,
            "negative_prompt": negative_prompt.strip(),
            "seed": resolved_seed,
            "steps": IMAGE_GENERATION_STEPS,
            "guidance_scale": IMAGE_GENERATION_GUIDANCE_SCALE,
            "width": IMAGE_GENERATION_WIDTH,
            "height": IMAGE_GENERATION_HEIGHT,
            "device": self.device,
            "xformers_enabled": self.xformers_enabled,
            "model": f"{IMAGE_GENERATION_REPO}/{IMAGE_GENERATION_UNET_WEIGHTS}",
            "mime_type": "image/png",
            "image_base64": base64.b64encode(buffer.getvalue()).decode("utf-8"),
        }

    def _get_pipeline(self) -> StableDiffusionXLPipeline:
        if self.pipeline is not None:
            return self.pipeline

        try:
            unet = UNet2DConditionModel.from_config(
                IMAGE_GENERATION_BASE_MODEL,
                subfolder="unet",
                local_files_only=IMAGE_GENERATION_LOCAL_FILES_ONLY,
            ).to(self.device, self.dtype)

            checkpoint_path = hf_hub_download(
                repo_id=IMAGE_GENERATION_REPO,
                filename=IMAGE_GENERATION_UNET_WEIGHTS,
                local_files_only=IMAGE_GENERATION_LOCAL_FILES_ONLY,
            )
            state_dict = load_file(checkpoint_path, device=self.device)
            unet.load_state_dict(state_dict)

            pipeline_kwargs = {
                "pretrained_model_name_or_path": IMAGE_GENERATION_BASE_MODEL,
                "unet": unet,
                "torch_dtype": self.dtype,
                "local_files_only": IMAGE_GENERATION_LOCAL_FILES_ONLY,
                "use_safetensors": True,
            }
            if self.device == "cuda":
                pipeline_kwargs["variant"] = "fp16"

            pipe = StableDiffusionXLPipeline.from_pretrained(**pipeline_kwargs).to(self.device)
            pipe.scheduler = EulerDiscreteScheduler.from_config(
                pipe.scheduler.config,
                timestep_spacing="trailing",
            )
            pipe.set_progress_bar_config(disable=True)

            if self.device == "cuda":
                pipe.unet.to(memory_format=torch.channels_last)
                pipe.enable_vae_slicing()
                try:
                    pipe.enable_xformers_memory_efficient_attention()
                    self.xformers_enabled = True
                except Exception:
                    self.xformers_enabled = False
            else:
                pipe.enable_attention_slicing()

            self.pipeline = pipe
            return pipe
        except Exception as exc:
            if isinstance(exc, ssl.SSLError):
                raise RuntimeError(
                    "Secure download from Hugging Face failed. "
                    "Verify the server has outbound HTTPS access and valid CA certificates installed."
                ) from exc
            if IMAGE_GENERATION_LOCAL_FILES_ONLY:
                raise RuntimeError(
                    "Image generation model files are not available locally. "
                    "Add the SDXL base model and SDXL Lightning weights to the Docker image cache first."
                ) from exc
            raise RuntimeError(f"Image generation pipeline failed to load: {exc}") from exc
