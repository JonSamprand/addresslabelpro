# AddressLabelPro

AI-assisted address label printing. Upload a CSV, intelligent field mapping suggests the right columns, addresses get cleaned and validated, and a print-ready PDF (Avery-compatible) comes out the other side.

## Stack

- **Frontend** — Next.js 16 (App Router, TypeScript, Tailwind v4), Supabase Auth, pdfme for label preview
- **Backend** — Python 3.9+ / FastAPI, Pydantic v2, ReportLab for PDF generation, `usaddress` for deterministic US parsing, optional Gemini or Anthropic for AI cleanup
- **Persistence** — Supabase (Postgres + Auth)
- **Billing** — Stripe Checkout (monthly Pro subscription unlocks AI cleanup)

## Architecture

Clean architecture, layered: `API → Services (interfaces) → Repositories → Entities/DTOs`. Services depend on interfaces, not implementations. All services return a typed `Result` — no thrown exceptions in business logic. Frontend follows atomic design (atoms → molecules → organisms → screens).

```
backend/app/
├── api/             # Route handlers (thin controllers)
├── services/        # Business logic + interfaces
├── repositories/    # Data access
├── entities/        # Domain models (Pydantic)
├── dtos/            # Request/response DTOs
├── infrastructure/  # CSV parsing, PDF rendering, AI, auth, Supabase client
└── shared/          # Config, constants, errors, rate limiting

frontend/src/
├── app/             # Next.js App Router pages
├── components/      # atoms/ molecules/ organisms/
├── hooks/
├── services/        # API client
├── types/
└── constants/       # Design tokens
```

## Local setup

### Prerequisites

- Python 3.9+
- Node 20+
- A Supabase project (free tier is fine) — needed for auth and persistence

### Backend

```bash
cd backend
python -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt

cp .env.example .env       # then fill in Supabase + (optional) AI/Stripe keys
# Apply migrations/001_initial.sql in your Supabase SQL editor

uvicorn app.main:app --reload --port 8000
```

### Frontend

```bash
cd frontend
npm install
cp .env.local.example .env.local   # fill in Supabase URL + anon key
npm run dev                         # serves on http://localhost:3001
```

## Environment variables

All backend vars are prefixed `ALP_`. See [`backend/.env.example`](backend/.env.example) and [`frontend/.env.local.example`](frontend/.env.local.example) for the full list. Required:

- `ALP_SUPABASE_URL`, `ALP_SUPABASE_ANON_KEY`, `ALP_SUPABASE_SERVICE_ROLE_KEY`, `ALP_SUPABASE_JWT_SECRET`
- `NEXT_PUBLIC_SUPABASE_URL`, `NEXT_PUBLIC_SUPABASE_ANON_KEY`

Optional (unlocks features):
- `ALP_GEMINI_API_KEY` or `ALP_ANTHROPIC_API_KEY` — AI field-mapping suggestions and "Smart Clean" tier
- `ALP_STRIPE_*` — Pro subscription billing

## Design notes

- **Python backend over Node** — CSV parsing (`pandas`), PDF generation (`reportlab`), and US address parsing (`usaddress`) all have meaningfully better Python libraries.
- **No contact limit** — designed to handle thousands of rows per upload.
- **International addresses are a first-class concern** — detected at parse time and laid out differently in the PDF.
- **AI is optional** — the deterministic pipeline (`usaddress` + heuristics) handles ~95% of US addresses for free. AI only runs on residual rows for Pro users.
- **Per-user data isolation** — every query is scoped by `user_id`; Supabase RLS as a second layer.

## License

MIT — see [LICENSE](LICENSE).
