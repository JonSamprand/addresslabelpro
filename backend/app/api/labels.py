import os
from typing import Any, Dict, List, Optional

from fastapi import APIRouter, Depends, File, HTTPException, Request, UploadFile
from fastapi.responses import FileResponse

from app.config import settings
from app.dtos.upload import CustomTemplateSpec, FieldMappingRequest, UploadResponse
from app.dtos.label import (
    AddressWarning,
    LabelConfigRequest,
    LabelPreviewResponse,
    ValidatedAddress,
)
from app.entities.address import AddressEntity
from app.entities.job import JobStatus
from app.infrastructure.ai_client import AIClientInfra
from app.infrastructure.auth import CurrentUser, get_current_user
from app.infrastructure.csv_reader import CSVReaderInfra
from app.infrastructure.pdf_renderer import PDFRendererInfra
from app.repositories.job_repository import JobRepository
from app.repositories.subscription_repository import SubscriptionRepository
from app.services.address_cleanup import AddressCleanupService
from app.services.address_validator import AddressValidatorService
from app.services.csv_parser import CSVParserService
from app.services.label_layout import LabelLayoutService
from app.services.pdf_generator import PDFGeneratorService
from app.shared.constants import TEMPLATES, LabelTemplate
from app.shared.rate_limit import limiter
from app.shared.utils import ensure_directories


def _resolve_template(
    template_id: str,
    custom: Optional[CustomTemplateSpec],
) -> LabelTemplate:
    """Pick the right LabelTemplate for the request.

    Built-in template IDs come from the static TEMPLATES catalog. The special
    id "custom" pulls dimensions from the inline `custom` payload.
    """
    if template_id == "custom":
        if custom is None:
            raise HTTPException(
                status_code=400,
                detail="template='custom' requires a custom_template payload.",
            )
        return LabelTemplate(
            name=custom.name,
            description=custom.description,
            category=custom.category,
            page_width=custom.page_width,
            page_height=custom.page_height,
            label_width=custom.label_width,
            label_height=custom.label_height,
            columns=custom.columns,
            rows=custom.rows,
            top_margin=custom.top_margin,
            left_margin=custom.left_margin,
            h_gap=custom.h_gap,
            v_gap=custom.v_gap,
        )

    tmpl = TEMPLATES.get(template_id)
    if not tmpl:
        raise HTTPException(
            status_code=400,
            detail=f"Unknown template '{template_id}'. Use one of: {', '.join(TEMPLATES.keys())}, or 'custom'.",
        )
    return tmpl

router = APIRouter()

# Service wiring
_csv_reader = CSVReaderInfra()
_ai_client = AIClientInfra(
    provider=settings.ai_provider,
    anthropic_api_key=settings.anthropic_api_key,
    gemini_api_key=settings.gemini_api_key,
    anthropic_model=settings.anthropic_model,
    gemini_model=settings.gemini_model,
)
_csv_parser = CSVParserService(_csv_reader, _ai_client)
_address_validator = AddressValidatorService()
_address_cleanup = AddressCleanupService()
_label_layout = LabelLayoutService()
_pdf_renderer = PDFRendererInfra()
_pdf_generator = PDFGeneratorService(_pdf_renderer)
_jobs_repo = JobRepository()
_subs_repo = SubscriptionRepository()


@router.post("/upload", response_model=UploadResponse)
@limiter.limit(lambda: f"{settings.rate_limit_upload_per_hour}/hour")
async def upload_csv(
    request: Request,
    file: UploadFile = File(...),
    user: CurrentUser = Depends(get_current_user),
):
    """Upload a CSV file and get suggested field mappings."""
    request.state.user = user  # surface to rate-limiter key func
    ensure_directories()

    if not file.filename or not file.filename.lower().endswith(".csv"):
        raise HTTPException(status_code=400, detail="Only CSV files are accepted")

    content = await file.read()
    if len(content) > settings.max_file_size_mb * 1024 * 1024:
        raise HTTPException(
            status_code=400,
            detail=f"File exceeds {settings.max_file_size_mb}MB limit",
        )

    # Persist job row first so the id is allocated by Postgres.
    job = await _jobs_repo.create(user_id=user.id, filename=file.filename)
    job_id = job.id
    file_path = os.path.join(settings.upload_dir, f"{job_id}.csv")

    with open(file_path, "wb") as f:
        f.write(content)

    result = await _csv_parser.parse_and_detect(file_path, file.filename, job_id)
    if not result.success:
        await _jobs_repo.update(
            user.id, job_id,
            status=JobStatus.FAILED,
            error_message=(result.error.message if result.error else "Parse failed"),
        )
        raise HTTPException(
            status_code=400,
            detail=result.error.message if result.error else "Parse failed",
        )

    data = result.data
    import pandas as pd
    df = pd.read_csv(file_path, dtype=str, keep_default_na=False)

    await _jobs_repo.update(
        user.id,
        job_id,
        status=JobStatus.UPLOADED,
        total_rows=data.total_rows,
        columns=data.columns,
        csv_data=df.fillna("").astype(str).to_dict(orient="records"),
    )

    # Make sure response's job_id matches the persisted one.
    return UploadResponse(
        job_id=job_id,
        filename=data.filename,
        total_rows=data.total_rows,
        columns=data.columns,
        suggested_mappings=data.suggested_mappings,
        sample_rows=data.sample_rows,
    )


@router.post("/map", response_model=LabelPreviewResponse)
@limiter.limit(lambda: f"{settings.rate_limit_map_per_hour}/hour")
async def map_fields(
    request: Request,
    body: FieldMappingRequest,
    user: CurrentUser = Depends(get_current_user),
):
    """Apply field mappings and validate addresses."""
    request.state.user = user

    job = await _jobs_repo.get(user.id, body.job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    # Build addresses from CSV data using the provided mappings
    mapping_dict = {m.csv_column: m.field for m in body.mappings}
    addresses = _build_addresses(job.csv_data, mapping_dict)

    # ------------------------------------------------------------------
    # Cleanup pipeline
    #   1. Deterministic: usaddress + heuristics (free, fast, ~95% case)
    #   2. AI (optional): only residual rows — requires active Pro sub
    # ------------------------------------------------------------------
    pre_cleanup = [a.model_dump() for a in addresses]

    if settings.enable_deterministic_cleanup:
        addresses = _address_cleanup.cleanup(addresses)

    # AI cleanup gate: active Pro subscription (or global dev opt-in).
    user_is_pro = await _subs_repo.user_is_pro(user.id)
    ai_allowed = _ai_client.enabled and (settings.enable_ai_cleanup or user_is_pro)
    ai_indices: set[int] = set()
    ai_touched: list[int] = []
    if ai_allowed:
        residual = [
            i for i, a in enumerate(addresses)
            if AddressCleanupService.needs_ai_review(a)
        ]
        if residual:
            post_det = [a.model_dump() for a in addresses]
            ai_result = await _ai_client.normalize_addresses(addresses, residual)
            if ai_result.success and ai_result.data:
                addresses = ai_result.data
                for i in residual:
                    if post_det[i] != addresses[i].model_dump():
                        ai_touched.append(i)
        ai_indices = set(ai_touched)

    cleaned_indices: set[int] = {
        i for i, (before, after) in enumerate(zip(pre_cleanup, addresses))
        if before != after.model_dump()
    }

    addresses = _address_validator.validate_addresses(addresses)
    warnings_raw = _address_validator.check_missing_fields(addresses)
    warnings = [AddressWarning(**w) for w in warnings_raw]
    international_count = sum(1 for a in addresses if a.is_international)

    tmpl = _resolve_template(body.template, body.custom_template)
    layout_result = _label_layout.layout_labels(addresses, tmpl)
    if not layout_result.success:
        raise HTTPException(
            status_code=400,
            detail=layout_result.error.message if layout_result.error else "Layout failed",
        )

    labels = layout_result.data
    labels_per_page = tmpl.labels_per_page
    total_pages = (len(labels) + labels_per_page - 1) // labels_per_page

    # Persist state for generate step
    await _jobs_repo.update(
        user.id, body.job_id,
        status=JobStatus.VALIDATED,
        template=body.template,
        labels=[label.model_dump() for label in labels] if labels and hasattr(labels[0], "model_dump") else labels,
        addresses=[a.model_dump() for a in addresses],
    )

    validated = [
        ValidatedAddress(
            name=a.name,
            company=a.company,
            street1=a.street1,
            street2=a.street2,
            city=a.city,
            state=a.state,
            zip_code=a.zip_code,
            country=a.country,
            is_international=a.is_international,
            is_complete=a.is_complete,
            missing_fields=a.missing_fields,
            combined_street=a.combined_street,
            city_state_zip=a.city_state_zip,
            address_block=a.address_block,
            formatted_lines=a.format_lines(),
            ai_normalized=(i in ai_indices),
            was_cleaned=(i in cleaned_indices),
        )
        for i, a in enumerate(addresses)
    ]

    return LabelPreviewResponse(
        job_id=body.job_id,
        total_labels=len(labels),
        total_pages=total_pages,
        warnings=warnings,
        international_count=international_count,
        domestic_count=len(addresses) - international_count,
        addresses=validated,
        is_pro=user_is_pro,
        ai_cleaned_count=len(ai_indices),
    )


@router.post("/generate")
@limiter.limit(lambda: f"{settings.rate_limit_generate_per_hour}/hour")
async def generate_pdf(
    request: Request,
    body: LabelConfigRequest,
    user: CurrentUser = Depends(get_current_user),
):
    """Generate the PDF file from validated labels."""
    request.state.user = user
    ensure_directories()

    job = await _jobs_repo.get(user.id, body.job_id)
    if not job:
        raise HTTPException(status_code=404, detail="Job not found")

    labels = getattr(job, "labels", None)
    if not labels:
        # Fallback: pull through Supabase raw (JobRepository.get doesn't hydrate labels by default)
        from app.infrastructure.supabase_client import supabase
        client = supabase()
        if client is not None:
            res = client.table("jobs").select("labels").eq("user_id", user.id).eq("id", body.job_id).limit(1).execute()
            if res.data:
                labels = res.data[0].get("labels")

    if not labels:
        raise HTTPException(status_code=400, detail="No validated labels found. Run /map first.")

    tmpl = _resolve_template(body.template, body.custom_template)
    output_path = os.path.join(settings.output_dir, f"{body.job_id}.pdf")
    result = _pdf_generator.generate(labels, tmpl, output_path)
    if not result.success:
        raise HTTPException(
            status_code=500,
            detail=result.error.message if result.error else "Generation failed",
        )

    await _jobs_repo.update(
        user.id, body.job_id,
        status=JobStatus.GENERATED,
        pdf_path=output_path,
    )

    return {
        "job_id": body.job_id,
        "status": "generated",
        "download_url": f"/api/labels/download/{body.job_id}",
    }


@router.get("/download/{job_id}")
async def download_pdf(job_id: str, user: CurrentUser = Depends(get_current_user)):
    """Download the generated PDF."""
    job = await _jobs_repo.get(user.id, job_id)
    if not job or not job.pdf_path:
        raise HTTPException(status_code=404, detail="PDF not found")
    if not os.path.exists(job.pdf_path):
        raise HTTPException(status_code=404, detail="PDF file not found on disk")

    return FileResponse(
        job.pdf_path,
        media_type="application/pdf",
        filename=f"labels_{job.filename.replace('.csv', '')}.pdf",
    )


def _build_addresses(csv_data: List[Dict[str, Any]], mapping: Dict[str, str]) -> List[AddressEntity]:
    """Convert CSV rows to AddressEntity objects using field mappings."""
    addresses: List[AddressEntity] = []
    field_to_cols: Dict[str, List[str]] = {}
    for csv_col, field in mapping.items():
        field_to_cols.setdefault(field, []).append(csv_col)

    for row in csv_data:
        def get_field(field_name: str) -> str:
            cols = field_to_cols.get(field_name, [])
            return " ".join(str(row.get(c, "")).strip() for c in cols).strip()

        name = get_field("name")
        if not name:
            first = get_field("first_name")
            last = get_field("last_name")
            name = f"{first} {last}".strip()

        addresses.append(AddressEntity(
            name=name,
            company=get_field("company"),
            street1=get_field("street1"),
            street2=get_field("street2"),
            city=get_field("city"),
            state=get_field("state"),
            zip_code=get_field("zip_code"),
            country=get_field("country"),
            raw_data=row,
        ))

    return addresses
