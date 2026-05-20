// Column mapping from CSV to address fields
export interface ColumnMapping {
  csv_column: string;
  field: string;
}

// Response from CSV upload
export interface UploadResponse {
  job_id: string;
  filename: string;
  total_rows: number;
  columns: string[];
  suggested_mappings: ColumnMapping[];
  sample_rows: Record<string, string>[];
}

// Request to map fields
export interface FieldMappingRequest {
  job_id: string;
  mappings: ColumnMapping[];
  template: string;
  sender_address?: Record<string, string>;
}

// Address validation warning
export interface AddressWarning {
  row_index: number;
  field: string;
  message: string;
}

// Response from field mapping / validation
export interface LabelPreviewResponse {
  job_id: string;
  total_labels: number;
  total_pages: number;
  warnings: AddressWarning[];
  international_count: number;
  domestic_count: number;
  addresses: AddressData[];
  is_pro?: boolean;
  ai_cleaned_count?: number;
}

// Request to generate PDF
export interface LabelConfigRequest {
  job_id: string;
  template: string;
  font_size?: number;
  include_sender: boolean;
}

// Generate response
export interface GenerateResponse {
  job_id: string;
  status: string;
  download_url: string;
}

// Label template options
export interface LabelTemplate {
  id: string;
  name: string;
  columns: number;
  rows: number;
  description: string;
}

// Address data from backend validation
export interface AddressData {
  name: string;
  company: string;
  street1: string;
  street2: string;
  city: string;
  state: string;
  zip_code: string;
  country: string;
  is_international: boolean;
  is_complete: boolean;
  missing_fields: string[];
  // Composition-ready fields (pre-computed server-side so labels render
  // cleanly whether or not optional fields are populated).
  combined_street?: string;
  city_state_zip?: string;
  address_block?: string;
  formatted_lines?: string[];
  ai_normalized?: boolean;
  was_cleaned?: boolean;
}

// App step tracking
export type AppStep = "upload" | "map" | "design" | "review" | "download";

// API result wrapper
export interface ApiResult<T> {
  success: boolean;
  data?: T;
  error?: string;
}

// Available address fields for mapping
export const ADDRESS_FIELDS = [
  { value: "name", label: "Full Name" },
  { value: "first_name", label: "First Name" },
  { value: "last_name", label: "Last Name" },
  { value: "company", label: "Company" },
  { value: "street1", label: "Street Address" },
  { value: "street2", label: "Street Address 2" },
  { value: "city", label: "City" },
  { value: "state", label: "State / Province" },
  { value: "zip_code", label: "ZIP / Postal Code" },
  { value: "country", label: "Country" },
] as const;

export const LABEL_TEMPLATES: LabelTemplate[] = [
  { id: "avery_5160", name: "Avery 5160 / 8160", columns: 3, rows: 10, description: '1" x 2.625" — 30 per sheet' },
  { id: "avery_5163", name: "Avery 5163 / 8163", columns: 2, rows: 5, description: '2" x 4" — 10 per sheet' },
  { id: "avery_5164", name: "Avery 5164 / 8164", columns: 2, rows: 3, description: '3.33" x 4" — 6 per sheet' },
];
