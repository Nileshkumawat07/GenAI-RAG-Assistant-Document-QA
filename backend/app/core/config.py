import os
from pathlib import Path

from dotenv import load_dotenv


BASE_DIR = Path(__file__).resolve().parents[2]

load_dotenv(BASE_DIR / ".env")

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "").strip()
GROQ_MODEL = os.getenv("GROQ_MODEL", "llama3-70b-8192").strip()
OBJECT_DETECTION_MODEL = os.getenv(
    "OBJECT_DETECTION_MODEL",
    "meta-llama/llama-4-scout-17b-16e-instruct",
).strip()
CHUNK_SIZE = int(os.getenv("CHUNK_SIZE", "700"))
CHUNK_OVERLAP = int(os.getenv("CHUNK_OVERLAP", "120"))
TOP_K_RESULTS = int(os.getenv("TOP_K_RESULTS", "8"))
FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "http://localhost:3000").strip()
DOCUMENTS_DIR = Path(os.getenv("DOCUMENTS_DIR", str(BASE_DIR / "documents"))).resolve()
EMBEDDING_MODEL_NAME = os.getenv(
    "EMBEDDING_MODEL_NAME",
    "all-MiniLM-L6-v2",
).strip()
IMAGE_GENERATION_BASE_MODEL = os.getenv(
    "IMAGE_GENERATION_BASE_MODEL",
    "stabilityai/stable-diffusion-xl-base-1.0",
).strip()
IMAGE_GENERATION_REPO = os.getenv(
    "IMAGE_GENERATION_REPO",
    "ByteDance/SDXL-Lightning",
).strip()
IMAGE_GENERATION_UNET_WEIGHTS = os.getenv(
    "IMAGE_GENERATION_UNET_WEIGHTS",
    "sdxl_lightning_4step_unet.safetensors",
).strip()
IMAGE_GENERATION_STEPS = int(os.getenv("IMAGE_GENERATION_STEPS", "4"))
IMAGE_GENERATION_GUIDANCE_SCALE = float(os.getenv("IMAGE_GENERATION_GUIDANCE_SCALE", "0"))
IMAGE_GENERATION_WIDTH = int(os.getenv("IMAGE_GENERATION_WIDTH", "512"))
IMAGE_GENERATION_HEIGHT = int(os.getenv("IMAGE_GENERATION_HEIGHT", "512"))
IMAGE_GENERATION_LOCAL_FILES_ONLY = os.getenv(
    "IMAGE_GENERATION_LOCAL_FILES_ONLY",
    "false",
).strip().lower() in {"1", "true", "yes", "on"}

AWS_REGION = os.getenv("AWS_REGION", "").strip()
SES_FROM_EMAIL = os.getenv("SES_FROM_EMAIL", "").strip()
AWS_ACCESS_KEY_ID = os.getenv("AWS_ACCESS_KEY_ID", "").strip()
AWS_SECRET_ACCESS_KEY = os.getenv("AWS_SECRET_ACCESS_KEY", "").strip()

OTP_LENGTH = int(os.getenv("OTP_LENGTH", "6"))
OTP_TTL_SECONDS = int(os.getenv("OTP_TTL_SECONDS", "600"))
OTP_RESEND_COOLDOWN_SECONDS = int(os.getenv("OTP_RESEND_COOLDOWN_SECONDS", "30"))
