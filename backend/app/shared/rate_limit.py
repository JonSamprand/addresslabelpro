"""Rate limiting — per-user when authed, per-IP otherwise."""
from __future__ import annotations

from typing import Any

from fastapi import Request
from slowapi import Limiter
from slowapi.util import get_remote_address


def _key(request: Request) -> str:
    """Prefer the authenticated user id; fall back to remote address."""
    user: Any = getattr(request.state, "user", None)
    if user is not None:
        uid = getattr(user, "id", None)
        if uid:
            return f"user:{uid}"
    return f"ip:{get_remote_address(request)}"


limiter = Limiter(key_func=_key, default_limits=[])
