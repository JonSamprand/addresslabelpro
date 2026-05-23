from __future__ import annotations

from app.dtos.result import Result
from app.entities.label import LabelEntity
from app.infrastructure.pdf_renderer import PDFRendererInfra
from app.services.interfaces import PDFGeneratorServiceI
from app.shared.constants import LabelTemplate
from app.shared.errors import AppError, ServerErrorCode


class PDFGeneratorService(PDFGeneratorServiceI):
    def __init__(self, renderer: PDFRendererInfra):
        self._renderer = renderer

    def generate(
        self,
        labels: list[LabelEntity],
        template: LabelTemplate,
        output_path: str,
    ) -> Result[str]:
        try:
            self._renderer.render(labels, template, output_path)
            return Result.ok(output_path)
        except Exception as e:
            return Result.fail(AppError(
                code=ServerErrorCode.PDF_GENERATION_FAILED,
                message=f"PDF generation failed: {str(e)}",
            ))
