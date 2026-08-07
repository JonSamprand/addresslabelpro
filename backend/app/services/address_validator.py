from __future__ import annotations

import re

from app.entities.address import AddressEntity
from app.services.interfaces import AddressValidatorServiceI
from app.shared.constants import US_ZIP_PATTERN


class AddressValidatorService(AddressValidatorServiceI):
    def validate_addresses(self, addresses: list[AddressEntity]) -> list[AddressEntity]:
        validated = []
        for addr in addresses:
            addr = self.detect_international(addr)
            addr = self._normalize_fields(addr)
            validated.append(addr)
        return validated

    def detect_international(self, address: AddressEntity) -> AddressEntity:
        """Infer the country when it wasn't supplied.

        Rules, in order of confidence:
          1. An explicit country wins — we only canonicalise US variants.
          2. Otherwise infer from the postal-code format.
          3. If nothing matches, leave `country` EMPTY (= unknown).

        We deliberately never invent a country. Two past bugs came from doing
        so: setting the literal sentinel "INTERNATIONAL" (which then printed
        as a line on the label), and defaulting unknowns to "US" (which made
        every stateless foreign row emit a bogus "Missing state" warning).
        """
        if address.country and address.country.strip():
            # Canonicalise the many spellings of the US so downstream
            # grouping/format code sees one value. Territories are left alone
            # (they're meaningful as-is and already treated as domestic).
            if address.country.strip().upper() in (
                "US", "USA", "U.S.", "U.S.A.",
                "UNITED STATES", "UNITED STATES OF AMERICA",
            ):
                return address.model_copy(update={"country": "US"})
            return address

        zip_raw = (address.zip_code or "").strip()
        if zip_raw:
            if re.match(US_ZIP_PATTERN, zip_raw):
                return address.model_copy(update={"country": "US"})

            # Canadian postal code pattern (A1A 1A1). We store the full country
            # name, not the ISO code, because USPS wants the destination country
            # spelled out in English on the last line of an international label.
            if re.match(r"^[A-Za-z]\d[A-Za-z]\s?\d[A-Za-z]\d$", zip_raw):
                return address.model_copy(update={"country": "Canada"})

            # UK postcode pattern
            if re.match(r"^[A-Za-z]{1,2}\d[A-Za-z\d]?\s?\d[A-Za-z]{2}$", zip_raw):
                return address.model_copy(update={"country": "United Kingdom"})

        # Unknown — leave country empty rather than guessing.
        return address

    def check_missing_fields(self, addresses: list[AddressEntity]) -> list[dict]:
        warnings = []
        for i, addr in enumerate(addresses):
            for field in addr.missing_fields:
                warnings.append({
                    "row_index": i,
                    "field": field,
                    "message": f"Missing {field} in row {i + 1}",
                })
        return warnings

    def _normalize_fields(self, address: AddressEntity) -> AddressEntity:
        """Clean up whitespace, normalize casing for state/country."""
        updates = {}

        if address.name:
            updates["name"] = address.name.strip()
        if address.company:
            updates["company"] = address.company.strip()
        if address.street1:
            updates["street1"] = address.street1.strip()
        if address.street2:
            updates["street2"] = address.street2.strip()
        if address.city:
            updates["city"] = address.city.strip()
        if address.state:
            updates["state"] = address.state.strip().upper() if len(address.state.strip()) <= 3 else address.state.strip()
        if address.zip_code:
            updates["zip_code"] = address.zip_code.strip()
        if address.country:
            updates["country"] = address.country.strip()

        return address.model_copy(update=updates) if updates else address
