# ======================
# FRONTEND BUILD
# ======================
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend

COPY frontend/package*.json ./
RUN npm ci

COPY frontend/ ./
ARG REACT_APP_API_BASE_URL=""
ENV REACT_APP_API_BASE_URL=${REACT_APP_API_BASE_URL}
RUN npm run build


# ======================
# BACKEND RUNTIME
# ======================
FROM python:3.10-slim AS runtime
WORKDIR /app/backend

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8000

# ✅ IMPORTANT: system deps for faiss + torch
RUN apt-get update && apt-get install -y \
    build-essential \
    gcc \
    g++ \
    libgomp1 \
    && rm -rf /var/lib/apt/lists/*

# Copy requirements
COPY backend/requirements.txt ./

# Install python deps
RUN pip install --no-cache-dir -r requirements.txt

# ✅ OPTIONAL (recommended): pre-download embedding model
RUN python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('all-MiniLM-L6-v2')"

# Copy backend
COPY backend/ ./

# Copy frontend build
COPY --from=frontend-builder /app/frontend/build /app/frontend/build

EXPOSE 8000

CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]  