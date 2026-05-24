import { createClient } from "@/lib/supabase/client";
import type {
  UploadResponse,
  FieldMappingRequest,
  LabelPreviewResponse,
  LabelConfigRequest,
  GenerateResponse,
  ApiResult,
} from "@/types";

const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";

/** Attach `Authorization: Bearer <jwt>` if the user has a Supabase session. */
async function authHeaders(): Promise<Record<string, string>> {
  if (typeof window === "undefined") return {};
  if (!process.env.NEXT_PUBLIC_SUPABASE_URL) return {}; // dev-without-auth
  try {
    const supabase = createClient();
    const { data } = await supabase.auth.getSession();
    const token = data.session?.access_token;
    return token ? { Authorization: `Bearer ${token}` } : {};
  } catch {
    return {};
  }
}

async function request<T>(url: string, options: RequestInit = {}): Promise<ApiResult<T>> {
  try {
    const headers = new Headers(options.headers);
    const auth = await authHeaders();
    Object.entries(auth).forEach(([k, v]) => headers.set(k, v));

    const res = await fetch(`${API_BASE}${url}`, { ...options, headers });
    if (!res.ok) {
      const err = await res.json().catch(() => ({ detail: res.statusText }));
      return { success: false, error: err.detail || "Request failed" };
    }
    const data = await res.json();
    return { success: true, data };
  } catch (e) {
    return { success: false, error: e instanceof Error ? e.message : "Network error" };
  }
}

export const api = {
  uploadCSV: async (file: File): Promise<ApiResult<UploadResponse>> => {
    const formData = new FormData();
    formData.append("file", file);
    return request<UploadResponse>("/labels/upload", {
      method: "POST",
      body: formData,
    });
  },

  mapFields: async (req: FieldMappingRequest): Promise<ApiResult<LabelPreviewResponse>> => {
    return request<LabelPreviewResponse>("/labels/map", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      // FieldMappingRequest already includes the optional custom_template
      // field — JSON.stringify drops undefined keys, so non-custom templates
      // serialize identically to before.
      body: JSON.stringify(req),
    });
  },

  generatePDF: async (req: LabelConfigRequest): Promise<ApiResult<GenerateResponse>> => {
    return request<GenerateResponse>("/labels/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(req),
    });
  },

  getDownloadURL: (jobId: string): string => {
    return `${API_BASE}/labels/download/${jobId}`;
  },

  // ---- Billing (subscription) ----
  getPricing: async (): Promise<ApiResult<{ price_id: string; enabled: boolean; product_name: string }>> => {
    return request("/billing/pricing");
  },

  getSubscriptionStatus: async (): Promise<ApiResult<{ is_pro: boolean; status?: string; current_period_end?: string; cancel_at_period_end?: boolean }>> => {
    return request("/billing/status");
  },

  createCheckout: async (): Promise<ApiResult<{ url: string }>> => {
    return request("/billing/checkout", { method: "POST" });
  },

  createPortal: async (): Promise<ApiResult<{ url: string }>> => {
    return request("/billing/portal", { method: "POST" });
  },
};
