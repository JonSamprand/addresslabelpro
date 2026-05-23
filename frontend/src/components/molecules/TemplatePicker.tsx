"use client";

import { useMemo, useState } from "react";
import {
  CATEGORY_META,
  LABEL_CONFIGS,
  type LabelTemplateConfig,
  type TemplateCategory,
} from "@/lib/templates";

interface TemplatePickerProps {
  value: string;
  onChange: (id: string) => void;
}

const CATEGORY_ORDER: TemplateCategory[] = ["sheet", "continuous", "single"];

export function TemplatePicker({ value, onChange }: TemplatePickerProps) {
  const initialCategory =
    LABEL_CONFIGS.find((c) => c.id === value)?.category ?? "sheet";
  const [activeCategory, setActiveCategory] =
    useState<TemplateCategory>(initialCategory);

  const configs = useMemo(
    () => LABEL_CONFIGS.filter((c) => c.category === activeCategory),
    [activeCategory],
  );

  return (
    <div className="bg-white rounded-xl border p-5">
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900">Label format</h3>
        <span className="text-xs text-gray-500">
          {LABEL_CONFIGS.length} templates · custom dimensions coming soon
        </span>
      </div>

      {/* Category tabs */}
      <div
        role="tablist"
        aria-label="Label format category"
        className="flex gap-1 p-1 bg-gray-100 rounded-lg mb-4"
      >
        {CATEGORY_ORDER.map((cat) => {
          const meta = CATEGORY_META[cat];
          const isActive = cat === activeCategory;
          return (
            <button
              key={cat}
              role="tab"
              aria-selected={isActive}
              onClick={() => setActiveCategory(cat)}
              className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                isActive
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              {meta.label}
            </button>
          );
        })}
      </div>

      <p className="text-xs text-gray-500 mb-4">
        {CATEGORY_META[activeCategory].subtitle}
      </p>

      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
        {configs.map((config) => {
          const isSelected = config.id === value;
          return (
            <button
              key={config.id}
              type="button"
              onClick={() => onChange(config.id)}
              aria-pressed={isSelected}
              className={`text-left border rounded-lg p-3 transition-all ${
                isSelected
                  ? "border-blue-500 ring-2 ring-blue-500/20 bg-blue-50/40"
                  : "border-gray-200 hover:border-gray-400 bg-white"
              }`}
            >
              <div className="flex items-center justify-center h-20 mb-2 bg-gray-50 rounded">
                <TemplatePreview config={config} />
              </div>
              <div className="text-sm font-medium text-gray-900 leading-tight">
                {config.name}
              </div>
              <div className="mt-1 text-xs text-gray-500 leading-snug">
                {config.description}
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}

/**
 * Tiny scaled diagram of the layout. Renders into ~96×72 logical units;
 * the surrounding container caps the visual size.
 *
 *   sheet      → page outline with the label grid drawn inside
 *   continuous → one label with dashed roll extensions above & below
 *   single     → page outline with the (large) label rectangle inside
 */
function TemplatePreview({ config }: { config: LabelTemplateConfig }) {
  // Fit the page within a 96 × 72 SVG canvas, preserving aspect ratio.
  const CANVAS_W = 96;
  const CANVAS_H = 72;
  const aspect = config.pageWidth / config.pageHeight;
  let pageW = CANVAS_W;
  let pageH = CANVAS_W / aspect;
  if (pageH > CANVAS_H) {
    pageH = CANVAS_H;
    pageW = CANVAS_H * aspect;
  }
  const offsetX = (CANVAS_W - pageW) / 2;
  const offsetY = (CANVAS_H - pageH) / 2;

  // Convert label-space mm → svg units relative to page.
  const sx = pageW / config.pageWidth;
  const sy = pageH / config.pageHeight;
  const lw = config.labelWidth * sx;
  const lh = config.labelHeight * sy;
  const ml = config.leftMargin * sx;
  const mt = config.topMargin * sy;
  const gx = config.hGap * sx;
  const gy = config.vGap * sy;

  return (
    <svg
      viewBox={`0 0 ${CANVAS_W} ${CANVAS_H}`}
      width="80"
      height="60"
      aria-hidden="true"
    >
      {config.category === "continuous" && (
        <>
          {/* Roll feed lines above and below the single label */}
          <line
            x1={offsetX + pageW / 2}
            y1={1}
            x2={offsetX + pageW / 2}
            y2={offsetY - 1}
            stroke="#9CA3AF"
            strokeDasharray="2 2"
          />
          <line
            x1={offsetX + pageW / 2}
            y1={offsetY + pageH + 1}
            x2={offsetX + pageW / 2}
            y2={CANVAS_H - 1}
            stroke="#9CA3AF"
            strokeDasharray="2 2"
          />
        </>
      )}

      {/* Page outline */}
      <rect
        x={offsetX}
        y={offsetY}
        width={pageW}
        height={pageH}
        rx={1.5}
        fill="#ffffff"
        stroke="#D1D5DB"
        strokeWidth={1}
      />

      {/* Labels — tile the grid */}
      {Array.from({ length: config.rows }).map((_, r) =>
        Array.from({ length: config.columns }).map((__, c) => {
          const x = offsetX + ml + c * (lw + gx);
          const y = offsetY + mt + r * (lh + gy);
          return (
            <rect
              key={`${r}-${c}`}
              x={x}
              y={y}
              width={Math.max(lw, 0.5)}
              height={Math.max(lh, 0.5)}
              rx={0.5}
              fill="#3B82F6"
              fillOpacity={0.85}
            />
          );
        }),
      )}
    </svg>
  );
}
