"use client";

import type { ColumnMapping, UploadResponse } from "@/types";
import { ADDRESS_FIELDS } from "@/types";
import { Select } from "@/components/atoms/Select";

interface FieldMapperProps {
  uploadData: UploadResponse;
  mappings: ColumnMapping[];
  onUpdateMapping: (csvColumn: string, field: string) => void;
}

export function FieldMapper({ uploadData, mappings, onUpdateMapping }: FieldMapperProps) {
  const getMappedField = (csvColumn: string) => {
    return mappings.find((m) => m.csv_column === csvColumn)?.field || "";
  };

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-4 text-sm font-medium text-gray-500 pb-2 border-b">
        <div>CSV Column</div>
        <div>Maps To</div>
      </div>

      {uploadData.columns.map((col) => (
        <div key={col} className="grid grid-cols-2 gap-4 items-center">
          <div className="text-sm font-mono bg-gray-50 px-3 py-2 rounded">{col}</div>
          <Select
            value={getMappedField(col)}
            onChange={(e) => onUpdateMapping(col, e.target.value)}
            options={[
              { value: "", label: "-- Skip --" },
              ...ADDRESS_FIELDS.map((f) => ({ value: f.value, label: f.label })),
            ]}
          />
        </div>
      ))}

      {uploadData.sample_rows.length > 0 && (
        <div className="mt-6">
          <h4 className="text-sm font-medium text-gray-700 mb-2">Sample Data (first 5 rows)</h4>
          <div className="overflow-x-auto">
            <table className="min-w-full text-xs">
              <thead>
                <tr>
                  {uploadData.columns.map((col) => (
                    <th key={col} className="px-3 py-2 text-left font-medium text-gray-500 bg-gray-50">
                      {col}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {uploadData.sample_rows.map((row, i) => (
                  <tr key={i} className="border-t">
                    {uploadData.columns.map((col) => (
                      <td key={col} className="px-3 py-2 text-gray-600 whitespace-nowrap">
                        {row[col] || "-"}
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
