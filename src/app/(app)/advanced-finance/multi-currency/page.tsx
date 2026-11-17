"use client";

import * as React from "react";
import { Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable, type Column } from "@/components/shared/data-table";
import { FormDialog } from "@/components/shared/form-dialog";
import { SelectField } from "@/components/shared/form-controls";
import { ErrorState, SimNotice, TableSkeleton } from "@/components/shared/states";
import { Panel, StatCard } from "@/components/shared/stat-card";
import { TrendChart } from "@/components/charts/charts";
import { useCurrencyOverview, useEntityMutation } from "@/hooks/use-data";
import { useApp, useFormat } from "@/providers/app-provider";
import { services } from "@/services";
import { fxRateSchema } from "@/lib/validators";
import { CURRENCIES, formatDate } from "@/lib/formatters";

export default function MultiCurrencyPage() {
  const f = useFormat(); const { today, currency } = useApp(); const { data, isLoading, error, refetch } = useCurrencyOverview(); const [add, setAdd] = React.useState(false); const [hist, setHist] = React.useState("");
  const addRate = useEntityMutation((e, i: { currency: string; date: string; rate: number }) => services.currency.addRate(e, i), { success: "Exchange rate saved" });
  const addCur = useEntityMutation((e, c: string) => services.currency.addCurrency(e, c), { success: (r) => `${r.currency} enabled` });
  if (error) return <ErrorState error={error as Error} onRetry={() => refetch()} />;
  if (isLoading || !data) return <TableSkeleton />;
  const sel = hist || data.currencies[0]?.currency; const series = data.history.filter((r) => r.currency === sel).sort((a, b) => a.date.localeCompare(b.date)).map((r) => ({ label: formatDate(r.date, "MMM yy"), rate: r.rate }));
  type Bal = (typeof data.rows)[number]; type Re = (typeof data.realized)[number]; type Tx = (typeof data.foreignTxns)[number];
  const balCols: Column<Bal>[] = [{ id: "k", header: "Type", accessor: (r) => r.kind }, { id: "d", header: "Document", accessor: (r) => r.docNo }, { id: "p", header: "Party", accessor: (r) => r.party, className: "max-w-[200px] truncate" }, { id: "c", header: "Currency", accessor: (r) => r.currency }, { id: "a", header: "Amount (foreign)", align: "right", accessor: (r) => r.amount, cell: (r) => f.money(r.amount, r.currency) }, { id: "b", header: `Booked (${currency})`, align: "right", accessor: (r) => r.booked, cell: (r) => f.money(r.booked) }, { id: "rv", header: "Revalued", align: "right", accessor: (r) => r.revalued, cell: (r) => f.money(r.revalued) }, { id: "u", header: "Unrealised gain / (loss)", align: "right", accessor: (r) => r.unrealized, cell: (r) => <span className={r.unrealized < 0 ? "text-error" : ""}>{f.money(r.unrealized, undefined, { parens: true })}</span>, footer: f.money(data.unrealizedTotal, undefined, { parens: true }) }];
  const reCols: Column<Re>[] = [{ id: "n", header: "Receipt / payment", accessor: (r) => r.number }, { id: "d", header: "Date", accessor: (r) => r.date, cell: (r) => formatDate(r.date) }, { id: "p", header: "Party", accessor: (r) => r.party }, { id: "c", header: "Currency", accessor: (r) => r.currency }, { id: "a", header: "Amount", align: "right", accessor: (r) => r.amount, cell: (r) => f.money(r.amount, r.currency) }, { id: "r", header: "Rate", align: "right", accessor: (r) => r.rate }, { id: "g", header: "Realised gain / (loss)", align: "right", accessor: (r) => r.gainLoss, cell: (r) => f.money(r.gainLoss, undefined, { parens: true }), footer: f.money(data.realizedTotal, undefined, { parens: true }) }];
  const txCols: Column<Tx>[] = [{ id: "k", header: "Type", accessor: (r) => r.kind }, { id: "n", header: "Number", accessor: (r) => r.number }, { id: "d", header: "Date", accessor: (r) => r.date, cell: (r) => formatDate(r.date) }, { id: "p", header: "Party", accessor: (r) => r.party, className: "max-w-[200px] truncate" }, { id: "c", header: "Currency", accessor: (r) => r.currency }, { id: "a", header: "Transaction amount", align: "right", accessor: (r) => r.amount, cell: (r) => f.money(r.amount, r.currency) }, { id: "r", header: "Rate", align: "right", accessor: (r) => r.rate }, { id: "b", header: `${currency} equivalent`, align: "right", accessor: (r) => r.base, cell: (r) => f.money(r.base) }];
  return (
    <>
      <PageHeader title="Multi-Currency" description={`Base currency ${data.base}. Exchange rates, foreign-currency balances and gain/loss previews.`} actions={<><Button variant="outline" size="sm" onClick={() => { const next = CURRENCIES.find((c) => c.code !== data.base && !data.currencies.some((x) => x.currency === c.code)); if (next) addCur.mutate(next.code); }}>Enable currency</Button><Button size="sm" onClick={() => setAdd(true)}><Plus /> Manual rate</Button></>} />
      <SimNotice className="mb-3" title="Sample rates">Reference rates are generated sample data, not live market quotes. Manual rates you enter take precedence from their effective date.</SimNotice>
      <div className="mb-3 grid grid-cols-2 gap-3 lg:grid-cols-4"><StatCard label="Base currency" value={data.base} hint="Fixed once postings exist" /><StatCard label="Foreign currencies" value={String(data.currencies.length)} hint={data.currencies.map((c) => c.currency).join(" · ")} /><StatCard label="Unrealised gain / (loss)" value={f.money(data.unrealizedTotal, undefined, { parens: true })} hint="Open foreign balances revalued" valueClassName={data.unrealizedTotal < 0 ? "text-error" : undefined} /><StatCard label="Realised gain / (loss)" value={f.money(data.realizedTotal, undefined, { parens: true })} hint="On settled receipts & payments" /></div>
      <div className="mb-4 grid gap-4 lg:grid-cols-[1fr_1.3fr]">
        <Panel title="Current rates" noPad><table className="w-full text-[13px]"><thead className="bg-muted/50 text-[11px] uppercase text-muted-foreground"><tr><th className="px-3 py-1.5 text-left">Currency</th><th className="px-3 py-1.5 text-right">Rate to {data.base}</th><th className="px-3 py-1.5 text-right">Month Δ</th><th className="px-3 py-1.5 text-left">Source</th></tr></thead><tbody>{data.currencies.map((c) => <tr key={c.currency} className="cursor-pointer border-t hover:bg-surface" onClick={() => setHist(c.currency)}><td className="px-3 py-1.5 font-medium">{c.currency}</td><td className="num px-3 py-1.5">{c.rate.toFixed(4)}</td><td className={`num px-3 py-1.5 ${c.change < 0 ? "text-error" : ""}`}>{c.change >= 0 ? "+" : ""}{c.change.toFixed(2)}%</td><td className="px-3 py-1.5 text-xs text-muted-foreground">{c.manual ? "Manual" : "Reference (sample)"}</td></tr>)}</tbody></table></Panel>
        <Panel title={`Exchange rate history – ${sel}`} actions={<div className="w-28"><SelectField size="sm" value={sel} onChange={setHist} options={data.currencies.map((c) => ({ value: c.currency, label: c.currency }))} /></div>}><TrendChart data={series} series={[{ key: "rate", label: `${sel} → ${data.base}`, type: "line" }]} height={190} currency={data.base} /></Panel>
      </div>
      <Tabs defaultValue="balances"><TabsList><TabsTrigger value="balances">Foreign balances & unrealised</TabsTrigger><TabsTrigger value="realized">Realised gain/loss</TabsTrigger><TabsTrigger value="txns">Foreign transactions</TabsTrigger><TabsTrigger value="rates">Rate list</TabsTrigger></TabsList>
        <TabsContent value="balances" className="mt-3"><DataTable columns={balCols} data={data.rows} rowKey={(r) => r.docNo} hideSearch exportName="unrealised-fx" emptyTitle="No open foreign-currency balances" /></TabsContent>
        <TabsContent value="realized" className="mt-3"><DataTable columns={reCols} data={data.realized} rowKey={(r) => r.id} hideSearch exportName="realised-fx" emptyTitle="No realised gains or losses yet" /></TabsContent>
        <TabsContent value="txns" className="mt-3"><DataTable columns={txCols} data={data.foreignTxns} rowKey={(r) => r.id} exportName="foreign-transactions" emptyTitle="No foreign-currency transactions" /></TabsContent>
        <TabsContent value="rates" className="mt-3"><DataTable columns={[{ id: "d", header: "Date", accessor: (r) => r.date, cell: (r) => formatDate(r.date) }, { id: "c", header: "Currency", accessor: (r) => r.currency }, { id: "r", header: "Rate", align: "right", accessor: (r) => r.rate, cell: (r) => r.rate.toFixed(4) }, { id: "s", header: "Source", accessor: (r) => r.source }]} data={data.history} rowKey={(r) => r.id} exportName="exchange-rates" pageSize={15} /></TabsContent></Tabs>
      <FormDialog open={add} onOpenChange={setAdd} size="sm" title="Manual exchange rate" description={`Units of ${data.base} per 1 unit of foreign currency.`} submitLabel="Save rate" schema={fxRateSchema} fields={[{ name: "currency", label: "Currency", type: "select", options: data.currencies.map((c) => ({ value: c.currency, label: c.currency })), required: true }, { name: "date", label: "Effective date", type: "date", required: true }, { name: "rate", label: "Rate", type: "number", step: 0.0001, required: true, span: 2 }]} defaultValues={{ currency: data.currencies[0]?.currency ?? "", date: today, rate: "" }} onSubmit={async (v: { currency: string; date: string; rate: number }) => { await addRate.mutateAsync({ ...v, rate: Number(v.rate) }); }} />
    </>
  );
}
