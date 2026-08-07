"use client";

import { useMemo } from "react";
import type { LabelPreviewResponse } from "@/types";
import { Badge } from "@/components/atoms/Badge";
import {
  GROUP_OPTIONS,
  POSTAL_KEYS,
  organize,
  type GroupKey,
  type SortDir,
} from "@/lib/grouping";

interface ReviewPanelProps {
  preview: LabelPreviewResponse;
  groupKey: GroupKey;
  sortDir: SortDir;
  pageBreak: boolean;
  labelsPerPage: number;
  onGroupKeyChange: (k: GroupKey) => void;
  onSortDirChange: (d: SortDir) => void;
  onPageBreakChange: (b: boolean) => void;
}

// Cap rows rendered per group so a 5,000-row upload doesn't jank the DOM.
// Counts are always shown in full — the cap only limits the visible sample.
const ROWS_PER_GROUP = 25;

export function ReviewPanel({
  preview,
  groupKey,
  sortDir,
  pageBreak,
  labelsPerPage,
  onGroupKeyChange,
  onSortDirChange,
  onPageBreakChange,
}: ReviewPanelProps) {
  const result = useMemo(
    () => organize(preview.addresses, groupKey, sortDir),
    [preview.addresses, groupKey, sortDir],
  );

  const isGrouped = groupKey !== "none";
  const isPostal = POSTAL_KEYS.includes(groupKey);
  const pageBreakApplies = labelsPerPage > 1;

  return (
    <div className="space-y-6">
      {/* Stats */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <Stat value={preview.total_labels} label="Total Labels" />
        <Stat value={preview.total_pages} label="Pages" />
        <Stat value={preview.domestic_count} label="Domestic" />
        <Stat value={preview.international_count} label="International" accent />
      </div>

      {/* Organize control */}
      <div className="bg-white rounded-xl border p-5">
        <div className="flex items-baseline justify-between mb-3">
          <h3 className="text-sm font-semibold text-gray-900">Organize labels</h3>
          {isGrouped && (
            <span className="text-xs text-gray-500">
              {result.groupCount} group{result.groupCount === 1 ? "" : "s"}
              {result.missingCount > 0 && ` · ${result.missingCount} uncategorized`}
            </span>
          )}
        </div>

        <div className="flex flex-wrap items-end gap-3">
          <label className="flex flex-col gap-1 text-xs">
            <span className="text-gray-500">Group by</span>
            <select
              value={groupKey}
              onChange={(e) => onGroupKeyChange(e.target.value as GroupKey)}
              className="px-3 py-2 text-sm text-gray-900 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
            >
              {GROUP_OPTIONS.map((o) => (
                <option key={o.value} value={o.value}>
                  {o.label}
                  {o.postal ? "  — USPS presort" : ""}
                </option>
              ))}
            </select>
          </label>

          {isGrouped && (
            <label className="flex flex-col gap-1 text-xs">
              <span className="text-gray-500">Order</span>
              <select
                value={sortDir}
                onChange={(e) => onSortDirChange(e.target.value as SortDir)}
                className="px-3 py-2 text-sm text-gray-900 bg-white border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              >
                <option value="asc">Ascending (A→Z, 0→9)</option>
                <option value="desc">Descending (Z→A, 9→0)</option>
              </select>
            </label>
          )}

          {isGrouped && pageBreakApplies && (
            <label className="flex items-center gap-2 text-sm text-gray-700 pb-2 cursor-pointer">
              <input
                type="checkbox"
                checked={pageBreak}
                onChange={(e) => onPageBreakChange(e.target.checked)}
                className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
              />
              Start each group on a new sheet
            </label>
          )}
        </div>

        {isPostal && (
          <p className="mt-3 text-xs text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-lg px-3 py-2">
            ✉ Labels will print pre-sorted for USPS drop-off. Peel in order and
            your mail is already grouped by {groupKey === "zip3" ? "ZIP region" : "ZIP code"}.
            {pageBreak && pageBreakApplies && " Each group starts on its own sheet so you can bundle them."}
          </p>
        )}
        {isGrouped && pageBreak && pageBreakApplies && !isPostal && (
          <p className="mt-3 text-xs text-gray-500">
            Each group starts on a new sheet — partial sheets are padded with
            blank labels, so this uses more label stock.
          </p>
        )}
      </div>

      {/* Grouped preview */}
      {isGrouped ? (
        <div className="space-y-3">
          {result.groups.map((g) => (
            <div key={g.id} className="bg-white rounded-lg border overflow-hidden">
              <div
                className={`flex items-center justify-between px-4 py-2.5 border-b ${
                  g.isMissing ? "bg-amber-50" : "bg-gray-50"
                }`}
              >
                <span className="text-sm font-semibold text-gray-900">{g.label}</span>
                <Badge variant={g.isMissing ? "warning" : "info"}>
                  {g.addresses.length} label{g.addresses.length === 1 ? "" : "s"}
                </Badge>
              </div>
              <ul className="divide-y">
                {g.addresses.slice(0, ROWS_PER_GROUP).map((a, i) => (
                  <li key={i} className="px-4 py-2 text-sm text-gray-700 flex justify-between gap-4">
                    <span className="truncate">{a.name || <em className="text-gray-400">(no name)</em>}</span>
                    <span className="text-gray-400 shrink-0 tabular-nums">
                      {[a.city, a.state].filter(Boolean).join(", ")} {a.zip_code}
                    </span>
                  </li>
                ))}
                {g.addresses.length > ROWS_PER_GROUP && (
                  <li className="px-4 py-2 text-xs text-gray-400">
                    + {g.addresses.length - ROWS_PER_GROUP} more
                  </li>
                )}
              </ul>
            </div>
          ))}
        </div>
      ) : (
        <FlatPreview addresses={preview.addresses} />
      )}

      {/* Warnings / status */}
      {preview.warnings.length > 0 && (
        <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h4 className="text-sm font-semibold text-yellow-800 mb-2">
            Warnings ({preview.warnings.length})
          </h4>
          <div className="max-h-48 overflow-y-auto space-y-1">
            {preview.warnings.map((w, i) => (
              <div key={i} className="flex items-center gap-2 text-sm text-yellow-700">
                <Badge variant="warning">Row {w.row_index + 1}</Badge>
                <span>{w.message}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {preview.international_count > 0 && (
        <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
          <p className="text-sm text-blue-800">
            <strong>{preview.international_count}</strong> international address
            {preview.international_count > 1 ? "es" : ""} detected. Country will be
            automatically added to these labels.
          </p>
        </div>
      )}
    </div>
  );
}

function Stat({ value, label, accent }: { value: number; label: string; accent?: boolean }) {
  return (
    <div className="bg-white rounded-lg border p-4">
      <div className={`text-2xl font-bold ${accent ? "text-blue-600" : "text-gray-900"}`}>
        {value}
      </div>
      <div className="text-sm text-gray-500">{label}</div>
    </div>
  );
}

const FLAT_CAP = 100;

function FlatPreview({ addresses }: { addresses: LabelPreviewResponse["addresses"] }) {
  return (
    <div className="bg-white rounded-lg border overflow-hidden">
      <ul className="divide-y">
        {addresses.slice(0, FLAT_CAP).map((a, i) => (
          <li key={i} className="px-4 py-2 text-sm text-gray-700 flex justify-between gap-4">
            <span className="truncate">{a.name || <em className="text-gray-400">(no name)</em>}</span>
            <span className="text-gray-400 shrink-0 tabular-nums">
              {[a.city, a.state].filter(Boolean).join(", ")} {a.zip_code}
            </span>
          </li>
        ))}
        {addresses.length > FLAT_CAP && (
          <li className="px-4 py-2 text-xs text-gray-400">+ {addresses.length - FLAT_CAP} more</li>
        )}
      </ul>
    </div>
  );
}
