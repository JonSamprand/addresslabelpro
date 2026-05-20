"use client";

import { useEffect, useRef, useState, useCallback } from "react";
import type { Template, Schema, Font } from "@pdfme/common";
import type { AddressData } from "@/types";
import type { LabelTemplateConfig } from "@/lib/templates";
import { buildDesignerTemplate } from "@/lib/templates";

/**
 * Load Roboto font variants so the user has real bold/italic options in
 * the pdfme Designer font dropdown. Cached across mounts.
 */
let _fontCache: Font | null = null;
async function loadFonts(): Promise<Font> {
  if (_fontCache) return _fontCache;
  const variants: Array<[string, string]> = [
    ["Roboto", "/fonts/Roboto-Regular.ttf"],
    ["Roboto Bold", "/fonts/Roboto-Bold.ttf"],
    ["Roboto Italic", "/fonts/Roboto-Italic.ttf"],
    ["Roboto Bold Italic", "/fonts/Roboto-BoldItalic.ttf"],
  ];
  const entries = await Promise.all(
    variants.map(async ([name, url], idx) => {
      const res = await fetch(url);
      const data = await res.arrayBuffer();
      return [name, { data, fallback: idx === 0 }] as const;
    }),
  );
  _fontCache = Object.fromEntries(entries) as Font;
  return _fontCache;
}

interface TemplateDesignerProps {
  config: LabelTemplateConfig;
  addresses: AddressData[];
  initialTemplate?: Template;
  onSave: (template: Template) => void;
}

/**
 * Format an AddressData into the values keyed by schema field name.
 * Produces every field the designer templates may reference:
 *   - composed: addressBlock (multi-line), cityStateZip, combinedStreet
 *   - individual: street, street2, company, country (for split-field layouts)
 *   - also a `full` alias for users who want one block incl. name.
 */
function addressToFieldValues(addr: AddressData): Record<string, string> {
  // Prefer server-composed values, fall back to local composition.
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

  // addressBlock = everything except the name, with empty lines collapsed.
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
    // Full block including name — useful if the user deletes `name` field.
    fullAddress: [addr.name, addressBlock].filter(Boolean).join("\n"),
  };
}

/**
 * Inject address data into a template's schema content fields.
 */
function templateWithData(template: Template, addr: AddressData): Template {
  const values = addressToFieldValues(addr);
  return {
    ...template,
    schemas: template.schemas.map((page) =>
      page.map((field: Schema) => ({
        ...field,
        content: values[field.name] ?? field.content ?? "",
      })),
    ),
  };
}

type DesignerInstance = {
  getTemplate: () => Template;
  updateTemplate: (t: Template) => void;
  onChangeTemplate: (cb: (t: Template) => void) => void;
  destroy: () => void;
};

export function TemplateDesigner({ config, addresses, initialTemplate, onSave }: TemplateDesignerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const designerRef = useRef<DesignerInstance | null>(null);
  // Latest user-edited template (positions, sizes, added shapes) — content stripped.
  const latestTemplateRef = useRef<Template | null>(null);
  // When we programmatically updateTemplate, ignore the resulting onChange.
  const suppressChangeRef = useRef(false);
  const [previewIndex, setPreviewIndex] = useState(0);
  const [ready, setReady] = useState(false);

  const total = addresses.length;
  const currentAddr = addresses[previewIndex] || addresses[0];

  // Initialize the pdfme Designer (only when config changes)
  useEffect(() => {
    if (!containerRef.current) return;

    let designer: DesignerInstance | null = null;
    let cancelled = false;

    async function init() {
      const { Designer } = await import("@pdfme/ui");
      const pdfmeSchemas = await import("@pdfme/schemas");
      const font = await loadFonts();

      if (cancelled || !containerRef.current) return;

      const baseTemplate = initialTemplate || buildDesignerTemplate(config);
      const firstAddr = addresses[0];
      const template = firstAddr ? templateWithData(baseTemplate, firstAddr) : baseTemplate;
      latestTemplateRef.current = template;

      designer = new Designer({
        domContainer: containerRef.current,
        template,
        options: { font },
        plugins: {
          Text: pdfmeSchemas.text,
          Image: pdfmeSchemas.image,
          Line: pdfmeSchemas.line,
          Rectangle: pdfmeSchemas.rectangle,
          Ellipse: pdfmeSchemas.ellipse,
        },
      }) as unknown as DesignerInstance;

      designer.onChangeTemplate((t) => {
        if (suppressChangeRef.current) return;
        // Cache user edits so we can re-apply them when navigating preview.
        latestTemplateRef.current = t;
      });

      designerRef.current = designer;
      setReady(true);
    }

    init();

    return () => {
      cancelled = true;
      designer?.destroy();
      designerRef.current = null;
      latestTemplateRef.current = null;
      setReady(false);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config]);

  // Inject the current address's data whenever the preview index changes
  useEffect(() => {
    if (!ready || !designerRef.current || !currentAddr) return;
    const designer = designerRef.current;
    const base = latestTemplateRef.current ?? designer.getTemplate();
    const updated = templateWithData(base, currentAddr);
    latestTemplateRef.current = updated;
    suppressChangeRef.current = true;
    designer.updateTemplate(updated);
    // Release suppression on next tick (after pdfme's async render settles)
    setTimeout(() => {
      suppressChangeRef.current = false;
    }, 0);
  }, [previewIndex, ready, currentAddr]);

  const handleSave = () => {
    const template = designerRef.current?.getTemplate();
    if (template) onSave(template);
  };

  const prevPreview = () => setPreviewIndex((i) => Math.max(0, i - 1));
  const nextPreview = () => setPreviewIndex((i) => Math.min(total - 1, i + 1));

  return (
    <div className="space-y-4">
      {/* Preview navigation */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-4">
          <button
            onClick={prevPreview}
            disabled={previewIndex === 0}
            className="p-2 rounded-lg border hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="Previous address"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </button>
          <span className="text-sm text-gray-600 min-w-[140px] text-center">
            Previewing label <strong>{previewIndex + 1}</strong> of {total}
          </span>
          <button
            onClick={nextPreview}
            disabled={previewIndex >= total - 1}
            className="p-2 rounded-lg border hover:bg-gray-50 disabled:opacity-30 disabled:cursor-not-allowed"
            aria-label="Next address"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5l7 7-7 7" />
            </svg>
          </button>
        </div>

        <button
          onClick={handleSave}
          className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
        >
          Save & Continue
        </button>
      </div>

      {/* pdfme Designer */}
      <div
        ref={containerRef}
        style={{ width: "100%", height: "550px" }}
        className="border rounded-lg overflow-hidden"
      />
    </div>
  );
}
