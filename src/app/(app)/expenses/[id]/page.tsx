"use client";

import * as React from "react";
import { ByLine, PersonCell } from "@/components/shared/user-avatar";
import Link from "next/link";
import { useParams } from "next/navigation";
import { CheckCircle2, Pencil, Repeat, Send, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { ErrorState, SimNotice, TableSkeleton } from "@/components/shared/states";
import { FilePicker } from "@/components/shared/form-controls";
import { KV, Panel, StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { ExpenseDialog } from "@/components/features/expense-dialog";
import { useEntityMutation, useExpense } from "@/hooks/use-data";
import { useFormat } from "@/providers/app-provider";
import { services, type ExpenseInput } from "@/services";
import { formatBytes, formatDate, formatDateTime, titleCase } from "@/lib/formatters";

export default function ExpenseDetailPage() {
  const { id } = useParams<{ id: string }>(); const f = useFormat(); const { data, isLoading, error, refetch } = useExpense(id); const [edit, setEdit] = React.useState(false);
  const approve = useEntityMutation((e, i: string) => services.expenses.approve(e, i), { success: "Expense approved & posted" });
  const reject = useEntityMutation((e, i: string) => services.expenses.reject(e, i), { success: "Expense rejected" });
  const submit = useEntityMutation((e, i: ExpenseInput) => services.expenses.save(e, i), { success: "Submitted" });
  const attach = useEntityMutation(async (e, i: { file: File; expenseId: string; number: string }) => {
    const dataUrl = i.file.type.startsWith("image") && i.file.size < 400_000 ? await new Promise<string>((res) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.readAsDataURL(i.file); }) : undefined;
    const d = await services.org.addDocument(e, { name: i.file.name, size: i.file.size, mime: i.file.type || "application/octet-stream", category: "Receipt", linkedType: "expense", linkedId: i.expenseId, linkedRef: i.number, dataUrl });
    const { patch } = await import("@/lib/mock/db"); patch("expenses", i.expenseId, { receiptDocId: d.id }); return d;
  }, { success: "Receipt attached (simulated storage)" });
  if (error) return <ErrorState error={error as Error} onRetry={() => refetch()} />;
  if (isLoading || !data) return <TableSkeleton />;
  const { expense: x, approvals, receipt, journal } = data; const editable = ["draft", "rejected"].includes(x.status);
  return (
    <>
      <PageHeader title={<span className="flex items-center gap-2">{x.number} <StatusBadge status={x.status} /></span>} description={x.description} trail={[{ label: x.number }]}
        actions={<>
          {editable && <><Button variant="outline" size="sm" onClick={() => setEdit(true)}><Pencil /> Edit</Button><Button size="sm" onClick={() => submit.mutate({ id: x.id, date: x.date, categoryId: x.categoryId, vendorId: x.vendorId, description: x.description, amount: x.taxTreatment === "exclusive" ? x.amount - x.taxAmount : x.amount, taxTreatment: x.taxTreatment, gstRate: x.gstRate, paymentAccountId: x.paymentAccountId, paymentMethod: x.paymentMethod, recurring: x.recurring, departmentId: x.departmentId, mode: "submit" })}><Send /> Submit</Button></>}
          {x.status === "pending_approval" && <><Button variant="outline" size="sm" onClick={() => reject.mutate(x.id)}><XCircle /> Reject</Button><Button size="sm" onClick={() => approve.mutate(x.id)}><CheckCircle2 /> Approve & post</Button></>}
          {journal && <Button variant="outline" size="sm" asChild><Link href={`/accounting/journals/${journal.id}`}>View journal</Link></Button>}
        </>} />
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4"><StatCard label="Total amount" value={f.money(x.amount)} /><StatCard label="Net of tax" value={f.money(x.amount - x.taxAmount)} /><StatCard label={`GST (${x.gstRate}%)`} value={f.money(x.taxAmount)} hint={titleCase(x.taxTreatment)} /><StatCard label="Category" value={x.categoryName} /></div>
      <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          <Panel title="Details"><dl className="grid grid-cols-2 gap-4 md:grid-cols-3"><KV label="Date">{formatDate(x.date)}</KV><KV label="Vendor">{x.vendorName}</KV><KV label="Payment account">{x.paymentName}</KV><KV label="Method">{x.paymentMethod.toUpperCase()}</KV><KV label="Submitted by"><PersonCell name={x.submittedBy} /></KV><KV label="Created">{formatDateTime(x.createdAt)}</KV>{x.recurring && <KV label="Recurring"><span className="inline-flex items-center gap-1"><Repeat className="size-3" /> {titleCase(x.recurring.frequency)} · next {formatDate(x.recurring.nextDate)}</span></KV>}</dl></Panel>
          <Panel title="Approval history">{approvals.length === 0 ? <p className="text-xs text-muted-foreground">{x.status === "paid" ? "Approved automatically — below the approval limit." : "Not submitted yet."}</p> : <ol className="space-y-2 border-l pl-3">{approvals.flatMap((a) => a.history).map((h, i) => <li key={i} className="relative text-xs"><span className="absolute -left-[17px] top-1 size-2 rounded-full bg-action" /><p className="font-medium capitalize">{h.action}</p><ByLine name={h.by} at={h.at} />{h.comment && <p>{h.comment}</p>}</li>)}</ol>}</Panel>
        </div>
        <Panel title="Receipt">
          {receipt ? (<div className="space-y-2">{receipt.dataUrl?.startsWith("data:image") ?   <img src={receipt.dataUrl} alt={receipt.name} className="max-h-72 w-full rounded border object-contain" /> : <pre className="max-h-60 overflow-auto whitespace-pre-wrap rounded border bg-white p-3 font-mono text-xs">{receipt.previewText ?? "No preview available"}</pre>}<p className="text-xs text-muted-foreground">{receipt.name} · {formatBytes(receipt.size)}</p></div>)
            : <><SimNotice className="mb-2">Receipts are stored as simulated browser files, not in cloud storage.</SimNotice><FilePicker accept="image/*,.pdf" label="Attach receipt" onFiles={(fs) => attach.mutate({ file: fs[0], expenseId: x.id, number: x.number })} description="Drop a receipt image or PDF" /></>}
        </Panel>
      </div>
      {edit && <ExpenseDialog open onOpenChange={setEdit} expense={x} />}
    </>
  );
}
