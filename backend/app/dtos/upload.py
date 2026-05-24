from typing import Dict, List, Literal, Optional

from pydantic import BaseModel, Field


class ColumnMapping(BaseModel):
    csv_column: str
    field: str  # name, company, street1, street2, city, state, zip, country


class UploadResponse(BaseModel):
    job_id: str
    filename: str
    total_rows: int
    columns: List[str]
    suggested_mappings: List[ColumnMapping]
    sample_rows: List[Dict[str, str]]


class CustomTemplateSpec(BaseModel):
    """User-defined label dimensions, sent inline when `template == "custom"`.

    Units are inches everywhere — frontend converts if the user typed in mm.
    Bounds are deliberately wide; sanity-check is done at request time.
    """
    name: str = "Custom"
    description: str = ""
    category: Literal["sheet", "continuous", "single"] = "sheet"
    page_width: float = Field(..., gt=0, le=60)
    page_height: float = Field(..., gt=0, le=60)
    label_width: float = Field(..., gt=0, le=60)
    label_height: float = Field(..., gt=0, le=60)
    columns: int = Field(..., ge=1, le=100)
    rows: int = Field(..., ge=1, le=100)
    top_margin: float = Field(0.0, ge=0, le=10)
    left_margin: float = Field(0.0, ge=0, le=10)
    h_gap: float = Field(0.0, ge=0, le=10)
    v_gap: float = Field(0.0, ge=0, le=10)


class FieldMappingRequest(BaseModel):
    job_id: str
    mappings: List[ColumnMapping]
    template: str = "avery_5160"
    # When `template == "custom"`, this carries the user-defined dimensions.
    # Ignored for built-in templates.
    custom_template: Optional[CustomTemplateSpec] = None
    sender_address: Optional[Dict[str, str]] = None
