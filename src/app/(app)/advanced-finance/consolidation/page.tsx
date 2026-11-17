"use client";

import * as React from "react";
import { Layers, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable, type Column } from "@/components/shared/data-table";
import { FormDialog } from "@/components/shared/form-dialog";
import { SelectField } from "@/components/shared/form-controls";
import { RangeFilter } from "@/components/shared/range-picker";
import { ErrorState, SimNotice, TableSkeleton } from "@/components/shared/states";
import { Panel, StatCard } from "@/components/shared/stat-card";
import { ExportMenu } from "@/components/shared/export-menu";
import { useEntityMutation, useEntityQuery } from "@/hooks/use-data";
import { useApp, useFormat } from "@/providers/app-provider";
import { services } from "@/services";
import { CURRENCIES, formatDate } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { z } from "zod";

type Cons = Awaited<ReturnType<typeof services.consolidation.run>>;

function ConsTable({ rows, entities, currency }: { rows: Cons["pnl"]; entities: Cons["entities"]; currency: string }) {
  const f = useFormat();
  return (
    <div className="scroll-thin overflow-x-auto"><Table>
      <TableHeader className="bg-muted/50"><TableRow><TableHead className="text-[11px] uppercase">Line</TableHead>{entities.map((e) => <TableHead key={e.id} className="text-right text-[11px] uppercase">{e.name.split(" ").slice(0, 2).join(" ")}<span className="block text-[10px] font-normal normal-case">{e.baseCurrency} → {currency}</span></TableHead>)}<TableHead className="text-right text-[11px] uppercase">Eliminations</TableHead><TableHead className="text-right text-[11px] uppercase">Adjustments</TableHead><TableHead className="text-right text-[11px] uppercase">Consolidated</TableHead></TableRow></TableHeader>
      <TableBody>{rows.map((r) => <TableRow key={r.key} className={cn("h-8", r.kind === "total" && "border-t-2 bg-accent/60 font-semibold", r.kind === "subtotal" && "bg-muted/40 font-semibold")}><TableCell className="py-1 text-[13px]" style={{ paddingLeft: 12 + r.depth * 16 }}>{r.label}</TableCell>{entities.map((e) => <TableCell key={e.id} className="num py-1 text-[13px]">{r.values[e.id] !== undefined ? f.money(r.values[e.id], currency, { parens: true }) : "—"}</TableCell>)}<TableCell className="num py-1 text-[13px] text-muted-foreground">{r.elimination ? f.money(r.elimination, currency, { parens: true }) : "—"}</TableCell><TableCell className="num py-1 text-[13px] text-muted-foreground">{r.adjustment ? f.money(r.adjustment, currency, { parens: true }) : "—"}</TableCell><TableCell className="num py-1 text-[13px] font-semibold">{f.money(r.consolidated, currency, { parens: true })}</TableCell></TableRow>)}</TableBody>
    </Table></div>
  );
}

export default function ConsolidationPage() {
  const f = useFormat(); const { entities, entity, range } = useApp(); const [ids, setIds] = React.useState<string[]>([]); const [cur, setCur] = React.useState(""); const [r, setR] = React.useState<{ from: string; to: string } | null>(null); const [adj, setAdj] = React.useState(false);
  React.useEffect(() => { if (!ids.length && entities.length) { setIds(entities.map((e) => e.id)); setCur(entities.find((e) => e.role === "parent")?.baseCurrency ?? entities[0].baseCurrency); } }, [entities, ids.length]);
  const from = r?.from ?? range.from, to = r?.to ?? range.to;
  const q = useEntityQuery(["consolidation", ids.join(","), cur, from, to], (e) => services.consolidation.run(e, { entityIds: ids, from, to, currency: cur }), { enabled: ids.length > 1 && !!cur });
  const addAdj = useEntityMutation((e, i: { description: string; section: "revenue" | "cogs" | "opex" | "other" | "finance"; amount: number }) => services.consolidation.addAdjustment(e, i), { success: "Consolidation adjustment added" });
  const delAdj = useEntityMutation((e, id: string) => services.consolidation.removeAdjustment(e, id), { success: "Adjustment removed" });
  const d = q.data; type Ic = NonNullable<typeof d>["intercompany"][number];
  const icCols: Column<Ic>[] = [{ id: "d", header: "Date", accessor: (x) => x.date, cell: (x) => formatDate(x.date) }, { id: "f", header: "Seller", accessor: (x) => x.from }, { id: "t", header: "Buyer", accessor: (x) => x.to }, { id: "df", header: "Seller doc", accessor: (x) => x.docFrom }, { id: "dt", header: "Buyer doc", accessor: (x) => x.docTo }, { id: "a", header: "Amount", align: "right", accessor: (x) => x.amount, cell: (x) => f.money(x.amount, x.currency) }, { id: "o", header: "Open", align: "right", accessor: (x) => x.open, cell: (x) => f.money(x.open, x.currency) }, { id: "sv", header: "Seller (translated)", align: "right", accessor: (x) => x.seller, cell: (x) => f.money(x.seller, cur) }, { id: "bv", header: "Buyer (translated)", align: "right", accessor: (x) => x.buyer, cell: (x) => f.money(x.buyer, cur) }];
  return (
    <>
      <PageHeader title="Consolidated Financial Statements" description="Combine entities, translate to a presentation currency and eliminate intercompany balances." actions={<ExportMenu filename="consolidation" getRows={() => [["Line", ...(d?.entities.map((e) => e.name) ?? []), "Eliminations", "Adjustments", "Consolidated"], ...(d?.pnl ?? []).map((r) => [r.label, ...(d?.entities.map((e) => r.values[e.id] ?? "") ?? []), r.elimination, r.adjustment, r.consolidated])]} disabled={!d} />} />
      <SimNotice className="mb-3" title="Simulated consolidation">Translation uses sample average / closing rates and a computed currency-translation reserve. It illustrates the workflow and is not an audit-grade consolidation.</SimNotice>
      <div className="mb-3 flex flex-wrap items-end gap-4 rounded-lg border bg-card p-3">
        <div><p className="mb-1 text-[11px] font-medium text-muted-foreground">Entities</p><div className="flex flex-wrap gap-3">{entities.map((e) => <label key={e.id} className="flex items-center gap-1.5 text-sm"><Checkbox checked={ids.includes(e.id)} onCheckedChange={(v) => setIds((s) => (v ? [...s, e.id] : s.filter((x) => x !== e.id)))} />{e.name} <span className="text-xs text-muted-foreground">({e.baseCurrency})</span></label>)}</div></div>
        <div className="w-40"><p className="mb-1 text-[11px] font-medium text-muted-foreground">Presentation currency</p><SelectField size="sm" value={cur} onChange={setCur} options={CURRENCIES.map((c) => ({ value: c.code, label: c.code }))} /></div>
        <div><p className="mb-1 text-[11px] font-medium text-muted-foreground">Consolidation period</p><RangeFilter from={from} to={to} onChange={setR} fyStartMonth={entity?.fyStartMonth} /></div>
      </div>
      {ids.length < 2 ? <p className="tone-warning rounded-md border px-3 py-2 text-sm">Select at least two entities to consolidate.</p> : q.error ? <ErrorState error={q.error as Error} onRetry={() => q.refetch()} /> : q.isLoading || !d ? <TableSkeleton rows={8} /> : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4"><StatCard label="Consolidated revenue" value={f.money(d.pnl.find((r) => r.key === "revenue")!.consolidated, cur)} /><StatCard label="Consolidated net profit" value={f.money(d.netProfit, cur, { parens: true })} /><StatCard label="Intercompany eliminated" value={f.money(d.eliminations[0]?.amount ?? 0, cur)} hint={`${d.intercompany.length} transactions`} /><StatCard label="Adjustments" value={String(d.adjustments.length)} hint="manual, simulated" /></div>
          <Tabs defaultValue="pnl"><TabsList><TabsTrigger value="pnl">Profit & Loss</TabsTrigger><TabsTrigger value="bs">Balance Sheet</TabsTrigger><TabsTrigger value="cf">Cash Flow</TabsTrigger><TabsTrigger value="ic">Intercompany ({d.intercompany.length})</TabsTrigger><TabsTrigger value="elim">Eliminations & adjustments</TabsTrigger></TabsList>
            <TabsContent value="pnl" className="mt-3"><Panel noPad title="Consolidated Profit and Loss" description={`${formatDate(from)} – ${formatDate(to)} · ${cur}`}><ConsTable rows={d.pnl} entities={d.entities} currency={cur} /></Panel></TabsContent>
            <TabsContent value="bs" className="mt-3"><Panel noPad title="Consolidated Balance Sheet" description={`As of ${formatDate(to)} at closing rates · ${cur}`}><ConsTable rows={d.balanceSheet} entities={d.entities} currency={cur} /></Panel></TabsContent>
            <TabsContent value="cf" className="mt-3"><Panel noPad title="Consolidated Cash Flow" description={`${formatDate(from)} – ${formatDate(to)} · ${cur}`}><ConsTable rows={d.cashFlow} entities={d.entities} currency={cur} /></Panel></TabsContent>
            <TabsContent value="ic" className="mt-3"><DataTable columns={icCols} data={d.intercompany} rowKey={(x) => x.docFrom} hideSearch emptyTitle="No intercompany transactions in this period" exportName="intercompany" /></TabsContent>
            <TabsContent value="elim" className="mt-3 space-y-4">
              <Panel title="Elimination entry preview" noPad><Table><TableHeader><TableRow><TableHead>Description</TableHead><TableHead>Debit</TableHead><TableHead>Credit</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader><TableBody>{d.eliminations.length === 0 ? <TableRow><TableCell colSpan={4} className="py-6 text-center text-xs text-muted-foreground">No intercompany activity in the selected period.</TableCell></TableRow> : d.eliminations.map((x) => <TableRow key={x.id}><TableCell className="py-1.5 text-[13px]">{x.description}</TableCell><TableCell className="py-1.5 text-[13px]">{x.debit}</TableCell><TableCell className="py-1.5 text-[13px]">{x.credit}</TableCell><TableCell className="num py-1.5 text-[13px]">{f.money(x.amount, cur)}</TableCell></TableRow>)}</TableBody></Table></Panel>
              <Panel title="Consolidation adjustments" actions={<Button size="xs" onClick={() => setAdj(true)}><Plus /> Add adjustment</Button>} noPad>
                {d.adjustments.length === 0 ? <p className="p-3 text-xs text-muted-foreground">No manual adjustments.</p> : <ul className="divide-y">{d.adjustments.map((a) => <li key={a.id} className="flex items-center gap-2 px-3 py-2 text-[13px]"><span className="min-w-0 flex-1">{a.description} <span className="text-xs text-muted-foreground">· {a.section} · {a.createdBy}</span></span><span className="tnum">{f.money(a.amount, cur, { parens: true })}</span><Button variant="ghost" size="icon-xs" aria-label="Remove adjustment" onClick={() => delAdj.mutate(a.id)}><Trash2 /></Button></li>)}</ul>}</Panel>
            </TabsContent></Tabs>
        </div>)}
      <FormDialog open={adj} onOpenChange={setAdj} size="sm" title="Consolidation adjustment" description="Positive amounts increase the selected line; negative amounts reduce it. Effects flow to consolidated net profit." submitLabel="Add" schema={z.object({ description: z.string().min(1, "Describe the adjustment"), section: z.enum(["revenue", "cogs", "opex", "other", "finance"]), amount: z.coerce.number().refine((v) => v !== 0, "Enter a non-zero amount") })}
        fields={[{ name: "description", label: "Description", required: true, span: 2 }, { name: "section", label: "P&L line", type: "select", options: [{ value: "revenue", label: "Operating revenue" }, { value: "cogs", label: "Cost of goods sold" }, { value: "opex", label: "Operating expenses" }, { value: "other", label: "Other income" }, { value: "finance", label: "Finance costs" }] }, { name: "amount", label: `Amount (${cur})`, type: "money" }]} defaultValues={{ description: "", section: "opex", amount: "" }} onSubmit={async (v: { description: string; section: "revenue" | "cogs" | "opex" | "other" | "finance"; amount: number }) => { await addAdj.mutateAsync({ ...v, amount: Number(v.amount) }); }} />
      <span className="hidden"><Layers /></span>
    </>
  );
}
