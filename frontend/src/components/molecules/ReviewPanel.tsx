import type { LabelPreviewResponse } from "@/types";
import { Badge } from "@/components/atoms/Badge";

interface ReviewPanelProps {
  preview: LabelPreviewResponse;
}

export function ReviewPanel({ preview }: ReviewPanelProps) {
  return (
    <div className="space-y-6">
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg border p-4">
          <div className="text-2xl font-bold text-gray-900">{preview.total_labels}</div>
          <div className="text-sm text-gray-500">Total Labels</div>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="text-2xl font-bold text-gray-900">{preview.total_pages}</div>
          <div className="text-sm text-gray-500">Pages</div>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="text-2xl font-bold text-gray-900">{preview.domestic_count}</div>
          <div className="text-sm text-gray-500">Domestic</div>
        </div>
        <div className="bg-white rounded-lg border p-4">
          <div className="text-2xl font-bold text-blue-600">{preview.international_count}</div>
          <div className="text-sm text-gray-500">International</div>
        </div>
      </div>

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
            <strong>{preview.international_count}</strong> international address{preview.international_count > 1 ? "es" : ""} detected.
            Country will be automatically added to these labels.
          </p>
        </div>
      )}

      {preview.warnings.length === 0 && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-sm text-green-800">All addresses validated successfully. Ready to generate.</p>
        </div>
      )}
    </div>
  );
}
