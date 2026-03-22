import io
import shutil
from dataclasses import dataclass
from pathlib import Path
from typing import Dict, List

import faiss
import numpy as np
from fastapi import UploadFile
from openai import OpenAI
from pypdf import PdfReader
from sentence_transformers import SentenceTransformer

from config import DOCUMENTS_DIR, GROQ_API_KEY, GROQ_MODEL


CHUNK_SIZE = 300
TOP_K = 5


@dataclass
class Chunk:
    text: str


class RAGService:
    def __init__(self):
        if not GROQ_API_KEY:
            raise ValueError("Set GROQ_API_KEY")

        DOCUMENTS_DIR.mkdir(parents=True, exist_ok=True)

        self.client = OpenAI(
            api_key=GROQ_API_KEY,
            base_url="https://api.groq.com/openai/v1",
        )

        self.model = SentenceTransformer("all-MiniLM-L6-v2")

        self.index = None
        self.chunks: List[Chunk] = []

    async def ingest(self, upload: UploadFile, session_id: str):
        content = await upload.read()

        path = DOCUMENTS_DIR / session_id
        if path.exists():
            shutil.rmtree(path)
        path.mkdir(parents=True)

        file_path = path / upload.filename
        file_path.write_bytes(content)

        text = self._extract_text(content, upload.filename)

        chunks = self._chunk(text)
        self.chunks = [Chunk(c) for c in chunks]

        embeddings = self.model.encode(chunks, convert_to_numpy=True)
        embeddings = embeddings / np.linalg.norm(embeddings, axis=1, keepdims=True)

        dim = embeddings.shape[1]
        self.index = faiss.IndexFlatIP(dim)
        self.index.add(embeddings.astype("float32"))

        return {"chunks": len(chunks)}

    def query(self, question: str, session_id: str):
        if not self.index:
            return {"answer": "Upload document first."}

        query_vec = self.model.encode([question], convert_to_numpy=True)
        query_vec = query_vec / np.linalg.norm(query_vec, axis=1, keepdims=True)

        _, idx = self.index.search(query_vec.astype("float32"), TOP_K)

        context = "\n\n".join(self.chunks[i].text for i in idx[0])

        answer = self._ask_llm(question, context)

        return {"answer": answer}

    def _ask_llm(self, question, context):
        prompt = f"""
Answer ONLY from the context.
If answer not present → say: Not in document.

Return ONLY relevant part. No extra explanation.

Question:
{question}

Context:
{context}
"""

        try:
            res = self.client.chat.completions.create(
                model=GROQ_MODEL,
                temperature=0,
                messages=[{"role": "user", "content": prompt}],
            )
            return res.choices[0].message.content.strip()
        except:
            return "Error"

    def _chunk(self, text):
        words = text.split()
        return [
            " ".join(words[i:i + CHUNK_SIZE])
            for i in range(0, len(words), CHUNK_SIZE)
        ]

    def _extract_text(self, content, filename):
        if filename.lower().endswith(".pdf"):
            reader = PdfReader(io.BytesIO(content))
            return "\n".join(page.extract_text() or "" for page in reader.pages)
        return content.decode("utf-8", errors="ignore")