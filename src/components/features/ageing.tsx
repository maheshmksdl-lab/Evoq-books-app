"use client";

import { AGE_BUCKETS } from "@/lib/accounting/engine";
import { useFormat } from "@/providers/app-provider";

const COLORS = ["var(--t-soft)", "color-mix(in srgb, var(--s-warning) 45%, white)", "color-mix(in srgb, var(--s-warning) 80%, white)", "color-mix(in srgb, var(--s-error) 55%, white)", "var(--s-error)"];

/** Compact stacked bar + legend for ageing buckets (Current, 1–30, 31–60, 61–90, 90+). */
export function AgeingBar({ totals }: { totals: number[] }) {
  const f = useFormat(); const sum = totals.reduce((s, x) => s + x, 0) || 1;
  return (
    <div>
      <div className="flex h-3 overflow-hidden rounded-full bg-muted" role="img" aria-label="Ageing distribution">{totals.map((t, i) => t > 0 && <div key={i} style={{ width: `${(t / sum) * 100}%`, background: COLORS[i] }} title={`${AGE_BUCKETS[i]}: ${f.money(t)}`} />)}</div>
      <div className="mt-2 grid grid-cols-5 gap-1 text-[11px]">{AGE_BUCKETS.map((b, i) => <div key={b}><span className="mr-1 inline-block size-2 rounded-sm align-middle" style={{ background: COLORS[i] }} /><span className="text-muted-foreground">{b}</span><p className="tnum font-medium">{f.compact(totals[i])}</p></div>)}</div>
    </div>
  );
}
