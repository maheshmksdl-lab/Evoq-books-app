"use client";

import * as React from "react";
import Link from "next/link";
import { Landmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DataTable, type Column } from "@/components/shared/data-table";
import { SelectField } from "@/components/shared/form-controls";
import { ErrorState, TableSkeleton } from "@/components/shared/states";
import { StatusBadge } from "@/components/shared/status-badge";
import { StatCard } from "@/components/shared/stat-card";
import { AgeingBar } from "@/components/features/ageing";
import { JournalDrawer } from "@/components/features/journal-view";
import { ExpandControls, FilterBar, ReportFrame, ReportTable, groupIds, nodesToRows, periodLabel, useReportFilters, type RRow } from "@/components/features/report-parts";
import { useAccountSummary, useApAgeing, useArAgeing, useBalanceSheet, useBankReconReport, useCashFlow, useJournalReport, usePnl, useTaxSummaryReport, useTrialBalance } from "@/hooks/use-data";
import { useUrlParams } from "@/hooks/use-misc";
import { useApp, useFormat } from "@/providers/app-provider";
import { AGE_BUCKETS, type ReportNode } from "@/lib/accounting/engine";
import { formatDate, titleCase } from "@/lib/formatters";

const useCollapsed = () => { const [c, setC] = React.useState<Set<string>>(new Set()); return { collapsed: c, toggle: (k: string) => setC((s) => { const n = new Set(s); n.has(k) ? n.delete(k) : n.add(k); return n; }), set: setC }; };

// -------------------------------------------------------------------------------- Profit & Loss
export function PnlView() {
  const p = useUrlParams(); const { filters, state, set } = useReportFilters({ from: p?.get("from"), to: p?.get("to") });
  const { data, isLoading, error, refetch } = usePnl({ from: filters.from, to: filters.to, ...(filters.compare ? { compareFrom: filters.compareFrom, compareTo: filters.compareTo } : {}) });
  const c = useCollapsed(); const [hideZero] = [true];
  if (error) return <ErrorState error={error as Error} onRetry={() => refetch()} />;
  const cur = data?.current, prev = data?.previous ?? null;
  const rows: RRow[] = [];
  if (cur) {
    const add = (n: ReportNode | null, pn: ReportNode | null) => rows.push(...nodesToRows(n, pn, c.collapsed));
    const sub = (key: string, label: string, a: number, b: number | undefined, kind: RRow["kind"] = "subtotal") => rows.push({ key, label, depth: 0, amount: a, prev: b, kind });
    add(cur.revenue, prev?.revenue ?? null); add(cur.cogs, prev?.cogs ?? null); sub("gp", "Gross profit", cur.grossProfit, prev?.grossProfit);
    add(cur.opex, prev?.opex ?? null); sub("ebitda", "Operating profit (before depreciation)", cur.ebitda, prev?.ebitda); add(cur.depreciation, prev?.depreciation ?? null); add(cur.otherIncome, prev?.otherIncome ?? null); add(cur.finance, prev?.finance ?? null);
    sub("net", "Net profit / (loss)", cur.netProfit, prev?.netProfit, "total");
  }
  const all = cur ? [cur.revenue, cur.cogs, cur.opex, cur.depreciation, cur.otherIncome, cur.finance].flatMap(groupIds) : [];
  void hideZero;
  return (
    <ReportFrame title="Profit and Loss" subtitle={periodLabel(filters.from, filters.to)} exportName="profit-and-loss" getRows={() => [["Account", "Amount", ...(filters.compare ? ["Previous"] : [])], ...rows.map((r) => [r.label, r.amount, ...(filters.compare ? [r.prev ?? ""] : [])])]}
      actions={cur && <span className="hidden text-xs text-muted-foreground sm:inline">Net margin {cur.totalRevenue ? ((cur.netProfit / cur.totalRevenue) * 100).toFixed(1) : 0}%</span>}>
      <div className="no-print p-3 pb-0"><FilterBar state={state} set={set} /></div>
      <ExpandControls onExpand={() => c.set(new Set())} onCollapse={() => c.set(new Set(all))} />
      {isLoading || !cur ? <TableSkeleton /> : <ReportTable rows={rows} compare={filters.compare} collapsed={c.collapsed} onToggle={c.toggle} from={filters.from} to={filters.to} percentOfFirst={cur.totalRevenue} labels={[periodLabel(filters.from, filters.to), periodLabel(filters.compareFrom, filters.compareTo)]} />}
    </ReportFrame>
  );
}

// -------------------------------------------------------------------------------- Balance sheet
export function BalanceSheetView() {
  const p = useUrlParams(); const { filters, state, set } = useReportFilters({ to: p?.get("to"), from: p?.get("to") });
  const { data, isLoading, error, refetch } = useBalanceSheet({ asOf: filters.asOf, ...(filters.compare ? { compareAsOf: filters.compareTo } : {}) });
  const c = useCollapsed(); const f = useFormat();
  if (error) return <ErrorState error={error as Error} onRetry={() => refetch()} />;
  const cur = data?.current, prev = data?.previous ?? null; const rows: RRow[] = [];
  if (cur) {
    const tot = (key: string, label: string, a: number, b?: number): RRow => ({ key, label, depth: 0, amount: a, prev: b, kind: "total" });
    rows.push(...nodesToRows(cur.assets, prev?.assets ?? null, c.collapsed), tot("ta", "Total assets", cur.totalAssets, prev?.totalAssets), ...nodesToRows(cur.liabilities, prev?.liabilities ?? null, c.collapsed), ...nodesToRows(cur.equity, prev?.equity ?? null, c.collapsed), tot("tle", "Total liabilities & equity", cur.totalLiabilities + cur.totalEquity, prev ? prev.totalLiabilities + prev.totalEquity : undefined));
  }
  const all = cur ? [cur.assets, cur.liabilities, cur.equity].flatMap(groupIds) : [];
  return (
    <ReportFrame title="Balance Sheet" subtitle={`As of ${formatDate(filters.asOf)}`} exportName="balance-sheet" getRows={() => [["Account", "Amount"], ...rows.map((r) => [r.label, r.amount])]}>
      <div className="no-print p-3 pb-0"><FilterBar state={state} set={set} mode="asof" /></div>
      <ExpandControls onExpand={() => c.set(new Set())} onCollapse={() => c.set(new Set(all))} />
      {isLoading || !cur ? <TableSkeleton /> : <>
        <ReportTable rows={rows} compare={filters.compare} collapsed={c.collapsed} onToggle={c.toggle} labels={[formatDate(filters.asOf), formatDate(filters.compareTo)]} />
        <div className={`mx-4 my-3 rounded-md border px-3 py-2 text-xs ${cur.balanced ? "tone-success" : "tone-error"}`}>{cur.balanced ? "Balanced — assets equal liabilities plus equity." : `Out of balance by ${f.money(cur.totalAssets - cur.totalLiabilities - cur.totalEquity)}`} Retained earnings (prior periods) and current-period earnings are computed from the ledger.</div></>}
    </ReportFrame>
  );
}

// -------------------------------------------------------------------------------- Cash flow
export function CashFlowView() {
  const f = useFormat(); const { filters, state, set } = useReportFilters(); const { data, isLoading, error, refetch } = useCashFlow({ from: filters.from, to: filters.to });
  if (error) return <ErrorState error={error as Error} onRetry={() => refetch()} />;
  const sections = data ? [["Operating activities", data.operating, data.operatingTotal], ["Investing activities", data.investing, data.investingTotal], ["Financing activities", data.financing, data.financingTotal]] as const : [];
  return (
    <ReportFrame title="Cash Flow Statement" subtitle={`${periodLabel(filters.from, filters.to)} · indirect method`} exportName="cash-flow" getRows={() => [["Line", "Amount"], ...sections.flatMap(([t, l, tot]) => [[t, ""], ...l.map((x) => [x.label, x.amount]), [`Net cash — ${t}`, tot]])]}>
      <div className="no-print p-3 pb-0"><FilterBar state={{ ...state, compare: false }} set={set} /></div>
      {isLoading || !data ? <TableSkeleton /> : (
        <Table><TableBody>
          {sections.map(([title, lines, total]) => (
            <React.Fragment key={title}>
              <TableRow className="bg-surface"><TableCell colSpan={2} className="py-1.5 text-[13px] font-semibold">{title}</TableCell></TableRow>
              {lines.map((l, i) => <TableRow key={i} className="h-8"><TableCell className="py-1 pl-8 text-[13px]">{l.accountId ? <Link className="hover:underline" href={`/accounting/general-ledger?account=${l.accountId}&from=${filters.from}&to=${filters.to}`}>{l.label}</Link> : l.label}</TableCell><TableCell className="num py-1 text-[13px]">{f.money(l.amount, undefined, { parens: true })}</TableCell></TableRow>)}
              {lines.length === 0 && <TableRow><TableCell colSpan={2} className="py-1 pl-8 text-xs text-muted-foreground">No movements</TableCell></TableRow>}
              <TableRow className="bg-muted/40"><TableCell className="py-1.5 text-[13px] font-semibold">Net cash from {title.split(" ")[0].toLowerCase()} activities</TableCell><TableCell className="num py-1.5 text-[13px] font-semibold">{f.money(total, undefined, { parens: true })}</TableCell></TableRow>
            </React.Fragment>))}
          <TableRow className="border-t-2 bg-accent/60"><TableCell className="py-2 text-[13px] font-semibold">Net increase / (decrease) in cash</TableCell><TableCell className="num py-2 text-[13px] font-semibold">{f.money(data.netChange, undefined, { parens: true })}</TableCell></TableRow>
          <TableRow><TableCell className="py-1.5 text-[13px]">Cash and bank at beginning of period</TableCell><TableCell className="num py-1.5 text-[13px]">{f.money(data.openingCash)}</TableCell></TableRow>
          <TableRow className="bg-accent/60"><TableCell className="py-2 text-[13px] font-semibold">Cash and bank at end of period</TableCell><TableCell className="num py-2 text-[13px] font-semibold">{f.money(data.closingCash)}</TableCell></TableRow>
        </TableBody>
          <TableFooter><TableRow><TableCell colSpan={2} className={`text-xs ${Math.abs(data.difference) < 0.01 ? "text-[color-mix(in_srgb,var(--s-success)_55%,black)]" : "text-error"}`}>{Math.abs(data.difference) < 0.01 ? "✓ Opening cash + net change = closing cash (reconciles to the bank and cash ledgers)." : `Unreconciled difference ${f.money(data.difference)}`}</TableCell></TableRow></TableFooter></Table>)}
    </ReportFrame>
  );
}

// -------------------------------------------------------------------------------- Trial balance
export function TrialBalanceView() {
  const f = useFormat(); const { filters, state, set } = useReportFilters(); const [type, setType] = React.useState("all"); const { data, isLoading, error, refetch } = useTrialBalance(filters.asOf);
  if (error) return <ErrorState error={error as Error} onRetry={() => refetch()} />;
  const rows = (data?.rows ?? []).filter((r) => type === "all" || r.type === type);
  type R = (typeof rows)[number];
  const cols: Column<R>[] = [{ id: "c", header: "Code", accessor: (r) => r.code, className: "tnum w-20 text-muted-foreground" }, { id: "n", header: "Account", accessor: (r) => r.name, cell: (r) => (r.synthetic ? <span className="italic">{r.name}</span> : <Link className="hover:text-primary hover:underline" href={`/accounting/general-ledger?account=${r.accountId}`}>{r.name}</Link>) }, { id: "t", header: "Type", accessor: (r) => r.type, cell: (r) => <span className="capitalize">{r.type}</span>, hideBelow: "md" }, { id: "d", header: "Debit", align: "right", accessor: (r) => r.debit, cell: (r) => (r.debit ? f.money(r.debit) : "") , footer: f.money(rows.reduce((s, r) => s + r.debit, 0)) }, { id: "cr", header: "Credit", align: "right", accessor: (r) => r.credit, cell: (r) => (r.credit ? f.money(r.credit) : ""), footer: f.money(rows.reduce((s, r) => s + r.credit, 0)) }];
  return (
    <ReportFrame title="Trial Balance" subtitle={`As of ${formatDate(filters.asOf)}`} exportName="trial-balance" getRows={() => [["Code", "Account", "Debit", "Credit"], ...rows.map((r) => [r.code, r.name, r.debit, r.credit])]}>
      <div className="no-print p-3 pb-0"><FilterBar state={{ ...state, compare: false }} set={set} mode="asof"><div className="w-36"><p className="mb-1 text-[11px] font-medium text-muted-foreground">Account type</p><SelectField size="sm" value={type} onChange={setType} options={[{ value: "all", label: "All" }, ...["asset", "liability", "equity", "income", "expense"].map((t) => ({ value: t, label: titleCase(t) }))]} /></div></FilterBar></div>
      <DataTable bare hideSearch columns={cols} data={rows} rowKey={(r) => r.accountId} isLoading={isLoading} pageSize={100} />
      {data && <p className={`mx-4 mb-3 rounded-md border px-3 py-2 text-xs ${Math.abs(data.totalDebit - data.totalCredit) < 0.01 ? "tone-success" : "tone-error"}`}>{Math.abs(data.totalDebit - data.totalCredit) < 0.01 ? `✓ Debits equal credits (${f.money(data.totalDebit)}).` : `Debits and credits differ by ${f.money(data.totalDebit - data.totalCredit)}`}</p>}
    </ReportFrame>
  );
}

// -------------------------------------------------------------------------------- Account summary
export function AccountSummaryView() {
  const f = useFormat(); const { filters, state, set } = useReportFilters(); const [type, setType] = React.useState("all"); const { data, isLoading, error, refetch } = useAccountSummary({ from: filters.from, to: filters.to });
  if (error) return <ErrorState error={error as Error} onRetry={() => refetch()} />;
  const rows = (data ?? []).filter((r) => type === "all" || r.type === type); type R = (typeof rows)[number];
  const cols: Column<R>[] = [{ id: "c", header: "Code", accessor: (r) => r.code, className: "tnum w-16 text-muted-foreground" }, { id: "n", header: "Account", accessor: (r) => r.name, cell: (r) => <Link className="hover:text-primary hover:underline" href={`/accounting/general-ledger?account=${r.accountId}&from=${filters.from}&to=${filters.to}`}>{r.name}</Link> }, { id: "t", header: "Type", accessor: (r) => r.type, hideBelow: "md", cell: (r) => <span className="capitalize">{r.type}</span> },
    { id: "o", header: "Opening", align: "right", accessor: (r) => r.opening, cell: (r) => f.money(r.opening, undefined, { parens: true }) }, { id: "d", header: "Debits", align: "right", accessor: (r) => r.debit, cell: (r) => f.money(r.debit), footer: f.money(rows.reduce((s, r) => s + r.debit, 0)) }, { id: "cr", header: "Credits", align: "right", accessor: (r) => r.credit, cell: (r) => f.money(r.credit), footer: f.money(rows.reduce((s, r) => s + r.credit, 0)) }, { id: "cl", header: "Closing", align: "right", accessor: (r) => r.closing, cell: (r) => f.money(r.closing, undefined, { parens: true }) }];
  return (
    <ReportFrame title="Account Summary" subtitle={periodLabel(filters.from, filters.to)} exportName="account-summary" getRows={() => [["Code", "Account", "Opening", "Debits", "Credits", "Closing"], ...rows.map((r) => [r.code, r.name, r.opening, r.debit, r.credit, r.closing])]}>
      <div className="no-print p-3 pb-0"><FilterBar state={{ ...state, compare: false }} set={set}><div className="w-36"><p className="mb-1 text-[11px] font-medium text-muted-foreground">Account type</p><SelectField size="sm" value={type} onChange={setType} options={[{ value: "all", label: "All" }, ...["asset", "liability", "equity", "income", "expense"].map((t) => ({ value: t, label: titleCase(t) }))]} /></div></FilterBar></div>
      <DataTable bare columns={cols} data={rows} rowKey={(r) => r.accountId} isLoading={isLoading} pageSize={25} searchPlaceholder="Filter accounts…" />
    </ReportFrame>
  );
}

// -------------------------------------------------------------------------------- Ageing
export function AgeingView({ kind }: { kind: "ar" | "ap" }) {
  const f = useFormat(); const { today } = useApp(); const [asOf, setAsOf] = React.useState(today); const ar = useArAgeing(asOf), ap = useApAgeing(asOf); const q = kind === "ar" ? ar : ap; const { data, isLoading, error, refetch } = q;
  const [open, setOpen] = React.useState<string | null>(null);
  if (error) return <ErrorState error={error as Error} onRetry={() => refetch()} />;
  const title = kind === "ar" ? "Accounts Receivable Ageing" : "Accounts Payable Ageing";
  return (
    <ReportFrame title={title} subtitle={`As of ${formatDate(asOf)} · by due date · base currency`} exportName={kind === "ar" ? "receivables-ageing" : "payables-ageing"} getRows={() => [[kind === "ar" ? "Customer" : "Vendor", ...AGE_BUCKETS, "Total"], ...(data?.rows ?? []).map((r) => [r.name, ...r.buckets, r.total])]}>
      <div className="no-print p-3"><div className="w-44"><p className="mb-1 text-[11px] font-medium text-muted-foreground">As of</p><input type="date" value={asOf} max={today} onChange={(e) => e.target.value && setAsOf(e.target.value)} className="h-8 w-full rounded-lg border border-input bg-transparent px-2 text-sm" aria-label="As of date" /></div></div>
      {isLoading || !data ? <TableSkeleton /> : <>
        <div className="px-4 pb-3"><AgeingBar totals={data.totals} /></div>
        <div className="scroll-thin overflow-x-auto"><Table><TableHeader className="bg-muted/50"><TableRow><TableHead className="text-[11px] uppercase">{kind === "ar" ? "Customer" : "Vendor"}</TableHead>{AGE_BUCKETS.map((b) => <TableHead key={b} className="text-right text-[11px] uppercase">{b === "Current" ? "Current" : `${b} days`}</TableHead>)}<TableHead className="text-right text-[11px] uppercase">Total</TableHead></TableRow></TableHeader>
          <TableBody>{data.rows.map((r) => (<React.Fragment key={r.partyId}>
            <TableRow className="h-8 cursor-pointer" onClick={() => setOpen(open === r.partyId ? null : r.partyId)}><TableCell className="py-1 text-[13px] font-medium">{r.name}</TableCell>{r.buckets.map((b, i) => <TableCell key={i} className={`num py-1 text-[13px] ${i >= 3 && b ? "text-error" : ""}`}>{b ? f.money(b) : "—"}</TableCell>)}<TableCell className="num py-1 text-[13px] font-semibold">{f.money(r.total)}</TableCell></TableRow>
            {open === r.partyId && r.items.map((it) => <TableRow key={it.id} className="bg-surface/60"><TableCell className="py-1 pl-8 text-xs"><Link className="text-primary hover:underline" href={kind === "ar" ? `/receivables/invoices/${it.id}` : `/payables/bills/${it.id}`}>{it.number}</Link> <span className="text-muted-foreground">· due {formatDate(it.dueDate)}</span></TableCell><TableCell colSpan={5} /><TableCell className="num py-1 text-xs">{f.money(it.outstanding)}</TableCell></TableRow>)}</React.Fragment>))}</TableBody>
          <TableFooter><TableRow><TableCell className="font-semibold">Total</TableCell>{data.totals.map((t, i) => <TableCell key={i} className="num font-semibold">{f.money(t)}</TableCell>)}<TableCell className="num font-semibold">{f.money(data.total)}</TableCell></TableRow></TableFooter></Table></div>
        <p className="px-4 py-2 text-[11px] text-muted-foreground">Click a row to expand its documents. Totals agree to the {kind === "ar" ? "Accounts Receivable" : "Accounts Payable"} control account before unapplied credit notes (intercompany balances are reported separately).</p></>}
    </ReportFrame>
  );
}

// -------------------------------------------------------------------------------- Tax summary
export function TaxSummaryView() {
  const f = useFormat(); const { entity } = useApp(); const { filters, state, set } = useReportFilters(); const { data, isLoading, error, refetch } = useTaxSummaryReport(filters.from, filters.to); const india = entity?.taxRegime === "india-gst";
  if (error) return <ErrorState error={error as Error} onRetry={() => refetch()} />;
  const rows = data ? [...(india ? [["CGST", data.outputCgst, data.inputCgst], ["SGST", data.outputSgst, data.inputSgst]] : []), [india ? "IGST" : "GST", data.outputIgst, data.inputIgst]] as [string, number, number][] : [];
  return (
    <ReportFrame title="Tax Summary" subtitle={periodLabel(filters.from, filters.to)} exportName="tax-summary" getRows={() => [["Head", "Output", "Input", "Net"], ...rows.map(([h, o, i]) => [h, o, i, o - i])]}>
      <div className="no-print p-3 pb-0"><FilterBar state={{ ...state, compare: false }} set={set} /></div>
      {isLoading || !data ? <TableSkeleton /> : <><div className="grid grid-cols-2 gap-3 p-4 lg:grid-cols-4"><StatCard label="Taxable sales" value={f.money(data.taxableSales)} /><StatCard label="Taxable purchases" value={f.money(data.taxablePurchases)} /><StatCard label="Output tax" value={f.money(data.outputTotal)} /><StatCard label="Input tax credit" value={f.money(data.inputTotal)} /></div>
        <Table><TableHeader className="bg-muted/50"><TableRow><TableHead>Tax head</TableHead><TableHead className="text-right">Output tax</TableHead><TableHead className="text-right">Input tax</TableHead><TableHead className="text-right">Net payable / (credit)</TableHead></TableRow></TableHeader>
          <TableBody>{rows.map(([h, o, i]) => <TableRow key={h}><TableCell className="py-1.5">{h}</TableCell><TableCell className="num py-1.5">{f.money(o)}</TableCell><TableCell className="num py-1.5">{f.money(i)}</TableCell><TableCell className="num py-1.5">{f.money(o - i, undefined, { parens: true })}</TableCell></TableRow>)}</TableBody>
          <TableFooter><TableRow><TableCell>Total</TableCell><TableCell className="num">{f.money(data.outputTotal)}</TableCell><TableCell className="num">{f.money(data.inputTotal)}</TableCell><TableCell className="num">{f.money(data.netPayable, undefined, { parens: true })}</TableCell></TableRow></TableFooter></Table></>}
    </ReportFrame>
  );
}

// -------------------------------------------------------------------------------- Bank reconciliation
export function BankReconView() {
  const f = useFormat(); const { today } = useApp(); const { data, isLoading, error, refetch } = useBankReconReport(today);
  if (error) return <ErrorState error={error as Error} onRetry={() => refetch()} />;
  return (
    <ReportFrame title="Bank Reconciliation" subtitle={`As of ${formatDate(today)}`} exportName="bank-reconciliation" getRows={() => [["Account", "Statement", "Books", "Difference", "Statement-only", "Outstanding book"], ...(data ?? []).map((s) => [s.bank.name, s.statementClosing, s.bookClosing, s.difference, s.bankOnlyNet, s.bookOnlyNet])]}>
      {isLoading || !data ? <TableSkeleton /> : <div className="space-y-4 p-4">{data.map((s) => (
        <div key={s.bank.id} className="rounded-lg border">
          <div className="flex items-center justify-between border-b bg-muted/40 px-3 py-2"><p className="flex items-center gap-2 text-sm font-semibold"><Landmark className="size-4 text-primary" />{s.bank.name}</p><div className="flex items-center gap-2"><StatusBadge status={s.unresolvedCount === 0 ? "reconciled" : "difference"} label={s.unresolvedCount === 0 ? "Resolved" : `${s.unresolvedCount} to resolve`} /><Button variant="outline" size="xs" asChild><Link href={`/banking/reconciliation?account=${s.bank.id}`}>Open workspace</Link></Button></div></div>
          <dl className="grid grid-cols-2 gap-3 p-3 text-[13px] md:grid-cols-5"><div><dt className="text-[11px] uppercase text-muted-foreground">Statement</dt><dd className="tnum font-medium">{f.money(s.statementClosing)}</dd></div><div><dt className="text-[11px] uppercase text-muted-foreground">Books</dt><dd className="tnum font-medium">{f.money(s.bookClosing)}</dd></div><div><dt className="text-[11px] uppercase text-muted-foreground">Difference</dt><dd className="tnum font-medium">{f.money(s.difference, undefined, { parens: true })}</dd></div><div><dt className="text-[11px] uppercase text-muted-foreground">Statement-only</dt><dd className="tnum">{f.money(s.bankOnlyNet, undefined, { parens: true })} <span className="text-xs text-muted-foreground">({s.bankOnly.length})</span></dd></div><div><dt className="text-[11px] uppercase text-muted-foreground">Outstanding book</dt><dd className="tnum">{f.money(s.bookOnlyNet, undefined, { parens: true })} <span className="text-xs text-muted-foreground">({s.bookOnly.length})</span></dd></div></dl>
          {(s.bankOnly.length > 0 || s.bookOnly.length > 0) && <div className="grid gap-px border-t bg-border md:grid-cols-2"><ul className="bg-card p-2 text-xs"><li className="mb-1 font-semibold">On statement, not in books</li>{s.bankOnly.slice(0, 6).map((t) => <li key={t.id} className="flex justify-between gap-2 py-0.5"><span className="truncate">{formatDate(t.date, "dd MMM")} · {t.description}</span><span className="tnum">{f.money(t.deposit - t.withdrawal, undefined, { parens: true })}</span></li>)}</ul><ul className="bg-card p-2 text-xs"><li className="mb-1 font-semibold">In books, not on statement</li>{s.bookOnly.slice(0, 6).map((l) => <li key={l.lineId} className="flex justify-between gap-2 py-0.5"><span className="truncate">{formatDate(l.date, "dd MMM")} · {l.description}</span><span className="tnum">{f.money(l.debit - l.credit, undefined, { parens: true })}</span></li>)}{s.bookOnly.length === 0 && <li className="text-muted-foreground">None</li>}</ul></div>}
        </div>))}</div>}
    </ReportFrame>
  );
}

// -------------------------------------------------------------------------------- Journal report
export function JournalReportView() {
  const f = useFormat(); const { filters, state, set } = useReportFilters(); const [kind, setKind] = React.useState("all"); const [open, setOpen] = React.useState<string | null>(null);
  const { data, isLoading, error, refetch } = useJournalReport({ from: filters.from, to: filters.to, kind }); type R = NonNullable<typeof data>[number];
  const cols: Column<R>[] = [{ id: "n", header: "Journal #", accessor: (j) => j.number, className: "tnum" }, { id: "d", header: "Date", accessor: (j) => j.date, cell: (j) => formatDate(j.date) }, { id: "desc", header: "Description", accessor: (j) => j.description, className: "max-w-[320px] truncate" }, { id: "t", header: "Type", accessor: (j) => titleCase(j.kind), hideBelow: "md" }, { id: "s", header: "Source", accessor: (j) => j.sourceRef, hideBelow: "lg" }, { id: "st", header: "Status", accessor: (j) => j.status, cell: (j) => <StatusBadge status={j.status} /> }, { id: "a", header: "Amount", align: "right", accessor: (j) => j.amount, cell: (j) => f.money(j.amount), footer: f.money((data ?? []).reduce((s, j) => s + j.amount, 0)) }];
  return (
    <ReportFrame title="Journal Report" subtitle={periodLabel(filters.from, filters.to)} exportName="journal-report" getRows={() => [["Number", "Date", "Description", "Type", "Status", "Amount"], ...(data ?? []).map((j) => [j.number, j.date, j.description, j.kind, j.status, j.amount])]}>
      <div className="no-print p-3 pb-0"><FilterBar state={{ ...state, compare: false }} set={set}><div className="w-40"><p className="mb-1 text-[11px] font-medium text-muted-foreground">Type</p><SelectField size="sm" value={kind} onChange={setKind} options={["all", "manual", "invoice", "bill", "receipt", "payment", "expense", "bank", "depreciation", "payroll", "tax", "adjustment", "reversal"].map((k) => ({ value: k, label: k === "all" ? "All types" : titleCase(k) }))} /></div></FilterBar></div>
      <DataTable bare columns={cols} data={data ?? []} rowKey={(j) => j.id} isLoading={isLoading} error={error as Error | null} onRetry={() => refetch()} onRowClick={(j) => setOpen(j.id)} pageSize={20} searchPlaceholder="Search journals…" />
      <JournalDrawer journalId={open} onClose={() => setOpen(null)} />
    </ReportFrame>
  );
}
