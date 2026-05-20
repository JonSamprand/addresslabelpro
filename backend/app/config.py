from typing import Literal

from pydantic_settings import BaseSettings


class Settings(BaseSettings):
    app_name: str = "AddressLabelPro"
    debug: bool = False
    upload_dir: str = "uploads"
    output_dir: str = "output"
    max_file_size_mb: int = 50
    default_country: str = "US"

    # AI provider configuration.
    # Provider priority for CSV field-mapping suggestions AND the optional
    # "Smart Clean" tier. "none" disables AI completely (deterministic only).
    ai_provider: Literal["gemini", "anthropic", "none"] = "none"
    anthropic_api_key: str = ""
    gemini_api_key: str = ""
    gemini_model: str = "gemini-1.5-flash"
    anthropic_model: str = "claude-haiku-4-5-20251001"

    # Always run the free deterministic cleanup (usaddress + heuristics).
    enable_deterministic_cleanup: bool = True
    # Global toggle for the AI cleanup pass. Enabled per-job via Stripe payment
    # when this global flag is False (the default for production).
    enable_ai_cleanup: bool = False

    # ---- Stripe ----
    stripe_secret_key: str = ""
    stripe_publishable_key: str = ""
    stripe_webhook_secret: str = ""
    # Pre-created Stripe Price ID for the Pro monthly plan. Create this in the
    # Stripe Dashboard → Products, then paste its id (price_...) here.
    stripe_pro_price_id: str = ""
    stripe_product_name: str = "AddressLabelPro Pro"
    frontend_base_url: str = "http://localhost:3001"

    # ---- Supabase ----
    supabase_url: str = ""
    supabase_anon_key: str = ""
    supabase_service_role_key: str = ""
    # JWT secret used to verify user tokens. Get from
    # Supabase Dashboard → Project Settings → API → JWT Secret
    supabase_jwt_secret: str = ""

    # ---- Rate limits ----
    rate_limit_upload_per_hour: int = 20
    rate_limit_map_per_hour: int = 60
    rate_limit_generate_per_hour: int = 60

    model_config = {"env_file": ".env", "env_prefix": "ALP_"}


settings = Settings()
