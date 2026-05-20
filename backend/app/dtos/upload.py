from typing import Dict, List, Optional

from pydantic import BaseModel


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


class FieldMappingRequest(BaseModel):
    job_id: str
    mappings: List[ColumnMapping]
    template: str = "avery_5160"
    sender_address: Optional[Dict[str, str]] = None
