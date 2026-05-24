import type { Template, Schema } from "@pdfme/common";

// All measurements in mm
const INCH_TO_MM = 25.4;

/**
 * Three label families the app supports:
 *   - "sheet"      : multi-up on US Letter / A4 (classic Avery)
 *   - "continuous" : one label per page, sized for thermal roll printers
 *                    (Dymo LabelWriter, Brother QL, Zebra ZD-series, …)
 *   - "single"     : one label per page on a standard sheet size
 */
export type TemplateCategory = "sheet" | "continuous" | "single";

export interface LabelTemplateConfig {
  id: string;
  name: string;
  description: string;
  category: TemplateCategory;
  pageWidth: number;   // mm
  pageHeight: number;  // mm
  labelWidth: number;  // mm
  labelHeight: number; // mm
  columns: number;
  rows: number;
  topMargin: number;   // mm
  leftMargin: number;  // mm
  hGap: number;        // mm
  vGap: number;        // mm
}

const sheet = (
  partial: Omit<LabelTemplateConfig, "category" | "pageWidth" | "pageHeight"> & {
    pageWidth?: number;
    pageHeight?: number;
  },
): LabelTemplateConfig => ({
  category: "sheet",
  pageWidth: 8.5 * INCH_TO_MM,
  pageHeight: 11 * INCH_TO_MM,
  ...partial,
});

const continuous = (
  id: string,
  name: string,
  description: string,
  widthIn: number,
  heightIn: number,
): LabelTemplateConfig => ({
  id,
  name,
  description,
  category: "continuous",
  pageWidth: widthIn * INCH_TO_MM,
  pageHeight: heightIn * INCH_TO_MM,
  labelWidth: widthIn * INCH_TO_MM,
  labelHeight: heightIn * INCH_TO_MM,
  columns: 1,
  rows: 1,
  topMargin: 0,
  leftMargin: 0,
  hGap: 0,
  vGap: 0,
});

export const LABEL_CONFIGS: LabelTemplateConfig[] = [
  // ---- Sheet (Avery & compatible) ----
  sheet({
    id: "avery_5160",
    name: "Avery 5160 / 8160",
    description: 'Address · 1" × 2.625" · 30 per sheet',
    labelWidth: 2.625 * INCH_TO_MM,
    labelHeight: 1.0 * INCH_TO_MM,
    columns: 3,
    rows: 10,
    topMargin: 0.5 * INCH_TO_MM,
    leftMargin: 0.1875 * INCH_TO_MM,
    hGap: 0.125 * INCH_TO_MM,
    vGap: 0,
  }),
  sheet({
    id: "avery_5161",
    name: "Avery 5161 / 8161",
    description: 'Address · 1" × 4" · 20 per sheet',
    labelWidth: 4.0 * INCH_TO_MM,
    labelHeight: 1.0 * INCH_TO_MM,
    columns: 2,
    rows: 10,
    topMargin: 0.5 * INCH_TO_MM,
    leftMargin: 0.15625 * INCH_TO_MM,
    hGap: 0.1875 * INCH_TO_MM,
    vGap: 0,
  }),
  sheet({
    id: "avery_5163",
    name: "Avery 5163 / 8163",
    description: 'Shipping · 2" × 4" · 10 per sheet',
    labelWidth: 4.0 * INCH_TO_MM,
    labelHeight: 2.0 * INCH_TO_MM,
    columns: 2,
    rows: 5,
    topMargin: 0.5 * INCH_TO_MM,
    leftMargin: 0.15625 * INCH_TO_MM,
    hGap: 0.1875 * INCH_TO_MM,
    vGap: 0,
  }),
  sheet({
    id: "avery_5164",
    name: "Avery 5164 / 8164",
    description: 'Large shipping · 3.33" × 4" · 6 per sheet',
    labelWidth: 4.0 * INCH_TO_MM,
    labelHeight: 3.333 * INCH_TO_MM,
    columns: 2,
    rows: 3,
    topMargin: 0.5 * INCH_TO_MM,
    leftMargin: 0.15625 * INCH_TO_MM,
    hGap: 0.1875 * INCH_TO_MM,
    vGap: 0,
  }),
  sheet({
    id: "avery_5167",
    name: "Avery 5167 / 8167",
    description: 'Return address · 0.5" × 1.75" · 80 per sheet',
    labelWidth: 1.75 * INCH_TO_MM,
    labelHeight: 0.5 * INCH_TO_MM,
    columns: 4,
    rows: 20,
    topMargin: 0.5 * INCH_TO_MM,
    leftMargin: 0.3 * INCH_TO_MM,
    hGap: 0.3 * INCH_TO_MM,
    vGap: 0,
  }),

  // ---- Continuous feed (thermal roll printers) ----
  continuous("dymo_30252", "Dymo 30252 Address", 'Address · 1.125" × 3.5"', 1.125, 3.5),
  continuous("dymo_30253", "Dymo 30253 Large Address", 'Large address · 1.125" × 4"', 1.125, 4.0),
  continuous("dymo_30334", "Dymo 30334 Multi-purpose", 'Multi-purpose · 1.25" × 2.25"', 2.25, 1.25),
  continuous(
    "brother_dk1201",
    "Brother DK-1201 Standard",
    'Standard address · 29mm × 90mm (1.14" × 3.54")',
    29 / 25.4,
    90 / 25.4,
  ),

  // ---- Single label per page ----
  {
    id: "single_4x6",
    name: '4" × 6" Shipping Label',
    description: 'Generic thermal · 4" × 6" · Zebra, Rollo, etc.',
    category: "single",
    pageWidth: 4 * INCH_TO_MM,
    pageHeight: 6 * INCH_TO_MM,
    labelWidth: 4 * INCH_TO_MM,
    labelHeight: 6 * INCH_TO_MM,
    columns: 1,
    rows: 1,
    topMargin: 0,
    leftMargin: 0,
    hGap: 0,
    vGap: 0,
  },
  {
    id: "single_letter",
    name: "US Letter — Full Page",
    description: 'One label per page · 8.5" × 11"',
    category: "single",
    pageWidth: 8.5 * INCH_TO_MM,
    pageHeight: 11 * INCH_TO_MM,
    labelWidth: 8 * INCH_TO_MM,
    labelHeight: 10.5 * INCH_TO_MM,
    columns: 1,
    rows: 1,
    topMargin: 0.25 * INCH_TO_MM,
    leftMargin: 0.25 * INCH_TO_MM,
    hGap: 0,
    vGap: 0,
  },
];

export const CATEGORY_META: Record<
  TemplateCategory,
  { label: string; subtitle: string }
> = {
  sheet: {
    label: "Sheet labels",
    subtitle: "Avery & compatible · printed on US Letter sheets",
  },
  continuous: {
    label: "Continuous feed",
    subtitle: "Dymo, Brother, Zebra & other thermal roll printers",
  },
  single: {
    label: "Single label per page",
    subtitle: "One label = one PDF page · for full-page or generic 4×6",
  },
};

export function getConfigsByCategory(
  category: TemplateCategory,
): LabelTemplateConfig[] {
  return LABEL_CONFIGS.filter((c) => c.category === category);
}

// Padding inside each label (mm)
const LABEL_PADDING = 2;

/**
 * Build a pdfme template for a single label cell.
 * This is used in the Designer so the user can visually arrange
 * fields within one label.
 */
export function buildDesignerTemplate(config: LabelTemplateConfig): Template {
  const w = config.labelWidth;
  const h = config.labelHeight;
  const p = LABEL_PADDING;
  const innerW = w - p * 2;
  const innerH = h - p * 2;

  // Two-field default: `name` on top, `addressBlock` as a single multi-line
  // text field filling the rest. Because `addressBlock` is one text block,
  // empty lines naturally collapse — the design doesn't break when a record
  // has no apartment, company, or country.
  const nameHeight = innerH * 0.28;

  return {
    basePdf: {
      width: w,
      height: h,
      padding: [p, p, p, p],
    },
    schemas: [
      [
        {
          name: "name",
          type: "text",
          position: { x: p, y: p },
          width: innerW,
          height: nameHeight,
          fontSize: 11,
          alignment: "center",
          fontName: "Roboto Bold",
        },
        {
          name: "addressBlock",
          type: "text",
          position: { x: p, y: p + nameHeight },
          width: innerW,
          height: innerH - nameHeight,
          fontSize: 9,
          alignment: "center",
          lineHeight: 1.2,
          fontName: "Roboto",
        },
      ],
    ],
  };
}

/**
 * Build a full-page pdfme template with all label positions for generation.
 * Takes the single-label schema from the designer and tiles it across the page.
 */
export function buildSheetTemplate(
  config: LabelTemplateConfig,
  labelSchema: Schema[],
): Template {
  const labelsPerPage = config.columns * config.rows;
  const pageSchemas: Schema[] = [];

  for (let i = 0; i < labelsPerPage; i++) {
    const col = i % config.columns;
    const row = Math.floor(i / config.columns);

    const offsetX = config.leftMargin + col * (config.labelWidth + config.hGap);
    const offsetY = config.topMargin + row * (config.labelHeight + config.vGap);

    for (const field of labelSchema) {
      pageSchemas.push({
        ...field,
        name: `label_${i}_${field.name}`,
        position: {
          x: offsetX + field.position.x,
          y: offsetY + field.position.y,
        },
      });
    }
  }

  return {
    basePdf: {
      width: config.pageWidth,
      height: config.pageHeight,
      padding: [0, 0, 0, 0],
    },
    schemas: [pageSchemas],
  };
}

/**
 * Convert address data into pdfme inputs for a full sheet.
 * Returns one input object per page. Emits every known composition field so
 * custom designer templates can reference whichever fields they chose.
 */
export function buildInputs(
  addresses: Array<Record<string, string>>,
  config: LabelTemplateConfig,
): Record<string, string>[] {
  const labelsPerPage = config.columns * config.rows;
  const inputs: Record<string, string>[] = [];

  for (let pageStart = 0; pageStart < addresses.length; pageStart += labelsPerPage) {
    const pageAddresses = addresses.slice(pageStart, pageStart + labelsPerPage);
    const pageInput: Record<string, string> = {};

    for (let i = 0; i < labelsPerPage; i++) {
      const addr = pageAddresses[i] || {};
      const prefix = `label_${i}`;
      for (const [key, value] of Object.entries(addr)) {
        pageInput[`${prefix}_${key}`] = value ?? "";
      }
    }

    inputs.push(pageInput);
  }

  return inputs;
}

export function getConfigById(id: string): LabelTemplateConfig {
  return LABEL_CONFIGS.find((c) => c.id === id) || LABEL_CONFIGS[0];
}

// ---------------------------------------------------------------------------
// Custom dimensions — user-defined template handed in alongside id === "custom"
// ---------------------------------------------------------------------------

export const CUSTOM_TEMPLATE_ID = "custom";

/** Sensible starting point for the Custom form (US Letter, 2×5 layout). */
export const DEFAULT_CUSTOM_CONFIG: LabelTemplateConfig = {
  id: CUSTOM_TEMPLATE_ID,
  name: "Custom",
  description: "Custom dimensions",
  category: "sheet",
  pageWidth: 8.5 * INCH_TO_MM,
  pageHeight: 11 * INCH_TO_MM,
  labelWidth: 4 * INCH_TO_MM,
  labelHeight: 2 * INCH_TO_MM,
  columns: 2,
  rows: 5,
  topMargin: 0.5 * INCH_TO_MM,
  leftMargin: 0.15625 * INCH_TO_MM,
  hGap: 0.1875 * INCH_TO_MM,
  vGap: 0,
};

/** Convert a local config (mm) to the inches-based payload the backend expects. */
export function customConfigToSpec(
  config: LabelTemplateConfig,
): import("@/types").CustomTemplateSpec {
  const mmToIn = (v: number) => v / INCH_TO_MM;
  return {
    name: config.name || "Custom",
    description: config.description || "Custom dimensions",
    category: config.category,
    page_width: mmToIn(config.pageWidth),
    page_height: mmToIn(config.pageHeight),
    label_width: mmToIn(config.labelWidth),
    label_height: mmToIn(config.labelHeight),
    columns: config.columns,
    rows: config.rows,
    top_margin: mmToIn(config.topMargin),
    left_margin: mmToIn(config.leftMargin),
    h_gap: mmToIn(config.hGap),
    v_gap: mmToIn(config.vGap),
  };
}

/** Lightweight client-side sanity check. Returns a list of human messages. */
export function validateCustomConfig(config: LabelTemplateConfig): string[] {
  const issues: string[] = [];
  const usableW =
    config.pageWidth -
    2 * config.leftMargin -
    (config.columns - 1) * config.hGap;
  const usableH =
    config.pageHeight -
    2 * config.topMargin -
    (config.rows - 1) * config.vGap;
  const totalLabelW = config.columns * config.labelWidth;
  const totalLabelH = config.rows * config.labelHeight;
  if (totalLabelW > usableW + 0.5) {
    issues.push("Labels overflow the page horizontally — reduce columns, label width, or margins.");
  }
  if (totalLabelH > usableH + 0.5) {
    issues.push("Labels overflow the page vertically — reduce rows, label height, or margins.");
  }
  if (config.labelWidth < 5 || config.labelHeight < 5) {
    issues.push("Label is smaller than 5mm — text won't fit.");
  }
  return issues;
}
