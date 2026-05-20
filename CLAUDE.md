# AddressLabelPro

AI-powered address label printing system. CSV upload → intelligent field parsing → PDF labels.

## Tech Stack
- **Frontend:** Next.js 14+ (App Router, TypeScript)
- **Backend:** Python FastAPI

## Architecture
Clean architecture adapted from Flutter ARCHITECTURE_PROMPT.md principles:
- Layered separation: API → Services (interfaces) → Repositories → Entities/DTOs
- Dependency inversion: services depend on interfaces, not implementations
- Typed error handling: Result pattern, no thrown exceptions in business logic
- Atomic UI design: atoms → molecules → organisms → screens

## Backend Structure (`backend/app/`)
- `api/` — Route handlers (thin controllers)
- `services/` — Business logic interfaces + implementations
- `repositories/` — Data access layer
- `entities/` — Domain models (Pydantic)
- `dtos/` — Request/response DTOs
- `infrastructure/` — CSV parsing, PDF generation, AI integration
- `shared/` — Config, constants, error types, utils

## Frontend Structure (`frontend/src/`)
- `app/` — Next.js App Router pages
- `components/` — Atomic design (atoms/molecules/organisms)
- `hooks/` — Custom React hooks
- `services/` — API client layer
- `types/` — TypeScript interfaces
- `constants/` — Design tokens, config

## Commands
- Backend: `cd backend && uvicorn app.main:app --reload`
- Frontend: `cd frontend && npm run dev`

## Key Design Decisions
- Python backend chosen over NestJS because core logic (CSV parsing, PDF generation, AI) has superior Python libraries
- No contact limit — handles thousands of records
- International address detection is a first-class concern
- All services return Result types, never throw exceptions
