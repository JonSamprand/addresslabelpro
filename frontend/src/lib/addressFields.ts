import type { AddressData } from "@/types";

/**
 * Single source of truth for the values a label template can bind to.
 *
 * This MUST stay shared between:
 *   - components/organisms/TemplateDesigner.tsx  (what the user designs against)
 *   - app/api/generate/route.ts                  (what gets rendered into the PDF)
 *
 * These were previously two separate copies. Any drift silently produced blank
 * fields in the generated PDF — the designer would show a value for a field
 * name the generator didn't know how to fill.
 */

export interface AddressFieldValues {
  // pdfme resolves schema fields by name at runtime, so callers index this
  // with a plain string. The named members below stay for documentation and
  // autocomplete; the index signature is what makes dynamic lookup type-safe.
  [key: string]: string;
  // Individual, separated fields
  name: string;
  company: string;
  street1: string;
  street2: string;
  city: string;
  state: string;
  zip: string;
  country: string;
  // Composed convenience fields
  street: string;          // street1 + street2 on one line (alias of combinedStreet)
  combinedStreet: string;
  cityState: string;       // "Springfield, IL"
  zipCountry: string;      // "62704" or "62704 UNITED KINGDOM"
  cityStateZip: string;    // "Springfield, IL 62704"
  addressBlock: string;    // everything except name, multi-line
  fullAddress: string;     // addressBlock including the name
}

/**
 * Every binding a label field can point at, grouped for the "add field" menu.
 *
 * "Combining" fields is expressed here: pick `cityStateZip` for one line, or
 * `city` + `state` + `zip` for three. Same data, user's choice of granularity.
 */
export const ADDRESSABLE_FIELDS: {
  name: keyof AddressFieldValues & string;
  label: string;
  group: "Individual" | "Combined";
}[] = [
  { name: "name", label: "Name", group: "Individual" },
  { name: "company", label: "Company", group: "Individual" },
  { name: "street1", label: "Address line 1", group: "Individual" },
  { name: "street2", label: "Address line 2", group: "Individual" },
  { name: "city", label: "City", group: "Individual" },
  { name: "state", label: "State / Region", group: "Individual" },
  { name: "zip", label: "ZIP / Postal code", group: "Individual" },
  { name: "country", label: "Country", group: "Individual" },
  { name: "street", label: "Address 1 + 2 (one line)", group: "Combined" },
  { name: "cityState", label: "City, State", group: "Combined" },
  { name: "zipCountry", label: "ZIP + Country", group: "Combined" },
  { name: "cityStateZip", label: "City, State ZIP", group: "Combined" },
  { name: "addressBlock", label: "Full address block (no name)", group: "Combined" },
  { name: "fullAddress", label: "Full address incl. name", group: "Combined" },
];

export function addressToFieldValues(addr: AddressData): AddressFieldValues {
  const cityStateZip =
    addr.city_state_zip ||
    (() => {
      const parts: string[] = [];
      if (addr.city) parts.push(addr.city);
      if (addr.state) {
        if (parts.length) parts[parts.length - 1] += ",";
        parts.push(addr.state);
      }
      if (addr.zip_code) parts.push(addr.zip_code);
      return parts.join(" ");
    })();

  const combinedStreet =
    addr.combined_street || [addr.street1, addr.street2].filter(Boolean).join(", ");

  // Only surface a country for genuinely international mail — the backend
  // decides this (US territories like Puerto Rico are domestic).
  const country = addr.is_international && addr.country ? addr.country.toUpperCase() : "";

  const cityState = [addr.city, addr.state].filter(Boolean).join(", ");
  const zipCountry = [addr.zip_code, country].filter(Boolean).join("  ");

  const addressBlock =
    addr.address_block
      ?.split("\n")
      .filter((l) => l.trim() && l.trim() !== addr.name)
      .join("\n") ||
    [addr.company, combinedStreet, cityStateZip, country].filter(Boolean).join("\n");

  return {
    name: addr.name || "",
    company: addr.company || "",
    street1: addr.street1 || "",
    street2: addr.street2 || "",
    city: addr.city || "",
    state: addr.state || "",
    zip: addr.zip_code || "",
    country,
    street: combinedStreet,
    combinedStreet,
    cityState,
    zipCountry,
    cityStateZip,
    addressBlock,
    fullAddress: [addr.name, addressBlock].filter(Boolean).join("\n"),
  };
}
