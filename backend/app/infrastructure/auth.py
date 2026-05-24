"""Authentication — verify Supabase JWTs on incoming requests.

The frontend (Supabase JS client) attaches `Authorization: Bearer <jwt>` to
API calls. We verify the signature and return a `CurrentUser` we can inject
into route handlers as a FastAPI dependency.

Supabase issues JWTs signed in one of two ways:
  • Legacy (HS256): shared symmetric secret — `ALP_SUPABASE_JWT_SECRET`.
  • Modern (ES256/RS256): asymmetric — verify against the project's JWKS at
    `<project>/auth/v1/.well-known/jwks.json`. This is the default for all
    new projects; the JWT Secret field in the dashboard is just a key ID.

We dispatch on the token's `alg` header so the same code path works for
either signing scheme.
"""
from __future__ import annotations

from functools import lru_cache
from typing import Any, Optional

import jwt
from fastapi import Depends, Header, HTTPException, status
from jwt import PyJWKClient
from pydantic import BaseModel

from app.config import settings


class CurrentUser(BaseModel):
    id: str
    email: Optional[str] = None
    # The raw access-token JWT — useful when we want to forward it to Supabase
    # via a user-scoped client so RLS applies to server-side DB reads.
    token: str


@lru_cache(maxsize=1)
def _jwks_client() -> Optional[PyJWKClient]:
    """Build a memoised JWKS client pointed at the Supabase project.

    Returns None if Supabase isn't configured — callers handle that case.
    The client caches keys in-process; first verification incurs a network
    fetch, subsequent ones are local.
    """
    if not settings.supabase_url:
        return None
    jwks_url = f"{settings.supabase_url.rstrip('/')}/auth/v1/.well-known/jwks.json"
    return PyJWKClient(jwks_url, cache_keys=True)


def _decode(token: str) -> dict[str, Any]:
    if not settings.supabase_url:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Server auth is not configured (missing SUPABASE_URL).",
        )

    try:
        header = jwt.get_unverified_header(token)
    except jwt.InvalidTokenError as e:
        raise HTTPException(status_code=401, detail=f"Invalid auth token: {e}")

    alg = header.get("alg")

    try:
        if alg == "HS256":
            # Legacy projects sign with a shared secret.
            if not settings.supabase_jwt_secret:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail=(
                        "Token is HS256 but ALP_SUPABASE_JWT_SECRET is unset. "
                        "Set it from Supabase → Project Settings → API → JWT Secret."
                    ),
                )
            return jwt.decode(
                token,
                settings.supabase_jwt_secret,
                algorithms=["HS256"],
                audience="authenticated",
            )

        if alg in ("ES256", "RS256"):
            client = _jwks_client()
            if client is None:
                raise HTTPException(
                    status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                    detail="Cannot verify asymmetric JWT: SUPABASE_URL is unset.",
                )
            signing_key = client.get_signing_key_from_jwt(token)
            return jwt.decode(
                token,
                signing_key.key,
                algorithms=[alg],
                audience="authenticated",
            )

        raise HTTPException(
            status_code=401,
            detail=f"Unsupported JWT algorithm: {alg!r}",
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
