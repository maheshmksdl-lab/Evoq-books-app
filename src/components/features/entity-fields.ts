import { CURRENCIES } from "@/lib/formatters";

export const ENTITY_FIELDS = [
  { name: "name", label: "Display name", required: true }, { name: "legalName", label: "Legal name", required: true }, { name: "country", label: "Country", required: true }, { name: "state", label: "State / region" }, { name: "city", label: "City" }, { name: "industry", label: "Industry", required: true },
  { name: "address", label: "Address", span: 2 as const }, { name: "baseCurrency", label: "Base currency", type: "select" as const, options: CURRENCIES.map((c) => ({ value: c.code, label: `${c.code} – ${c.name}` })), required: true }, { name: "fyStartMonth", label: "Financial year starts", type: "select" as const, options: ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"].map((m, i) => ({ value: String(i + 1), label: m })) },
  { name: "taxRegime", label: "Tax regime", type: "select" as const, options: [{ value: "india-gst", label: "India GST (CGST / SGST / IGST)" }, { value: "flat-gst", label: "Flat GST / VAT" }] }, { name: "role", label: "Group role", type: "select" as const, options: [{ value: "parent", label: "Parent" }, { value: "subsidiary", label: "Subsidiary" }] }, { name: "ownership", label: "Ownership %", type: "number" as const }, { name: "gstin", label: "Tax registration no." },
];

