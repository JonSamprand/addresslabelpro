"""Stripe billing — monthly Pro subscription tier.

Flow:
  1. Authenticated user POSTs /billing/checkout → we create (or reuse) a
     Stripe Customer tied to their user_id and start a Subscription-mode
     Checkout Session. Return the hosted URL.
  2. User completes payment on Stripe, lands on /pro-success.
  3. Stripe sends webhooks (checkout.session.completed, customer.subscription.*
     events) to /billing/webhook. We upsert the subscription row in Supabase.
  4. The /labels/map endpoint asks the subscription repo whether the user is
     Pro — if yes, AI cleanup runs.
"""
from __future__ import annotations

from typing import Optional

from fastapi import APIRouter, Depends, HTTPException, Request
from pydantic import BaseModel

from app.config import settings
from app.infrastructure.auth import CurrentUser, get_current_user
from app.infrastructure.supabase_client import supabase
from app.repositories.subscription_repository import SubscriptionRepository

router = APIRouter()
_subs_repo = SubscriptionRepository()


class CheckoutResponse(BaseModel):
    url: str


class PricingResponse(BaseModel):
    price_id: str
    enabled: bool
    product_name: str


class SubscriptionStatusResponse(BaseModel):
    is_pro: bool
    status: Optional[str] = None
    current_period_end: Optional[str] = None
    cancel_at_period_end: bool = False


@router.get("/pricing", response_model=PricingResponse)
async def get_pricing():
    return PricingResponse(
        price_id=settings.stripe_pro_price_id,
        enabled=bool(settings.stripe_secret_key and settings.stripe_pro_price_id),
        product_name=settings.stripe_product_name,
    )


@router.get("/status", response_model=SubscriptionStatusResponse)
async def get_status(user: CurrentUser = Depends(get_current_user)):
    sub = await _subs_repo.get_for_user(user.id)
    if not sub:
        return SubscriptionStatusResponse(is_pro=False)
    return SubscriptionStatusResponse(
        is_pro=sub.is_pro,
        status=sub.status,
        current_period_end=sub.current_period_end.isoformat() if sub.current_period_end else None,
        cancel_at_period_end=sub.cancel_at_period_end,
    )


@router.post("/checkout", response_model=CheckoutResponse)
async def create_checkout(user: CurrentUser = Depends(get_current_user)):
    if not settings.stripe_secret_key or not settings.stripe_pro_price_id:
        raise HTTPException(status_code=503, detail="Stripe is not configured.")

    import stripe
    stripe.api_key = settings.stripe_secret_key

    # Fetch/create the Stripe customer for this user.
    customer_id = await _get_or_create_customer(user, stripe)

    try:
        session = stripe.checkout.Session.create(
            mode="subscription",
            customer=customer_id,
            line_items=[{"price": settings.stripe_pro_price_id, "quantity": 1}],
            success_url=f"{settings.frontend_base_url}/pro-success?session_id={{CHECKOUT_SESSION_ID}}",
            cancel_url=f"{settings.frontend_base_url}/?cancelled=1",
            client_reference_id=user.id,
            allow_promotion_codes=True,
            # Carry user_id into webhook events as belt-and-suspenders.
            subscription_data={"metadata": {"user_id": user.id}},
            metadata={"user_id": user.id},
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Stripe error: {e}")

    return CheckoutResponse(url=session.url or "")


@router.post("/portal", response_model=CheckoutResponse)
async def create_portal(user: CurrentUser = Depends(get_current_user)):
    """Send the user to Stripe's Customer Portal to manage/cancel their sub."""
    if not settings.stripe_secret_key:
        raise HTTPException(status_code=503, detail="Stripe is not configured.")
    import stripe
    stripe.api_key = settings.stripe_secret_key

    customer_id = await _get_or_create_customer(user, stripe)
    try:
        portal = stripe.billing_portal.Session.create(
            customer=customer_id,
            return_url=settings.frontend_base_url,
        )
    except Exception as e:
        raise HTTPException(status_code=502, detail=f"Stripe portal error: {e}")
    return CheckoutResponse(url=portal.url or "")


# ---------------------------------------------------------------------------
# Webhook — durably fulfill subscription changes
# ---------------------------------------------------------------------------
@router.post("/webhook")
async def stripe_webhook(request: Request):
    if not settings.stripe_secret_key or not settings.stripe_webhook_secret:
        raise HTTPException(status_code=503, detail="Stripe webhooks are not configured.")

    import stripe
    stripe.api_key = settings.stripe_secret_key

    payload = await request.body()
    sig = request.headers.get("stripe-signature", "")
    try:
        event = stripe.Webhook.construct_event(
            payload=payload,
            sig_header=sig,
            secret=settings.stripe_webhook_secret,
        )
    except Exception as e:
        raise HTTPException(status_code=400, detail=f"Invalid webhook signature: {e}")

    t = event["type"]

    if t == "checkout.session.completed":
        session = event["data"]["object"]
        user_id = (session.get("metadata") or {}).get("user_id") or session.get("client_reference_id")
        customer_id = session.get("customer")
        if user_id and customer_id:
            await _subs_repo.set_profile_customer(user_id, customer_id)
            # The subscription.* events that follow will populate the row.

    elif t in ("customer.subscription.created", "customer.subscription.updated", "customer.subscription.deleted"):
        sub = event["data"]["object"]
        user_id = (sub.get("metadata") or {}).get("user_id")
        if not user_id:
            user_id = await _subs_repo.user_id_for_customer(sub.get("customer", ""))

        if not user_id:
            # No user mapping available — nothing to do.
            return {"received": True}

        if t == "customer.subscription.deleted":
            await _subs_repo.delete_for_subscription(sub["id"])
            return {"received": True}

        items = (sub.get("items") or {}).get("data") or []
        price_id = items[0]["price"]["id"] if items and items[0].get("price") else None

        await _subs_repo.upsert_from_stripe(
            user_id=user_id,
            stripe_customer_id=sub.get("customer", ""),
            stripe_subscription_id=sub["id"],
            status=sub.get("status", "incomplete"),
            price_id=price_id,
            current_period_end=sub.get("current_period_end"),
            cancel_at_period_end=bool(sub.get("cancel_at_period_end")),
        )

    return {"received": True}


# ---------------------------------------------------------------------------
async def _get_or_create_customer(user: CurrentUser, stripe_mod) -> str:
    """Find-or-create a Stripe customer keyed on user_id. The id is cached in
    the profiles table so we don't create duplicates."""
    client = supabase()
    if client is None:
        raise HTTPException(status_code=503, detail="Supabase is not configured.")

    res = (
        client.table("profiles")
        .select("stripe_customer_id, email")
        .eq("id", user.id)
        .limit(1)
        .execute()
    )
    row = (res.data or [None])[0] or {}
    existing = row.get("stripe_customer_id")
    if existing:
        return existing

    customer = stripe_mod.Customer.create(
        email=user.email or row.get("email"),
        metadata={"user_id": user.id},
    )
    await _subs_repo.set_profile_customer(user.id, customer.id)
    return customer.id
