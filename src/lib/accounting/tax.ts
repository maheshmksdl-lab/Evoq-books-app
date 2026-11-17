import type { Entity } from "@/types";
import { round2 } from "@/lib/formatters";

export type TaxMode = "inclusive" | "exclusive";

/** Tax calculation for a single rate. Inclusive: `amount` already contains tax. Exclusive: tax is added on top. */
export function calcTax(amount: number, ratePct: number, mode: TaxMode) {
  if (mode === "inclusive") { const base = round2(amount / (1 + ratePct / 100)); return { base, tax: round2(amount - base), total: round2(amount) }; }
  const tax = round2((amount * ratePct) / 100); return { base: round2(amount), tax, total: round2(amount + tax) };
}

/** Splits GST into CGST+SGST (intra-state) or IGST (inter-state). Foreign / zero-rated supplies carry no tax. */
export function gstSplit(entity: Pick<Entity, "state" | "country" | "taxRegime">, partyState: string, partyCountry: string, taxable: number, ratePct: number, foreign = false) {
  if (foreign || partyCountry !== entity.country || ratePct === 0) return { cgst: 0, sgst: 0, igst: 0, kind: "none" as const };
  if (entity.taxRegime === "flat-gst") return { cgst: 0, sgst: 0, igst: round2((taxable * ratePct) / 100), kind: "gst" as const };
  if (partyState === entity.state) { const h = round2((taxable * ratePct) / 200); return { cgst: h, sgst: h, igst: 0, kind: "intra" as const }; }
  return { cgst: 0, sgst: 0, igst: round2((taxable * ratePct) / 100), kind: "inter" as const };
}

export const TDS_SECTIONS: { section: string; label: string; rate: number }[] = [
  { section: "194C", label: "194C – Contractors (1%)", rate: 1 },
  { section: "194C", label: "194C – Contractors, companies (2%)", rate: 2 },
  { section: "194I", label: "194I – Rent (10%)", rate: 10 },
  { section: "194J", label: "194J – Professional fees (10%)", rate: 10 },
  { section: "194Q", label: "194Q – Purchase of goods (0.1%)", rate: 0.1 },
];
