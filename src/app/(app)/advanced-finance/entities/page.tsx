"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Building2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable, type Column } from "@/components/shared/data-table";
import { FormDialog } from "@/components/shared/form-dialog";
import { Panel, StatCard } from "@/components/shared/stat-card";
import { SimNotice } from "@/components/shared/states";
import { StatusBadge } from "@/components/shared/status-badge";
import { useEntityMutation, useGroupSummary } from "@/hooks/use-data";
import { useApp, useFormat } from "@/providers/app-provider";
import { services } from "@/services";
import { entitySchema } from "@/lib/validators";
import { useQueryClient } from "@tanstack/react-query";
import { formatMoney } from "@/lib/formatters";
import { ENTITY_FIELDS } from "@/components/features/entity-fields";
import type { Entity } from "@/types";

export default function EntitiesPage() {
  const router = useRouter(); const f = useFormat(); const qc = useQueryClient(); const { entities, entityId, setEntityId } = useApp(); const group = useGroupSummary(); const [add, setAdd] = React.useState(false);
  const create = useEntityMutation((e, i: Parameters<typeof services.entities.create>[1]) => services.entities.create(e, i), { success: (en) => `${en.name} created with a default chart of accounts`, onDone: () => qc.invalidateQueries({ queryKey: ["entities"] }) });
  const cols: Column<Entity>[] = [
    { id: "n", header: "Entity", accessor: (e) => e.name, cell: (e) => <Link className="font-medium text-primary hover:underline" href={`/advanced-finance/entities/${e.id}`} onClick={(ev) => ev.stopPropagation()}>{e.name}</Link> }, { id: "l", header: "Legal name", accessor: (e) => e.legalName, hideBelow: "md" }, { id: "c", header: "Country", accessor: (e) => e.country }, { id: "cur", header: "Base currency", accessor: (e) => e.baseCurrency },
    { id: "fy", header: "Financial year", accessor: (e) => e.fyStartMonth, cell: (e) => (e.fyStartMonth === 1 ? "Jan – Dec" : `${new Date(2000, e.fyStartMonth - 1).toLocaleString("en", { month: "short" })} – ${new Date(2000, e.fyStartMonth - 2).toLocaleString("en", { month: "short" })}`), hideBelow: "md" },
    { id: "r", header: "Role", accessor: (e) => e.role, cell: (e) => <StatusBadge status={e.role} tone={e.role === "parent" ? "info" : "neutral"} label={e.role === "parent" ? "Parent" : `Subsidiary · ${e.ownership}%`} /> }, { id: "a", header: "Active", accessor: (e) => (e.id === entityId ? "Active" : ""), cell: (e) => (e.id === entityId ? <StatusBadge status="active" label="Selected" /> : <Button variant="ghost" size="xs" onClick={(ev) => { ev.stopPropagation(); setEntityId(e.id); }}>Switch</Button>) },
  ];
  return (
    <>
      <PageHeader title="Entities" description="Companies in the group. Each entity has its own books, base currency, financial year and chart of accounts." actions={<><Button variant="outline" size="sm" asChild><Link href="/advanced-finance/consolidation">Consolidation</Link></Button><Button size="sm" onClick={() => setAdd(true)}><Plus /> New entity</Button></>} />
      <SimNotice className="mb-3" title="Scoped data">Transactions never mix between entities. Intercompany sales are modelled as an invoice in one entity and a matching bill in the other; consolidation eliminates them.</SimNotice>
      <Panel title="Consolidated dashboard preview" description={`Translated to ${group.data?.[0]?.currency ?? "base currency"} at sample rates · financial year to date`} className="mb-4">
        {!group.data ? <div className="h-24" /> : <div className="grid gap-3 md:grid-cols-3">
          {group.data.map((g) => <div key={g.id} className="rounded-lg border p-3"><p className="flex items-center gap-1.5 text-sm font-semibold"><Building2 className="size-4 text-primary" />{g.name}</p><p className="text-[11px] text-muted-foreground">{g.baseCurrency} · {g.role}</p><dl className="mt-2 space-y-0.5 text-[13px]"><div className="flex justify-between"><dt className="text-muted-foreground">Revenue</dt><dd className="tnum">{f.compact(g.revenue, g.currency)}</dd></div><div className="flex justify-between"><dt className="text-muted-foreground">Net profit</dt><dd className="tnum">{f.compact(g.netProfit, g.currency)}</dd></div><div className="flex justify-between"><dt className="text-muted-foreground">Cash</dt><dd className="tnum">{f.compact(g.cash, g.currency)}</dd></div></dl>{g.baseCurrency !== g.currency && <p className="mt-1 text-[10px] text-muted-foreground">Native: {formatMoney(g.nativeRevenue, g.baseCurrency, { compact: true })} revenue @ {g.rate.toFixed(2)}</p>}</div>)}
          <div className="rounded-lg border bg-surface p-3"><p className="text-sm font-semibold">Group total (before eliminations)</p><dl className="mt-2 space-y-0.5 text-[13px]"><div className="flex justify-between"><dt className="text-muted-foreground">Revenue</dt><dd className="tnum">{f.compact(group.data.reduce((s, g) => s + g.revenue, 0))}</dd></div><div className="flex justify-between"><dt className="text-muted-foreground">Net profit</dt><dd className="tnum">{f.compact(group.data.reduce((s, g) => s + g.netProfit, 0))}</dd></div><div className="flex justify-between"><dt className="text-muted-foreground">Cash</dt><dd className="tnum">{f.compact(group.data.reduce((s, g) => s + g.cash, 0))}</dd></div></dl><Link href="/advanced-finance/consolidation" className="mt-1 inline-block text-xs text-primary hover:underline">Run consolidation →</Link></div></div>}
      </Panel>
      <DataTable columns={cols} data={entities} rowKey={(e) => e.id} hideSearch onRowClick={(e) => router.push(`/advanced-finance/entities/${e.id}`)} />
      <FormDialog open={add} onOpenChange={setAdd} size="lg" title="New entity" description="Creates a separate set of books with a default chart of accounts." schema={entitySchema} submitLabel="Create entity" fields={ENTITY_FIELDS}
        defaultValues={{ name: "", legalName: "", country: "India", state: "", city: "", address: "", baseCurrency: "INR", fyStartMonth: "4", taxRegime: "india-gst", gstin: "", pan: "", industry: "", role: "subsidiary", ownership: 100 }}
        onSubmit={async (v: never) => { const x = v as Record<string, string | number>; await create.mutateAsync({ ...(x as object), fyStartMonth: Number(x.fyStartMonth), ownership: Number(x.ownership) } as never); }} />
      <StatCard label="" value="" className="hidden" />
    </>
  );
}
