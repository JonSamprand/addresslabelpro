"use client";

import { useMemo, useState } from "react";
import {
  CATEGORY_META,
  CUSTOM_TEMPLATE_ID,
  DEFAULT_CUSTOM_CONFIG,
  LABEL_CONFIGS,
  validateCustomConfig,
  type LabelTemplateConfig,
  type TemplateCategory,
} from "@/lib/templates";

interface TemplatePickerProps {
  value: string;
  customConfig: LabelTemplateConfig | null;
  onChange: (id: string, customConfig?: LabelTemplateConfig) => void;
}

// Four tabs: three preset categories + a Custom mode that opens a form.
type TabKey = TemplateCategory | "custom";

const TAB_ORDER: TabKey[] = ["sheet", "continuous", "single", "custom"];

const TAB_LABELS: Record<TabKey, string> = {
  sheet: "Sheet labels",
  continuous: "Continuous feed",
  single: "Single label",
  custom: "Custom size",
};

const INCH_TO_MM = 25.4;
const inToMm = (v: number) => v * INCH_TO_MM;
const mmToIn = (v: number) => v / INCH_TO_MM;

export function TemplatePicker({
  value,
  customConfig,
  onChange,
}: TemplatePickerProps) {
  const initialTab: TabKey =
    value === CUSTOM_TEMPLATE_ID
      ? "custom"
      : (LABEL_CONFIGS.find((c) => c.id === value)?.category ?? "sheet");
  const [activeTab, setActiveTab] = useState<TabKey>(initialTab);

  const presetConfigs = useMemo(
    () =>
      activeTab === "custom"
        ? []
        : LABEL_CONFIGS.filter((c) => c.category === activeTab),
    [activeTab],
  );

  // Working copy of the custom config — falls back to a sensible default if
  // the parent hasn't given us one yet.
  const activeCustom: LabelTemplateConfig = customConfig ?? DEFAULT_CUSTOM_CONFIG;

  const updateCustom = (patch: Partial<LabelTemplateConfig>) => {
    const next = { ...activeCustom, ...patch };
    onChange(CUSTOM_TEMPLATE_ID, next);
  };

  return (
    <div className="bg-white rounded-xl border p-5">
      <div className="flex items-baseline justify-between mb-3">
        <h3 className="text-sm font-semibold text-gray-900">Label format</h3>
        <span className="text-xs text-gray-500">
          {LABEL_CONFIGS.length} presets + custom dimensions
        </span>
      </div>

      <div
        role="tablist"
        aria-label="Label format category"
        className="flex gap-1 p-1 bg-gray-100 rounded-lg mb-4"
      >
        {TAB_ORDER.map((tab) => {
          const isActive = tab === activeTab;
          return (
            <button
              key={tab}
              role="tab"
              aria-selected={isActive}
              onClick={() => {
                setActiveTab(tab);
                // If user opens the Custom tab, seed the selection with the
                // current custom config so downstream code has something to use.
                if (tab === "custom" && value !== CUSTOM_TEMPLATE_ID) {
                  onChange(CUSTOM_TEMPLATE_ID, activeCustom);
                }
              }}
              className={`flex-1 px-3 py-2 text-sm font-medium rounded-md transition-colors ${
                isActive
                  ? "bg-white text-gray-900 shadow-sm"
                  : "text-gray-600 hover:text-gray-900"
              }`}
            >
              {TAB_LABELS[tab]}
            </button>
          );
        })}
      </div>

      {activeTab !== "custom" ? (
        <>
          <p className="text-xs text-gray-500 mb-4">
            {CATEGORY_META[activeTab].subtitle}
          </p>
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {presetConfigs.map((config) => {
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
        </>
      ) : (
        <CustomDimensionsForm config={activeCustom} onUpdate={updateCustom} />
      )}
    </div>
  );
}

// ---------------------------------------------------------------------------
// Custom-dimensions form
// ---------------------------------------------------------------------------

function CustomDimensionsForm({
  config,
  onUpdate,
}: {
  config: LabelTemplateConfig;
  onUpdate: (patch: Partial<LabelTemplateConfig>) => void;
}) {
  // All inputs render in inches; we round-trip through mm for storage so the
  // pdfme renderer (which is mm-native) keeps using the same internal units.
  const inField = (key: keyof LabelTemplateConfig) =>
    Number((mmToIn(config[key] as number)).toFixed(3));

  const setIn = (key: keyof LabelTemplateConfig, valueIn: number) => {
    onUpdate({ [key]: inToMm(Math.max(0, valueIn)) } as Partial<LabelTemplateConfig>);
  };

  const issues = validateCustomConfig(config);
  const isContinuous = config.category === "continuous";

  const handleCategoryChange = (newCat: TemplateCategory) => {
    if (newCat === "continuous") {
      // Continuous = page IS the label, no margins/gaps, 1×1.
      onUpdate({
        category: "continuous",
        pageWidth: config.labelWidth,
        pageHeight: config.labelHeight,
        columns: 1,
        rows: 1,
        topMargin: 0,
        leftMargin: 0,
        hGap: 0,
        vGap: 0,
      });
    } else if (newCat === "single") {
      onUpdate({
        category: "single",
        columns: 1,
        rows: 1,
        hGap: 0,
        vGap: 0,
      });
    } else {
      onUpdate({ category: "sheet" });
    }
  };

  return (
    <div className="grid grid-cols-1 lg:grid-cols-[1fr_180px] gap-5">
      <div className="space-y-4">
        <Section title="Format type">
          <div className="flex gap-4 text-sm">
            {(["sheet", "continuous", "single"] as TemplateCategory[]).map((c) => (
              <label
                key={c}
                className="flex items-center gap-2 cursor-pointer"
              >
                <input
                  type="radio"
                  name="category"
                  checked={config.category === c}
                  onChange={() => handleCategoryChange(c)}
                  className="text-blue-600"
                />
                <span className="text-gray-700 capitalize">
                  {c === "sheet" ? "Multi-up sheet" : c === "continuous" ? "Continuous / single label" : "Single on full page"}
                </span>
              </label>
            ))}
          </div>
        </Section>

        {!isContinuous && (
          <Section title='Page size (inches)'>
            <div className="flex gap-2 items-center text-sm">
              <PresetButton
                label='US Letter'
                isActive={
                  Math.abs(inField("pageWidth") - 8.5) < 0.01 &&
                  Math.abs(inField("pageHeight") - 11) < 0.01
                }
                onClick={() => {
                  setIn("pageWidth", 8.5);
                  setIn("pageHeight", 11);
                }}
              />
              <PresetButton
                label='A4'
                isActive={
                  Math.abs(inField("pageWidth") - 8.27) < 0.05 &&
                  Math.abs(inField("pageHeight") - 11.69) < 0.05
                }
                onClick={() => {
                  setIn("pageWidth", 8.27);
                  setIn("pageHeight", 11.69);
                }}
              />
              <NumField label='Width' value={inField("pageWidth")} onChange={(v) => setIn("pageWidth", v)} />
              <NumField label='Height' value={inField("pageHeight")} onChange={(v) => setIn("pageHeight", v)} />
            </div>
          </Section>
        )}

        <Section title='Label size (inches)'>
          <div className="flex gap-2 items-center text-sm">
            <NumField
              label="Width"
              value={inField("labelWidth")}
              onChange={(v) => {
                setIn("labelWidth", v);
                if (isContinuous) setIn("pageWidth", v);
              }}
            />
            <NumField
              label="Height"
              value={inField("labelHeight")}
              onChange={(v) => {
                setIn("labelHeight", v);
                if (isContinuous) setIn("pageHeight", v);
              }}
            />
          </div>
        </Section>

        {!isContinuous && (
          <>
            <Section title="Grid">
              <div className="flex gap-2 items-center text-sm">
                <NumField
                  label="Columns"
                  value={config.columns}
                  step={1}
                  min={1}
                  onChange={(v) => onUpdate({ columns: Math.max(1, Math.round(v)) })}
                />
                <NumField
                  label="Rows"
                  value={config.rows}
                  step={1}
                  min={1}
                  onChange={(v) => onUpdate({ rows: Math.max(1, Math.round(v)) })}
                />
                <span className="text-xs text-gray-500 ml-1">
                  = {config.columns * config.rows} labels per page
                </span>
              </div>
            </Section>

            <Section title='Margins & gaps (inches)'>
              <div className="grid grid-cols-2 gap-2 text-sm">
                <NumField label="Top margin" value={inField("topMargin")} onChange={(v) => setIn("topMargin", v)} />
                <NumField label="Left margin" value={inField("leftMargin")} onChange={(v) => setIn("leftMargin", v)} />
                <NumField label="H gap" value={inField("hGap")} onChange={(v) => setIn("hGap", v)} />
                <NumField label="V gap" value={inField("vGap")} onChange={(v) => setIn("vGap", v)} />
              </div>
            </Section>
          </>
        )}

        {issues.length > 0 && (
          <div className="rounded-lg bg-amber-50 border border-amber-200 p-3 text-xs text-amber-900 space-y-1">
            {issues.map((msg, i) => (
              <p key={i}>⚠ {msg}</p>
            ))}
          </div>
        )}
      </div>

      <div className="flex flex-col items-center gap-2">
        <div className="text-xs uppercase tracking-wide text-gray-500">
          Preview
        </div>
        <div className="border rounded-lg bg-gray-50 p-3">
          <TemplatePreview config={config} size={140} />
        </div>
        <div className="text-xs text-gray-500 text-center leading-snug">
          {config.columns * config.rows} label{config.columns * config.rows === 1 ? "" : "s"} per page
          <br />
          {inField("labelWidth")}" × {inField("labelHeight")}" each
        </div>
      </div>
    </div>
  );
}

function Section({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wide text-gray-500 mb-1.5">
        {title}
      </div>
      {children}
    </div>
  );
}

function NumField({
  label,
  value,
  onChange,
  step = 0.125,
  min = 0,
}: {
  label: string;
  value: number;
  onChange: (v: number) => void;
  step?: number;
  min?: number;
}) {
  return (
    <label className="flex flex-col gap-0.5 text-xs">
      <span className="text-gray-500">{label}</span>
      <input
        type="number"
        value={value}
        min={min}
        step={step}
        onChange={(e) => {
          const n = parseFloat(e.target.value);
          if (!isNaN(n)) onChange(n);
        }}
        className="w-24 px-2 py-1 text-sm text-gray-900 bg-white border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
      />
    </label>
  );
}

function PresetButton({
  label,
  isActive,
  onClick,
}: {
  label: string;
  isActive: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`px-3 py-1 text-xs font-medium rounded border ${
        isActive
          ? "bg-blue-50 border-blue-400 text-blue-800"
          : "bg-white border-gray-300 text-gray-700 hover:border-gray-400"
      }`}
    >
      {label}
    </button>
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
function TemplatePreview({
  config,
  size = 80,
}: {
  config: LabelTemplateConfig;
  size?: number;
}) {
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
      width={size}
      height={Math.round((size * CANVAS_H) / CANVAS_W)}
      aria-hidden="true"
    >
      {config.category === "continuous" && (
        <>
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
