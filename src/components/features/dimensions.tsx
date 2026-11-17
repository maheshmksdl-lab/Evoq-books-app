"use client";

import * as React from "react";
import { PersonCell } from "@/components/shared/user-avatar";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { DataTable, type Column } from "@/components/shared/data-table";
import { Combobox, DateField, FieldShell, SelectField } from "@/components/shared/form-controls";
import { FormDialog } from "@/components/shared/form-dialog";
import { RangeFilter } from "@/components/shared/range-picker";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { TrendChart } from "@/components/charts/charts";
import { Panel } from "@/components/shared/stat-card";
import { useAllocations, useDimensionReport, useEntityMutation } from "@/hooks/use-data";
import { useAccountOptions } from "@/hooks/use-options";
import { useApp, useFormat } from "@/providers/app-provider";
import { services } from "@/services";
import { dimensionSchema } from "@/lib/validators";
import { formatDate } from "@/lib/formatters";
import { useConfirm } from "@/components/shared/confirm";
import { useAccounts } from "@/hooks/use-data";
import type { Dimension } from "@/types";

type DRow = NonNullable<ReturnType<typeof useDimensionReport>["data"]>[number];
const LABEL = { department: "Department", costCenter: "Cost center", project: "Project" } as const;

export function DimensionManager({ kind }: { kind: Dimension["kind"] }) {
  const f = useFormat(); const { range, entity, today } = useApp(); const [r, setR] = React.useState<{ from: string; to: string } | null>(null); const from = r?.from ?? range.from, to = r?.to ?? range.to;
  const { data, isLoading, error, refetch } = useDimensionReport({ kind, from, to }); const [edit, setEdit] = React.useState<DRow | "new" | null>(null);
  const save = useEntityMutation((e, i: Parameters<typeof services.dimensions.save>[1]) => services.dimensions.save(e, i), { success: `${LABEL[kind]} saved` });
  const rows = data ?? []; const tot = (k: "revenue" | "cost" | "profit") => rows.reduce((s, x) => s + x[k], 0);
  const proj = kind === "project";
  const cols: Column<DRow>[] = [
    { id: "code", header: "Code", accessor: (d) => d.code, className: "tnum w-24" }, { id: "n", header: LABEL[kind], accessor: (d) => d.name, cell: (d) => <span className="font-medium">{d.name}</span> }, { id: "o", header: "Owner", accessor: (d) => d.owner, cell: (d) => <PersonCell name={d.owner} />, hideBelow: "md" },
    ...(proj ? [{ id: "dt", header: "Timeline", accessor: (d: DRow) => d.startDate ?? "", cell: (d: DRow) => <span className="text-xs text-muted-foreground">{d.startDate ? formatDate(d.startDate, "MMM yy") : "—"} → {d.endDate ? formatDate(d.endDate, "MMM yy") : "—"}</span>, hideBelow: "lg" as const }] : []),
    { id: "rev", header: "Revenue", align: "right", accessor: (d) => d.revenue, cell: (d) => (d.revenue ? f.money(d.revenue) : "—") }, { id: "cost", header: "Cost", align: "right", accessor: (d) => d.cost, cell: (d) => f.money(d.cost) },
    { id: "p", header: proj ? "Profit" : "Net", align: "right", accessor: (d) => d.profit, cell: (d) => <span className={d.profit < 0 ? "text-error" : ""}>{f.money(d.profit, undefined, { parens: true })}</span> }, ...(proj ? [{ id: "m", header: "Margin", align: "right" as const, accessor: (d: DRow) => d.margin, cell: (d: DRow) => (d.revenue ? `${d.margin.toFixed(1)}%` : "—") }] : []),
    { id: "b", header: "Budget used", accessor: (d) => d.budgetUsed, cell: (d) => (d.budget ? <span className={d.budgetUsed > 100 ? "text-error" : ""}>{d.budgetUsed.toFixed(0)}% of {f.compact(d.budget)}</span> : "—"), hideBelow: "md" }, { id: "s", header: "Status", accessor: (d) => d.status, cell: (d) => <StatusBadge status={d.status} /> },
  ];
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2"><RangeFilter from={from} to={to} onChange={setR} fyStartMonth={entity?.fyStartMonth} /><Button size="sm" onClick={() => setEdit("new")}><Plus /> New {LABEL[kind].toLowerCase()}</Button></div>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4"><StatCard label={`${LABEL[kind]}s`} value={String(rows.length)} /><StatCard label="Allocated revenue" value={f.money(tot("revenue"))} /><StatCard label="Allocated cost" value={f.money(tot("cost"))} /><StatCard label={proj ? "Project profit" : "Net"} value={f.money(tot("profit"), undefined, { parens: true })} /></div>
      {rows.length > 0 && <Panel title={`${proj ? "Profitability" : "Cost"} by ${LABEL[kind].toLowerCase()}`}><TrendChart data={rows.map((d) => ({ label: d.code, revenue: d.revenue, cost: d.cost }))} height={190} series={proj ? [{ key: "revenue", label: "Revenue" }, { key: "cost", label: "Cost", color: "var(--t-depth)" }] : [{ key: "cost", label: "Cost" }]} /></Panel>}
      <DataTable columns={cols} data={rows} rowKey={(d) => d.id} isLoading={isLoading} error={error as Error | null} onRetry={() => refetch()} exportName={`${kind}-report`} hideSearch rowActions={[{ label: "Edit", icon: Pencil, onClick: (d) => setEdit(d) }]} emptyTitle={`No ${LABEL[kind].toLowerCase()}s yet`} />
      <FormDialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)} size="sm" title={edit && edit !== "new" ? `Edit ${LABEL[kind].toLowerCase()}` : `New ${LABEL[kind].toLowerCase()}`} schema={dimensionSchema} submitLabel="Save" fields={[{ name: "code", label: "Code", required: true }, { name: "name", label: "Name", required: true }, { name: "owner", label: "Owner", required: true }, { name: "budget", label: "Budget", type: "money" }, ...(proj ? [{ name: "startDate", label: "Start", type: "date" as const }, { name: "endDate", label: "End", type: "date" as const }] : []), { name: "status", label: "Status", type: "select", options: [{ value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }, ...(proj ? [{ value: "completed", label: "Completed" }] : [])] }]}
        defaultValues={edit && edit !== "new" ? { ...edit, startDate: edit.startDate ?? "", endDate: edit.endDate ?? "" } : { code: "", name: "", owner: "", budget: 0, status: "active", startDate: today, endDate: "" }}
        onSubmit={async (v: Omit<Dimension, "id" | "entityId" | "kind">) => { await save.mutateAsync({ ...v, kind, id: edit && edit !== "new" ? edit.id : undefined, budget: Number(v.budget) || 0, startDate: v.startDate || undefined, endDate: v.endDate || undefined, customerId: edit && edit !== "new" ? edit.customerId : undefined }); }} />
    </div>
  );
}

type SplitRow = { kind: "department" | "costCenter" | "project"; dimensionId: string; percent: number | string };
export function AllocationsPanel() {
  const f = useFormat(); const { today } = useApp(); const confirm = useConfirm(); const { data, isLoading } = useAllocations(); const accOpts = useAccountOptions(["expense", "income"]); const accounts = useAccounts().data ?? [];
  const depts = (useDimensionReport({ kind: "department", from: "2025-04-01", to: today }).data ?? []), ccs = (useDimensionReport({ kind: "costCenter", from: "2025-04-01", to: today }).data ?? []), prjs = (useDimensionReport({ kind: "project", from: "2025-04-01", to: today }).data ?? []);
  const dimOpts = [...depts.map((d) => ({ value: `department|${d.id}`, label: `Dept · ${d.name}` })), ...ccs.map((d) => ({ value: `costCenter|${d.id}`, label: `Cost center · ${d.name}` })), ...prjs.map((d) => ({ value: `project|${d.id}`, label: `Project · ${d.name}` }))];
  const [open, setOpen] = React.useState(false); const [err, setErr] = React.useState<string | null>(null);
  const save = useEntityMutation((e, i: Parameters<typeof services.dimensions.saveAllocation>[1]) => services.dimensions.saveAllocation(e, i), { success: "Allocation saved" });
  const del = useEntityMutation((e, id: string) => services.dimensions.removeAllocation(e, id), { success: "Allocation removed" });
  const form = useForm<{ date: string; description: string; accountId: string; amount: number | string; type: "expense" | "revenue"; splits: { key: string; percent: number | string }[] }>({ defaultValues: { date: today, description: "", accountId: "", amount: "", type: "expense", splits: [{ key: "", percent: 50 }, { key: "", percent: 50 }] } });
  const { control, register, handleSubmit, watch, reset } = form; const { fields, append, remove } = useFieldArray({ control, name: "splits" }); const sp = watch("splits"); const total = sp.reduce((s, x) => s + (Number(x.percent) || 0), 0);
  const submit = handleSubmit(async (v) => {
    setErr(null); if (!v.description.trim() || !v.accountId || !(Number(v.amount) > 0)) { setErr("Description, account and a positive amount are required."); return; }
    try { await save.mutateAsync({ date: v.date, description: v.description, accountId: v.accountId, amount: Number(v.amount), type: v.type, splits: v.splits.filter((s) => s.key).map((s) => { const [kind, dimensionId] = s.key.split("|"); return { kind: kind as SplitRow["kind"], dimensionId, percent: Number(s.percent) }; }) }); setOpen(false); reset(); } catch (e) { setErr((e as Error).message); }
  });
  type A = NonNullable<typeof data>[number];
  const cols: Column<A>[] = [{ id: "d", header: "Date", accessor: (a) => a.date, cell: (a) => formatDate(a.date) }, { id: "n", header: "Description", accessor: (a) => a.description }, { id: "a", header: "Account", accessor: (a) => accounts.find((x) => x.id === a.accountId)?.name ?? "", hideBelow: "md" }, { id: "t", header: "Type", accessor: (a) => a.type, cell: (a) => <span className="capitalize">{a.type}</span>, hideBelow: "md" }, { id: "amt", header: "Amount", align: "right", accessor: (a) => a.amount, cell: (a) => f.money(a.amount) }, { id: "s", header: "Split", accessor: (a) => a.splits.length, cell: (a) => <span className="text-xs text-muted-foreground">{a.splits.map((s) => `${[...depts, ...ccs, ...prjs].find((d) => d.id === s.dimensionId)?.code ?? "?"} ${s.percent}%`).join(" · ")}</span> }];
  return (
    <div className="space-y-3">
      <div className="flex justify-between gap-2"><p className="max-w-2xl text-sm text-muted-foreground">Allocate an expense or revenue amount across departments, cost centers and projects. Allocations are included in the dimension reports alongside tagged journal lines.</p><Button size="sm" onClick={() => setOpen(true)}><Plus /> New allocation</Button></div>
      <DataTable columns={cols} data={data ?? []} rowKey={(a) => a.id} isLoading={isLoading} hideSearch rowActions={[{ label: "Delete", icon: Trash2, destructive: true, onClick: async (a) => { if (await confirm({ title: "Remove allocation?", destructive: true, confirmLabel: "Remove" })) del.mutate(a.id); } }]} emptyTitle="No allocations yet" />
      <Dialog open={open} onOpenChange={setOpen}><DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-xl"><DialogHeader><DialogTitle>Dimension allocation</DialogTitle><DialogDescription>Splits must total exactly 100%.</DialogDescription></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-2"><FieldShell label="Date"><Controller control={control} name="date" render={({ field }) => <DateField value={field.value} onChange={field.onChange} />} /></FieldShell><FieldShell label="Type"><Controller control={control} name="type" render={({ field }) => <SelectField value={field.value} onChange={field.onChange} options={[{ value: "expense", label: "Expense" }, { value: "revenue", label: "Revenue" }]} />} /></FieldShell>
          <FieldShell label="Description" className="sm:col-span-2"><Input {...register("description")} /></FieldShell><FieldShell label="Account"><Controller control={control} name="accountId" render={({ field }) => <Combobox value={field.value} onChange={field.onChange} options={accOpts} placeholder="Account" />} /></FieldShell><FieldShell label="Amount"><Input type="number" step="0.01" className="tnum text-right" {...register("amount")} /></FieldShell></div>
        <div className="space-y-2"><div className="flex items-center justify-between"><p className="text-xs font-semibold">Splits <span className={Math.abs(total - 100) > 0.01 ? "text-error" : "text-[color-mix(in_srgb,var(--s-success)_55%,black)]"}>({total}%)</span></p><Button type="button" size="xs" variant="outline" onClick={() => append({ key: "", percent: 0 })}><Plus /> Add split</Button></div>
          {fields.map((fl, i) => <div key={fl.id} className="flex gap-2"><div className="min-w-0 flex-1"><Controller control={control} name={`splits.${i}.key`} render={({ field }) => <SelectField value={field.value} onChange={field.onChange} options={dimOpts} placeholder="Department / cost center / project" />} /></div><Input type="number" className="w-24 tnum text-right" aria-label={`Percent ${i + 1}`} {...register(`splits.${i}.percent`)} /><Button type="button" variant="ghost" size="icon-sm" aria-label="Remove split" disabled={fields.length <= 1} onClick={() => remove(i)}><Trash2 /></Button></div>)}</div>
        {err && <p role="alert" className="tone-error rounded-md border px-3 py-2 text-xs">{err}</p>}
        <DialogFooter><Button variant="outline" onClick={() => setOpen(false)}>Cancel</Button><Button onClick={submit} disabled={save.isPending}>Save allocation</Button></DialogFooter></DialogContent></Dialog>
    </div>
  );
}
