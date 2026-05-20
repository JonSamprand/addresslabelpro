"use client";

import dynamic from "next/dynamic";
import { useLabels } from "@/hooks/useLabels";
import { Stepper } from "@/components/atoms/Stepper";
import { FileDropZone } from "@/components/atoms/FileDropZone";
import { Button } from "@/components/atoms/Button";
import { Select } from "@/components/atoms/Select";
import { FieldMapper } from "@/components/molecules/FieldMapper";
import { ReviewPanel } from "@/components/molecules/ReviewPanel";
import { ProUpgradeCard } from "@/components/molecules/ProUpgradeCard";
import { LABEL_CONFIGS, getConfigById } from "@/lib/templates";

// pdfme Designer requires DOM — no SSR
const TemplateDesigner = dynamic(
  () => import("@/components/organisms/TemplateDesigner").then((m) => ({ default: m.TemplateDesigner })),
  { ssr: false, loading: () => <div className="h-[550px] bg-gray-100 rounded-lg animate-pulse" /> },
);

export function LabelWizard() {
  const {
    step,
    loading,
    error,
    uploadData,
    mappings,
    previewData,
    pdfUrl,
    addresses,
    selectedTemplate,
    setSelectedTemplate,
    upload,
    mapFields,
    saveTemplate,
    skipDesigner,
    generate,
    reset,
    updateMapping,
    upgradeToPro,
  } = useLabels();

  const templateOptions = LABEL_CONFIGS.map((t) => ({
    value: t.id,
    label: `${t.name} — ${t.description}`,
  }));

  return (
    <div className="max-w-4xl mx-auto">
      <Stepper currentStep={step} />

      {error && (
        <div className="mb-6 bg-red-50 border border-red-200 rounded-lg p-4">
          <p className="text-sm text-red-800">{error}</p>
        </div>
      )}

      {/* Step 1: Upload */}
      {step === "upload" && (
        <div className="space-y-6">
          <div className="text-center mb-8">
            <h2 className="text-2xl font-bold text-gray-900">Upload Your Mailing List</h2>
            <p className="mt-2 text-gray-500">Upload a CSV file with your addresses. No contact limit.</p>
          </div>
          <FileDropZone onFile={upload} disabled={loading} />
          {loading && <p className="text-center text-sm text-gray-500">Analyzing your file...</p>}
        </div>
      )}

      {/* Step 2: Map Fields */}
      {step === "map" && uploadData && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Map Your Fields</h2>
              <p className="mt-1 text-gray-500">
                {uploadData.total_rows} contacts found in{" "}
                <span className="font-mono">{uploadData.filename}</span>
              </p>
            </div>
            <Select
              label="Label Template"
              value={selectedTemplate}
              onChange={(e) => setSelectedTemplate(e.target.value)}
              options={templateOptions}
            />
          </div>

          <div className="bg-white rounded-xl border p-6">
            <FieldMapper
              uploadData={uploadData}
              mappings={mappings}
              onUpdateMapping={updateMapping}
            />
          </div>

          <ProUpgradeCard
            totalRows={uploadData.total_rows}
            onUpgrade={upgradeToPro}
            loading={loading}
            isPaid={previewData?.is_pro}
          />

          <div className="flex justify-between">
            <Button variant="ghost" onClick={reset}>Start Over</Button>
            <Button onClick={mapFields} loading={loading}>
              Validate & Continue
            </Button>
          </div>
        </div>
      )}

      {/* Step 3: Design Label */}
      {step === "design" && (
        <div className="space-y-6">
          <div className="flex items-center justify-between">
            <div>
              <h2 className="text-2xl font-bold text-gray-900">Design Your Label</h2>
              <p className="mt-1 text-gray-500">
                Drag fields to reposition, adjust font sizes, toggle visibility. Browse your actual data with the arrows.
              </p>
            </div>
            <Button variant="secondary" onClick={skipDesigner}>
              Skip — Use Default
            </Button>
          </div>

          <TemplateDesigner
            config={getConfigById(selectedTemplate)}
            addresses={addresses}
            onSave={saveTemplate}
          />
        </div>
      )}

      {/* Step 4: Review */}
      {step === "review" && previewData && (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-gray-900">Review & Generate</h2>
          <ReviewPanel preview={previewData} />
          <div className="flex justify-between">
            <Button variant="ghost" onClick={reset}>Start Over</Button>
            <Button onClick={generate} loading={loading} size="lg">
              Generate PDF
            </Button>
          </div>
        </div>
      )}

      {/* Step 5: Download */}
      {step === "download" && pdfUrl && (
        <div className="text-center space-y-6 py-12">
          <div className="mx-auto w-16 h-16 bg-green-100 rounded-full flex items-center justify-center">
            <svg className="w-8 h-8 text-green-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          </div>
          <h2 className="text-2xl font-bold text-gray-900">Labels Ready!</h2>
          <p className="text-gray-500">Your PDF has been generated and is ready to download.</p>
          <div className="flex justify-center gap-4">
            <a
              href={pdfUrl}
              download="labels.pdf"
              className="inline-flex items-center px-6 py-3 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 transition-colors"
            >
              <svg className="w-5 h-5 mr-2" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 10v6m0 0l-3-3m3 3l3-3m2 8H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
              </svg>
              Download PDF
            </a>
            <Button variant="secondary" onClick={reset}>
              New Batch
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}
