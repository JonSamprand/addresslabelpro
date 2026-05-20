from __future__ import annotations

from abc import ABC, abstractmethod

from app.dtos.result import Result
from app.dtos.upload import ColumnMapping, UploadResponse
from app.dtos.label import LabelPreviewResponse
from app.entities.address import AddressEntity
from app.entities.label import LabelEntity


class CSVParserServiceI(ABC):
    """Interface for CSV parsing and field detection."""

    @abstractmethod
    async def parse_and_detect(self, file_path: str, filename: str, job_id: str) -> Result[UploadResponse]:
        ...

    @abstractmethod
    async def suggest_mappings(self, columns: list[str]) -> Result[list[ColumnMapping]]:
        ...


class AddressValidatorServiceI(ABC):
    """Interface for address validation and international detection."""

    @abstractmethod
    def validate_addresses(self, addresses: list[AddressEntity]) -> list[AddressEntity]:
        ...

    @abstractmethod
    def detect_international(self, address: AddressEntity) -> AddressEntity:
        ...

    @abstractmethod
    def check_missing_fields(self, addresses: list[AddressEntity]) -> list[dict]:
        ...


class LabelLayoutServiceI(ABC):
    """Interface for label layout and text fitting."""

    @abstractmethod
    def layout_labels(
        self,
        addresses: list[AddressEntity],
        template: str,
        font_size: float | None = None,
    ) -> Result[list[LabelEntity]]:
        ...


class PDFGeneratorServiceI(ABC):
    """Interface for PDF generation."""

    @abstractmethod
    def generate(
        self,
        labels: list[LabelEntity],
        template: str,
        output_path: str,
    ) -> Result[str]:
        ...
