"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowRightLeft, CalendarClock, Eye, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable, type Column } from "@/components/shared/data-table";
import { FormDialog, type FieldDef } from "@/components/shared/form-dialog";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { SimNotice } from "@/components/shared/states";
import { useConfirm } from "@/components/shared/confirm";
import { useAssets, useDepPreview, useEntityMutation } from "@/hooks/use-data";
import { useBankOptions, useContactOptions } from "@/hooks/use-options";
import { useApp, useFormat } from "@/providers/app-provider";
import { services, type AssetInput, type AssetRow } from "@/services";
import { formatDate } from "@/lib/formatters";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { z } from "zod";
import { AssetFormDialog } from "@/components/features/asset-form";

export default function FixedAssetsPage() {
  const router = useRouter(); const f = useFormat(); const confirm = useConfirm(); const { today } = useApp(); const { data, isLoading, error, refetch } = useAssets(); const banks = useBankOptions(["bank", "cash"]);
  const [tab, setTab] = React.useState("active"); const [edit, setEdit] = React.useState<AssetRow | "new" | null>(null); const [dep, setDep] = React.useState(false); const [disp, setDisp] = React.useState<AssetRow | null>(null); const [tr, setTr] = React.useState<AssetRow | null>(null);
  const month = today.slice(0, 7); const depMonth = React.useMemo(() => { const m = (data?.[0]?.postedThrough ?? "2026-10"); const d = new Date(`${m}-01T00:00:00`); d.setMonth(d.getMonth() + 1); return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`; }, [data]);
  const preview = useDepPreview(depMonth);
  const postDep = useEntityMutation((e, m: string) => services.assets.postDepreciation(e, m), { success: (j) => `Depreciation journal ${j.number} posted`, onDone: () => setDep(false) });
  const dispose = useEntityMutation((e, i: { id: string; date: string; proceeds: number; bankAccountId: string }) => services.assets.dispose(e, i), { success: "Asset disposed" });
  const transfer = useEntityMutation((e, i: { id: string; to: string; department: string; date: string }) => services.assets.transfer(e, i), { success: "Asset transferred" });
  const all = data ?? []; const rows = all.filter((a) => tab === "all" || (tab === "active" ? a.status === "active" : a.status === "disposed"));
  const cost = all.filter((a) => a.status === "active").reduce((s, a) => s + a.cost, 0), nbv = all.filter((a) => a.status === "active").reduce((s, a) => s + a.nbv, 0), accum = all.filter((a) => a.status === "active").reduce((s, a) => s + a.accumulated, 0);
  const cols: Column<AssetRow>[] = [
    { id: "tag", header: "Tag", accessor: (a) => a.tag, cell: (a) => <Link className="font-medium text-primary hover:underline" href={`/advanced-finance/fixed-assets/${a.id}`} onClick={(e) => e.stopPropagation()}>{a.tag}</Link> }, { id: "n", header: "Asset", accessor: (a) => a.name, className: "max-w-[240px] truncate" }, { id: "c", header: "Category", accessor: (a) => a.category, hideBelow: "md" },
    { id: "d", header: "Acquired", accessor: (a) => a.purchaseDate, cell: (a) => formatDate(a.purchaseDate), hideBelow: "lg" }, { id: "m", header: "Method", accessor: (a) => `${a.method} · ${a.usefulLifeYears}y`, hideBelow: "lg" },
    { id: "cost", header: "Cost", align: "right", accessor: (a) => a.cost, cell: (a) => f.money(a.cost) }, { id: "acc", header: "Accumulated dep.", align: "right", accessor: (a) => a.accumulated, cell: (a) => f.money(a.accumulated), hideBelow: "md" }, { id: "nbv", header: "Net book value", align: "right", accessor: (a) => a.nbv, cell: (a) => f.money(a.nbv) },
    { id: "s", header: "Status", accessor: (a) => a.status, cell: (a) => <StatusBadge status={a.fullyDepreciated && a.status === "active" ? "closed" : a.status} label={a.fullyDepreciated && a.status === "active" ? "Fully depreciated" : undefined} /> },
  ];
  return (
    <>
      <PageHeader title="Fixed Assets" description="Asset register with depreciation schedules, monthly depreciation journals, disposal and transfer." actions={<><Button variant="outline" size="sm" onClick={() => setDep(true)}><CalendarClock /> Post depreciation</Button><Button size="sm" onClick={() => setEdit("new")}><Plus /> New asset</Button></>} />
      <div className="mb-3 grid grid-cols-2 gap-3 lg:grid-cols-4"><StatCard label="Gross block (active)" value={f.money(cost)} hint={`${all.filter((a) => a.status === "active").length} assets`} /><StatCard label="Accumulated depreciation" value={f.money(accum)} /><StatCard label="Net book value" value={f.money(nbv)} /><StatCard label="Next monthly charge" value={f.money(all.filter((a) => a.status === "active").reduce((s, a) => s + a.monthly, 0))} hint={`for ${depMonth}`} /></div>
      <Tabs value={tab} onValueChange={setTab} className="mb-2"><TabsList><TabsTrigger value="active">Active</TabsTrigger><TabsTrigger value="disposed">Disposed</TabsTrigger><TabsTrigger value="all">All</TabsTrigger></TabsList></Tabs>
      <DataTable columns={cols} data={rows} rowKey={(a) => a.id} isLoading={isLoading} error={error as Error | null} onRetry={() => refetch()} exportName="asset-register" onRowClick={(a) => router.push(`/advanced-finance/fixed-assets/${a.id}`)} defaultSort={{ id: "tag", dir: "asc" }} searchPlaceholder="Search tag, name, location…"
        rowActions={(a) => [{ label: "View & schedule", icon: Eye, onClick: () => router.push(`/advanced-finance/fixed-assets/${a.id}`) }, { label: "Transfer…", icon: ArrowRightLeft, onClick: () => setTr(a), hidden: () => a.status !== "active" }, { label: "Dispose…", icon: Trash2, destructive: true, separatorBefore: true, onClick: () => setDisp(a), hidden: () => a.status !== "active" }]} />
      {edit && <AssetFormDialog open onOpenChange={(o) => !o && setEdit(null)} asset={edit === "new" ? null : edit} />}
      <Dialog open={dep} onOpenChange={setDep}>
        <DialogContent className="sm:max-w-xl"><DialogHeader><DialogTitle>Monthly depreciation – {depMonth}</DialogTitle><DialogDescription>Preview of the journal that will be posted at month-end (Dr Depreciation Expense / Cr Accumulated Depreciation).</DialogDescription></DialogHeader>
          {preview.data?.alreadyPosted ? <p className="tone-info rounded-md border px-3 py-2 text-sm">Already posted as {preview.data.journalNumber}.</p> : null}
          <div className="max-h-72 overflow-y-auto rounded border"><Table><TableHeader><TableRow><TableHead>Asset</TableHead><TableHead className="text-right">Depreciation</TableHead></TableRow></TableHeader><TableBody>{(preview.data?.rows ?? []).map((r) => <TableRow key={r.asset.id}><TableCell className="py-1 text-[13px]">{r.asset.tag} · {r.asset.name}</TableCell><TableCell className="num py-1 text-[13px]">{f.money(r.dep)}</TableCell></TableRow>)}</TableBody><TableFooter><TableRow><TableCell className="font-semibold">Total</TableCell><TableCell className="num font-semibold">{f.money(preview.data?.total ?? 0)}</TableCell></TableRow></TableFooter></Table></div>
          <SimNotice>Posting writes a journal to the mock ledger. Depreciation for a month can only be posted at or after month-end.</SimNotice>
          <DialogFooter><Button variant="outline" onClick={() => setDep(false)}>Close</Button><Button disabled={!preview.data || preview.data.alreadyPosted || postDep.isPending} onClick={() => postDep.mutate(depMonth)}>Post journal</Button></DialogFooter></DialogContent>
      </Dialog>
      <FormDialog open={!!disp} onOpenChange={(o) => !o && setDisp(null)} size="sm" title={`Dispose ${disp?.tag}`} description={disp ? `Net book value ${f.money(disp.nbv)}. Gain or loss is posted automatically.` : undefined} submitLabel="Post disposal"
        schema={z.object({ date: z.string().min(1, "Choose a date"), proceeds: z.coerce.number().min(0, "Cannot be negative"), bankAccountId: z.string().optional() }).refine((v) => v.proceeds === 0 || !!v.bankAccountId, { message: "Select the receiving account", path: ["bankAccountId"] })}
        fields={[{ name: "date", label: "Disposal date", type: "date", required: true }, { name: "proceeds", label: "Sale proceeds", type: "money" }, { name: "bankAccountId", label: "Proceeds received in", type: "select", options: banks, span: 2, allowEmpty: true }]} defaultValues={{ date: today, proceeds: 0, bankAccountId: "" }}
        onSubmit={async (v: { date: string; proceeds: number; bankAccountId: string }) => { if (await confirm({ title: "Post disposal journal?", description: "Derecognises the asset and its accumulated depreciation.", confirmLabel: "Post" })) await dispose.mutateAsync({ id: disp!.id, date: v.date, proceeds: Number(v.proceeds), bankAccountId: v.bankAccountId }); }} />
      <FormDialog open={!!tr} onOpenChange={(o) => !o && setTr(null)} size="sm" title={`Transfer ${tr?.tag}`} description={tr ? `Currently at ${tr.location} (${tr.department ?? "—"}).` : undefined} submitLabel="Record transfer"
        schema={z.object({ to: z.string().min(1, "Enter the new location"), department: z.string().min(1, "Enter the department"), date: z.string().min(1) })} fields={[{ name: "to", label: "New location", required: true }, { name: "department", label: "Department", required: true }, { name: "date", label: "Transfer date", type: "date" }]} defaultValues={{ to: "", department: tr?.department ?? "", date: today }}
        onSubmit={async (v: { to: string; department: string; date: string }) => { await transfer.mutateAsync({ id: tr!.id, ...v }); }} />
      <span className="hidden">{month}</span>
    </>
  );
}
