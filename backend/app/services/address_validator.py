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
        """Detect if an address is international based on available signals."""
        if address.country and address.is_international:
            return address

        # If no country specified, try to infer from zip code format
        if address.zip_code and not address.country:
            if re.match(US_ZIP_PATTERN, address.zip_code.strip()):
                return address.model_copy(update={"country": "US"})

            # Canadian postal code pattern (A1A 1A1)
            if re.match(r"^[A-Za-z]\d[A-Za-z]\s?\d[A-Za-z]\d$", address.zip_code.strip()):
                return address.model_copy(update={"country": "CA"})

            # UK postcode pattern
            if re.match(r"^[A-Za-z]{1,2}\d[A-Za-z\d]?\s?\d[A-Za-z]{2}$", address.zip_code.strip()):
                return address.model_copy(update={"country": "GB"})

            # If zip has letters and doesn't match US pattern, likely international
            if re.search(r"[A-Za-z]", address.zip_code):
                return address.model_copy(update={"country": "INTERNATIONAL"})

        # Default to US if no signals
        if not address.country:
            return address.model_copy(update={"country": "US"})

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
