"use client";

import dynamic from "next/dynamic";
import { useLabels } from "@/hooks/useLabels";
import { Stepper } from "@/components/atoms/Stepper";
import { FileDropZone } from "@/components/atoms/FileDropZone";
import { Button } from "@/components/atoms/Button";
import { FieldMapper } from "@/components/molecules/FieldMapper";
import { ReviewPanel } from "@/components/molecules/ReviewPanel";
import { ProUpgradeCard } from "@/components/molecules/ProUpgradeCard";
import { TemplatePicker } from "@/components/molecules/TemplatePicker";
import {
  CUSTOM_TEMPLATE_ID,
  DEFAULT_CUSTOM_CONFIG,
  FIELD_LAYOUT_OPTIONS,
  getConfigById,
} from "@/lib/templates";

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
    customTemplateConfig,
    selectTemplate,
    groupKey,
    setGroupKey,
    sortDir,
    setSortDir,
    pageBreakPerGroup,
    setPageBreakPerGroup,
    fieldLayout,
    setFieldLayout,
    labelsPerPage,
    upload,
    mapFields,
    saveTemplate,
    skipDesigner,
    generate,
    reset,
    updateMapping,
    upgradeToPro,
  } = useLabels();

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
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Map Your Fields</h2>
            <p className="mt-1 text-gray-500">
              {uploadData.total_rows} contacts found in{" "}
              <span className="font-mono">{uploadData.filename}</span>
            </p>
          </div>

          <TemplatePicker
            value={selectedTemplate}
            customConfig={customTemplateConfig}
            onChange={selectTemplate}
          />

          <div className="flex items-start gap-2 rounded-lg bg-blue-50 border border-blue-200 px-4 py-3">
            <span aria-hidden className="text-blue-600">📍</span>
            <p className="text-sm text-blue-800">
              In the <strong>Review</strong> step you&apos;ll be able to sort &amp;
              group these labels — e.g. by <strong>ZIP code</strong> so your mail
              prints pre-sorted for faster USPS drop-off.
            </p>
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

          <div className="bg-white rounded-xl border p-5">
            <h3 className="text-sm font-semibold text-gray-900 mb-1">
              Address fields
            </h3>
            <p className="text-xs text-gray-500 mb-3">
              Choose how the address is split into editable fields. Switching
              resets the canvas to that arrangement — you can still drag,
              resize, or delete any field afterwards.
            </p>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              {FIELD_LAYOUT_OPTIONS.map((o) => {
                const active = o.value === fieldLayout;
                return (
                  <button
                    key={o.value}
                    type="button"
                    onClick={() => setFieldLayout(o.value)}
                    aria-pressed={active}
                    className={`text-left border rounded-lg p-3 transition-all ${
                      active
                        ? "border-blue-500 ring-2 ring-blue-500/20 bg-blue-50/40"
                        : "border-gray-200 hover:border-gray-400 bg-white"
                    }`}
                  >
                    <div className="text-sm font-medium text-gray-900">
                      {o.label}
                    </div>
                    <div className="mt-1 text-xs text-gray-500 leading-snug">
                      {o.description}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>

          <TemplateDesigner
            config={
              selectedTemplate === CUSTOM_TEMPLATE_ID
                ? customTemplateConfig ?? DEFAULT_CUSTOM_CONFIG
                : getConfigById(selectedTemplate)
            }
            addresses={addresses}
            layout={fieldLayout}
            onSave={saveTemplate}
          />
        </div>
      )}

      {/* Step 4: Review */}
      {step === "review" && previewData && (
        <div className="space-y-6">
          <h2 className="text-2xl font-bold text-gray-900">Review & Generate</h2>
          <ReviewPanel
            preview={previewData}
            groupKey={groupKey}
            sortDir={sortDir}
            pageBreak={pageBreakPerGroup}
            labelsPerPage={labelsPerPage}
            onGroupKeyChange={setGroupKey}
            onSortDirChange={setSortDir}
            onPageBreakChange={setPageBreakPerGroup}
          />
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
