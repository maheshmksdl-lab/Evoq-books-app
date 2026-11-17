"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, Eye, Pencil, Plus, Repeat, Send, Trash2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable, type Column } from "@/components/shared/data-table";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { useConfirm } from "@/components/shared/confirm";
import { ExpenseDialog } from "@/components/features/expense-dialog";
import { useEntityMutation, useExpenses } from "@/hooks/use-data";
import { useFormat } from "@/providers/app-provider";
import { services, type ExpenseInput } from "@/services";
import { formatDate, titleCase } from "@/lib/formatters";

type Row = NonNullable<ReturnType<typeof useExpenses>["data"]>[number];

export default function ExpensesPage() {
  const router = useRouter(); const f = useFormat(); const confirm = useConfirm(); const { data, isLoading, error, refetch } = useExpenses();
  const [tab, setTab] = React.useState("all"); const [edit, setEdit] = React.useState<Row | "new" | null>(null);
  const approve = useEntityMutation((e, id: string) => services.expenses.approve(e, id), { success: "Expense approved & posted" });
  const reject = useEntityMutation((e, id: string) => services.expenses.reject(e, id), { success: "Expense rejected" });
  const remove = useEntityMutation((e, id: string) => services.expenses.remove(e, id), { success: "Expense deleted" });
  const run = useEntityMutation((e, id: string) => services.expenses.runRecurring(e, id), { success: (x) => `Draft ${x.number} generated from recurring expense` });
  const submit = useEntityMutation((e, x: Row) => services.expenses.save(e, { ...(x as unknown as ExpenseInput), id: x.id, taxTreatment: x.taxTreatment, amount: x.taxTreatment === "exclusive" ? x.amount - x.taxAmount : x.amount, mode: "submit" }), { success: "Submitted" });
  const all = data ?? []; const posted = all.filter((x) => x.status === "paid");
  const rows = all.filter((x) => tab === "all" || (tab === "pending" && x.status === "pending_approval") || (tab === "draft" && ["draft", "rejected"].includes(x.status)) || (tab === "paid" && x.status === "paid") || (tab === "recurring" && !!x.recurring));
  const cols: Column<Row>[] = [
    { id: "n", header: "Expense", accessor: (x) => x.number, cell: (x) => <Link className="font-medium text-primary hover:underline" href={`/expenses/${x.id}`} onClick={(e) => e.stopPropagation()}>{x.number}</Link> }, { id: "d", header: "Date", accessor: (x) => x.date, cell: (x) => formatDate(x.date) },
    { id: "desc", header: "Description", accessor: (x) => x.description, className: "max-w-[260px] truncate" }, { id: "cat", header: "Category", accessor: (x) => x.categoryName, hideBelow: "md" }, { id: "pay", header: "Paid via", accessor: (x) => `${x.paymentName} ${x.paymentMethod}`, cell: (x) => <span className="text-xs text-muted-foreground">{x.paymentName}<br />{x.paymentMethod.toUpperCase()}</span>, hideBelow: "lg" },
    { id: "by", header: "Submitted by", accessor: (x) => x.submittedBy, hideBelow: "lg" }, { id: "tax", header: "GST", align: "right", accessor: (x) => x.taxAmount, cell: (x) => (x.taxAmount ? f.money(x.taxAmount) : "—"), hideBelow: "lg" },
    { id: "a", header: "Amount", align: "right", accessor: (x) => x.amount, cell: (x) => f.money(x.amount) }, { id: "s", header: "Status", accessor: (x) => x.status, cell: (x) => <span className="flex items-center gap-1"><StatusBadge status={x.status === "paid" ? "paid" : x.status} />{x.recurring && <Repeat className="size-3 text-muted-foreground" aria-label="Recurring" />}</span> },
  ];
  return (
    <>
      <PageHeader title="Expenses" description="Employee and company expenses with category, tax treatment, receipts and approval." actions={<Button size="sm" onClick={() => setEdit("new")}><Plus /> New expense</Button>} />
      <div className="mb-3 grid grid-cols-2 gap-3 lg:grid-cols-4"><StatCard label="Posted this FY" value={f.money(posted.reduce((s, x) => s + x.amount, 0))} hint={`${posted.length} expenses`} /><StatCard label="Pending approval" value={String(all.filter((x) => x.status === "pending_approval").length)} hint={f.money(all.filter((x) => x.status === "pending_approval").reduce((s, x) => s + x.amount, 0))} /><StatCard label="Drafts / rejected" value={String(all.filter((x) => ["draft", "rejected"].includes(x.status)).length)} /><StatCard label="Recurring" value={String(all.filter((x) => x.recurring).length)} hint="monthly templates" /></div>
      <Tabs value={tab} onValueChange={setTab} className="mb-2"><TabsList><TabsTrigger value="all">All</TabsTrigger><TabsTrigger value="pending">Pending approval</TabsTrigger><TabsTrigger value="draft">Draft / rejected</TabsTrigger><TabsTrigger value="paid">Posted</TabsTrigger><TabsTrigger value="recurring">Recurring</TabsTrigger></TabsList></Tabs>
      <DataTable columns={cols} data={rows} rowKey={(x) => x.id} isLoading={isLoading} error={error as Error | null} onRetry={() => refetch()} exportName="expenses" onRowClick={(x) => router.push(`/expenses/${x.id}`)} defaultSort={{ id: "d", dir: "desc" }} pageSize={20} searchPlaceholder="Search description, category, submitter…"
        rowActions={(x) => [{ label: "View", icon: Eye, onClick: () => router.push(`/expenses/${x.id}`) }, { label: "Edit", icon: Pencil, onClick: () => setEdit(x), hidden: () => !["draft", "rejected"].includes(x.status) }, { label: "Submit for approval", icon: Send, onClick: () => submit.mutate(x), hidden: () => !["draft", "rejected"].includes(x.status) },
          { label: "Approve & pay", icon: CheckCircle2, onClick: () => approve.mutate(x.id), hidden: () => !["pending_approval", "approved"].includes(x.status) }, { label: "Reject", icon: XCircle, onClick: () => reject.mutate(x.id), hidden: () => x.status !== "pending_approval" },
          { label: "Generate next recurring", icon: Repeat, onClick: () => run.mutate(x.id), hidden: () => !x.recurring }, { label: "Delete", icon: Trash2, destructive: true, separatorBefore: true, hidden: () => !["draft", "rejected"].includes(x.status), onClick: async () => { if (await confirm({ title: `Delete ${x.number}?`, destructive: true, confirmLabel: "Delete" })) remove.mutate(x.id); } }]} />
      {edit && <ExpenseDialog open onOpenChange={(o) => !o && setEdit(null)} expense={edit === "new" ? null : edit} />}
      <span className="hidden">{titleCase("x")}</span>
    </>
  );
}
