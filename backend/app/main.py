from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
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
