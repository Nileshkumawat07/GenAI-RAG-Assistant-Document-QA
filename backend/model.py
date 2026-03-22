import io
import re
import shutil
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List

from fastapi import UploadFile
from openai import OpenAI
from pypdf import PdfReader

# NEW
import faiss
import numpy as np
from sentence_transformers import SentenceTransformer

from config import CHUNK_OVERLAP, CHUNK_SIZE, DOCUMENTS_DIR, GROQ_API_KEY, GROQ_MODEL, TOP_K_RESULTS


WORD_RE = re.compile(r"\b[a-zA-Z0-9]+\b")

STOPWORDS = {
    "a","an","and","are","as","at","be","by","for","from","how","in","is","it","of",
    "on","or","that","the","this","to","was","what","when","where","which","who",
    "why","with",
}

QUERY_SYNONYMS = {
    "summary": ["overview", "abstract", "introduction"],
    "details": ["information", "facts", "content"],
    "steps": ["procedure", "process", "instructions"],
    "requirements": ["criteria", "conditions", "prerequisites"],
    "deadline": ["due date", "last date", "closing date"],
    "price": ["cost", "amount", "fee"],
    "contact": ["email", "phone", "mobile", "address"],
    "author": ["writer", "creator", "publisher"],
    "location": ["address", "city", "place"],
    "date": ["time", "period", "duration"],
}


@dataclass
class DocumentChunk:
    doc_id: str
    session_id: str
    filename: str
    text: str
    chunk_id: int


@dataclass
class SessionDocument:
    doc_id: str
    session_id: str
    filename: str
    text: str
    chunks: List[DocumentChunk]
    file_path: Path


class RAGService:
    def __init__(self):
        self.documents_by_session: Dict[str, SessionDocument] = {}

        if not GROQ_API_KEY or GROQ_API_KEY == "<SECRET>":
            raise ValueError("Set GROQ_API_KEY")

        DOCUMENTS_DIR.mkdir(parents=True, exist_ok=True)

        self.client = OpenAI(
            api_key=GROQ_API_KEY,
            base_url="https://api.groq.com/openai/v1",
        )

        # NEW: embedding + FAISS
        self.embedding_model = SentenceTransformer("all-MiniLM-L6-v2")
        self.index = None
        self.chunk_map = []

    async def ingest(self, upload: UploadFile, session_id: str):
        content = await upload.read()
        filename = self._sanitize_filename(upload.filename or "document.txt")

        session_dir = self._session_dir(session_id)
        self._reset_session_storage(session_dir)

        file_path = session_dir / filename
        file_path.write_bytes(content)

        text = self._extract_text(content, filename)

        if not text.strip():
            if file_path.exists():
                file_path.unlink()
            raise ValueError("No readable text found")

        doc_id = f"{session_id}-{filename}"
        chunk_texts = self._chunk_text(text)

        chunks = [
            DocumentChunk(doc_id, session_id, filename, chunk_text, i)
            for i, chunk_text in enumerate(chunk_texts, start=1)
        ]

        # NEW: create embeddings + FAISS index
        texts = [c.text for c in chunks]
        embeddings = self.embedding_model.encode(texts, convert_to_numpy=True)

        dim = embeddings.shape[1]
        self.index = faiss.IndexFlatL2(dim)
        self.index.add(embeddings)

        self.chunk_map = chunks

        self.documents_by_session[session_id] = SessionDocument(
            doc_id, session_id, filename, text, chunks, file_path
        )

        return {"chunks": len(chunks), "filename": filename, "session_id": session_id}

    def query(self, question: str, session_id: str):
        document = self._get_or_load_session_document(session_id)

        if not document:
            raise ValueError("Upload document first")

        direct_answer = self._answer_direct_field(question, document.text)
        if direct_answer:
            return {
                "answer": direct_answer,
                "sources": [{
                    "filename": document.filename,
                    "chunk_id": 1,
                    "excerpt": document.text[:220],
                }],
            }

        retrieved = self._retrieve(question, document.chunks)

        answer = self._normalize_answer_format(
            self._generate_answer(question, retrieved)
        )

        return {
            "answer": answer,
            "sources": [
                {
                    "filename": c.filename,
                    "chunk_id": c.chunk_id,
                    "excerpt": c.text[:220],
                }
                for c in retrieved
            ],
        }

    # ======================
    # ONLY THIS CHANGED (FAISS)
    # ======================
    def _retrieve(self, question: str, chunks: List[DocumentChunk]) -> List[DocumentChunk]:

        if self.index is None:
            return chunks[:TOP_K_RESULTS]

        query_embedding = self.embedding_model.encode([question], convert_to_numpy=True)

        distances, indices = self.index.search(query_embedding, TOP_K_RESULTS)

        results = []
        for idx in indices[0]:
            if idx < len(self.chunk_map):
                results.append(self.chunk_map[idx])

        return results

    # ======================
    # REST SAME (UNCHANGED)
    # ======================

    def _tokenize(self, text: str) -> List[str]:
        return [
            token for token in (m.group(0).lower() for m in WORD_RE.finditer(text))
            if token not in STOPWORDS
        ]

    def _extract_text(self, content: bytes, filename: str) -> str:
        if filename.lower().endswith(".pdf"):
            reader = PdfReader(io.BytesIO(content))
            return "\n".join(page.extract_text() or "" for page in reader.pages)
        return content.decode("utf-8", errors="ignore")

    def _session_dir(self, session_id: str) -> Path:
        return DOCUMENTS_DIR / session_id

    def _reset_session_storage(self, session_dir: Path):
        if session_dir.exists():
            shutil.rmtree(session_dir)
        session_dir.mkdir(parents=True, exist_ok=True)

    def _sanitize_filename(self, filename: str) -> str:
        cleaned = Path(filename).name.strip()
        return re.sub(r"[^A-Za-z0-9._ -]", "_", cleaned) or "document.txt"