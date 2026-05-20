"use client";

import { useState, useCallback, useEffect } from "react";
import type { Template } from "@pdfme/common";
import { api } from "@/services/api";
import type {
  AppStep,
  UploadResponse,
  ColumnMapping,
  LabelPreviewResponse,
  AddressData,
} from "@/types";

const STORAGE_KEY = "alp_wizard_state";

type PersistedState = {
  step: AppStep;
  uploadData: UploadResponse | null;
  mappings: ColumnMapping[];
  selectedTemplate: string;
};

function loadPersisted(): PersistedState | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = sessionStorage.getItem(STORAGE_KEY);
    return raw ? (JSON.parse(raw) as PersistedState) : null;
  } catch {
    return null;
  }
}

function savePersisted(state: PersistedState) {
  if (typeof window === "undefined") return;
  try {
    sessionStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // sessionStorage full / disabled — non-fatal
  }
}

export function useLabels() {
  const persisted = typeof window !== "undefined" ? loadPersisted() : null;

  const [step, setStep] = useState<AppStep>(persisted?.step ?? "upload");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Data from each step — uploadData/mappings/selectedTemplate are persisted
  // so the user survives the Stripe redirect round-trip.
  const [uploadData, setUploadData] = useState<UploadResponse | null>(persisted?.uploadData ?? null);
  const [mappings, setMappings] = useState<ColumnMapping[]>(persisted?.mappings ?? []);
  const [previewData, setPreviewData] = useState<LabelPreviewResponse | null>(null);
  const [addresses, setAddresses] = useState<AddressData[]>([]);
  const [labelTemplate, setLabelTemplate] = useState<Template | null>(null);
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [selectedTemplate, setSelectedTemplate] = useState(persisted?.selectedTemplate ?? "avery_5160");

  // Persist the minimal state needed to resume after Stripe redirect.
  useEffect(() => {
    savePersisted({ step, uploadData, mappings, selectedTemplate });
  }, [step, uploadData, mappings, selectedTemplate]);

  const upload = useCallback(async (file: File) => {
    setLoading(true);
    setError(null);
    const result = await api.uploadCSV(file);
    if (result.success && result.data) {
      setUploadData(result.data);
      setMappings(result.data.suggested_mappings);
      setStep("map");
    } else {
      setError(result.error || "Upload failed");
    }
    setLoading(false);
  }, []);

  const mapFields = useCallback(async () => {
    if (!uploadData) return;
    setLoading(true);
    setError(null);

    const result = await api.mapFields({
      job_id: uploadData.job_id,
      mappings,
      template: selectedTemplate,
    });

    if (result.success && result.data) {
      setPreviewData(result.data);
      setAddresses(result.data.addresses || []);
      setStep("design");
    } else {
      setError(result.error || "Mapping failed");
    }
    setLoading(false);
  }, [uploadData, mappings, selectedTemplate]);

  const upgradeToPro = useCallback(async () => {
    setLoading(true);
    setError(null);
    const result = await api.createCheckout();
    if (result.success && result.data?.url) {
      // Stripe Checkout for a monthly subscription. On success the user is
      // redirected to /pro-success; webhooks mark them Pro in Supabase.
      window.location.href = result.data.url;
    } else {
      setError(result.error || "Could not start checkout");
      setLoading(false);
    }
  }, []);

  const saveTemplate = useCallback((template: Template) => {
    setLabelTemplate(template);
    setStep("review");
  }, []);

  const skipDesigner = useCallback(() => {
    setStep("review");
  }, []);

  const generate = useCallback(async () => {
    if (addresses.length === 0) return;
    setLoading(true);
    setError(null);

    try {
      const res = await fetch("/api/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          addresses,
          templateId: selectedTemplate,
          labelTemplate: labelTemplate || undefined,
        }),
      });

      if (!res.ok) {
        const err = await res.json().catch(() => ({ error: "Generation failed" }));
        setError(err.error || "Generation failed");
        setLoading(false);
        return;
      }

      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      setPdfUrl(url);
      setStep("download");
    } catch (e) {
      setError(e instanceof Error ? e.message : "Generation failed");
    }
    setLoading(false);
  }, [addresses, selectedTemplate, labelTemplate]);

  const reset = useCallback(() => {
    if (pdfUrl) URL.revokeObjectURL(pdfUrl);
    setStep("upload");
    setLoading(false);
    setError(null);
    setUploadData(null);
    setMappings([]);
    setPreviewData(null);
    setAddresses([]);
    setLabelTemplate(null);
    setPdfUrl(null);
    setSelectedTemplate("avery_5160");
    if (typeof window !== "undefined") {
      sessionStorage.removeItem(STORAGE_KEY);
      sessionStorage.removeItem("alp_pending_job_id");
    }
  }, [pdfUrl]);

  const updateMapping = useCallback((csvColumn: string, field: string) => {
    setMappings((prev) => {
      const existing = prev.findIndex((m) => m.csv_column === csvColumn);
      if (field === "") {
        return prev.filter((m) => m.csv_column !== csvColumn);
      }
      if (existing >= 0) {
        const updated = [...prev];
        updated[existing] = { csv_column: csvColumn, field };
        return updated;
      }
      return [...prev, { csv_column: csvColumn, field }];
    });
  }, []);

  return {
    step,
    loading,
    error,
    uploadData,
    mappings,
    previewData,
    addresses,
    labelTemplate,
    pdfUrl,
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
  };
}
