from enum import Enum
from dataclasses import dataclass
from typing import Dict, Optional


class BusinessErrorCode(str, Enum):
    INVALID_CSV = "invalid_csv"
    MISSING_REQUIRED_FIELDS = "missing_required_fields"
    NO_VALID_ADDRESSES = "no_valid_addresses"
    FIELD_MAPPING_FAILED = "field_mapping_failed"
    TEMPLATE_NOT_FOUND = "template_not_found"


class ClientErrorCode(str, Enum):
    INVALID_INPUT = "invalid_input"
    FILE_TOO_LARGE = "file_too_large"
    UNSUPPORTED_FORMAT = "unsupported_format"


class ServerErrorCode(str, Enum):
    INTERNAL_ERROR = "internal_error"
    PDF_GENERATION_FAILED = "pdf_generation_failed"
    AI_SERVICE_UNAVAILABLE = "ai_service_unavailable"


@dataclass(frozen=True)
class AppError:
    code: str
    message: str
    details: Optional[Dict] = None
