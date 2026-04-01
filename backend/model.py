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
    start_char: int = 0
    end_char: int = 0


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

        ranked: Dict[int, float] = {}
        question_terms = self._question_terms(question)

        for rank, idx in enumerate(indices[0]):
            if 0 <= idx < len(self.chunk_map):
                ranked[idx] = float(scores[0][rank])

        for idx, chunk in enumerate(self.chunk_map):
            lexical_score = self._lexical_overlap_score(question_terms, chunk.text)
            if lexical_score > 0:
                ranked[idx] = max(ranked.get(idx, 0.0), lexical_score + 0.25)

        if not ranked:
            return self.chunk_map[:TOP_K_RESULTS]

        ordered = sorted(ranked.items(), key=lambda item: item[1], reverse=True)
        return [self.chunk_map[idx] for idx, _ in ordered[:TOP_K_RESULTS]]

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
        context = self._build_context(retrieved)
        fallback_answer = self._extract_answer_from_context(question, context)
        response_style = self._response_style(question)
        prompt = self._build_prompt(question, context, response_style)

        try:
            response = self.client.responses.create(
                model=GROQ_MODEL,
                input=prompt,
                temperature=0.1,
                top_p=0.9,
            )
            answer = (response.output_text or "").strip()
            normalized = answer.lower().strip().rstrip(".")
            if answer and normalized != "not in document":
                return self._clean_answer(answer)
        except Exception as exc:
            if fallback_answer:
                return self._clean_answer(fallback_answer)
            raise RuntimeError(f"Document retrieval LLM request failed: {exc}") from exc

        return self._clean_answer(fallback_answer) if fallback_answer else "Not in document."

    def _extract_answer_from_context(self, question: str, context: str) -> Optional[str]:
        if not context.strip():
            return None

        keywords = self._question_terms(question)
        wants_contact = self._question_requests_contact(question)
        candidates = [line.strip() for line in re.split(r"[\n\r]+|(?<=[.!?])\s+", context) if line.strip()]
        if not candidates:
            return None

        scored_candidates = []
        for candidate in candidates:
            score = self._lexical_overlap_score(keywords, candidate)

            # Only boost contact fields when the question is explicitly asking for them.
            if wants_contact and re.search(r"\b[\w.+-]+@[\w-]+\.[\w.-]+\b", candidate):
                score += 3
            if wants_contact and re.search(r"\b(?:\+?\d[\d\s().-]{7,}\d)\b", candidate):
                score += 2
            if "skill" in keywords and re.search(r"\b(skill|skills|technology|technologies|tools|stack)\b", candidate, re.I):
                score += 1.5

            if score > 0:
                scored_candidates.append((score, len(candidate), candidate))

        if not scored_candidates:
            return None

        scored_candidates.sort(key=lambda item: (-item[0], item[1]))
        best = scored_candidates[0][2]
        return best.strip()

    def _question_requests_contact(self, question: str) -> bool:
        q = question.lower()
        return any(
            word in q
            for word in ["contact", "email", "phone", "mobile", "number", "reach", "call"]
        )

    def _build_context(self, retrieved: List[DocumentChunk]) -> str:
        if not retrieved:
            return ""

        parts = []
        for chunk in retrieved:
            parts.append(
                f"[Chunk {chunk.chunk_id} | {chunk.filename}]\n{chunk.text.strip()}"
            )
        return "\n\n".join(parts)

    def _build_prompt(self, question: str, context: str, response_style: str) -> str:
        return f"""
Answer the question using only the context below.
If the answer is not clearly present, reply exactly: Not in document.
Do not use outside knowledge.
Do not add disclaimers, filler, or reasoning steps.

Formatting rules:
- Keep the answer grounded in the document.
- If there are multiple facts, use bullet points.
- If the question asks for steps, use a numbered list.
- If the question asks for contact details, return each field on its own line.
- If the question asks for a summary, write a short heading and then 3-6 bullets.
- If the answer is a single fact, answer in one short sentence.

Desired style:
{response_style}

Question:
{question}

Context:
{context}
"""

    def _response_style(self, question: str) -> str:
        q = question.lower()
        if any(word in q for word in ["how to", "steps", "process", "procedure", "instructions", "guide"]):
            return "Provide a numbered step-by-step answer."
        if any(word in q for word in ["list", "skills", "names", "emails", "phone", "contact", "details"]):
            return "Provide a clean bullet list or field-by-field answer."
        if any(word in q for word in ["summary", "summarize", "overview"]):
            return "Provide a short summary with bullets."
        return "Provide the most direct factual answer, using bullets only when it improves readability."

    def _question_terms(self, question: str) -> set[str]:
        stop_words = {
            "what",
            "when",
            "where",
            "which",
            "who",
            "whom",
            "whose",
            "does",
            "do",
            "did",
            "the",
            "and",
            "for",
            "with",
            "from",
            "this",
            "that",
            "about",
            "document",
            "file",
            "please",
            "tell",
            "show",
            "give",
            "me",
            "info",
            "information",
            "are",
            "is",
            "was",
            "were",
            "can",
            "could",
            "would",
            "should",
            "list",
            "explain",
        }
        terms = set()
        for word in re.split(r"\W+", question.lower()):
            word = word.strip()
            if len(word) > 2 and word not in stop_words:
                terms.add(word)
        return terms

    def _lexical_overlap_score(self, terms: set[str], text: str) -> float:
        if not terms:
            return 0.0

        candidate_words = {
            word.strip().lower()
            for word in re.split(r"\W+", text)
            if len(word.strip()) > 2
        }
        overlap = len(terms & candidate_words)
        if not overlap:
            return 0.0

        return overlap / max(len(terms), 1)

    def _clean_answer(self, answer: str) -> str:
        cleaned = answer.replace("\r\n", "\n").strip()
        cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
        cleaned = re.sub(r"[ \t]+\n", "\n", cleaned)
        return cleaned

    def _chunk_text(self, text: str) -> List[str]:
        sentences = re.split(r"(?<=[.!?])\s+", text.strip())
        chunks: List[str] = []
        current = ""

        for sentence in sentences:
            sentence = sentence.strip()
            if not sentence:
                continue

            if len(current) + len(sentence) + 1 <= CHUNK_SIZE:
                current = f"{current} {sentence}".strip()
            else:
                if current:
                    chunks.append(current.strip())
                if CHUNK_OVERLAP > 0 and chunks:
                    overlap_source = chunks[-1]
                    overlap = overlap_source[-CHUNK_OVERLAP:]
                    current = f"{overlap} {sentence}".strip()
                else:
                    current = sentence

        if current:
            chunks.append(current.strip())

        return [chunk for chunk in chunks if chunk]

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
