import os
from pathlib import Path

from dotenv import load_dotenv


BASE_DIR = Path(__file__).resolve().parent  # Path of the backend folder.

load_dotenv(BASE_DIR / ".env")  # Load values from `backend/.env`.

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "").strip()  # API key for the AI model.

GROQ_MODEL = os.getenv("GROQ_MODEL", "llama-3.1-8b-instant").strip()  # Model name used to create answers.

CHUNK_SIZE = int(os.getenv("CHUNK_SIZE", "700"))  # Size of each text chunk.

CHUNK_OVERLAP = int(os.getenv("CHUNK_OVERLAP", "120"))  # Overlap between chunks.

TOP_K_RESULTS = int(os.getenv("TOP_K_RESULTS", "8"))  # Number of top chunks used for answering.

FRONTEND_ORIGIN = os.getenv("FRONTEND_ORIGIN", "http://localhost:3000").strip()  # Frontend URL allowed to use this backend.

DOCUMENTS_DIR = Path(os.getenv("DOCUMENTS_DIR", str(BASE_DIR / "documents"))).resolve()  # Folder where uploaded files are saved.
