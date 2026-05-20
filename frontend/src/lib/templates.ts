import type { Template, Schema } from "@pdfme/common";

// All measurements in mm
const INCH_TO_MM = 25.4;

export interface LabelTemplateConfig {
  id: string;
  name: string;
  description: string;
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

export const LABEL_CONFIGS: LabelTemplateConfig[] = [
  {
    id: "avery_5160",
    name: "Avery 5160 / 8160",
    description: '1" x 2.625" — 30 per sheet',
    pageWidth: 8.5 * INCH_TO_MM,
    pageHeight: 11 * INCH_TO_MM,
    labelWidth: 2.625 * INCH_TO_MM,
    labelHeight: 1.0 * INCH_TO_MM,
    columns: 3,
    rows: 10,
    topMargin: 0.5 * INCH_TO_MM,
    leftMargin: 0.1875 * INCH_TO_MM,
    hGap: 0.125 * INCH_TO_MM,
    vGap: 0,
  },
  {
    id: "avery_5163",
    name: "Avery 5163 / 8163",
    description: '2" x 4" — 10 per sheet',
    pageWidth: 8.5 * INCH_TO_MM,
    pageHeight: 11 * INCH_TO_MM,
    labelWidth: 4.0 * INCH_TO_MM,
    labelHeight: 2.0 * INCH_TO_MM,
    columns: 2,
    rows: 5,
    topMargin: 0.5 * INCH_TO_MM,
    leftMargin: 0.15625 * INCH_TO_MM,
    hGap: 0.1875 * INCH_TO_MM,
    vGap: 0,
  },
  {
    id: "avery_5164",
    name: "Avery 5164 / 8164",
    description: '3.33" x 4" — 6 per sheet',
    pageWidth: 8.5 * INCH_TO_MM,
    pageHeight: 11 * INCH_TO_MM,
    labelWidth: 4.0 * INCH_TO_MM,
    labelHeight: 3.333 * INCH_TO_MM,
    columns: 2,
    rows: 3,
    topMargin: 0.5 * INCH_TO_MM,
    leftMargin: 0.15625 * INCH_TO_MM,
    hGap: 0.1875 * INCH_TO_MM,
    vGap: 0,
  },
];

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
