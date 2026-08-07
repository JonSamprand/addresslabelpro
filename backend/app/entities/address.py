from typing import Dict, List, Optional

from pydantic import BaseModel

# Country values that USPS treats as domestic mail. Includes the US territories
# and freely-associated states, which use US ZIP codes and two-letter state
# codes — mail to them is domestic, so we must NOT print a country line or
# flag them as international.
US_DOMESTIC_COUNTRIES = {
    "US", "USA", "U.S.", "U.S.A.", "UNITED STATES", "UNITED STATES OF AMERICA",
    # Territories / commonwealths
    "PR", "PUERTO RICO",
    "VI", "USVI", "U.S. VIRGIN ISLANDS", "VIRGIN ISLANDS",
    "GU", "GUAM",
    "AS", "AMERICAN SAMOA",
    "MP", "NORTHERN MARIANA ISLANDS",
    # Freely associated states (USPS domestic rates)
    "FM", "MICRONESIA", "MH", "MARSHALL ISLANDS", "PW", "PALAU",
}


class AddressEntity(BaseModel):
    """Core domain model for a mailing address."""

    name: str = ""
    company: str = ""
    street1: str = ""
    street2: str = ""
    city: str = ""
    state: str = ""
    zip_code: str = ""
    country: str = ""
    raw_data: Dict[str, str] = {}

    @property
    def is_us_domestic(self) -> bool:
        """True only when we positively know this is USPS-domestic mail.

        An empty country means *unknown*, not "US" — we deliberately don't
        guess, because guessing US is what produced spurious
        "Missing state" warnings on international lists.
        """
        if not self.country:
            return False
        return self.country.strip().upper() in US_DOMESTIC_COUNTRIES

    @property
    def is_international(self) -> bool:
        # Unknown country is not treated as international: we don't want to
        # print a bogus country line for a row we simply couldn't classify.
        if not self.country:
            return False
        return not self.is_us_domestic

    @property
    def is_complete(self) -> bool:
        state_ok = bool(self.state) or not self.is_us_domestic
        return bool(self.name and self.street1 and self.city and state_ok and self.zip_code)

    @property
    def missing_fields(self) -> List[str]:
        missing = []
        if not self.name:
            missing.append("name")
        if not self.street1:
            missing.append("street1")
        if not self.city:
            missing.append("city")
        # Only warn about a missing state when we positively know this is a US
        # domestic address. Many countries have no state/province at all, and
        # an unknown country shouldn't generate a warning we can't justify.
        if not self.state and self.is_us_domestic:
            missing.append("state")
        if not self.zip_code:
            missing.append("zip_code")
        return missing

    @property
    def combined_street(self) -> str:
        """Street1 + street2 merged into one line. Empty parts are dropped."""
        parts = [p.strip() for p in (self.street1, self.street2) if p and p.strip()]
        return ", ".join(parts)

    @property
    def city_state_zip(self) -> str:
        """Single-line city/state/zip in US or international format."""
        parts: List[str] = []
        if self.city:
            parts.append(self.city)
        if self.state:
            if parts:
                parts[-1] += ","
            parts.append(self.state)
        if self.zip_code:
            parts.append(self.zip_code)
        return " ".join(parts)

    def format_lines(
        self,
        include_country: Optional[bool] = None,
        combine_street: bool = True,
    ) -> List[str]:
        """Format address into label lines, dropping empty lines.

        Args:
            include_country: Force include/exclude country line.
                             None = auto (include only if international).
            combine_street:  If True, merge street1+street2 onto one line.
        """
        lines: List[str] = []

        if self.name:
            lines.append(self.name)
        if self.company:
            lines.append(self.company)

        if combine_street:
            if self.combined_street:
                lines.append(self.combined_street)
        else:
            if self.street1:
                lines.append(self.street1)
            if self.street2:
                lines.append(self.street2)

        csz = self.city_state_zip
        if csz:
            lines.append(csz)

        show_country = include_country if include_country is not None else self.is_international
        if show_country and self.country:
            lines.append(self.country.upper())

        return lines

    @property
    def address_block(self) -> str:
        """Multi-line composed address, ready to drop into a single text field."""
        return "\n".join(self.format_lines())
