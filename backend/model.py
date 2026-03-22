import io
import re
import shutil
import logging
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List

from fastapi import UploadFile
from openai import OpenAI
from pypdf import PdfReader

from config import (
    CHUNK_OVERLAP,
    CHUNK_SIZE,
    DOCUMENTS_DIR,
    GROQ_API_KEY,
    GROQ_MODEL,
    TOP_K_RESULTS,
)

# ======================
# LOGGING
# ======================
logger = logging.getLogger(__name__)

# ======================
# REGEX (PRECOMPILED)
# ======================
WORD_RE = re.compile(r"\b[a-zA-Z0-9]+\b")
EMAIL_REGEX = re.compile(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}")
PHONE_REGEX = re.compile(r"(?<!\d)(?:\+?\d[\d\s().-]{8,}\d)")

# ======================
# CONSTANTS
# ======================
EXACT_MATCH_WEIGHT = 0.45
PHRASE_WEIGHT = 0.14
NUMBER_WEIGHT = 0.18
SYMBOL_WEIGHT = 0.2
HEADING_WEIGHT = 0.18
COVERAGE_WEIGHT = 0.06

STOPWORDS = {
    "a", "an", "and", "are", "as", "at", "be", "by", "for", "from", "how",
    "in", "is", "it", "of", "on", "or", "that", "the", "this", "to",
    "was", "what", "when", "where", "which", "who", "why", "with",
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

# ======================
# DATA CLASSES
# ======================
@dataclass
class DocumentChunk:
    doc_id: str
    session_id: str
    filename: str
    text: str
    chunk_id: int
    tokens: List[str]


@dataclass
class SessionDocument:
    doc_id: str
    session_id: str
    filename: str
    text: str
    chunks: List[DocumentChunk]
    file_path: Path


# ======================
# MAIN SERVICE
# ======================
class RAGService:
    def __init__(self):
        self.documents_by_session: Dict[str, SessionDocument] = {}

        if not GROQ_API_KEY or GROQ_API_KEY == "<SECRET>":
            raise ValueError("Set GROQ_API_KEY before starting backend.")

        DOCUMENTS_DIR.mkdir(parents=True, exist_ok=True)

        self.client = OpenAI(
            api_key=GROQ_API_KEY,
            base_url="https://api.groq.com/openai/v1",
        )

    # ======================
    # INGEST
    # ======================
    async def ingest(self, upload: UploadFile, session_id: str):
        content = await upload.read()
        filename = self._sanitize_filename(upload.filename or "document.txt")

        session_dir = self._session_dir(session_id)
        self._reset_session_storage(session_dir)

        file_path = session_dir / filename
        with open(file_path, "wb") as f:
            f.write(content)

        text = self._extract_text(content, filename)

        if not text.strip():
            if file_path.exists():
                file_path.unlink()
            raise ValueError("No readable text found.")

        doc_id = f"{session_id}-{filename}"

        chunk_texts = self._chunk_text(text)

        chunks = [
            DocumentChunk(
                doc_id=doc_id,
                session_id=session_id,
                filename=filename,
                text=chunk_text,
                chunk_id=index,
                tokens=self._tokenize(chunk_text),
            )
            for index, chunk_text in enumerate(chunk_texts, start=1)
        ]

        self.documents_by_session[session_id] = SessionDocument(
            doc_id=doc_id,
            session_id=session_id,
            filename=filename,
            text=text,
            chunks=chunks,
            file_path=file_path,
        )

        logger.info(f"Ingested document: {filename}")

        return {"chunks": len(chunks), "filename": filename, "session_id": session_id}

    # ======================
    # QUERY
    # ======================
    def query(self, question: str, session_id: str) -> dict:
        document = self._get_or_load_session_document(session_id)

        if not document:
            raise ValueError("Upload a document first.")

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

        if not retrieved:
            raise ValueError("Invalid question. Ask more specific.")

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
    # RETRIEVAL
    # ======================
    def _retrieve(self, question: str, chunks: List[DocumentChunk]) -> List[DocumentChunk]:
        if len(chunks) <= TOP_K_RESULTS:
            return chunks

        expanded = self._expand_question(question)
        q_terms = self._tokenize(expanded)
        q_set = set(q_terms)
        phrases = self._extract_query_phrases(question)

        scored = []

        for idx, chunk in enumerate(chunks):
            score = self._score_chunk(
                question, q_terms, q_set, phrases,
                chunk.text, chunk.tokens
            )
            if score > 0:
                scored.append((score, idx, chunk))

        scored.sort(key=lambda x: x[0], reverse=True)

        if scored:
            top_idx = [i for _, i, _ in scored[:TOP_K_RESULTS]]
            selected = self._expand_with_neighbors(top_idx, len(chunks))
            return [chunks[i] for i in selected]

        fallback = self._expand_with_neighbors(
            list(range(min(TOP_K_RESULTS, len(chunks)))), len(chunks)
        )
        return [chunks[i] for i in fallback]

    def _score_chunk(self, question, q_terms, q_set, phrases, text, tokens):
        chunk_set = set(tokens)

        overlap = len(q_set & chunk_set) / max(1, len(q_set))

        text_l = text.lower()
        q_l = question.lower()

        exact = EXACT_MATCH_WEIGHT if q_l in text_l else 0
        phrase = sum(PHRASE_WEIGHT for p in phrases if p in text_l)

        numbers = re.findall(r"\d+(?:[./:-]\d+)*", question)
        number = sum(NUMBER_WEIGHT for n in numbers if n in text)

        symbols = [t for t in question.split() if any(c in t for c in "@:/._-")]
        symbol = sum(SYMBOL_WEIGHT for s in symbols if s.lower() in text_l)

        heading = HEADING_WEIGHT if self._looks_like_heading_match(q_terms, text_l) else 0
        coverage = min(0.45, len(q_set & chunk_set) * COVERAGE_WEIGHT)
        density = self._score_term_density(q_set, tokens)

        return (
            overlap + exact + phrase + number +
            symbol + heading + coverage + density
        )

    def _score_term_density(self, q_set, tokens):
        matches = sum(1 for t in tokens if t in q_set)
        return min(0.25, (matches / max(1, len(tokens))) * 2.5)

    # ======================
    # TOKENIZATION
    # ======================
    def _tokenize(self, text: str) -> List[str]:
        return [
            m.group(0).lower()
            for m in WORD_RE.finditer(text)
            if m.group(0).lower() not in STOPWORDS
        ]

    # ======================
    # UTILITIES (UNCHANGED LOGIC)
    # ======================
    def _expand_question(self, question: str) -> str:
        lowered = question.lower()
        additions = []
        for key, synonyms in QUERY_SYNONYMS.items():
            if key in lowered:
                additions.extend(synonyms)
        return f"{question} {' '.join(additions)}" if additions else question

    def _extract_query_phrases(self, question: str) -> List[str]:
        words = question.lower().split()
        phrases = [question.lower()]
        phrases += [" ".join(words[i:i + 2]) for i in range(len(words) - 1)]
        return list(dict.fromkeys(phrases))

    def _extract_text(self, content: bytes, filename: str) -> str:
        if filename.lower().endswith(".pdf"):
            reader = PdfReader(io.BytesIO(content))
            return "\n".join(page.extract_text() or "" for page in reader.pages)
        return content.decode("utf-8", errors="ignore")

    def _sanitize_filename(self, filename: str) -> str:
        return re.sub(r"[^A-Za-z0-9._ -]", "_", Path(filename).name.strip()) or "document.txt"

    def _session_dir(self, session_id: str) -> Path:
        return DOCUMENTS_DIR / session_id

    def _reset_session_storage(self, session_dir: Path):
        if session_dir.exists():
            shutil.rmtree(session_dir)
        session_dir.mkdir(parents=True, exist_ok=True)

    def _looks_like_heading_match(self, terms, text):
        lines = [l.strip().lower() for l in text.splitlines()[:4] if l.strip()]
        return any(t in " ".join(lines) for t in terms[:4])