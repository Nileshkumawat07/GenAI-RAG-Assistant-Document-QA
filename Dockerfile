ARG BUILDKIT_INLINE_CACHE=1

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
    PORT=8000 \
    HF_HOME=/app/.cache/huggingface \
    SSL_CERT_FILE=/etc/ssl/certs/ca-certificates.crt \
    REQUESTS_CA_BUNDLE=/etc/ssl/certs/ca-certificates.crt \
    CURL_CA_BUNDLE=/etc/ssl/certs/ca-certificates.crt

# System deps for faiss + torch
RUN apt-get update && apt-get install -y \
    build-essential \
    ca-certificates \
    curl \
    gcc \
    g++ \
    libgomp1 \
    openssl \
    && update-ca-certificates \
    && rm -rf /var/lib/apt/lists/*

# Copy dependency manifests before source code so Docker can reuse these layers.
COPY backend/requirements.txt ./requirements.txt
COPY backend/requirements-otp.txt ./requirements-otp.txt

# Install Python dependencies in a stable cached layer.
RUN pip install --no-cache-dir -r requirements.txt \
    && pip install --no-cache-dir -r requirements-otp.txt

ARG PRELOAD_EMBEDDING_MODEL=0

# Keep model preloading optional so scheduled builds do not spend minutes re-downloading it.
RUN if [ "$PRELOAD_EMBEDDING_MODEL" = "1" ]; then \
      python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('all-MiniLM-L6-v2')"; \
    fi

# Copy backend
COPY backend/ ./

# Copy frontend build
COPY --from=frontend-builder /app/frontend/build /app/frontend/build

EXPOSE 8000

CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000}"]
