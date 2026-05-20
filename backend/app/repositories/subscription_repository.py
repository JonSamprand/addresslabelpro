"""Subscription lookups + upsert on Stripe webhook."""
from __future__ import annotations

from datetime import datetime, timezone
from typing import Any, Optional

from pydantic import BaseModel

from app.infrastructure.supabase_client import supabase


_PRO_STATUSES = {"trialing", "active"}


class SubscriptionRecord(BaseModel):
    user_id: str
    stripe_customer_id: str
    stripe_subscription_id: str
    status: str
    price_id: Optional[str] = None
    current_period_end: Optional[datetime] = None
    cancel_at_period_end: bool = False

    @property
    def is_pro(self) -> bool:
        return self.status in _PRO_STATUSES


class SubscriptionRepository:
    _TABLE = "subscriptions"
    _PROFILES = "profiles"

    async def get_for_user(self, user_id: str) -> Optional[SubscriptionRecord]:
        client = supabase()
        if client is None:
            return None
        res = (
            client.table(self._TABLE)
            .select("*")
            .eq("user_id", user_id)
            .limit(1)
            .execute()
        )
        rows = res.data or []
        return SubscriptionRecord(**rows[0]) if rows else None

    async def user_is_pro(self, user_id: str) -> bool:
        sub = await self.get_for_user(user_id)
        return bool(sub and sub.is_pro)

    async def upsert_from_stripe(
        self,
        *,
        user_id: str,
        stripe_customer_id: str,
        stripe_subscription_id: str,
        status: str,
        price_id: Optional[str],
        current_period_end: Optional[int],
        cancel_at_period_end: bool,
    ) -> None:
        client = supabase()
        if client is None:
            return
        row: dict[str, Any] = {
            "user_id": user_id,
            "stripe_customer_id": stripe_customer_id,
            "stripe_subscription_id": stripe_subscription_id,
            "status": status,
            "price_id": price_id,
            "cancel_at_period_end": cancel_at_period_end,
        }
        if current_period_end is not None:
            row["current_period_end"] = datetime.fromtimestamp(
                current_period_end, tz=timezone.utc
            ).isoformat()
        client.table(self._TABLE).upsert(row, on_conflict="user_id").execute()

    async def delete_for_subscription(self, stripe_subscription_id: str) -> None:
        client = supabase()
        if client is None:
            return
        client.table(self._TABLE).delete().eq(
            "stripe_subscription_id", stripe_subscription_id
        ).execute()

    # --- profile helpers (so billing can map customer <-> user) -----------
    async def set_profile_customer(self, user_id: str, stripe_customer_id: str) -> None:
        client = supabase()
        if client is None:
            return
        client.table(self._PROFILES).update(
            {"stripe_customer_id": stripe_customer_id}
        ).eq("id", user_id).execute()

    async def user_id_for_customer(self, stripe_customer_id: str) -> Optional[str]:
        client = supabase()
        if client is None:
            return None
        res = (
            client.table(self._PROFILES)
            .select("id")
            .eq("stripe_customer_id", stripe_customer_id)
            .limit(1)
            .execute()
        )
        rows = res.data or []
        return rows[0]["id"] if rows else None
