import io
import re
import shutil
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List, Optional

import faiss
import numpy as np
from fastapi import UploadFile
from openai import OpenAI
from pypdf import PdfReader
from sentence_transformers import SentenceTransformer

from config import CHUNK_OVERLAP, CHUNK_SIZE, DOCUMENTS_DIR, GROQ_API_KEY, GROQ_MODEL, TOP_K_RESULTS


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

        self.embedding_model: Optional[SentenceTransformer] = None
        self.index = None
        self.chunk_map: List[DocumentChunk] = []

    def _load_model(self):
        if self.embedding_model is None:
            self.embedding_model = SentenceTransformer("all-MiniLM-L6-v2")

    async def ingest(self, upload: UploadFile, session_id: str):
        content = await upload.read()
        filename = self._sanitize_filename(upload.filename or "document.txt")

        session_dir = self._session_dir(session_id)
        self._reset_session_storage(session_dir)

        file_path = session_dir / filename
        file_path.write_bytes(content)

        text = self._extract_text(content, filename)
        if not text.strip():
            raise ValueError("No readable text found.")

        doc_id = f"{session_id}-{filename}"
        chunk_texts = self._chunk_text(text)

        chunks = [
            DocumentChunk(doc_id, session_id, filename, chunk_text, i)
            for i, chunk_text in enumerate(chunk_texts, start=1)
        ]

        self._load_model()

        texts = [c.text for c in chunks]
        embeddings = self.embedding_model.encode(texts, convert_to_numpy=True)
        embeddings = embeddings / np.linalg.norm(embeddings, axis=1, keepdims=True)

        dim = embeddings.shape[1]
        self.index = faiss.IndexFlatIP(dim)  # cosine similarity
        self.index.add(embeddings.astype("float32"))

        self.chunk_map = chunks

        self.documents_by_session[session_id] = SessionDocument(
            doc_id, session_id, filename, text, chunks, file_path
        )

        return {"chunks": len(chunks), "filename": filename}

    def query(self, question: str, session_id: str):
        document = self._get_or_load_session_document(session_id)
        if not document:
            raise ValueError("Upload document first.")

        retrieved = self._retrieve(question)

        answer = self._generate_answer(question, retrieved)

        return {
            "answer": answer,
            "sources": [
                {
                    "filename": c.filename,
                    "chunk_id": c.chunk_id,
                    "excerpt": c.text[:200],
                }
                for c in retrieved
            ],
        }

    def indexed_document_count(self) -> int:
        return len(self.documents_by_session)

    def indexed_chunk_count(self) -> int:
        return len(self.chunk_map)

    def _retrieve(self, question: str) -> List[DocumentChunk]:
        if self.index is None:
            return self.chunk_map[:TOP_K_RESULTS]

        self._load_model()

        query_embedding = self.embedding_model.encode([question], convert_to_numpy=True)
        query_embedding = query_embedding / np.linalg.norm(query_embedding, axis=1, keepdims=True)

        scores, indices = self.index.search(query_embedding.astype("float32"), TOP_K_RESULTS)

        results = []
        for idx in indices[0]:
            if 0 <= idx < len(self.chunk_map):
                results.append(self.chunk_map[idx])

        return results

    def _get_or_load_session_document(self, session_id: str) -> Optional[SessionDocument]:
        document = self.documents_by_session.get(session_id)
        if document:
            return document

        session_dir = self._session_dir(session_id)
        if not session_dir.exists():
            return None

        candidates = [path for path in session_dir.iterdir() if path.is_file()]
        if not candidates:
            return None

        file_path = candidates[0]
        try:
            content = file_path.read_bytes()
        except OSError:
            return None

        text = self._extract_text(content, file_path.name)
        if not text.strip():
            return None

        chunk_texts = self._chunk_text(text)
        chunks = [
            DocumentChunk(
                doc_id=f"{session_id}-{file_path.name}",
                session_id=session_id,
                filename=file_path.name,
                text=chunk_text,
                chunk_id=i,
            )
            for i, chunk_text in enumerate(chunk_texts, start=1)
        ]

        self._load_model()
        texts = [c.text for c in chunks]
        embeddings = self.embedding_model.encode(texts, convert_to_numpy=True)
        embeddings = embeddings / np.linalg.norm(embeddings, axis=1, keepdims=True)

        dim = embeddings.shape[1]
        self.index = faiss.IndexFlatIP(dim)
        self.index.add(embeddings.astype("float32"))
        self.chunk_map = chunks

        document = SessionDocument(
            doc_id=f"{session_id}-{file_path.name}",
            session_id=session_id,
            filename=file_path.name,
            text=text,
            chunks=chunks,
            file_path=file_path,
        )
        self.documents_by_session[session_id] = document
        return document

    def _generate_answer(self, question: str, retrieved: List[DocumentChunk]) -> str:
        context = "\n\n".join(chunk.text for chunk in retrieved)

        prompt = f"""
You MUST answer ONLY from the provided context.
If the answer is NOT clearly present, reply exactly: Not in document.
DO NOT guess. DO NOT add extra info.

Question:
{question}

Context:
{context}
"""

        try:
            response = self.client.chat.completions.create(
                model=GROQ_MODEL,
                messages=[{"role": "user", "content": prompt}],
                temperature=0,
            )
            return response.choices[0].message.content.strip()
        except Exception:
            return "Not in document."

    def _chunk_text(self, text: str) -> List[str]:
        sentences = re.split(r'(?<=[.!?]) +', text)

        chunks = []
        chunk = ""

        for sentence in sentences:
            if len(chunk) + len(sentence) < CHUNK_SIZE:
                chunk += " " + sentence
            else:
                chunks.append(chunk.strip())
                chunk = sentence

        if chunk:
            chunks.append(chunk.strip())

        return chunks

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
        cleaned = re.sub(r"[^A-Za-z0-9._-]", "_", cleaned)
        return cleaned
