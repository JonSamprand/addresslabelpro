from __future__ import annotations

from reportlab.lib.pagesizes import letter
from reportlab.lib.units import inch
from reportlab.pdfgen import canvas

from app.entities.label import LabelEntity
from app.shared.constants import LabelTemplate, POINTS_PER_INCH


class PDFRendererInfra:
    """Renders labels to PDF using ReportLab."""

    def render(self, labels: list[LabelEntity], template: LabelTemplate, output_path: str) -> None:
        page_w = template.page_width * POINTS_PER_INCH
        page_h = template.page_height * POINTS_PER_INCH

        c = canvas.Canvas(output_path, pagesize=(page_w, page_h))
        labels_per_page = template.columns * template.rows

        for page_start in range(0, len(labels), labels_per_page):
            page_labels = labels[page_start : page_start + labels_per_page]
            self._render_page(c, page_labels, template)
            if page_start + labels_per_page < len(labels):
                c.showPage()

        c.save()

    def _render_page(
        self,
        c: canvas.Canvas,
        labels: list[LabelEntity],
        template: LabelTemplate,
    ) -> None:
        page_h = template.page_height * POINTS_PER_INCH
        label_w = template.label_width * POINTS_PER_INCH
        label_h = template.label_height * POINTS_PER_INCH
        left_margin = template.left_margin * POINTS_PER_INCH
        top_margin = template.top_margin * POINTS_PER_INCH
        h_gap = template.h_gap * POINTS_PER_INCH
        v_gap = template.v_gap * POINTS_PER_INCH
        padding = label_w * 0.05

        for idx, label in enumerate(labels):
            col = idx % template.columns
            row = idx // template.columns

            x = left_margin + col * (label_w + h_gap) + padding
            y_top = page_h - top_margin - row * (label_h + v_gap)

            font_size = label.font_size
            line_height = font_size * 1.3

            # Vertically center the text block
            total_text_height = line_height * len(label.lines)
            y_start = y_top - (label_h - total_text_height) / 2 - font_size

            c.setFont("Helvetica", font_size)

            for line_idx, line in enumerate(label.lines):
                y = y_start - (line_idx * line_height)
                c.drawString(x, y, line)
