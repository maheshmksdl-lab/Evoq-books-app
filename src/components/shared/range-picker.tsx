"use client";

import * as React from "react";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { RANGE_PRESETS, rangeFromPreset } from "@/lib/accounting/fiscal";
import { formatDate } from "@/lib/formatters";
import { useApp } from "@/providers/app-provider";
import { DateField } from "./form-controls";

/** Global period picker bound to the app's active period (shared by dashboard & reports). */
export function PeriodPicker({ compact }: { compact?: boolean }) {
  const { preset, setPreset, range } = useApp();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select value={preset} onValueChange={(v) => setPreset(v, range.from, range.to)}>
        <SelectTrigger size="sm" className={compact ? "w-40" : "w-48"} aria-label="Period"><SelectValue /></SelectTrigger>
        <SelectContent>{RANGE_PRESETS.map((p) => <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>)}</SelectContent>
      </Select>
      {preset === "custom" ? (
        <>
          <div className="w-36"><DateField value={range.from} onChange={(v) => setPreset("custom", v, range.to < v ? v : range.to)} /></div>
          <span className="text-xs text-muted-foreground">to</span>
          <div className="w-36"><DateField value={range.to} min={range.from} onChange={(v) => setPreset("custom", range.from, v)} /></div>
        </>
      ) : <span className="tnum text-xs text-muted-foreground">{formatDate(range.from)} – {formatDate(range.to)}</span>}
    </div>
  );
}

/** Local from/to filter with presets, for pages that need their own range. */
export function RangeFilter({ from, to, onChange, fyStartMonth = 4 }: { from: string; to: string; onChange: (r: { from: string; to: string }) => void; fyStartMonth?: number }) {
  const { today } = useApp();
  return (
    <div className="flex flex-wrap items-center gap-2">
      <Select onValueChange={(v) => v !== "custom" && onChange(rangeFromPreset(v, today, fyStartMonth))}>
        <SelectTrigger size="sm" className="w-40" aria-label="Quick range"><SelectValue placeholder="Quick range" /></SelectTrigger>
        <SelectContent>{RANGE_PRESETS.filter((p) => p.id !== "custom").map((p) => <SelectItem key={p.id} value={p.id}>{p.label}</SelectItem>)}</SelectContent>
      </Select>
      <div className="w-36"><DateField value={from} max={to} onChange={(v) => onChange({ from: v, to })} /></div>
      <span className="text-xs text-muted-foreground">to</span>
      <div className="w-36"><DateField value={to} min={from} onChange={(v) => onChange({ from, to: v })} /></div>
    </div>
  );
}
