"use client";

import * as React from "react";
import { AlertTriangle, ArrowDownLeft, ArrowUpRight } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Panel, StatCard } from "@/components/shared/stat-card";
import { SelectField } from "@/components/shared/form-controls";
import { ErrorState, TableSkeleton } from "@/components/shared/states";
import { TrendChart } from "@/components/charts/charts";
import { AiBadge, AiDisclaimer } from "@/components/features/ai-parts";
import { useCashInsights } from "@/hooks/use-data";
import { useFormat } from "@/providers/app-provider";
import { formatDate } from "@/lib/formatters";
import { cn } from "@/lib/utils";

export default function InsightsPage() {
  const f = useFormat(); const [days, setDays] = React.useState("90"); const { data, isLoading, error, refetch } = useCashInsights(Number(days));
  if (error) return <ErrorState error={error as Error} onRetry={() => refetch()} />;
  const chart = (data?.points ?? []).filter((_, i) => i % Math.max(1, Math.floor(Number(days) / 45)) === 0).map((p) => ({ label: p.label, balance: p.balance, baseline: p.baseline }));
  return (
    <>
      <PageHeader title="Cash Flow Insights" description="Current cash position, expected inflows and outflows, and a projected balance." actions={<div className="w-36"><SelectField size="sm" value={days} onChange={setDays} options={[{ value: "30", label: "Next 30 days" }, { value: "60", label: "Next 60 days" }, { value: "90", label: "Next 90 days" }]} /></div>} />
      <AiDisclaimer>The projection combines open receivables/payables due dates, recurring payroll/GST/EMI patterns and recent run-rates. It is a simulation to demonstrate the experience — not a financial forecast.</AiDisclaimer>
      {isLoading || !data ? <TableSkeleton rows={8} /> : (
        <div className="space-y-4">
          {data.warnings.map((w, i) => <div key={i} className={cn("flex items-start gap-2 rounded-lg border px-3 py-2 text-sm", w.level === "error" ? "tone-error" : "tone-warning")}><AlertTriangle className="mt-0.5 size-4 shrink-0" /><p>{w.text}</p></div>)}
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5"><StatCard label="Current cash position" value={f.money(data.start)} /><StatCard label={`Projected in ${days} days`} value={f.money(data.end)} delta={data.start ? ((data.end - data.start) / data.start) * 100 : undefined} deltaGood={data.end >= data.start} /><StatCard label="Lowest projected" value={f.money(data.low.balance)} hint={formatDate(data.low.date)} valueClassName={data.low.balance < data.threshold ? "text-[color-mix(in_srgb,var(--s-warning)_50%,black)]" : undefined} /><StatCard label="Receivables impact" value={`+ ${f.compact(data.receivablesImpact)}`} hint={`avg ${data.avgDelay >= 0 ? "+" : ""}${data.avgDelay}d vs due`} /><StatCard label="Payables impact" value={`− ${f.compact(data.payablesImpact)}`} hint="open bills" /></div>
          <Panel title="Projected cash balance" description="Solid: with run-rate sales/costs · Dashed: known invoices & bills only" actions={<AiBadge>Simulation</AiBadge>}>
            <TrendChart data={chart} height={280} refY={data.threshold} ariaLabel="Projected cash balance" series={[{ key: "balance", label: "Projected balance", type: "area" }, { key: "baseline", label: "Known items only", type: "line", color: "var(--t-depth)", dashed: true }]} />
            <p className="mt-1 text-[11px] text-muted-foreground">Amber line = low-cash warning level ({f.money(data.threshold)}).</p>
          </Panel>
          <div className="grid gap-4 lg:grid-cols-2">
            <Panel title="Upcoming inflows (30 days)" noPad actions={<ArrowDownLeft className="size-4 text-success" />}>{data.upcomingIn.length === 0 ? <p className="p-3 text-xs text-muted-foreground">No expected inflows.</p> : <ul className="divide-y">{data.upcomingIn.map((x, i) => <li key={i} className="flex items-center justify-between gap-2 px-3 py-1.5 text-[13px]"><span className="min-w-0"><span className="block truncate">{x.label}</span><span className="text-[11px] text-muted-foreground">{formatDate(x.date)} · {x.source}</span></span><span className="tnum text-[color-mix(in_srgb,var(--s-success)_55%,black)]">+ {f.money(x.amount)}</span></li>)}</ul>}</Panel>
            <Panel title="Upcoming outflows (30 days)" noPad actions={<ArrowUpRight className="size-4 text-error" />}>{data.upcomingOut.length === 0 ? <p className="p-3 text-xs text-muted-foreground">No expected outflows.</p> : <ul className="divide-y">{data.upcomingOut.map((x, i) => <li key={i} className="flex items-center justify-between gap-2 px-3 py-1.5 text-[13px]"><span className="min-w-0"><span className="block truncate">{x.label}</span><span className="text-[11px] text-muted-foreground">{formatDate(x.date)} · {x.source}</span></span><span className="tnum">− {f.money(x.amount)}</span></li>)}</ul>}</Panel>
          </div>
        </div>)}
    </>
  );
}
