from typing import Dict, List, Optional

from pydantic import BaseModel


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
    def is_international(self) -> bool:
        if not self.country:
            return False
        return self.country.upper() not in ("US", "USA", "UNITED STATES", "UNITED STATES OF AMERICA")

    @property
    def is_complete(self) -> bool:
        return bool(self.name and self.street1 and self.city and (self.state or self.is_international) and self.zip_code)

    @property
    def missing_fields(self) -> List[str]:
        missing = []
        if not self.name:
            missing.append("name")
        if not self.street1:
            missing.append("street1")
        if not self.city:
            missing.append("city")
        if not self.state and not self.is_international:
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
