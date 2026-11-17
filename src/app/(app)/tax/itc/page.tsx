"use client";

import * as React from "react";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable } from "@/components/shared/data-table";
import { RangeFilter } from "@/components/shared/range-picker";
import { Panel, StatCard } from "@/components/shared/stat-card";
import { SimNotice, TableSkeleton } from "@/components/shared/states";
import { TrendChart } from "@/components/charts/charts";
import { useItc } from "@/hooks/use-data";
import { useApp, useFormat } from "@/providers/app-provider";

export default function ItcPage() {
  const f = useFormat(); const { range, entity } = useApp(); const [r, setR] = React.useState<{ from: string; to: string } | null>(null); const from = r?.from ?? range.from, to = r?.to ?? range.to;
  const { data, isLoading } = useItc(from, to);
  const tot = (k: "availed" | "utilised" | "closing") => (data?.rows ?? []).reduce((s, x) => s + x[k], 0);
  return (<>
    <PageHeader title="Input Tax Credit" description="Credit availed from purchases and expenses, utilised against output tax, and the closing balance in the ledger." />
    <SimNotice className="mb-3" title="Tracking only">ITC here follows the ledger. Eligibility rules, GSTR-2B reconciliation and reversals are not simulated.</SimNotice>
    <div className="mb-3"><RangeFilter from={from} to={to} onChange={setR} fyStartMonth={entity?.fyStartMonth} /></div>
    {isLoading || !data ? <TableSkeleton /> : (<div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4"><StatCard label="ITC availed" value={f.money(tot("availed"))} /><StatCard label="ITC utilised" value={f.money(tot("utilised"))} hint="Against monthly GST payments" /><StatCard label="Closing ITC balance" value={f.money(tot("closing"))} /><StatCard label="Utilisation" value={`${tot("availed") ? Math.round((tot("utilised") / tot("availed")) * 100) : 0}%`} /></div>
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]"><Panel title="Availed vs utilised" description="Last 8 months"><TrendChart data={data.monthly} height={230} series={[{ key: "availed", label: "Availed" }, { key: "utilised", label: "Utilised", color: "var(--t-depth)" }]} /></Panel>
        <DataTable hideSearch data={data.rows} rowKey={(x) => x.accountId} columns={[{ id: "n", header: "ITC ledger", accessor: (x) => x.name }, { id: "o", header: "Opening", align: "right", accessor: (x) => x.opening, cell: (x) => f.money(x.opening) }, { id: "a", header: "Availed", align: "right", accessor: (x) => x.availed, cell: (x) => f.money(x.availed) }, { id: "u", header: "Utilised", align: "right", accessor: (x) => x.utilised, cell: (x) => f.money(x.utilised) }, { id: "c", header: "Closing", align: "right", accessor: (x) => x.closing, cell: (x) => f.money(x.closing) }]} /></div>
    </div>)}
  </>);
}
