from dataclasses import dataclass


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


# Common Avery templates (dimensions in inches)
AVERY_5160 = LabelTemplate(
    name="Avery 5160 / 8160",
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

AVERY_5163 = LabelTemplate(
    name="Avery 5163 / 8163",
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

TEMPLATES = {
    "avery_5160": AVERY_5160,
    "avery_5163": AVERY_5163,
    "avery_5164": AVERY_5164,
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
