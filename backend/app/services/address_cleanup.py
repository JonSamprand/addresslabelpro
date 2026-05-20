"""Deterministic address cleanup.

Handles the 95% case without ever calling an AI API:
  - Extracts apartment/unit/suite numbers from street1 → street2
  - Normalizes ALL-CAPS / all-lowercase to Title Case
  - Normalizes US state to 2-letter uppercase
  - Infers country from postal code patterns & well-known city names

Uses `usaddress` (pure Python, MIT licensed, battle-tested parser used by
the U.S. Census-derived community).

The AI layer is only invoked for rows that still look problematic after
this pass runs.
"""
from __future__ import annotations

import re
from typing import List, Optional

from app.entities.address import AddressEntity


# usaddress labels that correspond to "unit/apartment" information.
# When these appear inside street1, we lift them out to street2.
_APT_LABELS = {
    "OccupancyType",
    "OccupancyIdentifier",
    "SubaddressType",
    "SubaddressIdentifier",
}

# Additional street1 labels that form the "real" street line.
_STREET_LABELS = {
    "AddressNumber",
    "AddressNumberPrefix",
    "AddressNumberSuffix",
    "StreetNamePreDirectional",
    "StreetNamePreType",
    "StreetNamePreModifier",
    "StreetName",
    "StreetNamePostType",
    "StreetNamePostDirectional",
    "StreetNamePostModifier",
    "LandmarkName",
}

# A few well-known "country of city" hints. Not exhaustive — just saves API
# calls on the obvious ones.
_CITY_TO_COUNTRY = {
    "paris": "FR",
    "lyon": "FR",
    "marseille": "FR",
    "london": "GB",
    "manchester": "GB",
    "birmingham": "GB",
    "toronto": "CA",
    "montreal": "CA",
    "vancouver": "CA",
    "ottawa": "CA",
    "berlin": "DE",
    "munich": "DE",
    "madrid": "ES",
    "barcelona": "ES",
    "rome": "IT",
    "milan": "IT",
    "tokyo": "JP",
    "osaka": "JP",
    "sydney": "AU",
    "melbourne": "AU",
    "dublin": "IE",
    "amsterdam": "NL",
    "brussels": "BE",
    "lisbon": "PT",
    "mexico city": "MX",
    "são paulo": "BR",
    "sao paulo": "BR",
    "rio de janeiro": "BR",
    "buenos aires": "AR",
    "shanghai": "CN",
    "beijing": "CN",
    "singapore": "SG",
    "seoul": "KR",
    "dubai": "AE",
}


class AddressCleanupService:
    """Pure-Python cleanup — no network calls."""

    def cleanup(self, addresses: List[AddressEntity]) -> List[AddressEntity]:
        return [self._cleanup_one(a) for a in addresses]

    def _cleanup_one(self, addr: AddressEntity) -> AddressEntity:
        updates: dict = {}

        # Normalize casing
        if addr.name and self._needs_case_fix(addr.name):
            updates["name"] = self._title_case_name(addr.name)
        if addr.company and self._needs_case_fix(addr.company):
            updates["company"] = self._smart_title(addr.company)
        if addr.city and self._needs_case_fix(addr.city):
            updates["city"] = self._smart_title(addr.city)

        # Extract apartment from street1
        street_fix = self._extract_apt(addr.street1, addr.street2)
        if street_fix:
            new_street1, new_street2 = street_fix
            if new_street1 != addr.street1:
                updates["street1"] = new_street1
            if new_street2 != addr.street2:
                updates["street2"] = new_street2

        # Normalize US state to 2-letter uppercase
        if addr.state:
            norm_state = self._normalize_state(addr.state)
            if norm_state and norm_state != addr.state:
                updates["state"] = norm_state

        # Infer country
        if not addr.country:
            inferred = self._infer_country(addr)
            if inferred:
                updates["country"] = inferred

        return addr.model_copy(update=updates) if updates else addr

    # ----- pieces -----

    @staticmethod
    def _needs_case_fix(s: str) -> bool:
        stripped = s.strip()
        if len(stripped) < 2:
            return False
        # All caps (except short 2-letter tokens like state abbrevs)
        if stripped.isupper():
            return True
        # All lowercase
        if stripped.islower():
            return True
        return False

    @staticmethod
    def _smart_title(s: str) -> str:
        """Title-case but preserve common acronyms."""
        return " ".join(
            w if w.upper() in {"USA", "UK", "NYC", "LA", "DC"} else w.capitalize()
            for w in s.strip().split()
        )

    @staticmethod
    def _title_case_name(s: str) -> str:
        """Title case for person names — handles McName and O'Name."""
        def cap(word: str) -> str:
            if word.startswith("Mc") and len(word) > 2:
                return "Mc" + word[2:].capitalize()
            if "'" in word:
                return "'".join(p.capitalize() for p in word.split("'"))
            return word.capitalize()

        return " ".join(cap(w) for w in s.strip().split())

    @staticmethod
    def _extract_apt(street1: str, street2: str) -> Optional[tuple[str, str]]:
        """Parse street1 and lift apartment/unit info into street2.

        Returns None if the original street1 is already clean. Returns
        (new_street1, new_street2) otherwise.

        Non-US addresses usually don't match usaddress cleanly — we just
        leave them alone in that case.
        """
        if not street1 or not street1.strip():
            return None

        # Quick heuristic short-circuit: if street1 has no apartment markers
        # AND no trailing unit-like suffix, skip parsing.
        has_word_marker = re.search(
            r"\b(apt|apartment|unit|suite|ste|no|bldg|floor|fl|rm|room|lot)\b",
            street1,
            re.IGNORECASE,
        )
        has_hash_marker = "#" in street1
        has_trailing_unit = re.search(r",\s*[a-z0-9\-]{1,6}\s*$", street1, re.IGNORECASE)
        if not (has_word_marker or has_hash_marker or has_trailing_unit):
            return None

        try:
            import usaddress
            tagged, _ = usaddress.tag(street1)
        except Exception:
            return None

        street_parts: list[str] = []
        apt_parts: list[str] = []
        # usaddress returns an OrderedDict mapping label -> token.
        for label, raw_token in tagged.items():
            if label in _APT_LABELS:
                apt_parts.append(raw_token)
            elif label in _STREET_LABELS:
                street_parts.append(raw_token)

        if not apt_parts or not street_parts:
            return None

        new_street1 = " ".join(street_parts).strip().rstrip(",")
        lifted = " ".join(apt_parts).strip()

        # Combine with any existing street2 without duplicating.
        if street2 and lifted.lower() in street2.lower():
            new_street2 = street2
        elif street2:
            new_street2 = f"{lifted}, {street2}"
        else:
            new_street2 = lifted

        return new_street1, new_street2

    @staticmethod
    def _normalize_state(state: str) -> Optional[str]:
        s = state.strip()
        if len(s) == 2:
            return s.upper()
        # Map full-name to abbreviation for the 50 + DC
        full_to_abbr = {
            "alabama": "AL", "alaska": "AK", "arizona": "AZ", "arkansas": "AR",
            "california": "CA", "colorado": "CO", "connecticut": "CT", "delaware": "DE",
            "district of columbia": "DC", "florida": "FL", "georgia": "GA", "hawaii": "HI",
            "idaho": "ID", "illinois": "IL", "indiana": "IN", "iowa": "IA",
            "kansas": "KS", "kentucky": "KY", "louisiana": "LA", "maine": "ME",
            "maryland": "MD", "massachusetts": "MA", "michigan": "MI", "minnesota": "MN",
            "mississippi": "MS", "missouri": "MO", "montana": "MT", "nebraska": "NE",
            "nevada": "NV", "new hampshire": "NH", "new jersey": "NJ", "new mexico": "NM",
            "new york": "NY", "north carolina": "NC", "north dakota": "ND", "ohio": "OH",
            "oklahoma": "OK", "oregon": "OR", "pennsylvania": "PA", "rhode island": "RI",
            "south carolina": "SC", "south dakota": "SD", "tennessee": "TN", "texas": "TX",
            "utah": "UT", "vermont": "VT", "virginia": "VA", "washington": "WA",
            "west virginia": "WV", "wisconsin": "WI", "wyoming": "WY",
        }
        return full_to_abbr.get(s.lower())

    @staticmethod
    def _infer_country(addr: AddressEntity) -> Optional[str]:
        # Static city-name shortcut for famous cities
        if addr.city:
            hit = _CITY_TO_COUNTRY.get(addr.city.strip().lower())
            if hit:
                return hit

        zip_ = (addr.zip_code or "").strip()
        # US ZIP pattern
        if re.match(r"^\d{5}(-\d{4})?$", zip_):
            return "US"
        # Canadian
        if re.match(r"^[A-Za-z]\d[A-Za-z]\s?\d[A-Za-z]\d$", zip_):
            return "CA"
        # UK
        if re.match(r"^[A-Za-z]{1,2}\d[A-Za-z\d]?\s?\d[A-Za-z]{2}$", zip_):
            return "GB"
        return None

    @staticmethod
    def needs_ai_review(addr: AddressEntity) -> bool:
        """Whether a row is still messy after deterministic cleanup and
        should be sent to the AI tier for a second pass."""
        # Missing country for a clearly non-US-shaped zip
        if not addr.country and addr.zip_code and not re.match(r"^\d{5}", addr.zip_code):
            return True
        # Still messy casing slipped through
        if addr.name and addr.name.isupper() and len(addr.name) > 3:
            return True
        # Non-ASCII gibberish in name/city often means encoding issue
        return False
