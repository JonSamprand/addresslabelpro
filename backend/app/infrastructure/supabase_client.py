"""Thin wrapper over the Supabase service-role client.

The service-role client bypasses Row Level Security and should ONLY be used
from our trusted backend for operations we can justify (e.g. writing job rows
on behalf of an authenticated user we've already verified, handling Stripe
webhooks).

User-facing reads use the Supabase JS client from the frontend, where RLS
enforces ownership.
"""
from __future__ import annotations

from functools import lru_cache
from typing import Optional

from supabase import Client, create_client

from app.config import settings


@lru_cache(maxsize=1)
def supabase() -> Optional[Client]:
    """Memoized service-role client. Returns None if not configured.

    Callers should handle None gracefully so the app still boots in dev
    without Supabase.
    """
    if not settings.supabase_url or not settings.supabase_service_role_key:
        return None
    return create_client(settings.supabase_url, settings.supabase_service_role_key)
