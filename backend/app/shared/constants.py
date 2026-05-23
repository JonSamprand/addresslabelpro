from dataclasses import dataclass
from typing import Literal


# Three label families the app supports:
#   - "sheet"      : multi-up on US Letter / A4 (classic Avery)
#   - "continuous" : one label per page, sized for thermal roll printers
#                    (Dymo LabelWriter, Brother QL, Zebra ZD-series, etc.)
#   - "single"     : one label per page on a standard sheet size
TemplateCategory = Literal["sheet", "continuous", "single"]


@dataclass(frozen=True)
class LabelTemplate:
    name: str
    page_width: float    # inches
    page_height: float   # inches
    label_width: float   # inches
    label_height: float  # inches
    columns: int
    rows: int
    top_margin: float    # inches
    left_margin: float   # inches
    h_gap: float         # inches — horizontal gap between labels
    v_gap: float         # inches — vertical gap between labels
    category: TemplateCategory = "sheet"
    description: str = ""  # short human-readable label, shown in the picker

    @property
    def labels_per_page(self) -> int:
        return self.columns * self.rows


# ---------------------------------------------------------------------------
# Sheet labels — Avery & compatible (US Letter)
# ---------------------------------------------------------------------------
AVERY_5160 = LabelTemplate(
    name="Avery 5160 / 8160",
    description='Address · 1" × 2.625" · 30 per sheet',
    category="sheet",
    page_width=8.5,
    page_height=11.0,
    label_width=2.625,
    label_height=1.0,
    columns=3,
    rows=10,
    top_margin=0.5,
    left_margin=0.1875,
    h_gap=0.125,
    v_gap=0.0,
)

AVERY_5161 = LabelTemplate(
    name="Avery 5161 / 8161",
    description='Address · 1" × 4" · 20 per sheet',
    category="sheet",
    page_width=8.5,
    page_height=11.0,
    label_width=4.0,
    label_height=1.0,
    columns=2,
    rows=10,
    top_margin=0.5,
    left_margin=0.15625,
    h_gap=0.1875,
    v_gap=0.0,
)

AVERY_5163 = LabelTemplate(
    name="Avery 5163 / 8163",
    description='Shipping · 2" × 4" · 10 per sheet',
    category="sheet",
    page_width=8.5,
    page_height=11.0,
    label_width=4.0,
    label_height=2.0,
    columns=2,
    rows=5,
    top_margin=0.5,
    left_margin=0.15625,
    h_gap=0.1875,
    v_gap=0.0,
)

AVERY_5164 = LabelTemplate(
    name="Avery 5164 / 8164",
    description='Large shipping · 3.33" × 4" · 6 per sheet',
    category="sheet",
    page_width=8.5,
    page_height=11.0,
    label_width=4.0,
    label_height=3.333,
    columns=2,
    rows=3,
    top_margin=0.5,
    left_margin=0.15625,
    h_gap=0.1875,
    v_gap=0.0,
)

AVERY_5167 = LabelTemplate(
    name="Avery 5167 / 8167",
    description='Return address · 0.5" × 1.75" · 80 per sheet',
    category="sheet",
    page_width=8.5,
    page_height=11.0,
    label_width=1.75,
    label_height=0.5,
    columns=4,
    rows=20,
    top_margin=0.5,
    left_margin=0.3,
    h_gap=0.3,
    v_gap=0.0,
)


# ---------------------------------------------------------------------------
# Continuous feed — one label per page, sized for thermal roll printers.
# Page size === label size, no margins.
# ---------------------------------------------------------------------------
def _continuous(name: str, description: str, w: float, h: float) -> LabelTemplate:
    return LabelTemplate(
        name=name,
        description=description,
        category="continuous",
        page_width=w,
        page_height=h,
        label_width=w,
        label_height=h,
        columns=1,
        rows=1,
        top_margin=0.0,
        left_margin=0.0,
        h_gap=0.0,
        v_gap=0.0,
    )


DYMO_30252 = _continuous(
    "Dymo 30252 Address",
    'Address · 1.125" × 3.5"',
    1.125, 3.5,
)
DYMO_30253 = _continuous(
    "Dymo 30253 Large Address",
    'Large address · 1.125" × 4"',
    1.125, 4.0,
)
DYMO_30334 = _continuous(
    "Dymo 30334 Multi-purpose",
    'Multi-purpose · 1.25" × 2.25"',
    2.25, 1.25,
)
# Brother DK-1201 — 29mm × 90mm. Most common Brother QL standard address label.
BROTHER_DK1201 = _continuous(
    "Brother DK-1201 Standard",
    'Standard address · 29mm × 90mm (1.14" × 3.54")',
    29.0 / 25.4, 90.0 / 25.4,
)


# ---------------------------------------------------------------------------
# Single label per page — full-page label stock or generic thermal shipping.
# ---------------------------------------------------------------------------
SINGLE_4X6 = LabelTemplate(
    name='4" × 6" Shipping Label',
    description='Generic thermal · 4" × 6" · Zebra, Rollo, etc.',
    category="single",
    page_width=4.0,
    page_height=6.0,
    label_width=4.0,
    label_height=6.0,
    columns=1,
    rows=1,
    top_margin=0.0,
    left_margin=0.0,
    h_gap=0.0,
    v_gap=0.0,
)

SINGLE_LETTER = LabelTemplate(
    name="US Letter — Full Page",
    description='One label per page · 8.5" × 11"',
    category="single",
    page_width=8.5,
    page_height=11.0,
    label_width=8.0,
    label_height=10.5,
    columns=1,
    rows=1,
    top_margin=0.25,
    left_margin=0.25,
    h_gap=0.0,
    v_gap=0.0,
)


TEMPLATES: dict[str, LabelTemplate] = {
    # Sheet (Avery & compatible)
    "avery_5160": AVERY_5160,
    "avery_5161": AVERY_5161,
    "avery_5163": AVERY_5163,
    "avery_5164": AVERY_5164,
    "avery_5167": AVERY_5167,
    # Continuous feed (thermal roll printers)
    "dymo_30252": DYMO_30252,
    "dymo_30253": DYMO_30253,
    "dymo_30334": DYMO_30334,
    "brother_dk1201": BROTHER_DK1201,
    # Single label per page
    "single_4x6": SINGLE_4X6,
    "single_letter": SINGLE_LETTER,
}

DEFAULT_TEMPLATE = "avery_5160"

# US ZIP code patterns
US_ZIP_PATTERN = r"^\d{5}(-\d{4})?$"

# Font sizing
DEFAULT_FONT_SIZE = 10.0
MIN_FONT_SIZE = 6.0
FONT_SIZE_STEP = 0.5

# Points per inch (PDF units)
POINTS_PER_INCH = 72
