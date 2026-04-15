# GenAI RAG Assistant Document QA

A full-stack AI workspace built with React and FastAPI. The repository started as a document question answering app and now includes a broader product surface with authentication, workspace dashboards, team collaboration, chat management, contact workflows, payments, image generation, object detection, and deployment tooling.

## Overview

This project combines a React frontend with a FastAPI backend and a MySQL-backed data layer. It supports document retrieval with retrieval-augmented generation, user and admin workflows, subscription and billing flows, and several AI-powered features in a single application.

At a high level, the app includes:

- Document upload and question answering for PDF and TXT files
- User signup, login, session-aware workspace access, and OTP support
- Social and linked provider integration scaffolding
- Workspace dashboards, notifications, and analytics panels
- Chat history, conversations, teams, and collaboration-oriented workspace sections
- Admin center and management tooling for contact and support workflows
- Razorpay payment and subscription transaction flows
- Image generation and object detection endpoints and UI panels
- Docker-based local deployment and AWS-oriented deployment automation

## Current Product Scope

The repository is no longer just a simple RAG demo. The codebase currently exposes the following product areas:

### Document Retrieval

- Upload PDF and TXT files
- Extract and chunk document text
- Retrieve relevant chunks using embedding and retrieval logic
- Ask natural-language questions grounded in uploaded content
- Return answers with source context

### Authentication and Account Flows

- Signup and login UI
- Backend auth routes and service layer
- Persistent session storage on the frontend
- OTP/email-related backend dependencies and service support
- Social OAuth configuration support
- Linked provider management routes and services

### Workspace Experience

- Workspace dashboard and notifications
- Team management panel
- Chat management and conversation panes
- Chat discovery, history, and recent activity views
- User settings and profile panels
- Analytics and billing-related workspace views

### Admin and Management

- Admin center API and service layer
- Contact request intake and management workflows
- Reply templates, assignment history, audit logging, and admin notifications
- Management-focused support tooling and seed data

### AI Features Beyond RAG

- Object detection route and frontend panel
- Image generation route and frontend panel
- Shared AI workspace layout across features

### Payments and Subscription Support

- Razorpay integration variables and payment service support
- Subscription transaction models and billing metadata
- Billing API helpers in the frontend

## Tech Stack

### Frontend

- React 18
- Plain CSS
- `react-scripts`
- Firebase client libraries for selected auth-related integrations

### Backend

- FastAPI
- Uvicorn
- SQLAlchemy
- PyMySQL
- Alembic
- OpenAI-compatible model access for Groq-hosted LLM calls
- Sentence Transformers
- FAISS CPU
- PyTorch CPU wheels
- Diffusers and Hugging Face model loading for image generation
- `pypdf` for PDF parsing
- `boto3` for AWS integrations
- `razorpay` for payments

### Database and Storage

- MySQL 8.4 via Docker Compose
- SQLAlchemy ORM models for users, workspace data, chat, admin flows, and subscriptions
- Local document storage
- Optional AWS S3-backed asset/storage configuration

### Deployment

- Multi-stage Docker build
- Docker Compose for app + MySQL
- Ansible deployment playbook

## Repository Structure

```text
GenAI-RAG-Assistant-Document-QA/
|-- backend/
|   |-- alembic/
|   |   `-- versions/
|   |-- app/
|   |   |-- api/
|   |   |   `-- routes/
|   |   |-- core/
|   |   |-- models/
|   |   |-- schemas/
|   |   `-- services/
|   |-- documents/
|   |-- tests/
|   |-- .env.example
|   |-- main.py
|   |-- requirements.txt
|   `-- requirements-otp.txt
|-- frontend/
|   |-- public/
|   |-- src/
|   |   |-- features/
|   |   `-- shared/
|   |-- package.json
|   `-- package-lock.json
|-- mysql/
|   `-- mysql.env.example
|-- Dockerfile
|-- docker-compose.yml
|-- deploy.ps1
|-- deploy.yml
`-- README.md
```

## Backend Modules

### API Routes

The FastAPI app wires these route groups:

- `auth`
- `admin_center`
- `chat_management`
- `contact_requests`
- `documents`
- `frontend`
- `health`
- `image_generation`
- `linked_providers`
- `management`
- `object_detection`
- `payments`
- `workspace_hub`

### Service Layer

The backend service layer currently includes:

- `auth_service`
- `admin_audit_service`
- `admin_center_service`
- `chat_management_core`
- `chat_management_service`
- `contact_request_service`
- `image_generation_service`
- `linked_provider_service`
- `management_service`
- `object_detection_service`
- `otp_service`
- `payment_service`
- `rag_service`
- `social_oauth_service`
- `storage_service`
- `subscription_transaction_service`
- `workspace_hub_service`

### Data Model Coverage

The ORM layer includes models for:

- Users, archives, login sessions, and user settings
- Team workspaces and team members
- Workspace notifications, chat threads, and chat messages
- Chat groups, communities, members, reactions, pins, stars, and preferences
- Contact requests, management notes, reply templates, and assignment history
- Linked providers and social OAuth configuration
- Subscription transactions, billing notes, security events, and admin audit entities

### Database Bootstrap Behavior

`backend/main.py` performs startup-time schema checks and bootstrap logic for:

- user/social link compatibility
- contact request schema updates
- user subscription/profile/admin fields
- user settings and login session tables
- management support tables
- workspace hub and chat-related tables
- subscription transaction enrichment
- seed data for reply templates and admin center defaults

## Frontend Modules

The frontend is organized around feature folders:

- `auth`
- `document-retrieval`
- `image-generation`
- `info`
- `object-detection`
- `workspace`

The main app shell handles:

- route state with hash-based navigation
- session-aware screen selection
- header notifications and recent activity
- workspace routing and mobile sidebar interactions

## Environment Variables

Copy `backend/.env.example` to `backend/.env` and set the values needed for your environment.

Core application variables:

```env
GROQ_API_KEY=your_groq_api_key
GROQ_MODEL=llama-3.1-8b-instant
OBJECT_DETECTION_MODEL=meta-llama/llama-4-scout-17b-16e-instruct
CHUNK_SIZE=700
CHUNK_OVERLAP=120
TOP_K_RESULTS=8
FRONTEND_ORIGIN=http://localhost:3000
APP_BASE_URL=http://localhost:8000
```

Database variables:

```env
MYSQL_HOST=mysql
MYSQL_PORT=3306
MYSQL_DATABASE=genai_app
MYSQL_USER=genai_user
MYSQL_PASSWORD=genai_user_123
```

Embedding and image generation variables:

```env
EMBEDDING_MODEL_NAME=all-MiniLM-L6-v2
IMAGE_GENERATION_BASE_MODEL=stabilityai/stable-diffusion-xl-base-1.0
IMAGE_GENERATION_REPO=ByteDance/SDXL-Lightning
IMAGE_GENERATION_UNET_WEIGHTS=sdxl_lightning_4step_unet.safetensors
IMAGE_GENERATION_STEPS=4
IMAGE_GENERATION_GUIDANCE_SCALE=0
IMAGE_GENERATION_WIDTH=512
IMAGE_GENERATION_HEIGHT=512
IMAGE_GENERATION_LOCAL_FILES_ONLY=false
```

Email and OTP variables:

```env
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USERNAME=your_email@gmail.com
SMTP_PASSWORD=your_gmail_app_password
SMTP_FROM_EMAIL=your_email@gmail.com
OTP_LENGTH=6
OTP_TTL_SECONDS=600
OTP_RESEND_COOLDOWN_SECONDS=30
```

Social OAuth variables:

```env
SOCIAL_OAUTH_STATE_SECRET=your_social_oauth_state_secret
SOCIAL_OAUTH_STATE_TTL_SECONDS=600
FACEBOOK_OAUTH_ENABLED=false
FACEBOOK_OAUTH_CLIENT_ID=
FACEBOOK_OAUTH_CLIENT_SECRET=
LINKEDIN_OAUTH_ENABLED=false
LINKEDIN_OAUTH_CLIENT_ID=
LINKEDIN_OAUTH_CLIENT_SECRET=
```

Payment variables:

```env
RAZORPAY_KEY_ID=
RAZORPAY_KEY_SECRET=
RAZORPAY_COMPANY_NAME=Unified AI Workspace
```

Optional AWS-related variables are referenced by the deployment tooling and storage configuration:

```env
AWS_REGION=
AWS_ACCESS_KEY_ID=
AWS_SECRET_ACCESS_KEY=
AWS_S3_BUCKET=
AWS_S3_PUBLIC_BASE_URL=
SES_FROM_EMAIL=
```

## Local Development

### Prerequisites

- Python 3.10 or later compatible with the backend dependencies
- Node.js 20+
- npm
- MySQL, or Docker for the included Compose setup

### Backend Setup

```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
pip install -r requirements-otp.txt
```

Create `backend/.env` from `backend/.env.example`, then run:

```bash
python main.py
```

The API starts on `http://127.0.0.1:8000`.

### Frontend Setup

```bash
cd frontend
npm install
npm start
```

The frontend runs on `http://localhost:3000`.

The frontend `package.json` includes a proxy to `http://127.0.0.1:8000` for local development.

## Docker

This repository ships with a multi-stage Dockerfile that:

- builds the React frontend
- installs backend dependencies
- installs OTP/email-related backend dependencies
- preloads the default sentence-transformer model
- copies the frontend production build into the runtime image
- serves both frontend and backend from the FastAPI container

Build and run manually:

```bash
docker build -t genai-rag-assistant .
docker run -p 8000:8000 --env-file backend/.env genai-rag-assistant
```

Then open:

```text
http://localhost:8000
```

## Docker Compose

`docker-compose.yml` starts:

- `app`: the FastAPI + frontend container
- `mysql`: a MySQL 8.4 database container

### Compose Setup

1. Copy the MySQL env template:

```bash
copy mysql\mysql.env.example mysql\mysql.env
```

2. Fill in your MySQL credentials in `mysql/mysql.env`.

3. Make sure `backend/.env` is present and populated.

4. Start the stack:

```bash
docker compose up --build
```

The application is exposed on `http://localhost:8000`.

## Deployment Tooling

The repository includes:

- `deploy.yml`: an Ansible playbook that pulls Docker images, provisions MySQL, injects runtime variables, and launches the app container
- `deploy.ps1`: PowerShell helper script for deployment workflow
- `inventory.ini`: inventory configuration placeholder

The Ansible playbook expects environment-specific values for:

- Groq runtime configuration
- MySQL credentials
- AWS/S3/SES values
- social OAuth values
- Razorpay values

## Testing

The backend includes pytest coverage for selected areas, including:

- workspace hub service
- linked provider routes
- chat management service
- chat management API

Run tests from `backend/` with:

```bash
pytest
```

## Key Notes

- The backend currently uses MySQL by default through SQLAlchemy configuration.
- The repository also contains `backend/app.db`, but the active runtime config points to MySQL unless `DATABASE_URL` is overridden.
- Several startup helpers in `backend/main.py` perform schema evolution logic in code in addition to Alembic migrations.
- Some capabilities depend on external credentials and model downloads, especially Groq, Razorpay, SMTP, Hugging Face, and optional AWS services.

## Summary

This repository is best described as an AI workspace platform centered on document QA, with additional collaboration, admin, payment, and multimodal AI features. If you plan to continue developing or presenting the project, this README should now match the real scope of what is in the codebase much more closely than the earlier MVP-focused version.
