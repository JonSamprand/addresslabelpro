import type { AddressData } from "@/types";

/**
 * Label organization for the Review step.
 *
 * The downloaded PDF places labels in the order of the `addresses` array
 * (see buildInputs in lib/templates.ts). So "group by ZIP" is really
 * "reorder the array by ZIP" — the labels then print in ZIP order, and the
 * user peels-and-sticks in order, ending up with ZIP-presorted mail ready to
 * drop at the post office.
 *
 * All logic here is pure so the Review UI (display) and the generate step
 * (ordering) can call it independently and always agree.
 */

export type GroupKey =
  | "none"
  | "zip"
  | "zip3"
  | "state"
  | "city"
  | "country"
  | "name"
  | "company";

export type SortDir = "asc" | "desc";

export interface LabelGroup {
  id: string;
  /** Header shown in the review UI, e.g. "ZIP 62704" or "627xx" or "No ZIP". */
  label: string;
  addresses: AddressData[];
  /** True for the catch-all bucket of rows missing the grouping value. */
  isMissing: boolean;
}

export interface OrganizeResult {
  groups: LabelGroup[];
  /** Flat, in group order — this is what the PDF generator consumes. */
  ordered: AddressData[];
  groupCount: number;
  missingCount: number;
}

export const GROUP_OPTIONS: { value: GroupKey; label: string; postal?: boolean }[] = [
  { value: "none", label: "Upload order" },
  { value: "zip", label: "ZIP code", postal: true },
  { value: "zip3", label: "ZIP region (first 3 digits)", postal: true },
  { value: "state", label: "State" },
  { value: "city", label: "City" },
  { value: "country", label: "Country (domestic / international)" },
  { value: "name", label: "Name (by first letter)" },
  { value: "company", label: "Company" },
];

/** Grouping keys that produce mail presorted for USPS drop-off. */
export const POSTAL_KEYS: GroupKey[] = ["zip", "zip3"];

// --- value extraction --------------------------------------------------------

function zip5(a: AddressData): string {
  const m = (a.zip_code || "").match(/\d{5}/);
  return m ? m[0] : "";
}

function zip3(a: AddressData): string {
  const z = zip5(a);
  return z ? z.slice(0, 3) : "";
}

function domesticCountry(a: AddressData): string {
  if (a.is_international && a.country) return a.country.trim().toUpperCase();
  return "United States";
}

/** The raw bucket key + display label for a given address under `key`. */
function bucketFor(a: AddressData, key: GroupKey): { id: string; label: string } | null {
  switch (key) {
    case "zip": {
      const z = zip5(a);
      return z ? { id: z, label: `ZIP ${z}` } : null;
    }
    case "zip3": {
      const z = zip3(a);
      return z ? { id: z, label: `${z}xx region` } : null;
    }
    case "state": {
      const s = (a.state || "").trim();
      return s ? { id: s.toUpperCase(), label: s.toUpperCase() } : null;
    }
    case "city": {
      const c = (a.city || "").trim();
      return c ? { id: c.toLowerCase(), label: c } : null;
    }
    case "country": {
      const c = domesticCountry(a);
      return { id: c, label: c === "United States" ? "United States (domestic)" : c };
    }
    case "name": {
      const n = (a.name || "").trim();
      if (!n) return null;
      const first = n[0].toUpperCase();
      const letter = /[A-Z]/.test(first) ? first : "#";
      return { id: letter, label: letter === "#" ? "# (symbols / numbers)" : letter };
    }
    case "company": {
      const c = (a.company || "").trim();
      return c ? { id: c.toLowerCase(), label: c } : null;
    }
    default:
      return null;
  }
}

// --- sorting -----------------------------------------------------------------

/** Compare two bucket ids for a key. ZIP-family compares numerically. */
function compareBucketIds(key: GroupKey, a: string, b: string): number {
  if (key === "zip" || key === "zip3") {
    const na = parseInt(a, 10);
    const nb = parseInt(b, 10);
    if (!isNaN(na) && !isNaN(nb)) return na - nb;
  }
  return a.localeCompare(b, undefined, { numeric: true, sensitivity: "base" });
}

/** Secondary within-bucket sort so each group is itself tidy. */
function withinBucketSort(key: GroupKey, addrs: AddressData[]): AddressData[] {
  const byZipThenName = (x: AddressData, y: AddressData) =>
    zip5(x).localeCompare(zip5(y)) ||
    (x.name || "").localeCompare(y.name || "", undefined, { sensitivity: "base" });
  const byName = (x: AddressData, y: AddressData) =>
    (x.name || "").localeCompare(y.name || "", undefined, { sensitivity: "base" });

  const copy = [...addrs];
  switch (key) {
    case "zip":
    case "name":
    case "company":
      return copy.sort(byName);
    case "zip3":
    case "state":
    case "city":
    case "country":
      return copy.sort(byZipThenName);
    default:
      return copy;
  }
}

const MISSING_LABEL: Record<GroupKey, string> = {
  none: "",
  zip: "No ZIP code",
  zip3: "No ZIP code",
  state: "No state",
  city: "No city",
  country: "",
  name: "No name",
  company: "No company",
};

/**
 * Organize addresses into ordered groups.
 * `dir` flips the group order (missing bucket always sorts last regardless).
 */
export function organize(
  addresses: AddressData[],
  key: GroupKey,
  dir: SortDir,
): OrganizeResult {
  if (key === "none") {
    return {
      groups: [{ id: "all", label: "Upload order", addresses, isMissing: false }],
      ordered: addresses,
      groupCount: 1,
      missingCount: 0,
    };
  }

  const buckets = new Map<string, { label: string; addresses: AddressData[] }>();
  const missing: AddressData[] = [];

  for (const a of addresses) {
    const b = bucketFor(a, key);
    if (!b) {
      missing.push(a);
      continue;
    }
    const entry = buckets.get(b.id);
    if (entry) entry.addresses.push(a);
    else buckets.set(b.id, { label: b.label, addresses: [a] });
  }

  const ids = Array.from(buckets.keys()).sort((x, y) => compareBucketIds(key, x, y));
  if (dir === "desc") ids.reverse();

  const groups: LabelGroup[] = ids.map((id) => {
    const entry = buckets.get(id)!;
    return {
      id,
      label: entry.label,
      addresses: withinBucketSort(key, entry.addresses),
      isMissing: false,
    };
  });

  if (missing.length > 0) {
    groups.push({
      id: "__missing__",
      label: MISSING_LABEL[key] || "Uncategorized",
      addresses: withinBucketSort(key, missing),
      isMissing: true,
    });
  }

  const ordered = groups.flatMap((g) => g.addresses);
  return {
    groups,
    ordered,
    groupCount: groups.filter((g) => !g.isMissing).length,
    missingCount: missing.length,
  };
}

// --- page breaks -------------------------------------------------------------

function blankAddress(): AddressData {
  return {
    name: "",
    company: "",
    street1: "",
    street2: "",
    city: "",
    state: "",
    zip_code: "",
    country: "",
    is_international: false,
    is_complete: true,
    missing_fields: [],
  };
}

/**
 * Flatten groups into a print order where each group starts on a fresh page,
 * padding the tail of each group with blank labels up to the next page
 * boundary. For continuous/single templates (labelsPerPage <= 1) this is a
 * no-op — each label is already its own page.
 */
export function orderedWithPageBreaks(
  groups: LabelGroup[],
  labelsPerPage: number,
): AddressData[] {
  if (labelsPerPage <= 1) return groups.flatMap((g) => g.addresses);
  const out: AddressData[] = [];
  for (const g of groups) {
    if (g.addresses.length === 0) continue;
    out.push(...g.addresses);
    const remainder = out.length % labelsPerPage;
    if (remainder !== 0) {
      const pad = labelsPerPage - remainder;
      for (let i = 0; i < pad; i++) out.push(blankAddress());
    }
  }
  return out;
}
