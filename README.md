# LearnSmart

LearnSmart is an AI-powered learning platform developed as a Software Engineering Final Year Project (Group 10). It combines a web application, an AR/VR Memory Palace experience, and an AI-backed backend to support personalised study, content generation, and gamified learning.

## Features

- **AI tutoring & explanations** — chat, Feynman-style explanations, and adaptive comprehension checks.
- **Content generation** — quizzes, flashcards, diagrams, learning paths, and LaTeX-rendered notes generated from uploaded documents.
- **Document ingestion** — PDF, DOCX, PPTX, XLSX, image (OCR), and audio/video (Whisper) processing.
- **Memory Palace (AR/VR)** — Apple Vision Pro / iOS experience for spatial revision.
- **Gamification & social** — challenges, gameplay, reputation, friendships, classrooms, communities, discussions, mentorships, and shared content.
- **Knowledge graph** — Neo4j-backed concept linking with vector search via Qdrant.
- **Teacher tools** — memo assessment, classroom management, and content requests.

## Repository Layout

```
FYP-LearnSmart/
├── apps/
│   ├── web/        # React + Vite + TypeScript frontend
│   └── ARVR/       # Apple Vision Pro / iOS Memory Palace (Xcode project)
├── backend/        # FastAPI backend (Python)
│   ├── app/        # api/, core/, models/, repositories/, services/, utils/
│   ├── database/   # Postgres init SQL
│   └── main.py
├── shared/         # Shared TS types, constants, api helpers
├── deploy/         # nginx + wireguard configs
├── macmini/        # Mac mini model gateway helpers
├── docs/           # Project documentation
├── docker-compose.yml
└── docker-compose.prod.yml
```

## Tech Stack

**Frontend (web)** — React 18, TypeScript, Vite, Tailwind CSS, React Router, TanStack Query, Tiptap, D3, Three.js / react-force-graph-3d, Playwright, Vitest.

**Frontend (AR/VR)** — Swift, SwiftUI, RealityKit (Apple Vision Pro).

**Backend** — FastAPI, Uvicorn, Pydantic, asyncpg, SQLAlchemy-style repositories.

**Data stores** — PostgreSQL 16, Neo4j 5 (graph), Qdrant (vectors).

**AI / ML** — Ollama (local LLM gateway), LangChain, LlamaIndex, Transformers, OpenAI-compatible APIs, Whisper, Tesseract OCR, PyMuPDF.

**Infrastructure** — Docker Compose, WireGuard VPN, Nginx, Postfix SMTP relay.

## Getting Started

### Prerequisites

- Docker & Docker Compose
- Node.js 20+ and npm (for local web dev)
- Python 3.11+ (for local backend dev without Docker)
- Xcode 15+ (for the AR/VR app)
- A `.env` file at the repo root (see `docker-compose.yml` for required variables: `POSTGRES_USER`, `POSTGRES_PASSWORD`, `POSTGRES_DB`, `NEO4J_PASSWORD`, `UPLOAD_DIR`, `SMTP_*`, `OLLAMA_*`, etc.)

### Run the full stack (Docker)

```bash
docker compose up --build
```

Services exposed:
- Backend API — `http://localhost:8000`
- Postgres — `localhost:5432`
- Neo4j browser — `http://localhost:7474`
- Qdrant — `http://localhost:6333`
- Ollama — `http://localhost:11435`

### Web frontend (local dev)

```bash
npm run dev:web
# or: cd apps/web && npm install && npm run dev
```

### Backend (local dev, without Docker)

```bash
cd backend
pip install -r requirements.txt
uvicorn main:app --reload --host 0.0.0.0 --port 8000
```

### AR/VR app

Open `apps/ARVR/Testing Ground/Memory Palace.xcodeproj` in Xcode and run on a Vision Pro simulator or device.

## Testing

```bash
# Web unit tests
cd apps/web && npm run test

# Web end-to-end (Playwright)
cd apps/web && npm run test:e2e

# Backend
cd backend && pytest
```

## Production Deployment

`docker-compose.prod.yml` provides the production stack. Reverse-proxy and TLS termination are handled via the configs under `deploy/nginx`, and WireGuard tunnels the Mac mini model gateway.

## Project

Software Engineering Final Year Project — Group 10.

See `docs/` and `BUGS_REPORT.md` for additional documentation.
