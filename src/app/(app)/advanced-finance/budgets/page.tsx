"use client";

import * as React from "react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { Controller, useFieldArray, useForm } from "react-hook-form";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { toast } from "sonner";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable, type Column } from "@/components/shared/data-table";
import { Combobox, FieldShell, SelectField } from "@/components/shared/form-controls";
import { Panel, StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { ErrorState, TableSkeleton } from "@/components/shared/states";
import { TrendChart } from "@/components/charts/charts";
import { useBudgetVariance, useBudgets, useEntityMutation, useForecast } from "@/hooks/use-data";
import { useAccountOptions, useDimensionOptions } from "@/hooks/use-options";
import { useApp, useFormat } from "@/providers/app-provider";
import { services } from "@/services";
import { budgetSchema } from "@/lib/validators";
import { fiscalYearOf, monthLabel } from "@/lib/accounting/fiscal";
import { cn } from "@/lib/utils";
import type { Budget } from "@/types";

type BRow = NonNullable<ReturnType<typeof useBudgets>["data"]>[number];

function BudgetEditor({ budget, onClose }: { budget: BRow | "new" | null; onClose: () => void }) {
  const { entity, today } = useApp(); const accOpts = useAccountOptions(["income", "expense"]); const depts = useDimensionOptions("department"); const projs = useDimensionOptions("project"); const fy = fiscalYearOf(today, entity?.fyStartMonth ?? 4);
  const cur = budget && budget !== "new" ? budget : null; const [mode, setMode] = React.useState<"annual" | "monthly">("annual"); const [err, setErr] = React.useState<string | null>(null);
  const months = Array.from({ length: 12 }, (_, i) => monthLabel(`${fy.start.slice(0, 4)}-${String(((Number(fy.start.slice(5, 7)) - 1 + i) % 12) + 1).padStart(2, "0")}`, "MMM"));
  const form = useForm<{ name: string; fiscalYear: string; scope: Budget["scope"]; dimensionId: string; status: Budget["status"]; lines: { accountId: string; annual: number | string; monthly: (number | string)[] }[] }>({ defaultValues: { name: cur?.name ?? `${fy.label} Budget`, fiscalYear: cur?.fiscalYear ?? fy.label, scope: cur?.scope ?? "annual", dimensionId: cur?.dimensionId ?? "", status: cur?.status ?? "draft", lines: cur?.lines.map((l) => ({ accountId: l.accountId, annual: l.monthly.reduce((s, x) => s + x, 0), monthly: l.monthly })) ?? [{ accountId: "", annual: "", monthly: Array(12).fill("") }] } });
  const { control, register, handleSubmit, watch, setValue, formState: { errors } } = form; const { fields, append, remove } = useFieldArray({ control, name: "lines" });
  React.useEffect(() => { if (budget) { form.reset({ name: cur?.name ?? `${fy.label} Budget`, fiscalYear: cur?.fiscalYear ?? fy.label, scope: cur?.scope ?? "annual", dimensionId: cur?.dimensionId ?? "", status: cur?.status ?? "draft", lines: cur?.lines.map((l) => ({ accountId: l.accountId, annual: l.monthly.reduce((s, x) => s + x, 0), monthly: l.monthly })) ?? [{ accountId: "", annual: "", monthly: Array(12).fill("") }] }); setErr(null); }   }, [budget]);
  const save = useEntityMutation((e, i: Parameters<typeof services.budgets.save>[1]) => services.budgets.save(e, i), { success: "Budget saved" });
  const scope = watch("scope");
  const submit = handleSubmit(async (v) => {
    const head = budgetSchema.safeParse(v); if (!head.success) { setErr(head.error.issues[0].message); return; }
    const lines = v.lines.filter((l) => l.accountId).map((l) => ({ accountId: l.accountId, monthly: mode === "annual" && !l.monthly.some((m) => Number(m)) || (mode === "annual" && Number(l.annual) !== l.monthly.reduce<number>((s, x) => s + (Number(x) || 0), 0)) ? Array(12).fill(0).map(() => Math.round(((Number(l.annual) || 0) / 12) * 100) / 100) : l.monthly.map((m) => Number(m) || 0) }));
    try { await save.mutateAsync({ id: cur?.id, name: v.name, fiscalYear: v.fiscalYear, scope: v.scope, dimensionId: v.scope === "annual" ? undefined : v.dimensionId, status: v.status, lines }); onClose(); } catch (e) { setErr((e as Error).message); }
  });
  return (
    <Dialog open={!!budget} onOpenChange={(o) => !o && onClose()}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-5xl"><DialogHeader><DialogTitle>{cur ? `Edit ${cur.name}` : "New budget"}</DialogTitle><DialogDescription>Enter annual amounts (spread evenly) or edit each month.</DialogDescription></DialogHeader>
        <div className="grid gap-3 sm:grid-cols-4">
          <FieldShell label="Budget name" required error={errors.name?.message} className="sm:col-span-2"><Input {...register("name", { required: "Name is required" })} /></FieldShell>
          <FieldShell label="Scope"><Controller control={control} name="scope" render={({ field }) => <SelectField value={field.value} onChange={field.onChange} options={[{ value: "annual", label: "Annual (company)" }, { value: "department", label: "Department" }, { value: "project", label: "Project" }]} />} /></FieldShell>
          <FieldShell label="Status"><Controller control={control} name="status" render={({ field }) => <SelectField value={field.value} onChange={field.onChange} options={[{ value: "draft", label: "Draft" }, { value: "active", label: "Active" }, { value: "closed", label: "Closed" }]} />} /></FieldShell>
          {scope !== "annual" && <FieldShell label={scope === "department" ? "Department" : "Project"} required className="sm:col-span-4"><Controller control={control} name="dimensionId" render={({ field }) => <SelectField value={field.value} onChange={field.onChange} options={scope === "department" ? depts : projs} />} /></FieldShell>}
        </div>
        <div className="flex items-center justify-between"><Tabs value={mode} onValueChange={(v) => setMode(v as "annual" | "monthly")}><TabsList className="h-8"><TabsTrigger value="annual">Annual amounts</TabsTrigger><TabsTrigger value="monthly">Monthly grid</TabsTrigger></TabsList></Tabs><Button type="button" size="sm" variant="outline" onClick={() => append({ accountId: "", annual: "", monthly: Array(12).fill("") })}><Plus /> Add account</Button></div>
        <div className="scroll-thin overflow-x-auto rounded-md border"><table className="w-full text-sm"><thead className="bg-muted/50 text-[11px] uppercase text-muted-foreground"><tr><th className="min-w-56 px-2 py-1.5 text-left">Account</th>{mode === "annual" ? <th className="px-2 py-1.5 text-right">Annual budget</th> : months.map((m) => <th key={m} className="w-24 px-1 py-1.5 text-right">{m}</th>)}<th className="w-24 px-2 py-1.5 text-right">Total</th><th className="w-8" /></tr></thead>
          <tbody>{fields.map((fl, i) => { const row = watch(`lines.${i}`); const total = mode === "annual" ? Number(row?.annual) || 0 : (row?.monthly ?? []).reduce<number>((s, x) => s + (Number(x) || 0), 0); return (
            <tr key={fl.id} className="border-t"><td className="px-2 py-1"><Controller control={control} name={`lines.${i}.accountId`} render={({ field }) => <Combobox value={field.value} onChange={field.onChange} options={accOpts} placeholder="Account" />} /></td>
              {mode === "annual" ? <td className="px-2 py-1"><Input type="number" className="tnum text-right" aria-label={`Annual budget ${i + 1}`} {...register(`lines.${i}.annual`, { onChange: (e) => setValue(`lines.${i}.monthly`, Array(12).fill(Math.round(((Number(e.target.value) || 0) / 12) * 100) / 100)) })} /></td> : months.map((_, m) => <td key={m} className="px-1 py-1"><Input type="number" className="h-8 tnum px-1 text-right text-xs" aria-label={`${months[m]} line ${i + 1}`} {...register(`lines.${i}.monthly.${m}` as const)} /></td>)}
              <td className="num px-2 py-1 text-[13px]">{total.toLocaleString("en-IN")}</td><td className="px-1"><Button type="button" variant="ghost" size="icon-sm" aria-label="Remove line" onClick={() => remove(i)} disabled={fields.length === 1}><Trash2 /></Button></td></tr>); })}</tbody></table></div>
        {err && <p role="alert" className="tone-error rounded-md border px-3 py-2 text-xs">{err}</p>}
        <DialogFooter><Button variant="outline" onClick={onClose}>Cancel</Button><Button onClick={submit} disabled={save.isPending}>Save budget</Button></DialogFooter></DialogContent>
    </Dialog>
  );
}

export default function BudgetsPage() {
  const f = useFormat(); const budgets = useBudgets(); const forecast = useForecast(); const [sel, setSel] = React.useState(""); const [edit, setEdit] = React.useState<BRow | "new" | null>(null);
  const id = sel || budgets.data?.[0]?.id; const v = useBudgetVariance(id); void toast;
  if (budgets.error) return <ErrorState error={budgets.error as Error} onRetry={() => budgets.refetch()} />;
  type R = NonNullable<typeof v.data>["rows"][number];
  const cols: Column<R>[] = [{ id: "c", header: "Code", accessor: (r) => r.code, className: "tnum text-muted-foreground w-16" }, { id: "n", header: "Account", accessor: (r) => r.name }, { id: "t", header: "Type", accessor: (r) => r.type, cell: (r) => <span className="capitalize">{r.type}</span>, hideBelow: "md" }, { id: "b", header: "Budget (YTD)", align: "right", accessor: (r) => r.budgetTotal, cell: (r) => f.money(r.budgetTotal) }, { id: "a", header: "Actual (YTD)", align: "right", accessor: (r) => r.actualTotal, cell: (r) => f.money(r.actualTotal) },
    { id: "v", header: "Variance", align: "right", accessor: (r) => r.variance, cell: (r) => <span className={r.favourable ? "text-[color-mix(in_srgb,var(--s-success)_55%,black)]" : "text-error"}>{f.money(r.variance, undefined, { parens: true })}</span> }, { id: "p", header: "Var %", align: "right", accessor: (r) => r.variancePct, cell: (r) => <span className={r.favourable ? "text-[color-mix(in_srgb,var(--s-success)_55%,black)]" : "text-error"}>{r.variancePct > 0 ? "+" : ""}{r.variancePct.toFixed(1)}%</span>, hideBelow: "md" },
    { id: "u", header: "Utilisation", accessor: (r) => (r.budgetTotal ? (r.actualTotal / r.budgetTotal) * 100 : 0), cell: (r) => { const p = r.budgetTotal ? Math.min(160, (r.actualTotal / r.budgetTotal) * 100) : 0; return <div className="h-1.5 w-20 overflow-hidden rounded-full bg-muted"><div className={cn("h-full", r.type === "expense" && p > 100 ? "bg-error" : "bg-action")} style={{ width: `${Math.min(100, p)}%` }} /></div>; }, hideBelow: "lg" }];
  const monthly = v.data ? Array.from({ length: 12 }, (_, i) => ({ label: monthLabel(`${v.data!.fyStart.slice(0, 4)}-${String(((Number(v.data!.fyStart.slice(5, 7)) - 1 + i) % 12) + 1).padStart(2, "0")}`, "MMM"), budget: v.data!.rows.filter((r) => r.type === "expense").reduce((s, r) => s + r.budget[i], 0), actual: i <= v.data!.throughIdx ? v.data!.rows.filter((r) => r.type === "expense").reduce((s, r) => s + r.actual[i], 0) : 0 })) : [];
  return (
    <>
      <PageHeader title="Budgeting & Forecasting" description="Annual, department and project budgets with actual-versus-budget variance and trend-based forecasts." actions={<Button size="sm" onClick={() => setEdit("new")}><Plus /> New budget</Button>} />
      <Tabs defaultValue="variance"><TabsList><TabsTrigger value="variance">Budget vs actual</TabsTrigger><TabsTrigger value="budgets">All budgets</TabsTrigger><TabsTrigger value="forecast">Forecast</TabsTrigger></TabsList>
        <TabsContent value="variance" className="mt-3 space-y-4">
          <div className="flex flex-wrap items-center gap-2"><div className="w-72"><SelectField value={id ?? ""} onChange={setSel} options={(budgets.data ?? []).map((b) => ({ value: b.id, label: `${b.name} (${b.scope})` }))} /></div>{v.data && <span className="text-xs text-muted-foreground">Closed months through {monthly[v.data.throughIdx]?.label}</span>}{id && <Button variant="outline" size="sm" onClick={() => setEdit(budgets.data?.find((b) => b.id === id) ?? null)}><Pencil /> Edit</Button>}</div>
          {v.isLoading || !v.data ? <TableSkeleton /> : <>
            <div className="grid grid-cols-2 gap-3 lg:grid-cols-4"><StatCard label="Expense budget (YTD)" value={f.money(v.data.totals.budget)} /><StatCard label="Expense actual (YTD)" value={f.money(v.data.totals.actual)} /><StatCard label="Expense variance" value={f.money(v.data.totals.actual - v.data.totals.budget, undefined, { parens: true })} hint={v.data.totals.actual <= v.data.totals.budget ? "Under budget" : "Over budget"} valueClassName={v.data.totals.actual > v.data.totals.budget ? "text-error" : undefined} /><StatCard label="Revenue vs budget" value={f.money(v.data.totals.incomeActual - v.data.totals.incomeBudget, undefined, { parens: true })} hint={`${f.compact(v.data.totals.incomeActual)} vs ${f.compact(v.data.totals.incomeBudget)}`} /></div>
            <Panel title="Monthly expense: budget vs actual"><TrendChart data={monthly} height={220} series={[{ key: "budget", label: "Budget", color: "var(--t-soft)" }, { key: "actual", label: "Actual" }]} /></Panel>
            <DataTable columns={cols} data={v.data.rows} rowKey={(r) => r.accountId} hideSearch exportName="budget-variance" pageSize={20} /></>}
        </TabsContent>
        <TabsContent value="budgets" className="mt-3"><DataTable data={budgets.data ?? []} rowKey={(b) => b.id} isLoading={budgets.isLoading} hideSearch columns={[{ id: "n", header: "Budget", accessor: (b) => b.name, cell: (b) => <button className="font-medium text-primary hover:underline" onClick={() => setSel(b.id)}>{b.name}</button> }, { id: "s", header: "Scope", accessor: (b) => b.scope, cell: (b) => <span className="capitalize">{b.scope}{b.dimensionName ? ` · ${b.dimensionName}` : ""}</span> }, { id: "fy", header: "Year", accessor: (b) => b.fiscalYear }, { id: "t", header: "Total", align: "right", accessor: (b) => b.total, cell: (b) => f.money(b.total) }, { id: "st", header: "Status", accessor: (b) => b.status, cell: (b) => <StatusBadge status={b.status} /> }]} rowActions={[{ label: "Edit", icon: Pencil, onClick: (b) => setEdit(b) }]} /></TabsContent>
        <TabsContent value="forecast" className="mt-3 space-y-4">
          {forecast.isLoading || !forecast.data ? <TableSkeleton /> : <>
            <Panel title="Revenue & expense forecast" description="11 months of actuals plus a 6-month linear trend projection (simulation)"><TrendChart data={forecast.data.map((m) => ({ label: monthLabel(m.month), revenue: m.revenue, expense: m.expense, fRevenue: m.forecast ? m.revenue : 0, fExpense: m.forecast ? m.expense : 0 }))} height={260} series={[{ key: "revenue", label: "Revenue", type: "line" }, { key: "expense", label: "Expense", type: "line", color: "var(--t-depth)" }, { key: "fRevenue", label: "Forecast revenue", type: "bar", color: "var(--t-soft)" }, { key: "fExpense", label: "Forecast expense", type: "bar", color: "var(--n-subtle)" }]} /></Panel>
            <DataTable hideSearch data={forecast.data.filter((m) => m.forecast)} rowKey={(m) => m.month} pageSize={6} columns={[{ id: "m", header: "Forecast month", accessor: (m) => m.month, cell: (m) => monthLabel(m.month, "MMM yyyy") }, { id: "r", header: "Revenue", align: "right", accessor: (m) => m.revenue, cell: (m) => f.money(m.revenue) }, { id: "e", header: "Expenses", align: "right", accessor: (m) => m.expense, cell: (m) => f.money(m.expense) }, { id: "p", header: "Profit", align: "right", accessor: (m) => m.revenue - m.expense, cell: (m) => f.money(m.revenue - m.expense, undefined, { parens: true }) }]} /></>}
          <p className="text-xs text-muted-foreground">Forecasts are simple linear trends over recent months — a demonstration, not a predictive model. Cash flow forecasting is on the AI &amp; Automation → Insights page.</p></TabsContent></Tabs>
      <BudgetEditor budget={edit} onClose={() => setEdit(null)} />
    </>
  );
}
