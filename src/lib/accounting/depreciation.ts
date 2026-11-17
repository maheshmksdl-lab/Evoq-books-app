import { addMonths, format, parseISO } from "date-fns";
import type { FixedAsset } from "@/types";
import { round2 } from "@/lib/formatters";

export interface DepRow { month: string; opening: number; depreciation: number; accumulated: number; closing: number }

/** Depreciation starts the month after purchase and runs monthly until residual value is reached. */
export function depreciationSchedule(asset: Pick<FixedAsset, "cost" | "residual" | "usefulLifeYears" | "method" | "purchaseDate" | "disposal">, untilMonth?: string): DepRow[] {
  const months = asset.usefulLifeYears * 12;
  const rows: DepRow[] = [];
  const start = addMonths(parseISO(`${asset.purchaseDate.slice(0, 7)}-01`), 1);
  let book = asset.cost, acc = 0;
  const depreciable = asset.cost - asset.residual;
  const annualRate = asset.method === "WDV"
    ? 1 - Math.pow(Math.max(asset.residual, 1) / asset.cost, 1 / asset.usefulLifeYears)
    : asset.method === "DDB" ? 2 / asset.usefulLifeYears : 0;
  for (let i = 0; i < months; i++) {
    const key = format(addMonths(start, i), "yyyy-MM");
    if (untilMonth && key > untilMonth) break;
    if (asset.disposal && key > asset.disposal.date.slice(0, 7)) break;
    let dep = asset.method === "SLM" ? depreciable / months : (book * annualRate) / 12;
    dep = Math.min(dep, book - asset.residual);
    if (dep <= 0) break;
    dep = round2(dep);
    const opening = book;
    book = round2(book - dep);
    acc = round2(acc + dep);
    rows.push({ month: key, opening, depreciation: dep, accumulated: acc, closing: book });
  }
  return rows;
}

export function accumulatedAt(asset: Parameters<typeof depreciationSchedule>[0], untilMonth: string): number {
  const rows = depreciationSchedule(asset, untilMonth);
  return rows.length ? rows[rows.length - 1].accumulated : 0;
}

export function monthDepreciation(asset: Parameters<typeof depreciationSchedule>[0], month: string): number {
  return depreciationSchedule(asset, month).find((r) => r.month === month)?.depreciation ?? 0;
}
