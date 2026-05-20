from __future__ import annotations

import uuid

import pandas as pd

from app.dtos.result import Result
from app.dtos.upload import ColumnMapping, UploadResponse
from app.infrastructure.csv_reader import CSVReaderInfra
from app.infrastructure.ai_client import AIClientInfra
from app.services.interfaces import CSVParserServiceI
from app.shared.errors import AppError, BusinessErrorCode


# Common column name patterns for auto-detection
FIELD_PATTERNS: dict[str, list[str]] = {
    "first_name": ["first_name", "firstname", "first", "fname", "given_name"],
    "last_name": ["last_name", "lastname", "last", "lname", "surname", "family_name"],
    "name": ["name", "full_name", "fullname", "contact", "recipient", "addressee", "recipient_name", "contact_name"],
    "company": ["company", "organization", "org", "business", "firm", "company_name"],
    "street1": ["street", "address", "address1", "address_1", "street1", "address_line_1", "line1", "street_address"],
    "street2": ["street2", "address2", "address_2", "address_line_2", "line2", "apt", "suite", "unit"],
    "city": ["city", "town", "municipality", "locality"],
    "state": ["state", "province", "region", "state_province", "st"],
    "zip_code": ["zip", "zip_code", "zipcode", "postal", "postal_code", "postcode", "zip_postal"],
    "country": ["country", "country_code", "nation", "country_name"],
}


class CSVParserService(CSVParserServiceI):
    def __init__(self, csv_reader: CSVReaderInfra, ai_client: AIClientInfra | None = None):
        self._csv_reader = csv_reader
        self._ai_client = ai_client

    async def parse_and_detect(self, file_path: str, filename: str, job_id: str) -> Result[UploadResponse]:
        read_result = self._csv_reader.read(file_path)
        if not read_result.success:
            return Result.fail(read_result.error)

        df = read_result.data
        if df is None or df.empty:
            return Result.fail(AppError(
                code=BusinessErrorCode.INVALID_CSV,
                message="CSV file is empty or could not be parsed",
            ))

        columns = [str(c) for c in df.columns.tolist()]
        mappings_result = await self.suggest_mappings(columns)
        suggested = mappings_result.data if mappings_result.success else []

        sample_rows = df.head(5).fillna("").astype(str).to_dict(orient="records")

        return Result.ok(UploadResponse(
            job_id=job_id,
            filename=filename,
            total_rows=len(df),
            columns=columns,
            suggested_mappings=suggested or [],
            sample_rows=sample_rows,
        ))

    async def suggest_mappings(self, columns: list[str]) -> Result[list[ColumnMapping]]:
        mappings: list[ColumnMapping] = []
        used_fields: set[str] = set()

        for col in columns:
            col_lower = col.lower().strip().replace(" ", "_").replace("-", "_")
            matched_field = None

            # Pass 1: exact match against patterns
            for field, patterns in FIELD_PATTERNS.items():
                if col_lower in patterns and field not in used_fields:
                    matched_field = field
                    used_fields.add(field)
                    break

            # Pass 2: substring match (only if no exact match found)
            if not matched_field:
                for field, patterns in FIELD_PATTERNS.items():
                    if any(p in col_lower for p in patterns):
                        if field not in used_fields:
                            matched_field = field
                            used_fields.add(field)
                            break

            if matched_field:
                # Combine first_name + last_name into name if both found
                mappings.append(ColumnMapping(csv_column=col, field=matched_field))

        # If we have first_name and last_name but no name, note it for the frontend
        # The actual combining happens during address entity creation

        if not mappings and self._ai_client:
            return await self._ai_client.suggest_field_mappings(columns)

        return Result.ok(mappings)
