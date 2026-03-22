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

SECTION_ALIASES = {
    "education": ["education", "academic", "qualification", "qualifications", "study", "studies"],
    "projects": ["project", "projects"],
    "skills": ["skill", "skills", "technical skills", "competencies", "core competencies"],
    "certifications": ["certification", "certifications", "certificate", "certificates"],
    "experience": ["experience", "work experience", "employment", "internship", "internships"],
    "summary": ["summary", "profile", "overview", "objective"],
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

        section_answer = self._answer_section_query(question, document.text)
        if section_answer:
            return {
                "answer": section_answer,
                "sources": [
                    {
                        "filename": document.filename,
                        "chunk_id": 1,
                        "excerpt": document.text[:220],
                    }
                ],
            }

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
            if not lines:
                continue

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
                current_length = sum(len(item) for item in current_lines) + max(0, len(current_lines) - 1)

            if current_lines:
                chunks.append("\n".join(current_lines).strip())
                current_lines = []
                current_length = 0

        return [chunk for chunk in chunks if chunk.strip()]

    def _retrieve(self, question: str, chunks: List[DocumentChunk]) -> List[DocumentChunk]:
        if len(chunks) <= TOP_K_RESULTS:
            return chunks

        expanded_question = self._expand_question(question)
        question_terms = self._tokenize(expanded_question)
        question_phrases = self._extract_query_phrases(question)
        scored = []

        for index, chunk in enumerate(chunks):
            chunk_terms = self._tokenize(chunk.text)
            score = self._score_chunk(question, question_terms, question_phrases, chunk.text, chunk_terms)
            if score > 0:
                scored.append((score, index, chunk))

        scored.sort(key=lambda item: item[0], reverse=True)
        if scored:
            top_indexes = [index for _, index, _ in scored[:TOP_K_RESULTS]]
            selected_indexes = self._expand_with_neighbors(top_indexes, len(chunks))
            return [chunks[index] for index in selected_indexes]
        # Fall back to leading chunks when a question is too short or retrieval is ambiguous.
        fallback_indexes = self._expand_with_neighbors(list(range(min(TOP_K_RESULTS, len(chunks)))), len(chunks))
        return [chunks[index] for index in fallback_indexes]

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
                {"address"},
                "Address",
                self._extract_address(text),
            ),
            (
                {"location", "city"},
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

    def _answer_section_query(self, question: str, text: str) -> str | None:
        section_name = self._match_section_query(question)
        if not section_name:
            return None

        sections = self._extract_sections(text)
        section_lines = sections.get(section_name)
        if not section_lines:
            return "Not in document."

        formatter = getattr(self, f"_format_{section_name}_section", None)
        if formatter:
            formatted = formatter(section_lines)
            if formatted:
                return formatted

        return self._format_generic_section(section_name, section_lines)

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
        normalized = re.sub(r"\s+(\d+\.\s+[^\n:]+:)", r"\n\n\1", normalized)
        for label in labels:
            normalized = re.sub(rf"\s+({re.escape(label)}:)", r"\n\1", normalized)
        normalized = re.sub(r"\n{3,}", "\n\n", normalized)
        return normalized.strip()

    def _match_section_query(self, question: str) -> str | None:
        lowered = question.lower()
        for section_name, aliases in SECTION_ALIASES.items():
            if any(alias in lowered for alias in aliases):
                return section_name
        return None

    def _extract_sections(self, text: str) -> Dict[str, List[str]]:
        lines = [line.strip() for line in text.replace("\r\n", "\n").splitlines()]
        sections: Dict[str, List[str]] = {}
        current_section: str | None = None

        for raw_line in lines:
            line = raw_line.strip()
            if not line:
                continue

            matched_section = self._match_heading_line(line)
            if matched_section:
                current_section = matched_section
                sections.setdefault(current_section, [])
                continue

            if current_section:
                sections[current_section].append(line)

        return sections

    def _match_heading_line(self, line: str) -> str | None:
        normalized = re.sub(r"[^a-zA-Z ]", " ", line).lower()
        normalized = " ".join(normalized.split())
        for section_name, aliases in SECTION_ALIASES.items():
            if normalized in aliases:
                return section_name
        return None

    def _format_projects_section(self, lines: List[str]) -> str:
        projects = []
        current_title = None
        current_points: List[str] = []

        for line in lines:
            cleaned = self._clean_section_line(line)
            if not cleaned:
                continue

            if self._is_primary_bullet(cleaned):
                if current_title:
                    projects.append((current_title, current_points))
                current_title = self._strip_bullet(cleaned)
                current_points = []
                continue

            if self._is_secondary_bullet(cleaned):
                if current_title:
                    current_points.append(self._strip_bullet(cleaned))
                continue

            if current_title and current_points:
                current_points[-1] = f"{current_points[-1]} {cleaned}".strip()
                continue

            if current_title:
                current_points.append(cleaned)

        if current_title:
            projects.append((current_title, current_points))

        if not projects:
            return ""

        output = ["Projects:"]
        for index, (title, points) in enumerate(projects, start=1):
            output.append(f"{index}. {title}")
            for point in points:
                output.append(f"- {point}")
            output.append("")

        return "\n".join(output).strip()

    def _format_skills_section(self, lines: List[str]) -> str:
        entries = []
        for line in lines:
            cleaned = self._clean_section_line(line)
            if not cleaned:
                continue
            entries.append(self._strip_bullet(cleaned))

        if not entries:
            return ""

        output = ["Skills:"]
        output.extend(f"- {entry}" for entry in entries)
        return "\n".join(output)

    def _format_certifications_section(self, lines: List[str]) -> str:
        entries = []
        for line in lines:
            cleaned = self._clean_section_line(line)
            if not cleaned:
                continue
            entries.append(self._strip_bullet(cleaned))

        if not entries:
            return ""

        output = ["Certifications:"]
        output.extend(f"- {entry}" for entry in entries)
        return "\n".join(output)

    def _format_experience_section(self, lines: List[str]) -> str:
        roles = []
        current_title = None
        current_points: List[str] = []

        for line in lines:
            cleaned = self._clean_section_line(line)
            if not cleaned:
                continue

            if self._looks_like_role_line(cleaned):
                if current_title:
                    roles.append((current_title, current_points))
                current_title = cleaned
                current_points = []
                continue

            if self._is_secondary_bullet(cleaned):
                if current_title:
                    current_points.append(self._strip_bullet(cleaned))
                continue

            if current_title and current_points:
                current_points[-1] = f"{current_points[-1]} {cleaned}".strip()
                continue

            if current_title:
                current_points.append(cleaned)

        if current_title:
            roles.append((current_title, current_points))

        if not roles:
            return self._format_generic_section("experience", lines)

        output = ["Experience:"]
        for index, (title, points) in enumerate(roles, start=1):
            output.append(f"{index}. {title}")
            for point in points:
                output.append(f"- {point}")
            output.append("")

        return "\n".join(output).strip()

    def _format_summary_section(self, lines: List[str]) -> str:
        paragraphs = [self._clean_section_line(line) for line in lines]
        paragraphs = [line for line in paragraphs if line]
        if not paragraphs:
            return ""
        return "Summary:\n" + "\n".join(paragraphs)

    def _format_generic_section(self, section_name: str, lines: List[str]) -> str:
        cleaned_lines = [self._clean_section_line(line) for line in lines]
        cleaned_lines = [line for line in cleaned_lines if line]
        if not cleaned_lines:
            return ""

        title = section_name.replace("_", " ").title() + ":"
        output = [title]
        for line in cleaned_lines:
            if self._is_primary_bullet(line) or self._is_secondary_bullet(line):
                output.append(f"- {self._strip_bullet(line)}")
            elif output and output[-1].startswith("- "):
                output[-1] = f"{output[-1]} {line}".strip()
            else:
                output.append(line)
        return "\n".join(output)

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

    def _score_chunk(
        self,
        question: str,
        question_terms: List[str],
        question_phrases: List[str],
        chunk_text: str,
        chunk_terms: List[str],
    ) -> float:
        overlap_score = self._score_overlap(question_terms, chunk_terms)

        chunk_text_lower = chunk_text.lower()
        question_lower = question.lower()
        exact_question_bonus = 0.45 if question_lower and question_lower in chunk_text_lower else 0.0
        phrase_bonus = sum(0.14 for phrase in question_phrases if phrase and phrase in chunk_text_lower)

        query_numbers = re.findall(r"\d+(?:[./:-]\d+)*", question)
        number_bonus = sum(0.18 for value in query_numbers if value in chunk_text)

        query_symbols = [token for token in question.split() if any(char in token for char in "@:/._-")]
        symbol_bonus = sum(0.2 for token in query_symbols if token.lower() in chunk_text_lower)

        heading_bonus = 0.18 if self._looks_like_heading_match(question_terms, chunk_text_lower) else 0.0
        coverage_bonus = min(0.45, len(set(question_terms) & set(chunk_terms)) * 0.06)
        density_bonus = self._score_term_density(question_terms, chunk_terms)

        return overlap_score + exact_question_bonus + phrase_bonus + number_bonus + symbol_bonus + heading_bonus + coverage_bonus + density_bonus

    def _expand_question(self, question: str) -> str:
        lowered = question.lower()
        additions = []
        for key, synonyms in QUERY_SYNONYMS.items():
            if key in lowered:
                additions.extend(synonyms)
        if additions:
            return f"{question} {' '.join(additions)}"
        return question

    def _extract_query_phrases(self, question: str) -> List[str]:
        phrases = []
        lowered = question.lower().strip()
        if lowered:
            phrases.append(lowered)

        words = [word for word in re.split(r"\s+", lowered) if word]
        if len(words) >= 2:
            phrases.extend(
                " ".join(words[index:index + 2])
                for index in range(len(words) - 1)
            )
        return list(dict.fromkeys(phrases))

    def _expand_with_neighbors(self, indexes: List[int], chunk_count: int) -> List[int]:
        selected = set()
        for index in indexes:
            selected.add(index)
            if index - 1 >= 0:
                selected.add(index - 1)
            if index + 1 < chunk_count:
                selected.add(index + 1)
        return sorted(selected)[: min(chunk_count, max(TOP_K_RESULTS + 2, len(indexes) * 2))]

    def _score_term_density(self, question_terms: List[str], chunk_terms: List[str]) -> float:
        if not question_terms or not chunk_terms:
            return 0.0
        matches = sum(1 for token in chunk_terms if token in set(question_terms))
        density = matches / max(1, len(chunk_terms))
        return min(0.25, density * 2.5)

    def _looks_like_heading_match(self, question_terms: List[str], chunk_text_lower: str) -> bool:
        if not question_terms:
            return False
        lines = [line.strip().lower() for line in chunk_text_lower.splitlines()[:4] if line.strip()]
        if not lines:
            return False
        joined_head = " ".join(lines)
        return any(term in joined_head for term in question_terms[:4])

    def _extract_text(self, content: bytes, filename: str) -> str:
        if filename.lower().endswith(".pdf"):
            reader = PdfReader(io.BytesIO(content))
            return "\n".join(page.extract_text() or "" for page in reader.pages)
        return content.decode("utf-8", errors="ignore")

    def _extract_email(self, text: str) -> str | None:
        lines = [line.strip() for line in text.splitlines() if line.strip()]
        extracted_name = self._extract_name(text)
        name_tokens = self._name_tokens(extracted_name)

        # Prefer lines near the top of the document or lines explicitly mentioning email.
        prioritized_lines = []
        prioritized_lines.extend(lines[:12])
        prioritized_lines.extend(
            line for line in lines if any(keyword in line.lower() for keyword in ("email", "mail", "@"))
        )

        candidates = []
        for line in prioritized_lines:
            normalized_line = self._normalize_inline_contact_text(line)
            candidates.extend(re.findall(r"[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}", normalized_line))

        for candidate in candidates:
            cleaned = candidate.strip(".,;:|")
            cleaned = self._refine_email_candidate(cleaned, name_tokens)
            if self._is_valid_email(cleaned):
                return cleaned

        return None

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
        top_lines = lines[:8]

        for line in top_lines:
            normalized = self._normalize_inline_contact_text(line)
            location = self._extract_location_from_line(normalized)
            if location:
                return location

        for index, line in enumerate(lines):
            if "location" in line.lower():
                parts = line.split(":", 1)
                if len(parts) == 2 and parts[1].strip():
                    return parts[1].strip()
                if index + 1 < len(lines):
                    return lines[index + 1]

        return None

    def _extract_address(self, text: str) -> str | None:
        lines = [line.strip() for line in text.splitlines() if line.strip()]
        for index, line in enumerate(lines):
            lowered = line.lower()
            if "address" in lowered:
                parts = line.split(":", 1)
                if len(parts) == 2 and parts[1].strip():
                    return parts[1].strip()
                if index + 1 < len(lines):
                    next_line = lines[index + 1].strip()
                    if next_line:
                        return next_line

        for line in lines[:8]:
            street_match = re.search(
                r"\b\d{1,5}\s+[A-Za-z0-9., -]+(?:road|rd|street|st|lane|ln|avenue|ave|sector|block)\b",
                line,
                flags=re.IGNORECASE,
            )
            if street_match:
                return street_match.group(0).strip()

        return None

    def _normalize_inline_contact_text(self, text: str) -> str:
        normalized = text
        normalized = re.sub(r"\s*@\s*", "@", normalized)
        normalized = re.sub(r"\s*\.\s*", ".", normalized)
        normalized = re.sub(r"\s+", " ", normalized)
        return normalized

    def _is_valid_email(self, email: str) -> bool:
        local_part, _, domain = email.partition("@")
        if not local_part or not domain:
            return False
        if ".." in email:
            return False
        if domain.startswith(".") or domain.endswith("."):
            return False
        if "." not in domain:
            return False
        return True

    def _refine_email_candidate(self, email: str, name_tokens: List[str]) -> str:
        local_part, separator, domain = email.partition("@")
        if not separator:
            return email

        variants = [local_part]
        for trim in range(1, min(4, len(local_part))):
            variants.append(local_part[trim:])

        best_local = local_part
        best_score = -1
        for variant in variants:
            score = 0
            variant_lower = variant.lower()
            for token in name_tokens:
                if token in variant_lower:
                    score += len(token)
            if variant_lower.startswith(tuple(name_tokens)):
                score += 2
            if score > best_score or (score == best_score and len(variant) < len(best_local)):
                best_local = variant
                best_score = score

        return f"{best_local}@{domain}"

    def _name_tokens(self, name: str | None) -> List[str]:
        if not name:
            return []
        return [
            token.lower()
            for token in re.findall(r"[A-Za-z]+", name)
            if len(token) >= 4
        ]

    def _extract_location_from_line(self, line: str) -> str | None:
        for separator in ("|", "/", ";"):
            parts = [part.strip() for part in line.split(separator) if part.strip()]
            for part in parts:
                if self._looks_like_location_value(part):
                    return part

        comma_groups = [part.strip() for part in line.split("|") if part.strip()]
        for group in comma_groups:
            if self._looks_like_location_value(group):
                return group

        return None

    def _looks_like_location_value(self, value: str) -> bool:
        lowered = value.lower()
        if "@" in value or "linkedin" in lowered or "github" in lowered or "http" in lowered:
            return False
        if re.search(r"\d{5,}", value):
            return False
        location_pattern = re.fullmatch(
            r"[A-Z][A-Za-z]+(?: [A-Z][A-Za-z]+)*(?:,\s*[A-Z][A-Za-z]+(?: [A-Z][A-Za-z]+)*){1,2}",
            value,
        )
        return bool(location_pattern)

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

    def _normalize_chunk_line(self, line: str) -> str:
        return " ".join(line.split()).strip()

    def _clean_section_line(self, line: str) -> str:
        cleaned = " ".join(line.split()).strip()
        cleaned = cleaned.replace("• ", "•").replace("– ", "–")
        return cleaned

    def _is_primary_bullet(self, line: str) -> bool:
        return line.startswith("•")

    def _is_secondary_bullet(self, line: str) -> bool:
        return line.startswith("–") or line.startswith("-")

    def _strip_bullet(self, line: str) -> str:
        return re.sub(r"^[•–-]\s*", "", line).strip()

    def _looks_like_role_line(self, line: str) -> bool:
        if self._is_primary_bullet(line):
            return True
        lowered = line.lower()
        return any(token in lowered for token in ("intern", "engineer", "developer", "analyst", "manager"))

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
