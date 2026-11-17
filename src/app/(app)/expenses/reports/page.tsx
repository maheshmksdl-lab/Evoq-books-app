"use client";

import * as React from "react";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable, type Column } from "@/components/shared/data-table";
import { RangeFilter } from "@/components/shared/range-picker";
import { Panel, StatCard } from "@/components/shared/stat-card";
import { ErrorState, TableSkeleton } from "@/components/shared/states";
import { DonutChart, TrendChart } from "@/components/charts/charts";
import { ExportMenu } from "@/components/shared/export-menu";
import { useExpenseReport } from "@/hooks/use-data";
import { useApp, useFormat } from "@/providers/app-provider";
import { titleCase } from "@/lib/formatters";

export default function ExpenseReportsPage() {
  const f = useFormat(); const { range, entity } = useApp(); const [r, setR] = React.useState<{ from: string; to: string } | null>(null);
  const from = r?.from ?? range.from, to = r?.to ?? range.to; const { data, isLoading, error, refetch } = useExpenseReport({ from, to });
  if (error) return <ErrorState error={error as Error} onRetry={() => refetch()} />;
  type C = NonNullable<typeof data>["byCategory"][number];
  const cols: Column<C>[] = [{ id: "n", header: "Category", accessor: (c) => c.name, cell: (c) => <span className="font-medium">{c.name}</span> }, { id: "c", header: "Expenses", align: "right", accessor: (c) => c.count }, { id: "a", header: "Amount", align: "right", accessor: (c) => c.amount, cell: (c) => f.money(c.amount) }, { id: "p", header: "% of total", align: "right", accessor: (c) => (data ? (c.amount / (data.total || 1)) * 100 : 0), cell: (c) => `${data ? ((c.amount / (data.total || 1)) * 100).toFixed(1) : 0}%` }];
  return (<>
    <PageHeader title="Expense Reports" description="Spending by category, month and payment method for posted and approved expenses." actions={<ExportMenu filename="expense-report" getRows={() => [["Category", "Count", "Amount"], ...(data?.byCategory ?? []).map((c) => [c.name, c.count, c.amount])]} />} />
    <div className="mb-3"><RangeFilter from={from} to={to} onChange={setR} fyStartMonth={entity?.fyStartMonth} /></div>
    {isLoading || !data ? <TableSkeleton /> : (<div className="space-y-4">
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4"><StatCard label="Total expenses" value={f.money(data.total)} /><StatCard label="Input GST claimed" value={f.money(data.tax)} /><StatCard label="Number of expenses" value={String(data.count)} /><StatCard label="Largest category" value={data.byCategory[0]?.name ?? "—"} hint={data.byCategory[0] ? f.money(data.byCategory[0].amount) : undefined} /></div>
      <div className="grid gap-4 lg:grid-cols-[1fr_1.4fr]">
        <Panel title="By category"><DonutChart data={data.byCategory.map((c) => ({ name: c.name, value: c.amount }))} height={230} /></Panel>
        <Panel title="By month"><TrendChart data={data.byMonth} series={[{ key: "amount", label: "Expenses" }]} height={230} /></Panel>
      </div>
      <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]"><DataTable columns={cols} data={data.byCategory} rowKey={(c) => c.name} hideSearch pageSize={12} /><Panel title="By payment method" noPad><ul className="divide-y">{data.byMethod.map((m) => <li key={m.method} className="flex justify-between px-3 py-2 text-[13px]"><span>{titleCase(m.method)}</span><span className="tnum">{f.money(m.amount)}</span></li>)}</ul></Panel></div>
    </div>)}
  </>);
}
