from __future__ import annotations

from app.dtos.result import Result
from app.entities.address import AddressEntity
from app.entities.label import LabelEntity
from app.services.interfaces import LabelLayoutServiceI
from app.shared.constants import (
    LabelTemplate,
    DEFAULT_FONT_SIZE,
    MIN_FONT_SIZE,
    FONT_SIZE_STEP,
    POINTS_PER_INCH,
)


# Approximate character width as fraction of font size (monospace approximation)
CHAR_WIDTH_RATIO = 0.6


class LabelLayoutService(LabelLayoutServiceI):
    def layout_labels(
        self,
        addresses: list[AddressEntity],
        template: LabelTemplate,
        font_size: float | None = None,
    ) -> Result[list[LabelEntity]]:
        tmpl = template
        base_font_size = font_size or DEFAULT_FONT_SIZE
        label_width_pts = tmpl.label_width * POINTS_PER_INCH
        label_height_pts = tmpl.label_height * POINTS_PER_INCH

        # Usable area with internal padding (5% each side)
        padding = label_width_pts * 0.05
        usable_width = label_width_pts - (padding * 2)
        usable_height = label_height_pts - (padding * 2)

        labels: list[LabelEntity] = []

        for i, addr in enumerate(addresses):
            lines = addr.format_lines()
            warnings: list[str] = []

            if not addr.is_complete:
                warnings.extend([f"Missing: {f}" for f in addr.missing_fields])

            # Find the right font size — shrink if lines don't fit
            fitted_size = self._fit_font_size(
                lines, base_font_size, usable_width, usable_height,
            )

            if fitted_size < MIN_FONT_SIZE:
                warnings.append(f"Text may be too small to read (font size: {fitted_size}pt)")
                fitted_size = MIN_FONT_SIZE
                lines = self._truncate_lines(lines, fitted_size, usable_width, usable_height)

            labels.append(LabelEntity(
                index=i,
                address=addr,
                lines=lines,
                font_size=fitted_size,
                is_valid=addr.is_complete,
                warnings=warnings,
            ))

        return Result.ok(labels)

    def _fit_font_size(
        self,
        lines: list[str],
        start_size: float,
        max_width: float,
        max_height: float,
    ) -> float:
        """Reduce font size until all lines fit within the label."""
        size = start_size
        while size >= MIN_FONT_SIZE:
            line_height = size * 1.3  # leading
            total_height = line_height * len(lines)
            char_width = size * CHAR_WIDTH_RATIO
            max_line_width = max(len(line) * char_width for line in lines) if lines else 0

            if total_height <= max_height and max_line_width <= max_width:
                return size

            size -= FONT_SIZE_STEP

        return MIN_FONT_SIZE

    def _truncate_lines(
        self,
        lines: list[str],
        font_size: float,
        max_width: float,
        max_height: float,
    ) -> list[str]:
        """Truncate lines that are too long at the minimum font size."""
        char_width = font_size * CHAR_WIDTH_RATIO
        max_chars = int(max_width / char_width) if char_width > 0 else 40
        line_height = font_size * 1.3
        max_lines = int(max_height / line_height) if line_height > 0 else 6

        truncated = []
        for line in lines[:max_lines]:
            if len(line) > max_chars:
                truncated.append(line[: max_chars - 1] + "\u2026")
            else:
                truncated.append(line)

        return truncated
