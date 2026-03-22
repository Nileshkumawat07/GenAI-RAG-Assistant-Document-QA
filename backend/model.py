import io
import re
import shutil
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List

from fastapi import UploadFile
from openai import OpenAI
from pypdf import PdfReader

from sentence_transformers import SentenceTransformer
import faiss
import numpy as np

from config import CHUNK_OVERLAP, CHUNK_SIZE, DOCUMENTS_DIR, GROQ_API_KEY, GROQ_MODEL, TOP_K_RESULTS


WORD_RE = re.compile(r"\b[a-zA-Z0-9]+\b")

STOPWORDS = {
    "a","an","and","are","as","at","be","by","for","from","how","in","is","it",
    "of","on","or","that","the","this","to","was","what","when","where","which",
    "who","why","with",
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
            raise ValueError("Set GROQ_API_KEY properly")

        DOCUMENTS_DIR.mkdir(parents=True, exist_ok=True)

        self.client = OpenAI(
            api_key=GROQ_API_KEY,
            base_url="https://api.groq.com/openai/v1",
        )

        self.embedding_model = SentenceTransformer("all-MiniLM-L6-v2")
        self.index = None
        self.chunk_embeddings = None


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
            raise ValueError("No readable text found in the uploaded document.")

        doc_id = f"{session_id}-{filename}"

        chunk_texts = self._chunk_text(text)

        chunks = [
            DocumentChunk(
                doc_id=doc_id,
                session_id=session_id,
                filename=filename,
                text=chunk_text,
                chunk_id=index,
            )
            for index, chunk_text in enumerate(chunk_texts, start=1)
        ]

        texts = [chunk.text for chunk in chunks]
        embeddings = self.embedding_model.encode(texts)

        self.chunk_embeddings = np.array(embeddings).astype("float32")

        dimension = self.chunk_embeddings.shape[1]
        self.index = faiss.IndexFlatL2(dimension)
        self.index.add(self.chunk_embeddings)

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
            raise ValueError("Upload a document before asking questions.")

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
        if not retrieved:
            raise ValueError("Invalid question.")

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


    def _retrieve(self, question: str, chunks: List[DocumentChunk]) -> List[DocumentChunk]:
        if len(chunks) <= TOP_K_RESULTS:
            return chunks

        embedding_results = []
        if self.index is not None:
            query_embedding = self.embedding_model.encode([question]).astype("float32")
            distances, indices = self.index.search(query_embedding, TOP_K_RESULTS)
            embedding_results = [chunks[i] for i in indices[0] if i < len(chunks)]

        expanded_question = self._expand_question(question)
        question_terms = self._tokenize(expanded_question)

        scored = []
        for index, chunk in enumerate(chunks):
            chunk_terms = self._tokenize(chunk.text)
            score = self._score_overlap(question_terms, chunk_terms)
            if score > 0:
                scored.append((score, index, chunk))

        scored.sort(key=lambda x: x[0], reverse=True)
        keyword_results = [chunk for _, _, chunk in scored[:TOP_K_RESULTS]]

        combined = []
        seen = set()

        for chunk in embedding_results + keyword_results:
            if chunk.chunk_id not in seen:
                combined.append(chunk)
                seen.add(chunk.chunk_id)

        return combined[:TOP_K_RESULTS]


    def indexed_document_count(self) -> int:
        return len(self.documents_by_session)

    def indexed_chunk_count(self) -> int:
        return sum(len(document.chunks) for document in self.documents_by_session.values())


    def _chunk_text(self, text: str) -> List[str]:
        normalized_text = text.replace("\r\n", "\n")
        sections = [part.strip() for part in re.split(r"\n\s*\n", normalized_text) if part.strip()]
        if not sections:
            sections = [normalized_text]

        chunks = []
        current_lines: List[str] = []
        current_length = 0

        for section in sections:
            lines = [self._normalize_chunk_line(line) for line in section.splitlines()]
            lines = [line for line in lines if line]

            for line in lines:
                line_length = len(line) + (1 if current_lines else 0)

                if len(line) > CHUNK_SIZE:
                    if current_lines:
                        chunks.append("\n".join(current_lines).strip())
                        current_lines = []
                        current_length = 0
                    chunks.extend(self._split_long_line(line))
                    continue

                if current_length + line_length <= CHUNK_SIZE:
                    current_lines.append(line)
                    current_length += line_length
                    continue

                if current_lines:
                    chunks.append("\n".join(current_lines).strip())

                overlap_lines = self._tail_overlap_lines(current_lines)
                current_lines = overlap_lines + [line]
                current_length = sum(len(item) for item in current_lines)

            if current_lines:
                chunks.append("\n".join(current_lines).strip())
                current_lines = []
                current_length = 0

        return [chunk for chunk in chunks if chunk.strip()]


    def _tokenize(self, text: str) -> List[str]:
        return [
            token
            for token in (match.group(0).lower() for match in WORD_RE.finditer(text))
            if token not in STOPWORDS
        ]


    def _score_overlap(self, question_terms: List[str], chunk_terms: List[str]) -> float:
        if not question_terms or not chunk_terms:
            return 0.0
        return len(set(question_terms) & set(chunk_terms)) / max(1, len(set(question_terms)))


    def _generate_answer(self, question: str, chunks: List[DocumentChunk]) -> str:
        context = "\n\n".join(chunk.text for chunk in chunks)

        response = self.client.chat.completions.create(
            model=GROQ_MODEL,
            temperature=0,
            messages=[
                {"role": "system", "content": "Answer only from given document"},
                {"role": "user", "content": f"{question}\n\n{context}"},
            ],
        )

        return response.choices[0].message.content.strip()


    def _extract_text(self, content: bytes, filename: str) -> str:
        if filename.lower().endswith(".pdf"):
            reader = PdfReader(io.BytesIO(content))
            return "\n".join(page.extract_text() or "" for page in reader.pages)
        return content.decode("utf-8", errors="ignore")


    def _session_dir(self, session_id: str) -> Path:
        return DOCUMENTS_DIR / session_id


    def _reset_session_storage(self, session_dir: Path) -> None:
        if session_dir.exists():
            shutil.rmtree(session_dir)
        session_dir.mkdir(parents=True, exist_ok=True)


    def _sanitize_filename(self, filename: str) -> str:
        cleaned = Path(filename).name.strip()
        cleaned = re.sub(r"[^A-Za-z0-9._ -]", "_", cleaned)
        return cleaned or "document.txt"


    def _get_or_load_session_document(self, session_id: str) -> SessionDocument | None:
        return self.documents_by_session.get(session_id)


    def _normalize_chunk_line(self, line: str) -> str:
        return " ".join(line.split()).strip()


    def _split_long_line(self, line: str) -> List[str]:
        pieces = []
        start = 0
        while start < len(line):
            end = min(len(line), start + CHUNK_SIZE)
            if end < len(line):
                split_at = line.rfind(" ", start, end)
                if split_at > start:
                    end = split_at
            piece = line[start:end].strip()
            if piece:
                pieces.append(piece)
            if end >= len(line):
                break
            start = max(end - CHUNK_OVERLAP, start + 1)
        return pieces


    def _tail_overlap_lines(self, lines: List[str]) -> List[str]:
        if not lines:
            return []
        kept: List[str] = []
        total = 0
        for line in reversed(lines):
            projected = total + len(line) + (1 if kept else 0)
            if projected > CHUNK_OVERLAP:
                break
            kept.insert(0, line)
            total = projected
        return kept