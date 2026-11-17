"use client";
import * as React from "react";
import { Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable, type Column } from "@/components/shared/data-table";
import { FormDialog } from "@/components/shared/form-dialog";
import { StatusBadge } from "@/components/shared/status-badge";
import { useAccounts, useEntityMutation, useExpenseCategories } from "@/hooks/use-data";
import { useAccountOptions } from "@/hooks/use-options";
import { useFormat } from "@/providers/app-provider";
import { services } from "@/services";
import { GST_RATES } from "@/lib/constants";
import { z } from "zod";
import type { ExpenseCategory } from "@/types";
export default function Page() {
  const f = useFormat(); const { data, isLoading, error, refetch } = useExpenseCategories(); const accounts = useAccounts().data ?? []; const opts = useAccountOptions(["expense"]); const [edit, setEdit] = React.useState<ExpenseCategory | "new" | null>(null);
  const save = useEntityMutation((e, i: Parameters<typeof services.expenses.saveCategory>[1]) => services.expenses.saveCategory(e, i), { success: "Category saved" });
  const cols: Column<ExpenseCategory>[] = [
    { id: "n", header: "Category", accessor: (c) => c.name, cell: (c) => <span className="font-medium">{c.name}</span> }, { id: "a", header: "Ledger account", accessor: (c) => accounts.find((a) => a.id === c.accountId)?.name ?? "" },
    { id: "g", header: "Default GST", align: "right", accessor: (c) => c.defaultTaxRate, cell: (c) => `${c.defaultTaxRate}%` }, { id: "b", header: "Monthly budget", align: "right", accessor: (c) => c.budgetMonthly ?? 0, cell: (c) => (c.budgetMonthly ? f.money(c.budgetMonthly) : "—") }, { id: "s", header: "Status", accessor: (c) => (c.active ? "active" : "inactive"), cell: (c) => <StatusBadge status={c.active ? "active" : "inactive"} /> },
  ];
  return (<>
    <PageHeader title="Expense Categories" description="Each category maps to an expense ledger account and a default GST rate." actions={<Button size="sm" onClick={() => setEdit("new")}><Plus /> New category</Button>} />
    <DataTable columns={cols} data={data ?? []} rowKey={(c) => c.id} isLoading={isLoading} error={error as Error | null} onRetry={() => refetch()} hideSearch rowActions={[{ label: "Edit", icon: Pencil, onClick: (c) => setEdit(c) }]} />
    <FormDialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)} size="sm" title={edit && edit !== "new" ? "Edit category" : "New category"} submitLabel="Save category" schema={z.object({ name: z.string().min(1, "Name is required"), accountId: z.string().min(1, "Choose a ledger account"), defaultTaxRate: z.coerce.number().min(0).max(28), budgetMonthly: z.coerce.number().min(0).optional(), active: z.boolean() })}
      fields={[{ name: "name", label: "Category name", required: true, span: 2 }, { name: "accountId", label: "Expense ledger account", type: "combobox", options: opts, required: true, span: 2 }, { name: "defaultTaxRate", label: "Default GST %", type: "select", options: GST_RATES.map((r) => ({ value: String(r), label: `${r}%` })) }, { name: "budgetMonthly", label: "Monthly budget", type: "money" }, { name: "active", label: "Active", type: "switch", span: 2 }]}
      defaultValues={edit && edit !== "new" ? { ...edit, defaultTaxRate: String(edit.defaultTaxRate), budgetMonthly: edit.budgetMonthly ?? "" } : { name: "", accountId: "", defaultTaxRate: "18", budgetMonthly: "", active: true }}
      onSubmit={async (v: { name: string; accountId: string; defaultTaxRate: number; budgetMonthly?: number; active: boolean }) => { await save.mutateAsync({ ...v, id: edit && edit !== "new" ? edit.id : undefined, defaultTaxRate: Number(v.defaultTaxRate), budgetMonthly: v.budgetMonthly ? Number(v.budgetMonthly) : undefined }); }} />
  </>);
}
