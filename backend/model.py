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


WORD_RE = re.compile(r"\b[a-zA-Z0-9]+\b")

STOPWORDS = {
    "a",
    "an",
    "and",
    "are",
    "as",
    "at",
    "be",
    "by",
    "for",
    "from",
    "how",
    "in",
    "is",
    "it",
    "of",
    "on",
    "or",
    "that",
    "the",
    "this",
    "to",
    "was",
    "what",
    "when",
    "where",
    "which",
    "who",
    "why",
    "with",
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

        self.embedding_model: Optional[SentenceTransformer] = None
        self.index = None
        self.chunk_map: List[DocumentChunk] = []

    def _load_model(self):
        if self.embedding_model is None:
            try:
                self.embedding_model = SentenceTransformer("all-MiniLM-L6-v2")
            except Exception as exc:
                raise RuntimeError(f"Embedding model failed to load: {exc}") from exc

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
            raise ValueError("No readable text found.")

        doc_id = f"{session_id}-{filename}"
        chunk_texts = self._chunk_text(text)
        chunks = [
            DocumentChunk(doc_id, session_id, filename, chunk_text, i)
            for i, chunk_text in enumerate(chunk_texts, start=1)
        ]

        self._load_model()
        texts = [chunk.text for chunk in chunks]
        embeddings = self.embedding_model.encode(texts, convert_to_numpy=True)
        embeddings = np.asarray(embeddings, dtype="float32")

        dim = embeddings.shape[1]
        self.index = faiss.IndexFlatL2(dim)
        self.index.add(embeddings)
        self.chunk_map = chunks

        self.documents_by_session[session_id] = SessionDocument(
            doc_id=doc_id,
            session_id=session_id,
            filename=filename,
            text=text,
            chunks=chunks,
            file_path=file_path,
        )

        return {"chunks": len(chunks), "filename": filename, "session_id": session_id}

    def query(self, question: str, session_id: str):
        document = self._get_or_load_session_document(session_id)
        if not document:
            raise ValueError("Upload document first.")

        direct_answer = self._answer_direct_field(question, document.text)
        if direct_answer:
            return {
                "answer": direct_answer,
                "sources": [
                    {
                        "filename": document.filename,
                        "chunk_id": 1,
                        "excerpt": document.text[:220],
                    }
                ],
            }

        retrieved = self._retrieve(question, document.chunks)
        answer = self._normalize_answer_format(self._generate_answer(question, retrieved))

        return {
            "answer": answer,
            "sources": [
                {
                    "filename": chunk.filename,
                    "chunk_id": chunk.chunk_id,
                    "excerpt": chunk.text[:220],
                }
                for chunk in retrieved
            ],
        }

    def indexed_document_count(self) -> int:
        return len(self.documents_by_session)

    def indexed_chunk_count(self) -> int:
        return len(self.chunk_map)

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

        file_path = max(candidates, key=lambda path: path.stat().st_mtime)
        content = file_path.read_bytes()
        text = self._extract_text(content, file_path.name)
        if not text.strip():
            return None

        doc_id = f"{session_id}-{file_path.name}"
        chunk_texts = self._chunk_text(text)
        chunks = [
            DocumentChunk(doc_id, session_id, file_path.name, chunk_text, i)
            for i, chunk_text in enumerate(chunk_texts, start=1)
        ]

        document = SessionDocument(
            doc_id=doc_id,
            session_id=session_id,
            filename=file_path.name,
            text=text,
            chunks=chunks,
            file_path=file_path,
        )
        self.documents_by_session[session_id] = document
        return document

    def _retrieve(self, question: str, chunks: List[DocumentChunk]) -> List[DocumentChunk]:
        if not chunks:
            return []

        if self.index is None or not self.chunk_map:
            return chunks[:TOP_K_RESULTS]

        self._load_model()
        query_embedding = self.embedding_model.encode([question], convert_to_numpy=True)
        query_embedding = np.asarray(query_embedding, dtype="float32")

        _, indices = self.index.search(query_embedding, TOP_K_RESULTS)
        results: List[DocumentChunk] = []
        seen = set()
        for idx in indices[0]:
            if 0 <= idx < len(self.chunk_map) and idx not in seen:
                seen.add(idx)
                results.append(self.chunk_map[idx])

        return results or chunks[:TOP_K_RESULTS]

    def _answer_direct_field(self, question: str, text: str) -> Optional[str]:
        lower_question = question.lower().strip()
        lower_text = text.lower()

        patterns = []
        if any(word in lower_question for word in ["name", "candidate", "person"]):
            patterns.extend([r"(?im)^\s*name\s*[:\-]\s*(.+)$", r"(?im)^\s*full name\s*[:\-]\s*(.+)$"])
        if any(word in lower_question for word in ["email", "mail"]):
            patterns.append(r"[\w.\-+]+@[\w.\-]+\.\w+")
        if "phone" in lower_question or "mobile" in lower_question or "contact" in lower_question:
            patterns.append(r"(?im)^\s*(?:phone|mobile|contact)\s*[:\-]\s*(.+)$")
        if any(word in lower_question for word in ["role", "title", "designation", "position"]):
            patterns.extend([r"(?im)^\s*(?:role|title|designation|position)\s*[:\-]\s*(.+)$"])

        for pattern in patterns:
            match = re.search(pattern, text, re.IGNORECASE | re.MULTILINE)
            if match:
                value = match.group(1) if match.groups() else match.group(0)
                value = value.strip()
                if value:
                    return value

        for keyword, synonyms in QUERY_SYNONYMS.items():
            if keyword in lower_question or any(syn in lower_question for syn in synonyms):
                for line in text.splitlines():
                    if keyword in line.lower():
                        return line.strip()

        if "summary" in lower_question and len(text.split()) <= 120:
            return text.strip()

        return None

    def _generate_answer(self, question: str, retrieved: List[DocumentChunk]) -> str:
        context = "\n\n".join(
            f"Source {i + 1} ({chunk.filename}, chunk {chunk.chunk_id}):\n{chunk.text}"
            for i, chunk in enumerate(retrieved)
        )

        prompt = (
            "You are a document question answering assistant.\n"
            "Answer only using the provided context.\n"
            "If the answer is not present, say exactly: Not in document.\n"
            "Keep the answer concise and factual.\n\n"
            f"Question: {question}\n\n"
            f"Context:\n{context}"
        )

        response = self.client.chat.completions.create(
            model=GROQ_MODEL,
            messages=[
                {"role": "system", "content": "You answer strictly from the given document context."},
                {"role": "user", "content": prompt},
            ],
            temperature=0.2,
        )
        return response.choices[0].message.content or "Not in document."

    def _normalize_answer_format(self, answer: str) -> str:
        answer = (answer or "").replace("\r\n", "\n").strip()
        if not answer:
            return "Not in document."
        if "not in document" in answer.lower():
            return "Not in document."
        return answer

    def _chunk_text(self, text: str) -> List[str]:
        words = text.split()
        if not words:
            return []

        chunk_size = max(50, CHUNK_SIZE)
        overlap = max(0, min(CHUNK_OVERLAP, chunk_size - 1))

        chunks: List[str] = []
        start = 0
        while start < len(words):
            end = min(len(words), start + chunk_size)
            chunk = " ".join(words[start:end]).strip()
            if chunk:
                chunks.append(chunk)
            if end >= len(words):
                break
            start = max(end - overlap, start + 1)

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
        return re.sub(r"[^A-Za-z0-9._ -]", "_", cleaned) or "document.txt"
