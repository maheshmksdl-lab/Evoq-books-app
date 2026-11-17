"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import { AlertCircle, Banknote, CalendarClock, ChevronRight, LayoutGrid, Landmark, PiggyBank, Receipt, Scale, TrendingDown, TrendingUp, Wallet } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Progress } from "@/components/ui/progress";
import { Skeleton } from "@/components/ui/skeleton";
import { PageHeader } from "@/components/shared/page-header";
import { ExportMenu } from "@/components/shared/export-menu";
import { PeriodPicker } from "@/components/shared/range-picker";
import { BasisToggle, BasisNote } from "@/components/shared/basis-toggle";
import { EmptyState, ErrorState } from "@/components/shared/states";
import { Panel, StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { TrendChart } from "@/components/charts/charts";
import { useDashboard } from "@/hooks/use-data";
import { useLocalPref } from "@/hooks/use-misc";
import { useApp, useFormat } from "@/providers/app-provider";
import { formatDate, titleCase } from "@/lib/formatters";
import { monthEnd } from "@/lib/accounting/fiscal";

const WIDGETS = [
  { id: "trend", label: "Income vs expense" }, { id: "cash", label: "Cash flow overview" }, { id: "customers", label: "Outstanding customer balances" }, { id: "vendors", label: "Upcoming vendor payments" },
  { id: "recent", label: "Recent transactions" }, { id: "unrec", label: "Unreconciled bank transactions" }, { id: "tax", label: "Tax liabilities" }, { id: "fy", label: "Financial year" },
];
const pct = (cur: number, prev: number) => (prev ? ((cur - prev) / Math.abs(prev)) * 100 : NaN);

export default function DashboardPage() {
  const router = useRouter(); const { range, entity, basis } = useApp(); const f = useFormat();
  const { data: d, isLoading, error, refetch } = useDashboard(range.from, range.to, basis);
  const [hidden, setHidden] = useLocalPref<string[]>("dash-hidden", []);
  const show = (id: string) => !hidden.includes(id);
  const drill = (m: Record<string, string | number>) => { const key = String(d?.series.find((s) => s.label === m.label)?.month); router.push(`/reports/view/pnl?from=${key}-01&to=${monthEnd(`${key}-01`)}`); };

  return (
    <>
      <PageHeader title="Dashboard" description={`${entity?.name ?? ""} · figures follow the selected period; trends show the last 12 months.`}
        actions={<>
          <BasisToggle />
          <PeriodPicker />
          <Popover>
            <PopoverTrigger asChild><Button variant="outline" size="sm"><LayoutGrid /> Widgets</Button></PopoverTrigger>
            <PopoverContent align="end" className="w-64 space-y-2">
              <p className="text-sm font-medium">Dashboard widgets</p>
              {WIDGETS.map((w) => (<div key={w.id} className="flex items-center gap-2"><Checkbox id={`w-${w.id}`} checked={show(w.id)} onCheckedChange={(v) => setHidden(v ? hidden.filter((h) => h !== w.id) : [...hidden, w.id])} /><Label htmlFor={`w-${w.id}`} className="text-sm font-normal">{w.label}</Label></div>))}
              <Button variant="ghost" size="xs" onClick={() => setHidden([])}>Show all</Button>
            </PopoverContent>
          </Popover>
          <ExportMenu filename="dashboard-summary" getRows={() => d ? [["Metric", "Value"], ["Cash & bank", d.cashTotal], ["Income", d.income], ["Expenses", d.expense], ["Net profit", d.netProfit], ["Receivables", d.ar], ["Payables", d.ap]] : []} />
        </>} />
      <BasisNote />
      {error ? <ErrorState error={error as Error} onRetry={() => refetch()} /> : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 md:grid-cols-3 2xl:grid-cols-6">
            {isLoading || !d ? Array.from({ length: 6 }).map((_, i) => <Skeleton key={i} className="h-[92px]" />) : (<>
              <StatCard label="Cash & bank" value={f.money(d.cashTotal)} icon={<Wallet className="size-4" />} hint={`${d.banks.filter((b) => b.type !== "credit_card").length} accounts`} onClick={() => router.push("/banking/accounts")} />
              <StatCard label="Total income" value={f.money(d.income)} icon={<TrendingUp className="size-4" />} delta={pct(d.income, d.prevIncome)} deltaGood={d.income >= d.prevIncome} hint="vs previous period" onClick={() => router.push(`/reports/view/pnl?from=${range.from}&to=${range.to}`)} />
              <StatCard label="Total expenses" value={f.money(d.expense)} icon={<TrendingDown className="size-4" />} delta={pct(d.expense, d.prevExpense)} deltaGood={d.expense <= d.prevExpense} hint="vs previous period" onClick={() => router.push("/reports/view/expense-report")} />
              <StatCard label="Net profit" value={f.money(d.netProfit)} icon={<PiggyBank className="size-4" />} delta={pct(d.netProfit, d.prevNet)} deltaGood={d.netProfit >= d.prevNet} hint={d.income ? `${Math.round((d.netProfit / d.income) * 100)}% margin` : ""} valueClassName={d.netProfit < 0 ? "text-error" : undefined} onClick={() => router.push(`/reports/view/pnl?from=${range.from}&to=${range.to}`)} />
              <StatCard label="Accounts receivable" value={f.money(d.ar)} icon={<Receipt className="size-4" />} hint={`${f.compact(d.overdueAr)} overdue`} onClick={() => router.push("/receivables/invoices")} />
              <StatCard label="Accounts payable" value={f.money(d.ap)} icon={<Banknote className="size-4" />} hint="owed to vendors" onClick={() => router.push("/payables/bills")} />
            </>)}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {show("trend") && <Panel title="Income vs expense" description="Last 12 months · click a month to open its Profit & Loss" actions={d && <span className="text-xs text-muted-foreground">Net profit trend below</span>}>
              {!d ? <Skeleton className="h-64" /> : <>
                <TrendChart data={d.series} height={200} ariaLabel="Income versus expense by month" onPointClick={drill} series={[{ key: "income", label: "Income" }, { key: "expense", label: "Expense", color: "var(--t-depth)" }]} />
                <p className="mb-1 mt-2 text-xs font-medium text-muted-foreground">Profit & loss trend</p>
                <TrendChart data={d.series} height={90} series={[{ key: "profit", label: "Net profit", type: "area" }]} onPointClick={drill} ariaLabel="Net profit trend" />
              </>}
            </Panel>}
            {show("cash") && <Panel title="Cash flow overview" description="Cash inflow, outflow and closing balance by month" actions={<Link href="/reports/view/cash-flow" className="text-xs text-primary hover:underline">Cash flow statement →</Link>}>
              {!d ? <Skeleton className="h-64" /> : <TrendChart data={d.series} height={304} ariaLabel="Cash flow overview" series={[{ key: "inflow", label: "Inflow" }, { key: "outflow", label: "Outflow", color: "var(--t-soft)" }, { key: "cash", label: "Closing cash", type: "line", color: "var(--t-depth)" }]} />}
            </Panel>}
          </div>

          <div className="grid gap-4 lg:grid-cols-2">
            {show("customers") && <Panel title="Outstanding customer balances" noPad actions={<Link href="/receivables/invoices" className="text-xs text-primary hover:underline">All receivables →</Link>}>
              {!d ? <Skeleton className="m-3 h-40" /> : d.topCustomers.length === 0 ? <EmptyState title="No outstanding balances" description="Every customer invoice is settled." /> : (
                <ul className="divide-y">{d.topCustomers.map((c) => (
                  <li key={c.id}><Link href={`/receivables/customers/${c.id}`} className="flex items-center gap-3 px-3 py-2 hover:bg-surface">
                    <div className="min-w-0 flex-1"><p className="truncate text-[13px] font-medium">{c.name}</p>{c.overdue > 0 && <p className="text-[11px] text-error">{f.money(c.overdue)} overdue</p>}</div>
                    <span className="tnum text-[13px] font-medium">{f.money(c.amount)}</span><ChevronRight className="size-4 text-muted-foreground" />
                  </Link></li>))}</ul>)}
            </Panel>}
            {show("vendors") && <Panel title="Upcoming vendor payments" noPad actions={<Link href="/payables/bills" className="text-xs text-primary hover:underline">All bills →</Link>}>
              {!d ? <Skeleton className="m-3 h-40" /> : d.upcoming.length === 0 ? <EmptyState title="No payments due" /> : (
                <ul className="divide-y">{d.upcoming.map((b) => (
                  <li key={b.id}><Link href={`/payables/bills/${b.id}`} className="flex items-center gap-3 px-3 py-2 hover:bg-surface">
                    <div className="min-w-0 flex-1"><p className="truncate text-[13px] font-medium">{b.vendor}</p><p className="text-[11px] text-muted-foreground">{b.number} · due {formatDate(b.dueDate)}</p></div>
                    {b.overdue && <StatusBadge status="overdue" />}<span className="tnum text-[13px] font-medium">{f.money(b.amount)}</span>
                  </Link></li>))}</ul>)}
            </Panel>}
          </div>

          <div className="grid gap-4 lg:grid-cols-3">
            {show("recent") && <Panel title="Recent transactions" noPad className="lg:col-span-1" actions={<Link href="/accounting/journals" className="text-xs text-primary hover:underline">Journals →</Link>}>
              {!d ? <Skeleton className="m-3 h-40" /> : <ul className="divide-y">{d.recent.map((j) => (
                <li key={j.id}><Link href={`/accounting/journals/${j.id}`} className="flex items-center gap-2 px-3 py-1.5 hover:bg-surface"><div className="min-w-0 flex-1"><p className="truncate text-[13px]">{j.description}</p><p className="text-[11px] text-muted-foreground">{formatDate(j.date)} · {j.number} · {titleCase(j.kind)}</p></div><span className="tnum text-[13px]">{f.money(j.amount)}</span></Link></li>))}</ul>}
            </Panel>}
            {show("unrec") && <Panel title="Unreconciled bank transactions" noPad actions={<Link href="/banking/reconciliation" className="text-xs text-primary hover:underline">Reconcile →</Link>}>
              {!d ? <Skeleton className="m-3 h-40" /> : (<>
                <div className="flex items-center gap-3 border-b bg-surface/60 px-3 py-2"><Landmark className="size-4 text-primary" /><p className="text-sm"><span className="font-semibold">{d.unreconciled.count}</span> lines · <span className="tnum font-semibold">{f.money(d.unreconciled.value)}</span></p></div>
                {d.unreconciled.items.length === 0 ? <EmptyState title="All reconciled" /> : <ul className="divide-y">{d.unreconciled.items.map((t) => <li key={t.id} className="flex items-center gap-2 px-3 py-1.5"><div className="min-w-0 flex-1"><p className="truncate text-[13px]">{t.description}</p><p className="text-[11px] text-muted-foreground">{formatDate(t.date)}</p></div><span className={`tnum text-[13px] ${t.deposit ? "" : "text-muted-foreground"}`}>{t.deposit ? "+" : "−"}{f.money(t.deposit || t.withdrawal)}</span></li>)}</ul>}
              </>)}
            </Panel>}
            <div className="space-y-4">
              {show("tax") && <Panel title="Tax liabilities" actions={<Link href="/tax/overview" className="text-xs text-primary hover:underline">Tax →</Link>}>
                {!d ? <Skeleton className="h-28" /> : <dl className="space-y-1.5 text-[13px]">
                  <div className="flex justify-between"><dt className="text-muted-foreground">GST payable (output)</dt><dd className="tnum">{f.money(d.tax.gst)}</dd></div>
                  <div className="flex justify-between"><dt className="text-muted-foreground">Input tax credit</dt><dd className="tnum">− {f.money(d.tax.itc)}</dd></div>
                  <div className="flex justify-between border-t pt-1.5 font-semibold"><dt>Net GST payable</dt><dd className="tnum">{f.money(d.tax.net)}</dd></div>
                  <div className="flex justify-between"><dt className="text-muted-foreground">TDS payable</dt><dd className="tnum">{f.money(d.tax.tds)}</dd></div>
                </dl>}
              </Panel>}
              {show("fy") && <Panel title="Financial year">
                {!d ? <Skeleton className="h-24" /> : <div className="space-y-2">
                  <div className="flex items-center justify-between"><span className="text-sm font-semibold">{d.fy.label}</span><span className="text-xs text-muted-foreground">{formatDate(d.fy.start, "dd MMM yy")} – {formatDate(d.fy.end, "dd MMM yy")}</span></div>
                  <Progress value={d.fy.elapsed} aria-label="Financial year elapsed" /><p className="text-xs text-muted-foreground">{d.fy.elapsed}% elapsed · {d.fy.closedPeriods} periods closed · {d.fy.openPeriods} open</p>
                  <Link href="/accounting/periods" className="inline-flex items-center gap-1 text-xs text-primary hover:underline"><CalendarClock className="size-3" /> Manage periods</Link>
                </div>}
              </Panel>}
            </div>
          </div>
          {d && d.unreconciled.count > 0 && <div className="tone-warning flex items-center gap-2 rounded-lg border px-3 py-2 text-xs"><AlertCircle className="size-4" /> {d.unreconciled.count} bank lines are unreconciled — figures here come from the books, not the statements. <Link className="font-medium underline" href="/banking/reconciliation">Open reconciliation</Link></div>}
          <p className="flex items-center gap-1 text-[11px] text-muted-foreground"><Scale className="size-3" /> Every figure is calculated from the same journal data used in the ledger and reports — click any card or chart point to drill down.</p>
        </div>
      )}
    </>
  );
}
