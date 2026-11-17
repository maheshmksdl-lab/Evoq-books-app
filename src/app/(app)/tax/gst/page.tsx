"use client";

import * as React from "react";
import Link from "next/link";
import { Calculator } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable, type Column } from "@/components/shared/data-table";
import { FieldShell, SelectField } from "@/components/shared/form-controls";
import { RangeFilter } from "@/components/shared/range-picker";
import { Panel, StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { Input } from "@/components/ui/input";
import { useTaxOverview, useTaxTransactions } from "@/hooks/use-data";
import { useApp, useFormat } from "@/providers/app-provider";
import { calcTax, type TaxMode } from "@/lib/accounting/tax";
import { GST_RATES } from "@/lib/constants";
import { formatDate } from "@/lib/formatters";

export default function GstPage() {
  const f = useFormat(); const { range, entity } = useApp(); const [r, setR] = React.useState<{ from: string; to: string } | null>(null); const [type, setType] = React.useState("all");
  const from = r?.from ?? range.from, to = r?.to ?? range.to; const ov = useTaxOverview(from, to); const tx = useTaxTransactions(from, to);
  const [amt, setAmt] = React.useState("100000"); const [rate, setRate] = React.useState("18"); const [mode, setMode] = React.useState<TaxMode>("exclusive"); const calc = calcTax(Number(amt) || 0, Number(rate), mode); const india = entity?.taxRegime === "india-gst";
  type T = NonNullable<typeof tx.data>[number];
  const cols: Column<T>[] = [
    { id: "d", header: "Date", accessor: (t) => t.date, cell: (t) => formatDate(t.date) }, { id: "ty", header: "Type", accessor: (t) => t.type, cell: (t) => <StatusBadge status={t.type} tone={t.type === "Output" ? "info" : "neutral"} label={t.type} /> },
    { id: "doc", header: "Document", accessor: (t) => t.docNo, cell: (t) => <Link href={t.href} className="text-primary hover:underline">{t.docNo}</Link> }, { id: "p", header: "Party", accessor: (t) => t.party, className: "max-w-[200px] truncate", hideBelow: "md" },
    { id: "tv", header: "Taxable value", align: "right", accessor: (t) => t.taxable, cell: (t) => f.money(t.taxable) },
    ...(india ? [{ id: "c", header: "CGST", align: "right" as const, accessor: (t: T) => t.cgst, cell: (t: T) => (t.cgst ? f.money(t.cgst) : ""), hideBelow: "lg" as const }, { id: "s", header: "SGST", align: "right" as const, accessor: (t: T) => t.sgst, cell: (t: T) => (t.sgst ? f.money(t.sgst) : ""), hideBelow: "lg" as const }] : []),
    { id: "i", header: india ? "IGST" : "GST", align: "right", accessor: (t) => t.igst, cell: (t) => (t.igst ? f.money(t.igst) : ""), hideBelow: "lg" }, { id: "tt", header: "Total tax", align: "right", accessor: (t) => t.tax, cell: (t) => f.money(t.tax) },
  ];
  const p = ov.data?.period;
  return (<>
    <PageHeader title="GST" description="Output and input GST by head, the tax transaction register, and a rate calculator." />
    <div className="mb-3"><RangeFilter from={from} to={to} onChange={setR} fyStartMonth={entity?.fyStartMonth} /></div>
    <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4"><StatCard label="Output GST" value={f.money(p?.outputTotal ?? 0)} /><StatCard label="Input GST (ITC)" value={f.money(p?.inputTotal ?? 0)} /><StatCard label="Net GST payable" value={f.money(p?.netPayable ?? 0, undefined, { parens: true })} /><StatCard label="Taxable sales" value={f.money(p?.taxableSales ?? 0)} /></div>
    <div className="mb-4 grid gap-4 lg:grid-cols-[1fr_340px]">
      <Panel title="GST summary by head" noPad><table className="w-full text-[13px]"><thead className="bg-muted/50 text-[11px] uppercase text-muted-foreground"><tr><th className="px-3 py-1.5 text-left">Head</th><th className="px-3 py-1.5 text-right">Output</th><th className="px-3 py-1.5 text-right">Input</th><th className="px-3 py-1.5 text-right">Net</th></tr></thead><tbody>
        {(india ? [["CGST", p?.outputCgst, p?.inputCgst], ["SGST", p?.outputSgst, p?.inputSgst], ["IGST", p?.outputIgst, p?.inputIgst]] : [["GST", p?.outputIgst, p?.inputIgst]]).map(([h, o, i]) => <tr key={String(h)} className="border-t"><td className="px-3 py-1.5">{h}</td><td className="num px-3 py-1.5">{f.money(Number(o ?? 0))}</td><td className="num px-3 py-1.5">{f.money(Number(i ?? 0))}</td><td className="num px-3 py-1.5">{f.money(Number(o ?? 0) - Number(i ?? 0), undefined, { parens: true })}</td></tr>)}
        <tr className="border-t bg-muted/40 font-semibold"><td className="px-3 py-1.5">Total</td><td className="num px-3 py-1.5">{f.money(p?.outputTotal ?? 0)}</td><td className="num px-3 py-1.5">{f.money(p?.inputTotal ?? 0)}</td><td className="num px-3 py-1.5">{f.money(p?.netPayable ?? 0, undefined, { parens: true })}</td></tr></tbody></table></Panel>
      <Panel title="Tax calculator" description="Inclusive vs exclusive"><div className="space-y-2"><div className="grid grid-cols-2 gap-2"><FieldShell label="Amount"><Input type="number" className="tnum text-right" value={amt} onChange={(e) => setAmt(e.target.value)} /></FieldShell><FieldShell label="Rate"><SelectField value={rate} onChange={setRate} options={(india ? GST_RATES : [0, 9]).map((x) => ({ value: String(x), label: `${x}%` }))} /></FieldShell></div>
        <SelectField value={mode} onChange={(v) => setMode(v as TaxMode)} options={[{ value: "exclusive", label: "Tax-exclusive (add tax)" }, { value: "inclusive", label: "Tax-inclusive (extract tax)" }]} />
        <dl className="space-y-1 rounded-md bg-surface p-2 text-[13px]"><div className="flex justify-between"><dt className="text-muted-foreground">Taxable value</dt><dd className="tnum">{f.money(calc.base)}</dd></div>{india && <div className="flex justify-between text-xs"><dt className="text-muted-foreground">CGST + SGST (intra) or IGST</dt><dd className="tnum">{f.money(calc.tax / 2)} + {f.money(calc.tax / 2)} | {f.money(calc.tax)}</dd></div>}<div className="flex justify-between"><dt className="text-muted-foreground">Tax</dt><dd className="tnum">{f.money(calc.tax)}</dd></div><div className="flex justify-between border-t pt-1 font-semibold"><dt>Total</dt><dd className="tnum">{f.money(calc.total)}</dd></div></dl>
        <p className="flex items-center gap-1 text-[11px] text-muted-foreground"><Calculator className="size-3" /> Rounded to 2 decimals (half away from zero).</p></div></Panel>
    </div>
    <DataTable columns={cols} data={(tx.data ?? []).filter((t) => type === "all" || t.type === type)} rowKey={(t) => t.type + t.id} isLoading={tx.isLoading} error={tx.error as Error | null} onRetry={() => tx.refetch()} exportName="gst-transactions" pageSize={15} defaultSort={{ id: "d", dir: "desc" }} searchPlaceholder="Search document or party…"
      filters={<SelectField size="sm" className="w-36" value={type} onChange={setType} options={[{ value: "all", label: "All" }, { value: "Output", label: "Output tax" }, { value: "Input", label: "Input tax" }]} />} />
  </>);
}
