# GenAI RAG Assistant Document QA

A full-stack document question answering application that lets users upload a PDF or TXT file, ask natural-language questions about it, and receive concise answers grounded only in the uploaded content.

This project combines a React frontend with a FastAPI backend and a lightweight retrieval-augmented generation (RAG) pipeline. It is designed for local development and can also be deployed as a single Docker container to AWS.

## Overview

The application provides a focused workspace for document-based question answering:

- Upload a document in `.pdf` or `.txt` format
- Extract readable text from the uploaded file
- Split the document into chunks for retrieval
- Find the most relevant chunks for the user question
- Generate a concise answer using a Groq-hosted LLM through the OpenAI-compatible API
- Display a clean frontend interface for upload, question input, and answer viewing

## Features

- Document upload support for PDF and TXT files
- FastAPI backend with upload, query, and health endpoints
- React frontend with a simple document assistant UI
- Lightweight keyword-overlap retrieval for relevant chunk selection
- LLM-based answer generation restricted to uploaded document context
- Status-aware frontend feedback for uploads and questions
- Dockerized production setup for AWS-friendly deployment
- Single-container deployment flow serving both frontend and backend

## Tech Stack

### Frontend

- React 18
- CSS
- `react-scripts`

### Backend

- FastAPI
- Uvicorn
- Python 3.13
- `pypdf`
- `python-multipart`
- `python-dotenv`
- OpenAI Python SDK configured for Groq's OpenAI-compatible endpoint

### Deployment

- Docker multi-stage build
- AWS-ready single container deployment model

## Project Structure

```text
GenAI-RAG-Assistant-Document-QA/
|-- backend/
|   |-- app/
|   |   |-- api/
|   |   |   `-- routes/
|   |   |-- core/
|   |   |-- schemas/
|   |   `-- services/
|   |-- config.py
|   |-- main.py
|   |-- model.py
|   |-- object_detection/
|   |-- requirements.txt
|   `-- documents/
|-- frontend/
|   |-- public/
|   |-- src/
|   |   |-- app/
|   |   |-- features/
|   |   `-- shared/
|   |-- package.json
|   `-- package-lock.json
|-- Dockerfile
|-- .dockerignore
`-- README.md
```

### Structure Notes

- `backend/app` is now the main production-style backend package
- `backend/main.py`, `backend/config.py`, and `backend/model.py` are kept as compatibility wrappers so the existing run commands still work
- `frontend/src/app` contains the app shell
- `frontend/src/features` contains feature-specific UI like document retrieval and object detection
- `frontend/src/shared` contains shared API, session, and formatting helpers

## How It Works

### 1. Document ingestion

The backend accepts an uploaded file through the `/documents/upload` endpoint.

- PDF files are parsed with `pypdf`
- TXT files are decoded as UTF-8 text
- Empty or unreadable files are rejected

### 2. Chunking

The extracted text is split into smaller chunks using configurable chunk size and overlap settings.

This improves retrieval quality by allowing the system to compare the user question against smaller, more relevant document segments instead of the entire file at once.

### 3. Retrieval

The backend uses a lightweight lexical overlap approach:

- tokenize the question
- tokenize each chunk
- remove common stopwords
- rank chunks by overlap score

The top matching chunks are selected and passed into the model prompt as document context.

### 4. Answer generation

The selected chunks are sent to the Groq API using the OpenAI SDK. The model is instructed to:

- answer only from the provided document context
- avoid outside knowledge
- return a concise direct answer
- reply `Not in document.` if the answer is not clearly present

## API Endpoints

### `GET /health`

Returns service health and indexing status.

### `POST /documents/upload`

Uploads and indexes a PDF or TXT document.

### `POST /query`

Accepts a JSON payload:

```json
{
  "question": "What skills are listed in the resume?"
}
```

Returns an answer plus source excerpts from the retrieved chunks.

### `GET /object-detection/health`

Returns the object-detection route status and configured model.

### `POST /object-detection/detect`

Uploads an image and returns:

- a short summary
- detected objects
- counts
- approximate locations
- confidence levels

## Environment Variables

Copy `backend/.env.example` to `backend/.env` for local development, then fill in your real values.

```env
GROQ_API_KEY=your_groq_api_key
GROQ_MODEL=llama-3.1-8b-instant
CHUNK_SIZE=650
CHUNK_OVERLAP=120
TOP_K_RESULTS=4
FRONTEND_ORIGIN=http://localhost:3000
```

### Variable reference

- `GROQ_API_KEY`: Required. API key used to call Groq.
- `GROQ_MODEL`: Model name used for answer generation.
- `CHUNK_SIZE`: Maximum approximate chunk size.
- `CHUNK_OVERLAP`: Overlap between chunk boundaries.
- `TOP_K_RESULTS`: Number of retrieved chunks to send to the model.
- `FRONTEND_ORIGIN`: Allowed frontend origin for CORS during local development.

## Local Development Setup

### Prerequisites

- Python 3.13 or compatible Python 3 version
- Node.js 20 or later recommended
- npm
- A valid Groq API key

### Start the project

After installing dependencies and creating `backend/.env`, run the project with these two commands in separate terminals:

Backend:

```bash
cd backend
python main.py
```

Frontend:

```bash
cd frontend
npm start
```

The backend runs on `http://127.0.0.1:8000` and the frontend runs on `http://localhost:3000`.

Because the frontend `package.json` includes a proxy to `http://127.0.0.1:8000`, local API calls work without manually setting an API base URL in development.

## Production Docker Setup

This project includes a multi-stage Docker build that:

- builds the React frontend
- installs the Python backend
- copies the production frontend build into the final image
- serves both the frontend and API from a single FastAPI container

### Start with Docker

```bash
docker run -p 8000:8000 -e GROQ_API_KEY=your_groq_api_key genai-rag-assistant
```

Then open:

```text
http://localhost:8000
```

## AWS Deployment

This repository is structured to deploy cleanly to container-based AWS services such as:

- AWS App Runner
- Amazon ECS with Fargate
- Elastic Beanstalk with Docker

### Recommended deployment flow

1. Build the Docker image
2. Push the image to Amazon ECR
3. Deploy the image to your chosen AWS service
4. Set `GROQ_API_KEY` and any other required environment variables in the AWS console or task definition
5. Expose the service on port `8000` or map AWS traffic to the container `PORT`

### Important production note

The backend requires `GROQ_API_KEY` at startup. If it is missing, the application will fail to boot.

## What Was Added in This Version

The project was updated with production deployment support and a cleaner deployment story:

- Added a root-level `Dockerfile`
- Added `.dockerignore`
- Updated the FastAPI backend to serve the built React frontend in production
- Unified frontend and backend delivery into a single container for AWS deployment

## Current Limitations

- Uploaded documents are stored in memory for the running process and are not persisted across restarts
- Retrieval uses keyword overlap rather than vector embeddings
- The app currently supports one running backend instance's in-memory state only
- There is no user authentication, database, or persistent storage layer yet

## Future Improvements

- Add persistent document storage
- Add embeddings-based semantic retrieval
- Store chat/query history
- Support multiple documents and collections
- Add user authentication and role-based access
- Add automated tests and CI/CD workflows

## Screens and User Flow

The user workflow is straightforward:

1. Open the app
2. Upload a PDF or TXT document
3. Wait for indexing to complete
4. Ask a focused question
5. Review the answer returned from the indexed document

## Development Notes

- The frontend uses `REACT_APP_API_BASE_URL` only for production-style custom API targeting
- In local development, the frontend relies on the configured React proxy
- In containerized production, FastAPI serves the React build directly

## Repository Notes

If you plan to publish this project on GitHub, it is a good idea to also add:

- screenshots or a demo GIF
- a license file
- contribution guidelines
- a `.gitignore` file if it is not already present

## License

Add your preferred license here, for example MIT, Apache-2.0, or a private/internal-use notice.

---

Built as a full-stack document question answering assistant with React, FastAPI, Groq, and Docker for local use and AWS deployment.
