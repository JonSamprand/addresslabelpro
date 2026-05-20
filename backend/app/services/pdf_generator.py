from __future__ import annotations

from app.dtos.result import Result
from app.entities.label import LabelEntity
from app.infrastructure.pdf_renderer import PDFRendererInfra
from app.services.interfaces import PDFGeneratorServiceI
from app.shared.constants import TEMPLATES
from app.shared.errors import AppError, BusinessErrorCode, ServerErrorCode


class PDFGeneratorService(PDFGeneratorServiceI):
    def __init__(self, renderer: PDFRendererInfra):
        self._renderer = renderer

    def generate(
        self,
        labels: list[LabelEntity],
        template: str,
        output_path: str,
    ) -> Result[str]:
        tmpl = TEMPLATES.get(template)
        if not tmpl:
            return Result.fail(AppError(
                code=BusinessErrorCode.TEMPLATE_NOT_FOUND,
                message=f"Template '{template}' not found",
            ))

        try:
            self._renderer.render(labels, tmpl, output_path)
            return Result.ok(output_path)
        except Exception as e:
            return Result.fail(AppError(
                code=ServerErrorCode.PDF_GENERATION_FAILED,
                message=f"PDF generation failed: {str(e)}",
            ))
