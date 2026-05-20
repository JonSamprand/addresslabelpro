from typing import List, Optional

from pydantic import BaseModel


class AddressWarning(BaseModel):
    row_index: int
    field: str
    message: str


class ValidatedAddress(BaseModel):
    name: str = ""
    company: str = ""
    street1: str = ""
    street2: str = ""
    city: str = ""
    state: str = ""
    zip_code: str = ""
    country: str = ""
    is_international: bool = False
    is_complete: bool = True
    missing_fields: List[str] = []
    # Composition-ready fields (pre-computed server-side so the label
    # renders cleanly regardless of which optional fields are populated).
    combined_street: str = ""
    city_state_zip: str = ""
    address_block: str = ""
    formatted_lines: List[str] = []
    # True if this address went through AI normalization
    ai_normalized: bool = False
    # True if *any* cleanup layer (deterministic or AI) changed this row
    was_cleaned: bool = False


class LabelPreviewResponse(BaseModel):
    job_id: str
    total_labels: int
    total_pages: int
    warnings: List[AddressWarning]
    international_count: int
    domestic_count: int
    addresses: List[ValidatedAddress] = []
    is_pro: bool = False
    ai_cleaned_count: int = 0


class LabelConfigRequest(BaseModel):
    job_id: str
    template: str = "avery_5160"
    font_size: Optional[float] = None
    include_sender: bool = False
