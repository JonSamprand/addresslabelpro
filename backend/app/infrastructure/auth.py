"""Authentication — verify Supabase JWTs on incoming requests.

The frontend (Supabase JS client) attaches `Authorization: Bearer <jwt>` to
API calls. We verify the signature using the project's JWT secret and return
a `CurrentUser` we can inject into route handlers as a FastAPI dependency.
"""
from __future__ import annotations

from typing import Optional

import jwt
from fastapi import Depends, Header, HTTPException, status
from pydantic import BaseModel

from app.config import settings


class CurrentUser(BaseModel):
    id: str
    email: Optional[str] = None
    # The raw access-token JWT — useful when we want to forward it to Supabase
    # via a user-scoped client so RLS applies to server-side DB reads.
    token: str


def _decode(token: str) -> dict:
    if not settings.supabase_jwt_secret:
        # Misconfiguration — refuse rather than silently accept.
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Server auth is not configured (missing SUPABASE_JWT_SECRET).",
        )
    try:
        return jwt.decode(
            token,
            settings.supabase_jwt_secret,
            algorithms=["HS256"],
            # Supabase sets aud="authenticated" for signed-in users.
            audience="authenticated",
        )
    except jwt.ExpiredSignatureError:
        raise HTTPException(status_code=401, detail="Token expired. Please sign in again.")
    except jwt.InvalidTokenError as e:
        raise HTTPException(status_code=401, detail=f"Invalid auth token: {e}")


async def get_current_user(
    authorization: Optional[str] = Header(None),
) -> CurrentUser:
    """Require a valid Supabase JWT on the request."""
    if not authorization or not authorization.lower().startswith("bearer "):
        raise HTTPException(status_code=401, detail="Missing Authorization header.")
    token = authorization.split(" ", 1)[1].strip()
    payload = _decode(token)
    sub = payload.get("sub")
    if not sub:
        raise HTTPException(status_code=401, detail="Token has no subject.")
    return CurrentUser(id=sub, email=payload.get("email"), token=token)


async def get_optional_user(
    authorization: Optional[str] = Header(None),
) -> Optional[CurrentUser]:
    """Attempt auth but don't reject unauthed requests. Useful for endpoints
    that have graceful degradation (e.g. anonymous rate-limited use)."""
    if not authorization:
        return None
    try:
        return await get_current_user(authorization)
    except HTTPException:
        return None


CurrentUserDep = Depends(get_current_user)
OptionalUserDep = Depends(get_optional_user)
