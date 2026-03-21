import io
import re
from dataclasses import dataclass
from typing import List

from fastapi import UploadFile
from openai import OpenAI
from pypdf import PdfReader

from config import CHUNK_OVERLAP, CHUNK_SIZE, GROQ_API_KEY, GROQ_MODEL, TOP_K_RESULTS


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


@dataclass
class DocumentChunk:
    doc_id: str
    filename: str
    text: str
    chunk_id: int


class RAGService:
    def __init__(self):
        self.documents = []
        self.chunks: List[DocumentChunk] = []
        if not GROQ_API_KEY or GROQ_API_KEY == "<SECRET>":
            raise ValueError(
                "Set GROQ_API_KEY in the container environment or backend/.env before starting the backend."
            )
        self.client = OpenAI(
            api_key=GROQ_API_KEY,
            base_url="https://api.groq.com/openai/v1",
        )

    async def ingest(self, upload: UploadFile):
        content = await upload.read()
        filename = upload.filename or "document.txt"

        if filename.lower().endswith(".pdf"):
            reader = PdfReader(io.BytesIO(content))
            text = "\n".join(page.extract_text() or "" for page in reader.pages)
        else:
            text = content.decode("utf-8", errors="ignore")

        if not text.strip():
            raise ValueError("No readable text found in the uploaded document.")

        doc_id = f"doc-{len(self.documents) + 1}"
        chunks = self._chunk_text(text)

        for index, chunk_text in enumerate(chunks, start=1):
            self.chunks.append(
                DocumentChunk(
                    doc_id=doc_id,
                    filename=filename,
                    text=chunk_text,
                    chunk_id=index,
                )
            )

        self.documents.append(
            {"doc_id": doc_id, "filename": filename, "chunks": len(chunks)}
        )

        return {"chunks": len(chunks), "filename": filename}

    def query(self, question: str):
        if not self.chunks:
            raise ValueError("Upload a document before asking questions.")

        retrieved = self._retrieve(question)
        answer = self._generate_answer(question, retrieved)

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

    def _chunk_text(self, text: str) -> List[str]:
        paragraphs = [part.strip() for part in re.split(r"\n\s*\n", text) if part.strip()]
        if not paragraphs:
            paragraphs = [text]

        chunks = []
        current = ""

        for paragraph in paragraphs:
            normalized = " ".join(paragraph.split())
            if not normalized:
                continue

            if len(normalized) > CHUNK_SIZE:
                if current.strip():
                    chunks.append(current.strip())
                    current = ""

                start = 0
                while start < len(normalized):
                    end = min(len(normalized), start + CHUNK_SIZE)
                    chunk = normalized[start:end].strip()
                    if chunk:
                        chunks.append(chunk)
                    if end == len(normalized):
                        break
                    start = max(end - CHUNK_OVERLAP, start + 1)
                continue

            candidate = f"{current}\n{normalized}".strip() if current else normalized
            if len(candidate) <= CHUNK_SIZE:
                current = candidate
            else:
                if current.strip():
                    chunks.append(current.strip())
                current = normalized

        if current.strip():
            chunks.append(current.strip())

        return chunks

    def _retrieve(self, question: str) -> List[DocumentChunk]:
        question_terms = self._tokenize(question)
        scored = []

        for chunk in self.chunks:
            chunk_terms = self._tokenize(chunk.text)
            score = self._score_overlap(question_terms, chunk_terms)
            if score > 0:
                scored.append((score, chunk))

        scored.sort(key=lambda item: item[0], reverse=True)
        if scored:
            return [chunk for _, chunk in scored[:TOP_K_RESULTS]]
        return self.chunks[:TOP_K_RESULTS]

    def _generate_answer(self, question: str, chunks: List[DocumentChunk]) -> str:
        context = "\n\n".join(
            f"[Source {index}] {chunk.text}" for index, chunk in enumerate(chunks, start=1)
        )

        response = self.client.chat.completions.create(
            model=GROQ_MODEL,
            temperature=0,
            messages=[
                {
                    "role": "system",
                    "content": (
                        "You are a strict document question answering assistant. "
                        "Answer only from the provided document context. "
                        "If the answer is not clearly present, reply exactly: Not in document. "
                        "Prefer exact facts and concise answers. "
                        "Return only one direct answer sentence. "
                        "No bullet points. "
                        "Do not add outside knowledge."
                    ),
                },
                {
                    "role": "user",
                    "content": (
                        f"Question: {question}\n\n"
                        f"Document context:\n{context}\n\n"
                        "Return exactly one direct answer grounded in the context."
                    ),
                },
            ],
            max_tokens=300,
        )

        return response.choices[0].message.content.strip()

    def _tokenize(self, text: str) -> List[str]:
        return [
            token
            for token in (match.group(0).lower() for match in WORD_RE.finditer(text))
            if token not in STOPWORDS
        ]

    def _score_overlap(self, question_terms: List[str], chunk_terms: List[str]) -> float:
        if not question_terms or not chunk_terms:
            return 0.0
        question_set = set(question_terms)
        chunk_set = set(chunk_terms)
        overlap = len(question_set & chunk_set)
        if overlap == 0:
            return 0.0
        return overlap / max(1, len(question_set))
