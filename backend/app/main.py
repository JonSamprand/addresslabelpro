from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse
from postgrest.exceptions import APIError as PostgrestAPIError
from slowapi import _rate_limit_exceeded_handler
from slowapi.errors import RateLimitExceeded
from slowapi.middleware import SlowAPIMiddleware

from app.api.router import api_router
from app.config import settings
from app.shared.rate_limit import limiter

app = FastAPI(
    title=settings.app_name,
    version="0.1.0",
)

# Rate limiting — must be installed before the routes it guards.
app.state.limiter = limiter
app.add_exception_handler(RateLimitExceeded, _rate_limit_exceeded_handler)
app.add_middleware(SlowAPIMiddleware)


# Translate Supabase/postgrest errors into structured 4xx/5xx responses so the
# frontend gets a readable message instead of a stream reset ("Failed to fetch").
# PGRST205 = relation not found in schema cache → almost always "migration not run".
@app.exception_handler(PostgrestAPIError)
async def _postgrest_error_handler(request: Request, exc: PostgrestAPIError):
    code = (exc.code or "").upper() if hasattr(exc, "code") else ""
    msg = exc.message if hasattr(exc, "message") else str(exc)
    if code == "PGRST205":
        return JSONResponse(
            status_code=503,
            content={
                "detail": (
                    f"Supabase schema is missing a required table ({msg}). "
                    "Run backend/migrations/001_initial.sql in your Supabase SQL editor, "
                    "then retry."
                ),
                "code": code,
            },
        )
    return JSONResponse(
        status_code=502,
        content={"detail": f"Database error: {msg}", "code": code},
    )

_allowed_origins = [
    "http://localhost:3000",
    "http://localhost:3001",
]
if settings.frontend_base_url and settings.frontend_base_url not in _allowed_origins:
    _allowed_origins.append(settings.frontend_base_url)

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(api_router, prefix="/api")


@app.get("/health")
async def health_check():
    return {"status": "ok"}
