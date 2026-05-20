from enum import Enum
from typing import Dict, List, Optional

from pydantic import BaseModel


class JobStatus(str, Enum):
    UPLOADED = "uploaded"
    MAPPED = "mapped"
    VALIDATED = "validated"
    GENERATED = "generated"
    FAILED = "failed"


class JobEntity(BaseModel):
    """Tracks a label generation job through its lifecycle."""

    id: str
    filename: str
    status: JobStatus = JobStatus.UPLOADED
    total_rows: int = 0
    columns: List[str] = []
    csv_data: List[Dict[str, str]] = []
    template: str = "avery_5160"
    error_message: Optional[str] = None
    pdf_path: Optional[str] = None
    # Whether this specific job has been upgraded to Pro (AI cleanup) via Stripe.
    is_paid: bool = False
    # Stripe Checkout Session ID for this job (if an upgrade was initiated).
    stripe_session_id: Optional[str] = None
