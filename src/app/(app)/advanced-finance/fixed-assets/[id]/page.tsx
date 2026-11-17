"use client";

import * as React from "react";
import { useParams } from "next/navigation";
import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable, type Column } from "@/components/shared/data-table";
import { ErrorState, TableSkeleton } from "@/components/shared/states";
import { KV, Panel, StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { TrendChart } from "@/components/charts/charts";
import { useAsset } from "@/hooks/use-data";
import { useFormat } from "@/providers/app-provider";
import { formatDate } from "@/lib/formatters";
import { monthLabel } from "@/lib/accounting/fiscal";
import { AssetFormDialog } from "@/components/features/asset-form";
import type { DepRow } from "@/lib/accounting/depreciation";

export default function AssetDetailPage() {
  const { id } = useParams<{ id: string }>(); const f = useFormat(); const { data, isLoading, error, refetch } = useAsset(id); const [edit, setEdit] = React.useState(false);
  if (error) return <ErrorState error={error as Error} onRetry={() => refetch()} />;
  if (isLoading || !data) return <TableSkeleton />;
  const { asset: a, schedule } = data;
  const cols: Column<DepRow>[] = [{ id: "m", header: "Month", accessor: (r) => r.month, cell: (r) => monthLabel(r.month, "MMM yyyy") }, { id: "o", header: "Opening NBV", align: "right", accessor: (r) => r.opening, cell: (r) => f.money(r.opening) }, { id: "d", header: "Depreciation", align: "right", accessor: (r) => r.depreciation, cell: (r) => f.money(r.depreciation) }, { id: "a", header: "Accumulated", align: "right", accessor: (r) => r.accumulated, cell: (r) => f.money(r.accumulated) }, { id: "c", header: "Closing NBV", align: "right", accessor: (r) => r.closing, cell: (r) => f.money(r.closing) }, { id: "p", header: "Posting", accessor: (r) => (r.month <= a.postedThrough ? "posted" : "scheduled"), cell: (r) => <StatusBadge status={r.month <= a.postedThrough ? "posted" : "draft"} label={r.month <= a.postedThrough ? "Posted" : "Scheduled"} /> }];
  const chart = schedule.filter((_, i) => i % 3 === 0).map((r) => ({ label: r.month, nbv: r.closing }));
  return (
    <>
      <PageHeader title={<span className="flex items-center gap-2">{a.tag} · {a.name} <StatusBadge status={a.status} /></span>} description={`${a.category} · ${a.location}${a.department ? ` · ${a.department}` : ""}`} trail={[{ label: a.tag }]} actions={<Button variant="outline" size="sm" onClick={() => setEdit(true)}><Pencil /> Edit</Button>} />
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-5"><StatCard label="Acquisition cost" value={f.money(a.cost)} /><StatCard label="Residual value" value={f.money(a.residual)} /><StatCard label="Accumulated dep." value={f.money(a.accumulated)} hint={`through ${a.postedThrough}`} /><StatCard label="Net book value" value={f.money(a.nbv)} /><StatCard label="Monthly charge" value={f.money(a.monthly)} hint={`${a.method} · ${a.usefulLifeYears} years`} /></div>
      <Tabs defaultValue="schedule"><TabsList><TabsTrigger value="schedule">Depreciation schedule</TabsTrigger><TabsTrigger value="details">Details & history</TabsTrigger></TabsList>
        <TabsContent value="schedule" className="mt-3 space-y-4"><Panel title="Net book value over time"><TrendChart data={chart} series={[{ key: "nbv", label: "Net book value", type: "area" }]} height={180} /></Panel><DataTable columns={cols} data={schedule} rowKey={(r) => r.month} hideSearch pageSize={12} exportName={`depreciation-${a.tag}`} defaultSort={undefined} /></TabsContent>
        <TabsContent value="details" className="mt-3"><Panel><dl className="grid grid-cols-2 gap-4 md:grid-cols-4"><KV label="Acquired">{formatDate(a.purchaseDate)}</KV><KV label="Invoice ref">{a.invoiceRef}</KV><KV label="Method">{a.method}</KV><KV label="Useful life">{a.usefulLifeYears} years</KV><KV label="Location">{a.location}</KV><KV label="Department">{a.department}</KV>{a.disposal && <KV label="Disposed">{formatDate(a.disposal.date)} · proceeds {f.money(a.disposal.proceeds)} · {a.disposal.gainLoss >= 0 ? "gain" : "loss"} {f.money(Math.abs(a.disposal.gainLoss))}</KV>}</dl>
          <p className="mb-1 mt-4 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Transfer history</p>{a.transfers.length === 0 ? <p className="text-xs text-muted-foreground">No transfers.</p> : <ul className="space-y-1 text-sm">{a.transfers.map((t, i) => <li key={i}>{formatDate(t.date)} — {t.from} → {t.to} <span className="text-muted-foreground">by {t.by}</span></li>)}</ul>}</Panel></TabsContent></Tabs>
      {edit && <AssetFormDialog open onOpenChange={setEdit} asset={a} />}
    </>
  );
}
