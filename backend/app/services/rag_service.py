import io
import json
import re
import shutil
from dataclasses import dataclass
from datetime import datetime, timezone
from pathlib import Path
from typing import Dict, List, Optional

import faiss
import numpy as np
import torch
from fastapi import UploadFile
from openai import OpenAI
from pypdf import PdfReader
from sentence_transformers import SentenceTransformer

from app.core.config import (
    CHUNK_OVERLAP,
    CHUNK_SIZE,
    DOCUMENTS_DIR,
    EMBEDDING_MODEL_NAME,
    GROQ_API_KEY,
    GROQ_MODEL,
    TOP_K_RESULTS,
)


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
    index: faiss.IndexFlatIP
    embeddings: np.ndarray


class RAGService:
    def __init__(self):
        self.documents_by_session: Dict[str, Dict[str, SessionDocument]] = {}
        self.active_document_by_session: Dict[str, str] = {}

        if not GROQ_API_KEY or GROQ_API_KEY == "<SECRET>":
            raise ValueError("Set GROQ_API_KEY")

        DOCUMENTS_DIR.mkdir(parents=True, exist_ok=True)

        self.client = OpenAI(
            api_key=GROQ_API_KEY,
            base_url="https://api.groq.com/openai/v1",
        )

        self.embedding_model: Optional[SentenceTransformer] = None

    def _load_model(self):
        if self.embedding_model is None:
            self.embedding_model = SentenceTransformer(EMBEDDING_MODEL_NAME)

    async def ingest(self, upload: UploadFile, session_id: str):
        content = await upload.read()
        filename = self._sanitize_filename(upload.filename or "document.txt")

        session_dir = self._session_dir(session_id)
        session_dir.mkdir(parents=True, exist_ok=True)

        file_path = session_dir / filename
        file_path.write_bytes(content)

        text = self._extract_text(content, filename)
        if not text.strip():
            raise ValueError("No readable text found.")

        document = self._build_session_document(session_id, filename, text, file_path)
        self.documents_by_session.setdefault(session_id, {})[filename] = document
        self.active_document_by_session[session_id] = filename
        self._write_session_meta(session_id, {"activeFilename": filename})

        return {"chunks": len(document.chunks), "filename": filename, "activeFilename": filename}

    def query(self, question: str, session_id: str):
        document = self._get_active_session_document(session_id)
        if not document:
            raise ValueError("Upload document first.")

        retrieved = self._retrieve(question, document)
        answer = self._generate_answer(question, retrieved)

        return {
            "answer": answer,
            "sources": [
                {
                    "filename": c.filename,
                    "chunk_id": c.chunk_id,
                    "excerpt": c.text[:240],
                }
                for c in retrieved
            ],
        }

    def indexed_document_count(self) -> int:
        return sum(len(documents) for documents in self.documents_by_session.values())

    def indexed_chunk_count(self) -> int:
        return sum(len(document.chunks) for document in self.documents_by_session.values())

    def _retrieve(self, question: str, document: SessionDocument) -> List[DocumentChunk]:
        if not document.chunks:
            return []

        self._load_model()

        question_terms = self._question_terms(question)
        query_embedding = self._encode_texts([question])[0]
        pool_size = min(max(TOP_K_RESULTS * 4, 10), len(document.chunks))

        scores, indices = document.index.search(query_embedding[np.newaxis, :].astype("float32"), pool_size)
        candidate_ids = {idx for idx in indices[0] if 0 <= idx < len(document.chunks)}

        lexical_ranked = sorted(
            (
                (idx, self._lexical_overlap_score(question_terms, chunk.text))
                for idx, chunk in enumerate(document.chunks)
            ),
            key=lambda item: item[1],
            reverse=True,
        )
        candidate_ids.update(idx for idx, score in lexical_ranked[:pool_size] if score > 0)

        if not candidate_ids:
            return document.chunks[:TOP_K_RESULTS]

        candidate_list = sorted(candidate_ids)
        candidate_embeddings = torch.from_numpy(document.embeddings[candidate_list])
        query_tensor = torch.from_numpy(query_embedding)
        semantic_scores = torch.mv(candidate_embeddings, query_tensor).tolist()

        ranked: List[tuple[int, float]] = []
        for pos, chunk_idx in enumerate(candidate_list):
            chunk = document.chunks[chunk_idx]
            lexical_score = self._lexical_overlap_score(question_terms, chunk.text)
            dense_match_score = self._dense_term_match_score(question_terms, chunk.text)
            structure_bonus = self._structure_bonus(question, chunk.text)
            score = (
                semantic_scores[pos] * 0.68
                + lexical_score * 0.20
                + dense_match_score * 0.08
                + structure_bonus * 0.04
            )
            ranked.append((chunk_idx, score))

        ranked.sort(key=lambda item: item[1], reverse=True)
        selected_ids = self._mmr_select(ranked, document.embeddings, query_embedding)
        expanded_ids = self._expand_with_neighbors(selected_ids, document.chunks)
        return [document.chunks[idx] for idx in expanded_ids[:TOP_K_RESULTS]]

    def list_session_documents(self, session_id: str) -> List[dict]:
        session_dir = self._session_dir(session_id)
        session_dir.mkdir(parents=True, exist_ok=True)
        active_filename = self._resolve_active_filename(session_id)
        documents = []
        for file_path in sorted(self._session_files(session_dir), key=lambda item: item.stat().st_mtime, reverse=True):
            cached = self.documents_by_session.get(session_id, {}).get(file_path.name)
            stat = file_path.stat()
            documents.append(
                {
                    "filename": file_path.name,
                    "sizeBytes": stat.st_size,
                    "updatedAt": datetime.fromtimestamp(stat.st_mtime, tz=timezone.utc).isoformat(),
                    "extension": file_path.suffix.lower().lstrip("."),
                    "chunkCount": len(cached.chunks) if cached else 0,
                    "isActive": file_path.name == active_filename,
                    "status": "active" if file_path.name == active_filename else "available",
                }
            )
        return documents

    def set_active_document(self, session_id: str, filename: str) -> dict:
        session_dir = self._session_dir(session_id)
        target = session_dir / self._sanitize_filename(filename)
        if not target.exists() or not target.is_file():
            raise ValueError("Selected document was not found.")
        self.active_document_by_session[session_id] = target.name
        self._write_session_meta(session_id, {"activeFilename": target.name})
        return {"filename": target.name, "message": "Active document updated."}

    def rename_document(self, session_id: str, filename: str, new_filename: str) -> dict:
        session_dir = self._session_dir(session_id)
        current = session_dir / self._sanitize_filename(filename)
        if not current.exists() or not current.is_file():
            raise ValueError("Document was not found.")
        extension = current.suffix.lower()
        next_name = self._sanitize_filename(new_filename)
        if not next_name.lower().endswith(extension):
            next_name = f"{next_name}{extension}"
        target = session_dir / next_name
        if target.exists():
            raise ValueError("Another document already uses that name.")
        current.rename(target)
        session_cache = self.documents_by_session.get(session_id, {})
        cached = session_cache.pop(current.name, None)
        if cached:
            cached.filename = target.name
            cached.file_path = target
            cached.doc_id = f"{session_id}-{target.name}"
            for chunk in cached.chunks:
                chunk.filename = target.name
                chunk.doc_id = cached.doc_id
            session_cache[target.name] = cached
        if self.active_document_by_session.get(session_id) == current.name:
            self.active_document_by_session[session_id] = target.name
            self._write_session_meta(session_id, {"activeFilename": target.name})
        return {"filename": target.name, "message": "Document renamed."}

    def delete_document(self, session_id: str, filename: str) -> dict:
        session_dir = self._session_dir(session_id)
        target = session_dir / self._sanitize_filename(filename)
        if not target.exists() or not target.is_file():
            raise ValueError("Document was not found.")
        target.unlink()
        self.documents_by_session.get(session_id, {}).pop(target.name, None)
        self._reset_active_after_removal(session_id, removed_filename=target.name)
        return {"filename": target.name, "message": "Document deleted."}

    def archive_document(self, session_id: str, filename: str) -> dict:
        session_dir = self._session_dir(session_id)
        archive_dir = session_dir / "archive"
        archive_dir.mkdir(parents=True, exist_ok=True)
        target = session_dir / self._sanitize_filename(filename)
        if not target.exists() or not target.is_file():
            raise ValueError("Document was not found.")
        archived_target = archive_dir / target.name
        if archived_target.exists():
            archived_target.unlink()
        shutil.move(str(target), str(archived_target))
        self.documents_by_session.get(session_id, {}).pop(target.name, None)
        self._reset_active_after_removal(session_id, removed_filename=target.name)
        return {"filename": target.name, "message": "Document archived."}

    def _get_active_session_document(self, session_id: str) -> Optional[SessionDocument]:
        active_filename = self._resolve_active_filename(session_id)
        if not active_filename:
            return None
        cached_document = self.documents_by_session.get(session_id, {}).get(active_filename)
        if cached_document:
            return cached_document

        session_dir = self._session_dir(session_id)
        if not session_dir.exists():
            return None
        file_path = session_dir / active_filename
        if not file_path.exists() or not file_path.is_file():
            return None
        try:
            content = file_path.read_bytes()
        except OSError:
            return None

        text = self._extract_text(content, file_path.name)
        if not text.strip():
            return None

        document = self._build_session_document(session_id, file_path.name, text, file_path)
        self.documents_by_session.setdefault(session_id, {})[file_path.name] = document
        return document

    def _resolve_active_filename(self, session_id: str) -> Optional[str]:
        active_filename = self.active_document_by_session.get(session_id)
        session_dir = self._session_dir(session_id)
        if active_filename and (session_dir / active_filename).exists():
            return active_filename

        meta = self._read_session_meta(session_id)
        meta_active = meta.get("activeFilename")
        if meta_active and (session_dir / meta_active).exists():
            self.active_document_by_session[session_id] = meta_active
            return meta_active

        session_files = self._session_files(session_dir)
        if not session_files:
            self.active_document_by_session.pop(session_id, None)
            self._write_session_meta(session_id, {"activeFilename": None})
            return None

        latest = max(session_files, key=lambda item: item.stat().st_mtime)
        self.active_document_by_session[session_id] = latest.name
        self._write_session_meta(session_id, {"activeFilename": latest.name})
        return latest.name

    def _reset_active_after_removal(self, session_id: str, removed_filename: str) -> None:
        if self.active_document_by_session.get(session_id) != removed_filename:
            return
        self.active_document_by_session.pop(session_id, None)
        self._resolve_active_filename(session_id)

    def _session_meta_path(self, session_id: str) -> Path:
        return self._session_dir(session_id) / ".session-meta.json"

    def _read_session_meta(self, session_id: str) -> dict:
        meta_path = self._session_meta_path(session_id)
        if not meta_path.exists():
            return {}
        try:
            return json.loads(meta_path.read_text(encoding="utf-8"))
        except (OSError, json.JSONDecodeError):
            return {}

    def _write_session_meta(self, session_id: str, payload: dict) -> None:
        session_dir = self._session_dir(session_id)
        session_dir.mkdir(parents=True, exist_ok=True)
        meta_path = self._session_meta_path(session_id)
        try:
            meta_path.write_text(json.dumps(payload), encoding="utf-8")
        except OSError:
            # Best effort only.
            return

    def _session_files(self, session_dir: Path) -> List[Path]:
        if not session_dir.exists():
            return []
        return [
            path
            for path in session_dir.iterdir()
            if path.is_file() and not path.name.startswith(".")
        ]

    def _build_session_document(
        self,
        session_id: str,
        filename: str,
        text: str,
        file_path: Path,
    ) -> SessionDocument:
        self._load_model()

        doc_id = f"{session_id}-{filename}"
        chunks = self._chunk_text(text, filename, doc_id, session_id)
        texts = [chunk.text for chunk in chunks]
        embeddings = self._encode_texts(texts)

        dim = embeddings.shape[1]
        index = faiss.IndexFlatIP(dim)
        index.add(embeddings.astype("float32"))

        return SessionDocument(
            doc_id=doc_id,
            session_id=session_id,
            filename=filename,
            text=text,
            chunks=chunks,
            file_path=file_path,
            index=index,
            embeddings=embeddings,
        )

    def _encode_texts(self, texts: List[str]) -> np.ndarray:
        embeddings = self.embedding_model.encode(
            texts,
            convert_to_numpy=True,
            normalize_embeddings=True,
        )
        return embeddings.astype("float32")

    def _mmr_select(
        self,
        ranked: List[tuple[int, float]],
        embeddings: np.ndarray,
        query_embedding: np.ndarray,
    ) -> List[int]:
        if not ranked:
            return []

        top_candidates = ranked[: max(TOP_K_RESULTS * 3, 8)]
        selected: List[int] = []
        selected_set = set()
        lambda_weight = 0.78

        while len(selected) < min(TOP_K_RESULTS, len(top_candidates)):
            best_idx = None
            best_score = float("-inf")

            for chunk_idx, base_score in top_candidates:
                if chunk_idx in selected_set:
                    continue

                relevance = float(np.dot(query_embedding, embeddings[chunk_idx]))
                diversity_penalty = 0.0
                if selected:
                    diversity_penalty = max(
                        float(np.dot(embeddings[chunk_idx], embeddings[chosen_idx]))
                        for chosen_idx in selected
                    )

                mmr_score = lambda_weight * max(base_score, relevance) - (1 - lambda_weight) * diversity_penalty
                if mmr_score > best_score:
                    best_score = mmr_score
                    best_idx = chunk_idx

            if best_idx is None:
                break

            selected.append(best_idx)
            selected_set.add(best_idx)

        return selected

    def _expand_with_neighbors(self, selected_ids: List[int], chunks: List[DocumentChunk]) -> List[int]:
        ordered: List[int] = []
        seen = set()

        for idx in selected_ids:
            for neighbor in (idx - 1, idx, idx + 1):
                if 0 <= neighbor < len(chunks) and neighbor not in seen:
                    if neighbor != idx and not self._should_include_neighbor(chunks[idx], chunks[neighbor]):
                        continue
                    ordered.append(neighbor)
                    seen.add(neighbor)

        return ordered

    def _should_include_neighbor(self, base_chunk: DocumentChunk, neighbor_chunk: DocumentChunk) -> bool:
        return abs(base_chunk.chunk_id - neighbor_chunk.chunk_id) == 1 and (
            len(base_chunk.text) < CHUNK_SIZE * 0.85 or len(neighbor_chunk.text) < CHUNK_SIZE * 0.85
        )

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
            score += self._dense_term_match_score(keywords, candidate) * 0.6

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
                f"[Chunk {chunk.chunk_id} | {chunk.filename} | chars {chunk.start_char}-{chunk.end_char}]\n{chunk.text.strip()}"
            )
        return "\n\n".join(parts)

    def _build_prompt(self, question: str, context: str, response_style: str) -> str:
        return f"""
Answer the question using only the context below.
If the answer is not clearly present, reply exactly: Not in document.
Do not use outside knowledge.
Do not add disclaimers, filler, or reasoning steps.
Prefer the most directly supported facts from the strongest matching chunks.

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
            "into",
            "their",
            "there",
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

    def _dense_term_match_score(self, terms: set[str], text: str) -> float:
        if not terms:
            return 0.0

        lowered = text.lower()
        hits = sum(1 for term in terms if term in lowered)
        return hits / max(len(terms), 1)

    def _structure_bonus(self, question: str, text: str) -> float:
        lowered = text.lower()
        bonus = 0.0
        if any(word in question.lower() for word in ["summary", "overview"]) and "\n" in text:
            bonus += 0.2
        if any(word in question.lower() for word in ["experience", "project", "education"]):
            if re.search(r"\b(experience|project|education|employment|work)\b", lowered):
                bonus += 0.25
        if any(word in question.lower() for word in ["skill", "technology", "tool"]):
            if re.search(r"\b(skills|technology|technologies|tools|stack)\b", lowered):
                bonus += 0.25
        return bonus

    def _clean_answer(self, answer: str) -> str:
        cleaned = answer.replace("\r\n", "\n").strip()
        cleaned = re.sub(r"\n{3,}", "\n\n", cleaned)
        cleaned = re.sub(r"[ \t]+\n", "\n", cleaned)
        return cleaned

    def _chunk_text(self, text: str, filename: str, doc_id: str, session_id: str) -> List[DocumentChunk]:
        normalized = re.sub(r"\r\n?", "\n", text).strip()
        if not normalized:
            return []

        paragraphs = [para.strip() for para in re.split(r"\n\s*\n+", normalized) if para.strip()]
        chunks: List[DocumentChunk] = []
        chunk_id = 1
        cursor = 0

        for paragraph in paragraphs:
            start_idx = normalized.find(paragraph, cursor)
            if start_idx == -1:
                start_idx = cursor
            cursor = start_idx + len(paragraph)

            sentences = self._split_sentences(paragraph)
            if not sentences:
                continue

            current_sentences: List[str] = []
            current_start = start_idx

            for sentence in sentences:
                candidate = " ".join(current_sentences + [sentence]).strip()
                if current_sentences and len(candidate) > CHUNK_SIZE:
                    chunk_text = " ".join(current_sentences).strip()
                    chunk_end = current_start + len(chunk_text)
                    chunks.append(
                        DocumentChunk(
                            doc_id=doc_id,
                            session_id=session_id,
                            filename=filename,
                            text=chunk_text,
                            chunk_id=chunk_id,
                            start_char=current_start,
                            end_char=chunk_end,
                        )
                    )
                    chunk_id += 1

                    overlap_text = chunk_text[-CHUNK_OVERLAP:].strip() if CHUNK_OVERLAP > 0 else ""
                    current_sentences = [overlap_text, sentence] if overlap_text else [sentence]
                    current_start = max(start_idx, chunk_end - len(overlap_text)) if overlap_text else start_idx
                else:
                    current_sentences.append(sentence)

            if current_sentences:
                chunk_text = " ".join(part for part in current_sentences if part).strip()
                chunk_end = current_start + len(chunk_text)
                chunks.append(
                    DocumentChunk(
                        doc_id=doc_id,
                        session_id=session_id,
                        filename=filename,
                        text=chunk_text,
                        chunk_id=chunk_id,
                        start_char=current_start,
                        end_char=chunk_end,
                    )
                )
                chunk_id += 1

        return chunks

    def _split_sentences(self, text: str) -> List[str]:
        sentences = re.split(r"(?<=[.!?])\s+|\n+", text.strip())
        cleaned = [sentence.strip() for sentence in sentences if sentence.strip()]
        return cleaned

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
