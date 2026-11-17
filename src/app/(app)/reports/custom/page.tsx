"use client";

import * as React from "react";
import { Play, Save, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable, type Column } from "@/components/shared/data-table";
import { FieldShell, SelectField } from "@/components/shared/form-controls";
import { RangeFilter } from "@/components/shared/range-picker";
import { Panel } from "@/components/shared/stat-card";
import { TrendChart } from "@/components/charts/charts";
import { useAccountSummary, useAccounts } from "@/hooks/use-data";
import { useLocalPref } from "@/hooks/use-misc";
import { useApp, useFormat } from "@/providers/app-provider";
import { titleCase } from "@/lib/formatters";

interface Saved { id: string; name: string; types: string[]; measure: string; from?: string; to?: string; hideZero: boolean }

export default function CustomReportsPage() {
  const f = useFormat(); const { range, entity } = useApp(); const accounts = useAccounts().data ?? [];
  const [types, setTypes] = React.useState<string[]>(["income", "expense"]); const [measure, setMeasure] = React.useState("closing"); const [r, setR] = React.useState(range); const [hideZero, setHideZero] = React.useState(true); const [group, setGroup] = React.useState("account"); const [name, setName] = React.useState("");
  const [saved, setSaved] = useLocalPref<Saved[]>("custom-reports", []); const [run, setRun] = React.useState(true);
  const { data, isLoading } = useAccountSummary({ from: r.from, to: r.to });
  type Row = { key: string; label: string; debit: number; credit: number; closing: number; opening: number };
  const rows: Row[] = React.useMemo(() => {
    const src = (data ?? []).filter((x) => types.includes(x.type) && (!hideZero || Math.abs(x.closing) + x.debit + x.credit > 0.005));
    if (group === "account") return src.map((x) => ({ key: x.accountId, label: `${x.code} · ${x.name}`, debit: x.debit, credit: x.credit, closing: x.closing, opening: x.opening }));
    const by = new Map<string, Row>();
    src.forEach((x) => { const acc = accounts.find((a) => a.id === x.accountId); const k = group === "type" ? titleCase(x.type) : acc?.group ?? "Other"; const cur = by.get(k) ?? { key: k, label: k, debit: 0, credit: 0, closing: 0, opening: 0 }; cur.debit += x.debit; cur.credit += x.credit; cur.closing += x.closing; cur.opening += x.opening; by.set(k, cur); });
    return [...by.values()];
  }, [data, types, hideZero, group, accounts]);
  const cols: Column<Row>[] = [{ id: "l", header: group === "account" ? "Account" : titleCase(group), accessor: (x) => x.label }, { id: "o", header: "Opening", align: "right", accessor: (x) => x.opening, cell: (x) => f.money(x.opening, undefined, { parens: true }) }, { id: "d", header: "Debits", align: "right", accessor: (x) => x.debit, cell: (x) => f.money(x.debit) }, { id: "c", header: "Credits", align: "right", accessor: (x) => x.credit, cell: (x) => f.money(x.credit) }, { id: "cl", header: "Closing", align: "right", accessor: (x) => x.closing, cell: (x) => f.money(x.closing, undefined, { parens: true }) }];
  const toggle = (t: string) => setTypes((s) => (s.includes(t) ? s.filter((x) => x !== t) : [...s, t]));
  const chartData = rows.slice(0, 12).map((x) => ({ label: x.label.slice(0, 18), value: Math.abs(measure === "debit" ? x.debit : measure === "credit" ? x.credit : x.closing) }));
  return (
    <>
      <PageHeader title="Custom Reports" description="Build an ad-hoc report over the shared dataset: pick account types, grouping, period and measure." />
      <div className="grid gap-4 xl:grid-cols-[320px_1fr]">
        <div className="space-y-4">
          <Panel title="Report builder"><div className="space-y-3">
            <FieldShell label="Account types"><div className="grid grid-cols-2 gap-1.5">{["asset", "liability", "equity", "income", "expense"].map((t) => <label key={t} className="flex items-center gap-1.5 text-sm"><Checkbox checked={types.includes(t)} onCheckedChange={() => toggle(t)} />{titleCase(t)}</label>)}</div></FieldShell>
            <FieldShell label="Group by"><SelectField value={group} onChange={setGroup} options={[{ value: "account", label: "Account" }, { value: "group", label: "Account group" }, { value: "type", label: "Account type" }]} /></FieldShell>
            <FieldShell label="Chart measure"><SelectField value={measure} onChange={setMeasure} options={[{ value: "closing", label: "Closing balance" }, { value: "debit", label: "Debits" }, { value: "credit", label: "Credits" }]} /></FieldShell>
            <FieldShell label="Period"><RangeFilter from={r.from} to={r.to} onChange={setR} fyStartMonth={entity?.fyStartMonth} /></FieldShell>
            <div className="flex items-center gap-2"><Checkbox id="hz" checked={hideZero} onCheckedChange={(v) => setHideZero(!!v)} /><Label htmlFor="hz" className="font-normal">Hide zero-balance rows</Label></div>
            <div className="flex gap-2"><Button size="sm" onClick={() => setRun(true)}><Play /> Run</Button></div>
          </div></Panel>
          <Panel title="Saved reports" description="Stored in this browser">
            <div className="mb-2 flex gap-2"><input value={name} onChange={(e) => setName(e.target.value)} placeholder="Report name" className="h-8 min-w-0 flex-1 rounded-lg border border-input bg-transparent px-2 text-sm" aria-label="Report name" /><Button size="sm" variant="outline" disabled={!name.trim()} onClick={() => { setSaved([...saved, { id: String(Date.now()), name: name.trim(), types, measure, from: r.from, to: r.to, hideZero }]); setName(""); }}><Save /> Save</Button></div>
            {saved.length === 0 ? <p className="text-xs text-muted-foreground">No saved reports yet.</p> : <ul className="space-y-1">{saved.map((s) => <li key={s.id} className="flex items-center gap-1 rounded border px-2 py-1 text-sm"><button className="min-w-0 flex-1 truncate text-left text-primary hover:underline" onClick={() => { setTypes(s.types); setMeasure(s.measure); setHideZero(s.hideZero); if (s.from && s.to) setR({ from: s.from, to: s.to }); setRun(true); }}>{s.name}</button><Button size="icon-xs" variant="ghost" aria-label="Delete saved report" onClick={() => setSaved(saved.filter((x) => x.id !== s.id))}><Trash2 /></Button></li>)}</ul>}
          </Panel>
        </div>
        <div className="space-y-4">
          {run && <Panel title="Chart" description={`Top 12 by ${measure}`}><TrendChart data={chartData} series={[{ key: "value", label: titleCase(measure) }]} height={220} /></Panel>}
          <DataTable columns={cols} data={rows} rowKey={(x) => x.key} isLoading={isLoading} exportName="custom-report" pageSize={15} searchPlaceholder="Filter rows…" emptyTitle="No rows" emptyDescription="Select at least one account type." />
        </div>
      </div>
    </>
  );
}
