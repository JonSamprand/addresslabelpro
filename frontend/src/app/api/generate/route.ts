import { NextRequest, NextResponse } from "next/server";
import { readFile } from "node:fs/promises";
import path from "node:path";
import { generate } from "@pdfme/generator";
import { text, image } from "@pdfme/schemas";
import type { Template, Schema, Font } from "@pdfme/common";
import {
  CUSTOM_TEMPLATE_ID,
  getConfigById,
  buildSheetTemplate,
  buildInputs,
  type LabelTemplateConfig,
  type FieldLayout,
} from "@/lib/templates";
// Shared with the Designer so the fields the user arranges are exactly the
// fields we can fill. See lib/addressFields.ts.
import { addressToFieldValues } from "@/lib/addressFields";
import type { AddressData } from "@/types";

let _fontCache: Font | null = null;
async function loadFonts(): Promise<Font> {
  if (_fontCache) return _fontCache;
  const base = path.join(process.cwd(), "public", "fonts");
  const variants: Array<[string, string]> = [
    ["Roboto", "Roboto-Regular.ttf"],
    ["Roboto Bold", "Roboto-Bold.ttf"],
    ["Roboto Italic", "Roboto-Italic.ttf"],
    ["Roboto Bold Italic", "Roboto-BoldItalic.ttf"],
  ];
  const entries = await Promise.all(
    variants.map(async ([name, file], idx) => {
      const data = await readFile(path.join(base, file));
      return [name, { data, fallback: idx === 0 }] as const;
    }),
  );
  _fontCache = Object.fromEntries(entries) as Font;
  return _fontCache;
}

interface GenerateRequest {
  addresses: AddressData[];
  templateId: string;
  labelTemplate?: Template; // Custom template from the designer
  // When templateId === "custom", caller passes the dimensions inline rather
  // than relying on LABEL_CONFIGS lookup.
  customConfig?: LabelTemplateConfig;
  // Which field breakdown to fall back to when the user skipped the Designer.
  fieldLayout?: FieldLayout;
}

export async function POST(request: NextRequest) {
  try {
    const body: GenerateRequest = await request.json();
    const config: LabelTemplateConfig =
      body.templateId === CUSTOM_TEMPLATE_ID && body.customConfig
        ? body.customConfig
        : getConfigById(body.templateId);

    // Get the label schema — either from designer or default
    let labelSchema: Schema[];
    if (body.labelTemplate?.schemas?.[0]) {
      labelSchema = body.labelTemplate.schemas[0] as Schema[];
    } else {
      const { buildDesignerTemplate } = await import("@/lib/templates");
      const defaultTemplate = buildDesignerTemplate(config, body.fieldLayout ?? "combined");
      labelSchema = defaultTemplate.schemas[0] as Schema[];
    }

    // Build the full-page sheet template
    const sheetTemplate = buildSheetTemplate(config, labelSchema);

    // Format addresses using the SAME composition the Designer previewed with.
    const formatted = body.addresses.map(addressToFieldValues);

    // Build inputs (one per page)
    const inputs = buildInputs(formatted, config);

    if (inputs.length === 0) {
      return NextResponse.json({ error: "No addresses to generate" }, { status: 400 });
    }

    // Generate PDF with Roboto font variants loaded for bold/italic support
    const font = await loadFonts();
    const pdf = await generate({
      template: sheetTemplate,
      inputs,
      plugins: { Text: text, Image: image },
      options: { font },
    });

    return new NextResponse(pdf.buffer, {
      headers: {
        "Content-Type": "application/pdf",
        "Content-Disposition": `attachment; filename="labels.pdf"`,
      },
    });
  } catch (e) {
    const message = e instanceof Error ? e.message : "PDF generation failed";
    console.error("PDF generation error:", e);
    return NextResponse.json({ error: message }, { status: 500 });
  }
}
