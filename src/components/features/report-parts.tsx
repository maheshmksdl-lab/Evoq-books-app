"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight, ChevronsDownUp, ChevronsUpDown, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/shared/page-header";
import { ExportMenu } from "@/components/shared/export-menu";
import { DateField, SelectField } from "@/components/shared/form-controls";
import { useFiscalYears } from "@/hooks/use-data";
import { useApp, useFormat } from "@/providers/app-provider";
import { formatDate } from "@/lib/formatters";
import { addDaysISO, daysBetween } from "@/lib/accounting/fiscal";
import type { ReportNode } from "@/lib/accounting/engine";
import { cn } from "@/lib/utils";

export interface RRow { key: string; label: string; code?: string; depth: number; amount: number; prev?: number; accountId?: string; kind: "group" | "line" | "subtotal" | "total"; synthetic?: boolean }

export function nodesToRows(node: ReportNode | null, prev: ReportNode | null, collapsed: Set<string>, depth = 0): RRow[] {
  if (!node) return [];
  const prevMap = new Map<string, number>(); const walk = (n: ReportNode | null) => n && (prevMap.set(n.id, n.amount), n.children?.forEach(walk)); walk(prev);
  const out: RRow[] = [];
  const go = (n: ReportNode, d: number) => {
    out.push({ key: n.id, label: n.label, code: n.code === "—" ? undefined : n.code, depth: d, amount: n.amount, prev: prev ? prevMap.get(n.id) ?? 0 : undefined, accountId: n.accountId, kind: n.isGroup ? "group" : "line", synthetic: n.synthetic });
    if (n.isGroup && !collapsed.has(n.id)) n.children?.forEach((c) => go(c, d + 1));
  };
  go(node, depth); return out;
}
/** Collect group ids so the viewer can expand/collapse all. */
export function groupIds(node: ReportNode | null): string[] { if (!node) return []; return node.isGroup ? [node.id, ...(node.children ?? []).flatMap(groupIds)] : []; }

export function ReportTable({ rows, compare, collapsed, onToggle, from, to, labels = ["Amount", "Previous"], percentOfFirst }: { rows: RRow[]; compare?: boolean; collapsed: Set<string>; onToggle: (k: string) => void; from?: string; to?: string; labels?: [string, string]; percentOfFirst?: number }) {
  const f = useFormat();
  return (
    <div className="scroll-thin overflow-x-auto">
      <Table>
        <TableHeader className="bg-muted/50"><TableRow><TableHead className="text-[11px] uppercase">Account</TableHead><TableHead className="text-right text-[11px] uppercase">{labels[0]}</TableHead>{percentOfFirst !== undefined && <TableHead className="hidden w-20 text-right text-[11px] uppercase md:table-cell">% rev.</TableHead>}{compare && <><TableHead className="text-right text-[11px] uppercase">{labels[1]}</TableHead><TableHead className="text-right text-[11px] uppercase">Change</TableHead><TableHead className="hidden w-20 text-right text-[11px] uppercase md:table-cell">%</TableHead></>}</TableRow></TableHeader>
        <TableBody>
          {rows.map((r) => {
            const bold = r.kind === "group" || r.kind === "subtotal" || r.kind === "total"; const delta = r.prev !== undefined ? r.amount - r.prev : undefined;
            const drill = r.accountId && r.kind === "line" ? `/accounting/general-ledger?account=${r.accountId}${from ? `&from=${from}` : ""}${to ? `&to=${to}` : ""}` : undefined;
            return (
              <TableRow key={r.key} className={cn("h-8", r.kind === "total" && "border-t-2 bg-accent/60", r.kind === "subtotal" && "bg-muted/40", r.kind === "group" && r.depth === 0 && "bg-surface")}>
                <TableCell className={cn("py-1 text-[13px]", bold && "font-semibold")}>
                  <span className="flex items-center gap-1" style={{ paddingLeft: r.depth * 18 }}>
                    {r.kind === "group" ? <button type="button" aria-label={collapsed.has(r.key) ? "Expand" : "Collapse"} aria-expanded={!collapsed.has(r.key)} onClick={() => onToggle(r.key)} className="rounded p-0.5 hover:bg-muted">{collapsed.has(r.key) ? <ChevronRight className="size-3.5" /> : <ChevronDown className="size-3.5" />}</button> : <span className="w-[18px]" />}
                    {r.code && <span className="tnum mr-1 text-[11px] font-normal text-muted-foreground">{r.code}</span>}
                    {drill ? <Link href={drill} className="hover:text-primary hover:underline" title="Drill down to ledger">{r.label}</Link> : <span className={cn(r.synthetic && "italic text-muted-foreground")}>{r.label}</span>}
                  </span>
                </TableCell>
                <TableCell className={cn("num py-1 text-[13px]", bold && "font-semibold")}>{f.money(r.amount, undefined, { parens: true })}</TableCell>
                {percentOfFirst !== undefined && <TableCell className="num hidden py-1 text-xs text-muted-foreground md:table-cell">{percentOfFirst ? `${((r.amount / percentOfFirst) * 100).toFixed(1)}%` : ""}</TableCell>}
                {compare && <><TableCell className={cn("num py-1 text-[13px] text-muted-foreground", bold && "font-semibold")}>{r.prev !== undefined ? f.money(r.prev, undefined, { parens: true }) : ""}</TableCell><TableCell className="num py-1 text-[13px]">{delta !== undefined ? f.money(delta, undefined, { parens: true }) : ""}</TableCell><TableCell className="num hidden py-1 text-xs text-muted-foreground md:table-cell">{delta !== undefined && r.prev ? `${((delta / Math.abs(r.prev)) * 100).toFixed(1)}%` : ""}</TableCell></>}
              </TableRow>);
          })}
        </TableBody>
      </Table>
    </div>
  );
}

export interface ReportFilters { from: string; to: string; compare: boolean; compareFrom: string; compareTo: string; asOf: string }

/** Shared filter state: financial-year picker, custom dates and an optional comparative period. */
export function useReportFilters(init?: { from?: string | null; to?: string | null }) {
  const { range, today } = useApp();
  const [f, setF] = React.useState<{ from: string; to: string; compare: boolean; compareMode: "prev" | "prevfy" }>({ from: init?.from ?? range.from, to: init?.to ?? range.to, compare: false, compareMode: "prev" });
  React.useEffect(() => { if (init?.from && init?.to) setF((s) => ({ ...s, from: init.from!, to: init.to! })); }, [init?.from, init?.to]);
  const span = daysBetween(f.from, f.to) + 1;
  const compareTo = f.compareMode === "prev" ? addDaysISO(f.from, -1) : addDaysISO(f.to, -365), compareFrom = f.compareMode === "prev" ? addDaysISO(f.from, -span) : addDaysISO(f.from, -365);
  const filters: ReportFilters = { from: f.from, to: f.to, compare: f.compare, compareFrom, compareTo, asOf: f.to > today ? today : f.to };
  return { filters, set: (p: Partial<typeof f>) => setF((s) => ({ ...s, ...p })), state: f };
}

export function FilterBar({ state, set, mode = "range", children, extra }: { state: { from: string; to: string; compare: boolean; compareMode: "prev" | "prevfy" }; set: (p: Partial<{ from: string; to: string; compare: boolean; compareMode: "prev" | "prevfy" }>) => void; mode?: "range" | "asof"; children?: React.ReactNode; extra?: React.ReactNode }) {
  const { data: fys } = useFiscalYears(); const { today } = useApp();
  return (
    <div className="no-print mb-3 flex flex-wrap items-end gap-2 rounded-lg border bg-card p-2">
      <div className="w-44"><p className="mb-1 text-[11px] font-medium text-muted-foreground">Financial year</p><SelectField size="sm" placeholder="Custom range" value={(fys ?? []).find((x) => x.start === state.from && (x.end === state.to || state.to === today))?.id ?? ""} onChange={(id) => { const fy = fys?.find((x) => x.id === id); if (fy) set({ from: fy.start, to: fy.end > today ? today : fy.end }); }} options={(fys ?? []).map((x) => ({ value: x.id, label: x.label }))} /></div>
      {mode === "range" && <div className="w-36"><p className="mb-1 text-[11px] font-medium text-muted-foreground">From</p><DateField value={state.from} max={state.to} onChange={(v) => set({ from: v })} /></div>}
      <div className="w-36"><p className="mb-1 text-[11px] font-medium text-muted-foreground">{mode === "asof" ? "As of" : "To"}</p><DateField value={state.to} min={mode === "range" ? state.from : undefined} onChange={(v) => set({ to: v })} /></div>
      {children}
      <label className="flex items-center gap-1.5 pb-1.5 text-xs"><Checkbox checked={state.compare} onCheckedChange={(v) => set({ compare: !!v })} /> Compare</label>
      {state.compare && <div className="w-40"><p className="mb-1 text-[11px] font-medium text-muted-foreground">Compare with</p><SelectField size="sm" value={state.compareMode} onChange={(v) => set({ compareMode: v as "prev" | "prevfy" })} options={[{ value: "prev", label: "Previous period" }, { value: "prevfy", label: "Same period last year" }]} /></div>}
      {extra}
    </div>
  );
}

export function ReportFrame({ title, subtitle, exportName, getRows, actions, children, simulated = true }: { title: string; subtitle?: string; exportName: string; getRows: () => (string | number | null | undefined)[][]; actions?: React.ReactNode; children: React.ReactNode; simulated?: boolean }) {
  const { entity } = useApp();
  return (
    <>
      <PageHeader title={title} description={subtitle} trail={[{ label: title }]} actions={<>{actions}<Button variant="outline" size="sm" onClick={() => window.print()}><Printer /> Print</Button><ExportMenu filename={exportName} getRows={getRows} /></>} />
      <div className="print-area rounded-lg border bg-card shadow-[0_1px_0_rgba(31,36,48,0.03)]">
        <div className="border-b px-4 py-3 text-center"><p className="text-xs uppercase tracking-[0.14em] text-muted-foreground">{entity?.legalName}</p><h2 className="text-base font-semibold">{title}</h2>{subtitle && <p className="text-xs text-muted-foreground">{subtitle}</p>}</div>
        {children}
        {simulated && <p className="border-t px-4 py-2 text-[10px] text-muted-foreground">Generated from sample data in EVOQ Books (frontend demonstration). Not an audited statement.</p>}
      </div>
    </>
  );
}

export const periodLabel = (from: string, to: string) => `${formatDate(from)} – ${formatDate(to)}`;

export function ExpandControls({ onExpand, onCollapse }: { onExpand: () => void; onCollapse: () => void }) {
  return <div className="no-print flex gap-1 border-b px-3 py-1.5"><Button variant="ghost" size="xs" onClick={onExpand}><ChevronsUpDown /> Expand all</Button><Button variant="ghost" size="xs" onClick={onCollapse}><ChevronsDownUp /> Collapse all</Button></div>;
}
