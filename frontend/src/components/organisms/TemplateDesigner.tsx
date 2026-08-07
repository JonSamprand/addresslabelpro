"use client";

import { useEffect, useRef, useState } from "react";
import type { Template, Schema, Font } from "@pdfme/common";
import type { AddressData } from "@/types";
import type { LabelTemplateConfig, FieldLayout } from "@/lib/templates";
import { buildDesignerTemplate } from "@/lib/templates";
import { addressToFieldValues, ADDRESSABLE_FIELDS } from "@/lib/addressFields";

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
  /** Which field breakdown to seed the canvas with. Changing it rebuilds. */
  layout?: FieldLayout;
  /**
   * Fires on every edit (debounced) and once more on unmount. The parent
   * persists this so leaving the step — or switching layout presets — can
   * never lose work.
   */
  onTemplateChange?: (template: Template) => void;
  onSave: (template: Template) => void;
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

export function TemplateDesigner({
  config,
  addresses,
  initialTemplate,
  layout = "combined",
  onTemplateChange,
  onSave,
}: TemplateDesignerProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const designerRef = useRef<DesignerInstance | null>(null);
  // Latest user-edited template (positions, sizes, added shapes) — content stripped.
  const latestTemplateRef = useRef<Template | null>(null);
  // When we programmatically updateTemplate, ignore the resulting onChange.
  const suppressChangeRef = useRef(false);
  // Stable refs so the (config, layout)-scoped init effect never re-runs just
  // because a parent callback identity changed.
  const onTemplateChangeRef = useRef(onTemplateChange);
  onTemplateChangeRef.current = onTemplateChange;
  const initialTemplateRef = useRef(initialTemplate);
  initialTemplateRef.current = initialTemplate;
  const flushTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
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

      // Restore this layout's saved work if the user has any; otherwise seed
      // from the preset. This is what makes navigating away / switching
      // presets non-destructive.
      const baseTemplate =
        initialTemplateRef.current || buildDesignerTemplate(config, layout);
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
        // Autosave upward, debounced so dragging doesn't thrash the parent.
        if (flushTimerRef.current) clearTimeout(flushTimerRef.current);
        flushTimerRef.current = setTimeout(() => {
          if (latestTemplateRef.current) {
            onTemplateChangeRef.current?.(latestTemplateRef.current);
          }
        }, 250);
      });

      designerRef.current = designer;
      setReady(true);
    }

    init();

    return () => {
      cancelled = true;
      // Flush any pending debounced edit before tearing down — otherwise an
      // edit made in the last 250ms before switching layout would be lost.
      if (flushTimerRef.current) {
        clearTimeout(flushTimerRef.current);
        flushTimerRef.current = null;
      }
      if (latestTemplateRef.current) {
        onTemplateChangeRef.current?.(latestTemplateRef.current);
      }
      designer?.destroy();
      designerRef.current = null;
      latestTemplateRef.current = null;
      setReady(false);
    };
    // Rebuild the canvas only when the label size or the field breakdown
    // changes — not when `addresses` updates, which would blow away the
    // user's in-progress edits on every preview navigation.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [config, layout]);

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

  /**
   * Append a data field to the canvas without disturbing anything already
   * there. This is how users "combine" or "separate" parts: add
   * `cityStateZip` for one line, or `city` + `state` + `zip` for three.
   */
  const handleAddField = (fieldName: string) => {
    const designer = designerRef.current;
    if (!designer) return;
    const current = latestTemplateRef.current ?? designer.getTemplate();
    const page = (current.schemas[0] ?? []) as Schema[];
    if (page.some((f) => f.name === fieldName)) return; // already on the label

    // Drop the new field just below the lowest existing one, clamped inside
    // the label so it can never land off-canvas.
    const lowest = page.reduce(
      (m, f) => Math.max(m, (f.position?.y ?? 0) + (f.height ?? 0)),
      0,
    );
    const h = 5;
    const y = Math.min(lowest + 1, Math.max(config.labelHeight - h - 1, 1));

    const added = {
      name: fieldName,
      type: "text",
      position: { x: 2, y },
      width: Math.max(config.labelWidth - 4, 5),
      height: h,
      fontSize: 9,
      alignment: "center",
      lineHeight: 1.2,
      fontName: "Roboto",
      content: currentAddr ? addressToFieldValues(currentAddr)[fieldName] ?? "" : "",
    } as unknown as Schema;

    const next = { ...current, schemas: [[...page, added]] } as Template;
    latestTemplateRef.current = next;
    suppressChangeRef.current = true;
    designer.updateTemplate(next);
    setTimeout(() => {
      suppressChangeRef.current = false;
      onTemplateChangeRef.current?.(next);
    }, 0);
  };

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

        <div className="flex items-center gap-3">
          <label className="flex items-center gap-2 text-xs text-gray-600">
            <span className="whitespace-nowrap">Add field</span>
            <select
              value=""
              onChange={(e) => {
                if (e.target.value) handleAddField(e.target.value);
                e.target.value = "";
              }}
              className="px-2 py-1.5 text-sm text-gray-900 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            >
              <option value="">Choose…</option>
              <optgroup label="Individual">
                {ADDRESSABLE_FIELDS.filter((f) => f.group === "Individual").map((f) => (
                  <option key={f.name} value={f.name}>{f.label}</option>
                ))}
              </optgroup>
              <optgroup label="Combined">
                {ADDRESSABLE_FIELDS.filter((f) => f.group === "Combined").map((f) => (
                  <option key={f.name} value={f.name}>{f.label}</option>
                ))}
              </optgroup>
            </select>
          </label>
          <button
            onClick={handleSave}
            className="px-5 py-2 bg-blue-600 text-white text-sm font-medium rounded-lg hover:bg-blue-700 transition-colors"
          >
            Save & Continue
          </button>
        </div>
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
