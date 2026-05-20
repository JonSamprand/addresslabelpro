"""Job persistence — replaces the in-memory dict.

Uses the Supabase service-role client but always scopes queries by user_id so
we never leak rows across users.
"""
from __future__ import annotations

from typing import Any, List, Optional

from app.entities.job import JobEntity, JobStatus
from app.infrastructure.supabase_client import supabase


class JobRepository:
    """Postgres-backed job store."""

    _TABLE = "jobs"

    async def create(self, user_id: str, filename: str) -> JobEntity:
        client = supabase()
        if client is None:
            raise RuntimeError("Supabase is not configured")
        row = {
            "user_id": user_id,
            "filename": filename,
            "status": JobStatus.UPLOADED.value,
        }
        res = client.table(self._TABLE).insert(row).execute()
        data = res.data[0] if res.data else None
        if not data:
            raise RuntimeError("Failed to create job row")
        return self._to_entity(data)

    async def get(self, user_id: str, job_id: str) -> Optional[JobEntity]:
        client = supabase()
        if client is None:
            return None
        res = (
            client.table(self._TABLE)
            .select("*")
            .eq("user_id", user_id)
            .eq("id", job_id)
            .limit(1)
            .execute()
        )
        rows = res.data or []
        return self._to_entity(rows[0]) if rows else None

    async def update(self, user_id: str, job_id: str, **fields: Any) -> None:
        client = supabase()
        if client is None:
            return
        # Map status enum to its .value
        if "status" in fields and hasattr(fields["status"], "value"):
            fields["status"] = fields["status"].value
        (
            client.table(self._TABLE)
            .update(fields)
            .eq("user_id", user_id)
            .eq("id", job_id)
            .execute()
        )

    async def list_for_user(self, user_id: str, limit: int = 50) -> List[JobEntity]:
        client = supabase()
        if client is None:
            return []
        res = (
            client.table(self._TABLE)
            .select("*")
            .eq("user_id", user_id)
            .order("created_at", desc=True)
            .limit(limit)
            .execute()
        )
        return [self._to_entity(r) for r in (res.data or [])]

    # ------------------------------------------------------------------
    def _to_entity(self, row: dict) -> JobEntity:
        return JobEntity(
            id=row["id"],
            filename=row["filename"],
            status=JobStatus(row.get("status") or JobStatus.UPLOADED.value),
            total_rows=row.get("total_rows") or 0,
            columns=row.get("columns") or [],
            csv_data=row.get("csv_data") or [],
            template=row.get("template") or "avery_5160",
            error_message=row.get("error_message"),
            pdf_path=row.get("pdf_path"),
        )
