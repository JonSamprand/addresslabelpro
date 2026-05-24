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
} from "@/lib/templates";

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

interface AddressData {
  name: string;
  company: string;
  street1: string;
  street2: string;
  city: string;
  state: string;
  zip_code: string;
  country: string;
  is_international: boolean;
  combined_street?: string;
  city_state_zip?: string;
  address_block?: string;
}

interface GenerateRequest {
  addresses: AddressData[];
  templateId: string;
  labelTemplate?: Template; // Custom template from the designer
  // When templateId === "custom", caller passes the dimensions inline rather
  // than relying on LABEL_CONFIGS lookup.
  customConfig?: LabelTemplateConfig;
}

function formatAddress(addr: AddressData) {
  const cityStateZip =
    addr.city_state_zip ||
    (() => {
      const parts: string[] = [];
      if (addr.city) parts.push(addr.city);
      if (addr.state) {
        if (parts.length) parts[parts.length - 1] += ",";
        parts.push(addr.state);
      }
      if (addr.zip_code) parts.push(addr.zip_code);
      return parts.join(" ");
    })();

  const combinedStreet =
    addr.combined_street ||
    [addr.street1, addr.street2].filter(Boolean).join(", ");

  const country = addr.is_international && addr.country ? addr.country.toUpperCase() : "";

  const addressBlock =
    addr.address_block?.split("\n").filter((l) => l.trim() && l.trim() !== addr.name).join("\n") ||
    [addr.company, combinedStreet, cityStateZip, country].filter(Boolean).join("\n");

  return {
    name: addr.name || "",
    company: addr.company || "",
    street: combinedStreet,
    street2: addr.street2 || "",
    combinedStreet,
    cityStateZip,
    country,
    addressBlock,
    fullAddress: [addr.name, addressBlock].filter(Boolean).join("\n"),
  };
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
      const defaultTemplate = buildDesignerTemplate(config);
      labelSchema = defaultTemplate.schemas[0] as Schema[];
    }

    // Build the full-page sheet template
    const sheetTemplate = buildSheetTemplate(config, labelSchema);

    // Format addresses
    const formatted = body.addresses.map(formatAddress);

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
