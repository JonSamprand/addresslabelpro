from typing import List

from pydantic import BaseModel

from app.entities.address import AddressEntity


class LabelEntity(BaseModel):
    """A single label with its content and layout metadata."""

    index: int
    address: AddressEntity
    lines: List[str] = []
    font_size: float = 10.0
    is_valid: bool = True
    warnings: List[str] = []
