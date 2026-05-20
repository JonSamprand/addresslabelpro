from __future__ import annotations

import chardet
import pandas as pd

from app.dtos.result import Result
from app.shared.errors import AppError, BusinessErrorCode


class CSVReaderInfra:
    """Reads CSV files with automatic encoding detection."""

    def read(self, file_path: str) -> Result[pd.DataFrame]:
        try:
            encoding = self._detect_encoding(file_path)
            df = pd.read_csv(file_path, encoding=encoding, dtype=str, keep_default_na=False)
            df.columns = [str(c).strip() for c in df.columns]
            return Result.ok(df)
        except Exception as e:
            return Result.fail(AppError(
                code=BusinessErrorCode.INVALID_CSV,
                message=f"Failed to read CSV: {str(e)}",
            ))

    def _detect_encoding(self, file_path: str) -> str:
        with open(file_path, "rb") as f:
            raw = f.read(10000)
        detected = chardet.detect(raw)
        return detected.get("encoding", "utf-8") or "utf-8"
