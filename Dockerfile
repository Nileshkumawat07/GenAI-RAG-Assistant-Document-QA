# syntax=docker/dockerfile:1.7

# ======================
# FRONTEND BUILD
# ======================
FROM node:20-alpine AS frontend-builder
WORKDIR /app/frontend

ENV NPM_CONFIG_UPDATE_NOTIFIER=false \
    NPM_CONFIG_FUND=false \
    NPM_CONFIG_AUDIT=false \
    NPM_CONFIG_CACHE=/root/.npm

COPY frontend/package*.json ./
RUN --mount=type=cache,target=/root/.npm npm ci

COPY frontend/ ./
ARG REACT_APP_API_BASE_URL=""
ENV REACT_APP_API_BASE_URL=${REACT_APP_API_BASE_URL}
RUN --mount=type=cache,target=/root/.npm npm run build


# ======================
# BACKEND RUNTIME
# ======================
FROM python:3.10-slim AS runtime
WORKDIR /app/backend

ENV PYTHONDONTWRITEBYTECODE=1 \
    PYTHONUNBUFFERED=1 \
    PORT=8000 \
    HF_HOME=/app/.cache/huggingface \
    PIP_DISABLE_PIP_VERSION_CHECK=1 \
    PIP_ROOT_USER_ACTION=ignore \
    PIP_CACHE_DIR=/root/.cache/pip \
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

# Copy dependency manifests only so source edits do not invalidate dependency installs.
COPY backend/requirements.txt ./requirements.txt
COPY backend/requirements-otp.txt ./requirements-otp.txt

# Install python deps with a persistent BuildKit cache.
RUN --mount=type=cache,target=/root/.cache/pip \
    pip install -r requirements.txt \
    && pip install -r requirements-otp.txt

ARG PRELOAD_EMBEDDING_MODEL=1

# Pre-download the embedding model into a reusable cache mount.
RUN --mount=type=cache,target=/app/.cache/huggingface \
    if [ "$PRELOAD_EMBEDDING_MODEL" = "1" ]; then \
      python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('all-MiniLM-L6-v2')"; \
    fi

# Copy backend
COPY backend/ ./

# Copy frontend build
COPY --from=frontend-builder /app/frontend/build /app/frontend/build

EXPOSE 8000

CMD ["sh", "-c", "uvicorn main:app --host 0.0.0.0 --port ${PORT:-8000} --proxy-headers --forwarded-allow-ips='*'"]
