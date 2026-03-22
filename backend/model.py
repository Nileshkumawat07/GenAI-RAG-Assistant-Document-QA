import io
import re
import shutil
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List

from fastapi import UploadFile
from openai import OpenAI
from pypdf import PdfReader

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
            raise ValueError(
                "Set GROQ_API_KEY in the container environment or backend/.env before starting the backend."
            )
        DOCUMENTS_DIR.mkdir(parents=True, exist_ok=True)
        self.client = OpenAI(
            api_key=GROQ_API_KEY,
            base_url="https://api.groq.com/openai/v1",
        )

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
            raise ValueError("Invalid question. Refine the wording if you want a more specific answer.")

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
        return sum(len(document.chunks) for document in self.documents_by_session.values())

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

    def _retrieve(self, question: str, chunks: List[DocumentChunk]) -> List[DocumentChunk]:
        question_terms = self._tokenize(question)
        scored = []

        for chunk in chunks:
            chunk_terms = self._tokenize(chunk.text)
            score = self._score_overlap(question_terms, chunk_terms)
            if score > 0:
                scored.append((score, chunk))

        scored.sort(key=lambda item: item[0], reverse=True)
        if scored:
            return [chunk for _, chunk in scored[:TOP_K_RESULTS]]
        return []

    def _answer_direct_field(self, question: str, text: str) -> str | None:
        lowered = question.lower()

        field_extractors = [
            (
                {"email", "mail"},
                "Email Address",
                self._extract_email(text),
            ),
            (
                {"phone", "mobile", "contact", "number"},
                "Contact Number",
                self._extract_phone(text),
            ),
            (
                {"linkedin"},
                "LinkedIn Profile",
                self._extract_link(text, "linkedin"),
            ),
            (
                {"github"},
                "GitHub Profile",
                self._extract_link(text, "github"),
            ),
            (
                {"portfolio", "website", "site"},
                "Website",
                self._extract_link(text, None),
            ),
            (
                {"name"},
                "Candidate Name",
                self._extract_name(text),
            ),
            (
                {"location", "address", "city"},
                "Location",
                self._extract_location(text),
            ),
        ]

        for keywords, label, value in field_extractors:
            if any(keyword in lowered for keyword in keywords):
                if not value:
                    return "Not in document."
                return f"{label}:\n{value}"

        return None

    def _generate_answer(self, question: str, chunks: List[DocumentChunk]) -> str:
        context = "\n\n".join(
            f"[Source {index} | {chunk.filename} | chunk {chunk.chunk_id}]\n{chunk.text}"
            for index, chunk in enumerate(chunks, start=1)
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
                        "Prefer complete, accurate answers over overly short answers. "
                        "Write in a professional, neat, business-style format. "
                        "Do not use markdown syntax of any kind. "
                        "Do not use asterisks, double asterisks, hash headings, underscores, or backticks. "
                        "Use plain text only. "
                        "When the answer needs structure, use short title-style headings ending with a colon, "
                        "followed by clean sentences or numbered points. "
                        "When the question asks for explanation, summary, details, qualifications, education, skills, "
                        "experience, or multiple items, include all important points supported by the context. "
                        "When the document contains multiple records such as education entries, jobs, projects, or certifications, "
                        "separate them clearly. "
                        "Give each record its own numbered subsection or title. "
                        "Keep the details for one record together under that record only. "
                        "Do not merge details from different records into the same bullet or same paragraph. "
                        "For education answers, present each degree or diploma separately with its own institution, duration, "
                        "location, affiliation, and any other available details. "
                        "When the question asks for a short fact, answer briefly but still include the key detail. "
                        "Keep the language clear, polished, and professional. "
                        "Do not add outside knowledge."
                    ),
                },
                {
                    "role": "user",
                    "content": (
                        f"Question: {question}\n\n"
                        f"Document context:\n{context}\n\n"
                        "Write a complete answer grounded only in the document context. "
                        "Use a polished plain-text format. "
                        "If helpful, format the answer like this:\n"
                        "Answer Summary:\n"
                        "...\n\n"
                        "Details:\n"
                        "1. Record Name:\n"
                        "Institution: ...\n"
                        "Duration: ...\n"
                        "Location: ...\n\n"
                        "2. Record Name:\n"
                        "Institution: ...\n"
                        "Duration: ...\n"
                        "Location: ...\n\n"
                        "If there are multiple education items or other records, create a separate numbered block for each one. "
                        "Do not mix the details of one record with another record. "
                        "Never use markdown symbols such as **, *, #, _, or backticks. "
                        "Do not mention any information that is not present in the context."
                    ),
                },
            ],
            max_tokens=700,
        )

        return response.choices[0].message.content.strip()

    def _normalize_answer_format(self, answer: str) -> str:
        normalized = answer.replace("\r\n", "\n").strip()
        labels = [
            "Institution",
            "Duration",
            "Location",
            "Affiliation",
            "Email",
            "Email Address",
            "Contact",
            "Contact Number",
            "Phone",
            "Mobile",
            "LinkedIn",
            "GitHub",
            "Website",
            "Name",
            "Candidate Name",
        ]
        for label in labels:
            normalized = re.sub(rf"\s+({re.escape(label)}:)", r"\n\1", normalized)
        normalized = re.sub(r"\n{3,}", "\n\n", normalized)
        return normalized.strip()

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

    def _extract_text(self, content: bytes, filename: str) -> str:
        if filename.lower().endswith(".pdf"):
            reader = PdfReader(io.BytesIO(content))
            return "\n".join(page.extract_text() or "" for page in reader.pages)
        return content.decode("utf-8", errors="ignore")

    def _extract_email(self, text: str) -> str | None:
        match = re.search(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}", text)
        return match.group(0) if match else None

    def _extract_phone(self, text: str) -> str | None:
        match = re.search(r"(?<!\d)(?:\+?\d[\d\s().-]{8,}\d)", text)
        return match.group(0).strip() if match else None

    def _extract_link(self, text: str, keyword: str | None) -> str | None:
        matches = re.findall(r"(https?://[^\s]+|www\.[^\s]+|[A-Za-z0-9.-]+\.[A-Za-z]{2,}/[^\s]+)", text)
        cleaned_matches = [match.rstrip(".,);]") for match in matches]
        if keyword:
            for match in cleaned_matches:
                if keyword.lower() in match.lower():
                    return match
            return None
        return cleaned_matches[0] if cleaned_matches else None

    def _extract_name(self, text: str) -> str | None:
        lines = [line.strip() for line in text.splitlines() if line.strip()]
        for line in lines[:12]:
            if "resume" in line.lower():
                candidate = line.replace("Resume", "").replace("resume", "").strip(" -|:")
                if candidate:
                    return candidate
            if re.fullmatch(r"[A-Z][A-Za-z]+(?: [A-Z][A-Za-z]+){1,4}", line):
                return line
        return None

    def _extract_location(self, text: str) -> str | None:
        lines = [line.strip() for line in text.splitlines() if line.strip()]
        for index, line in enumerate(lines):
            if "location" in line.lower():
                parts = line.split(":", 1)
                if len(parts) == 2 and parts[1].strip():
                    return parts[1].strip()
                if index + 1 < len(lines):
                    return lines[index + 1]

        city_match = re.search(
            r"\b([A-Z][a-z]+(?: [A-Z][a-z]+)*,\s*[A-Z][a-z]+(?: [A-Z][a-z]+)*)\b",
            text,
        )
        return city_match.group(1) if city_match else None

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
        existing = self.documents_by_session.get(session_id)
        if existing:
            return existing

        session_dir = self._session_dir(session_id)
        if not session_dir.exists():
            return None

        files = [path for path in session_dir.iterdir() if path.is_file()]
        if not files:
            return None

        file_path = max(files, key=lambda path: path.stat().st_mtime)
        content = file_path.read_bytes()
        text = self._extract_text(content, file_path.name)
        if not text.strip():
            return None

        doc_id = f"{session_id}-{file_path.name}"
        chunks = [
            DocumentChunk(
                doc_id=doc_id,
                session_id=session_id,
                filename=file_path.name,
                text=chunk_text,
                chunk_id=index,
            )
            for index, chunk_text in enumerate(self._chunk_text(text), start=1)
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
