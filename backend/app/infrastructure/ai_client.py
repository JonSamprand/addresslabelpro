"""Provider-agnostic AI client.

Supports Gemini (default, ~13x cheaper than Haiku for this task), Anthropic
(Haiku), or disabled. Selected via settings.ai_provider / env vars.

Two use cases:
  1. `suggest_field_mappings` — one-shot per CSV upload (cheap)
  2. `normalize_addresses`    — optional per-row "Smart Clean" tier
"""
from __future__ import annotations

import json
from typing import List, Literal, Optional

from app.dtos.result import Result
from app.dtos.upload import ColumnMapping
from app.entities.address import AddressEntity
from app.shared.errors import AppError, ServerErrorCode


Provider = Literal["gemini", "anthropic", "none"]


class AIClientInfra:
    """Unified interface. Internal routing to the configured provider."""

    def __init__(
        self,
        provider: Provider = "none",
        anthropic_api_key: str = "",
        gemini_api_key: str = "",
        anthropic_model: str = "claude-haiku-4-5-20251001",
        gemini_model: str = "gemini-1.5-flash",
    ) -> None:
        self._provider = provider
        self._anthropic_key = anthropic_api_key
        self._gemini_key = gemini_api_key
        self._anthropic_model = anthropic_model
        self._gemini_model = gemini_model

    @property
    def enabled(self) -> bool:
        if self._provider == "none":
            return False
        if self._provider == "gemini":
            return bool(self._gemini_key)
        if self._provider == "anthropic":
            return bool(self._anthropic_key)
        return False

    # ------------------------------------------------------------------
    # Field-mapping suggestions (one call per CSV upload)
    # ------------------------------------------------------------------
    async def suggest_field_mappings(self, columns: list[str]) -> Result[list[ColumnMapping]]:
        if not self.enabled:
            return Result.fail(AppError(
                code=ServerErrorCode.AI_SERVICE_UNAVAILABLE,
                message="AI service disabled",
            ))

        prompt = (
            "You are analyzing CSV column headers for a mailing label system. "
            "Map each column to one of these fields: name, first_name, last_name, "
            "company, street1, street2, city, state, zip_code, country. "
            "If a column doesn't match any field, skip it.\n\n"
            f"Columns: {columns}\n\n"
            "Return ONLY a JSON array of objects with 'csv_column' and 'field' keys. "
            "No explanation, just the JSON array."
        )

        try:
            text = await self._complete(prompt, max_output_tokens=800)
            mappings_data = _extract_json(text)
            mappings = [ColumnMapping(**m) for m in mappings_data]
            return Result.ok(mappings)
        except Exception as e:
            return Result.fail(AppError(
                code=ServerErrorCode.AI_SERVICE_UNAVAILABLE,
                message=f"AI field detection failed: {e}",
            ))

    # ------------------------------------------------------------------
    # Address normalization (optional per-row tier)
    # ------------------------------------------------------------------
    async def normalize_addresses(
        self,
        addresses: List[AddressEntity],
        indices_to_clean: Optional[List[int]] = None,
    ) -> Result[List[AddressEntity]]:
        """Clean a selected subset of addresses.

        The caller is expected to have already run deterministic cleanup and
        to pass `indices_to_clean` for the residual rows. If `indices_to_clean`
        is None, we fall back to a conservative internal heuristic.
        """
        if not self.enabled:
            return Result.ok(list(addresses))

        if indices_to_clean is None:
            indices_to_clean = [i for i, a in enumerate(addresses) if _needs_cleanup(a)]
        if not indices_to_clean:
            return Result.ok(list(addresses))

        try:
            result = list(addresses)
            BATCH = 50
            for start in range(0, len(indices_to_clean), BATCH):
                chunk = indices_to_clean[start:start + BATCH]
                batch = [
                    {
                        "i": idx,
                        "name": addresses[idx].name,
                        "company": addresses[idx].company,
                        "street1": addresses[idx].street1,
                        "street2": addresses[idx].street2,
                        "city": addresses[idx].city,
                        "state": addresses[idx].state,
                        "zip_code": addresses[idx].zip_code,
                        "country": addresses[idx].country,
                    }
                    for idx in chunk
                ]
                prompt = _build_normalize_prompt(batch)
                text = await self._complete(prompt, max_output_tokens=8000)
                cleaned = _extract_json(text)
                for item in cleaned:
                    idx = item.get("i")
                    if idx is None or idx >= len(result):
                        continue
                    original = result[idx]
                    result[idx] = original.model_copy(update={
                        "name": item.get("name", original.name),
                        "company": item.get("company", original.company),
                        "street1": item.get("street1", original.street1),
                        "street2": item.get("street2", original.street2),
                        "city": item.get("city", original.city),
                        "state": item.get("state", original.state),
                        "zip_code": item.get("zip_code", original.zip_code),
                        "country": item.get("country", original.country),
                    })
            return Result.ok(result)
        except Exception as e:
            # Never block PDF generation on AI failure
            return Result.fail(AppError(
                code=ServerErrorCode.AI_SERVICE_UNAVAILABLE,
                message=f"AI address normalization failed: {e}",
            ))

    # ------------------------------------------------------------------
    # Provider routing
    # ------------------------------------------------------------------
    async def _complete(self, prompt: str, max_output_tokens: int) -> str:
        if self._provider == "gemini":
            return await self._gemini_complete(prompt, max_output_tokens)
        if self._provider == "anthropic":
            return await self._anthropic_complete(prompt, max_output_tokens)
        raise RuntimeError(f"Unknown AI provider: {self._provider}")

    async def _gemini_complete(self, prompt: str, max_output_tokens: int) -> str:
        from google import genai
        from google.genai import types

        client = genai.Client(api_key=self._gemini_key)
        response = await client.aio.models.generate_content(
            model=self._gemini_model,
            contents=prompt,
            config=types.GenerateContentConfig(
                max_output_tokens=max_output_tokens,
                response_mime_type="application/json",
            ),
        )
        return response.text or ""

    async def _anthropic_complete(self, prompt: str, max_output_tokens: int) -> str:
        import anthropic
        client = anthropic.AsyncAnthropic(api_key=self._anthropic_key)
        message = await client.messages.create(
            model=self._anthropic_model,
            max_tokens=max_output_tokens,
            messages=[{"role": "user", "content": prompt}],
        )
        return message.content[0].text if message.content else ""


# ---------------------------------------------------------------------------
# Helpers
# ---------------------------------------------------------------------------
def _extract_json(text: str):
    """Strip optional markdown fences, then parse."""
    t = (text or "").strip()
    if t.startswith("```"):
        # strip ```json\n...\n``` fences
        first_nl = t.find("\n")
        last_fence = t.rfind("```")
        if first_nl != -1 and last_fence > first_nl:
            t = t[first_nl + 1:last_fence].strip()
    return json.loads(t)


def _build_normalize_prompt(batch: list[dict]) -> str:
    return (
        "You are cleaning mailing addresses for a label printing system. "
        "For each address, return a cleaned version with:\n"
        "- Apartment/unit numbers moved to street2 if they were in street1\n"
        "- City/State in proper Title Case\n"
        "- State as 2-letter uppercase abbreviation for US addresses\n"
        "- Country set to 'US' if blank and zip looks like US, else infer from "
        "city/state (Toronto→CA, London→GB, Paris→FR)\n"
        "- Zip preserved exactly as given (don't invent)\n"
        "- Name in Title Case\n"
        "Do NOT fabricate missing data. If a field is unknown, leave it empty.\n\n"
        f"Input (JSON array): {json.dumps(batch)}\n\n"
        "Return ONLY a JSON array of cleaned addresses with the same 'i' index. "
        "Each object has: i, name, company, street1, street2, city, state, zip_code, country. "
        "No explanation, just the JSON array."
    )


def _needs_cleanup(addr: AddressEntity) -> bool:
    """Fallback heuristic if the caller doesn't pre-select problematic rows."""
    import re
    s1 = addr.street1 or ""
    if re.search(r"\b(apt|apartment|unit|suite|ste|#)\b", s1, re.IGNORECASE):
        return True
    if not addr.country and addr.city:
        return True
    if addr.name and (addr.name.isupper() or addr.name.islower()):
        return True
    return False
