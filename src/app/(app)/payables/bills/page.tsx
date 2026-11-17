"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Banknote, CheckCircle2, Eye, Plus, Scale, Pencil, Ban } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable, type Column } from "@/components/shared/data-table";
import { Combobox } from "@/components/shared/form-controls";
import { Panel, StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { useConfirm } from "@/components/shared/confirm";
import { AgeingBar } from "@/components/features/ageing";
import { PaymentDialog } from "@/components/features/payment-dialog";
import { useApAgeing, useBills, useEntityMutation } from "@/hooks/use-data";
import { useContactOptions } from "@/hooks/use-options";
import { useApp, useFormat } from "@/providers/app-provider";
import { services, type BillRow } from "@/services";
import { formatDate } from "@/lib/formatters";

export default function BillsPage() {
  const router = useRouter(); const f = useFormat(); const confirm = useConfirm(); const { today } = useApp();
  const { data, isLoading, error, refetch } = useBills(); const ageing = useApAgeing(today); const vendors = useContactOptions("vendor");
  const [tab, setTab] = React.useState("open"); const [vendor, setVendor] = React.useState(""); const [pay, setPay] = React.useState<string | null>(null);
  const approve = useEntityMutation((e, id: string) => services.payables.approveBill(e, id), { success: "Bill approved & posted" });
  const voidB = useEntityMutation((e, id: string) => services.payables.voidBill(e, id), { success: "Bill voided with reversal" });
  const all = (data ?? []).filter((b) => !vendor || b.vendorId === vendor);
  const rows = all.filter((b) => tab === "all" || (tab === "open" && b.outstanding > 0.01) || (tab === "overdue" && b.displayStatus === "overdue") || (tab === "review" && ["draft", "pending_approval", "rejected"].includes(b.status)) || (tab === "paid" && b.displayStatus === "paid"));
  const out = all.reduce((s, b) => s + b.outstandingBase, 0), over = all.filter((b) => b.displayStatus === "overdue").reduce((s, b) => s + b.outstandingBase, 0);
  const dueWeek = all.filter((b) => b.outstanding > 0.01 && b.dueDate <= new Date(new Date(today).getTime() + 7 * 86400000).toISOString().slice(0, 10)).reduce((s, b) => s + b.outstandingBase, 0);
  const cols: Column<BillRow>[] = [
    { id: "n", header: "Bill", accessor: (b) => b.number, cell: (b) => <Link className="font-medium text-primary hover:underline" href={`/payables/bills/${b.id}`} onClick={(e) => e.stopPropagation()}>{b.number}</Link> },
    { id: "v", header: "Vendor", accessor: (b) => b.vendorName, className: "max-w-[220px] truncate" }, { id: "ref", header: "Vendor ref", accessor: (b) => b.vendorBillNo, hideBelow: "lg", className: "tnum text-xs" },
    { id: "d", header: "Date", accessor: (b) => b.date, cell: (b) => formatDate(b.date), hideBelow: "md" }, { id: "due", header: "Due", accessor: (b) => b.dueDate, cell: (b) => <span>{formatDate(b.dueDate)}{b.daysOverdue > 0 && <span className="ml-1 text-[11px] text-error">+{b.daysOverdue}d</span>}</span> },
    { id: "t", header: "Total", align: "right", accessor: (b) => b.total, cell: (b) => f.money(b.total, b.currency), hideBelow: "md" }, { id: "o", header: "Outstanding", align: "right", accessor: (b) => b.outstanding, cell: (b) => (b.outstanding ? f.money(b.outstanding, b.currency) : "—") },
    { id: "s", header: "Status", accessor: (b) => b.displayStatus, cell: (b) => <StatusBadge status={b.displayStatus} /> },
  ];
  return (
    <>
      <PageHeader title="Vendor Bills" description="Bills with due dates, partial payments and payables ageing." actions={<><Button variant="outline" size="sm" asChild><Link href="/reports/view/ap-ageing"><Scale /> Ageing report</Link></Button><Button variant="outline" size="sm" onClick={() => setPay("")}><Banknote /> Record payment</Button><Button size="sm" asChild><Link href="/payables/bills/new"><Plus /> New bill</Link></Button></>} />
      <div className="mb-3 grid gap-3 lg:grid-cols-[1fr_1.4fr]">
        <div className="grid grid-cols-3 gap-3"><StatCard label="Outstanding" value={f.money(out)} /><StatCard label="Overdue" value={f.money(over)} valueClassName={over ? "text-error" : undefined} /><StatCard label="Due in 7 days" value={f.money(dueWeek)} /></div>
        <Panel title="Payables ageing">{ageing.data ? <AgeingBar totals={ageing.data.totals} /> : <div className="h-12" />}</Panel>
      </div>
      <Tabs value={tab} onValueChange={setTab} className="mb-2"><TabsList><TabsTrigger value="open">Outstanding</TabsTrigger><TabsTrigger value="overdue">Overdue</TabsTrigger><TabsTrigger value="review">Draft / review</TabsTrigger><TabsTrigger value="paid">Paid</TabsTrigger><TabsTrigger value="all">All</TabsTrigger></TabsList></Tabs>
      <DataTable columns={cols} data={rows} rowKey={(b) => b.id} isLoading={isLoading} error={error as Error | null} onRetry={() => refetch()} exportName="vendor-bills" onRowClick={(b) => router.push(`/payables/bills/${b.id}`)} defaultSort={{ id: "due", dir: "asc" }} searchPlaceholder="Search bill, vendor, ref…"
        filters={<div className="w-56"><Combobox value={vendor} onChange={setVendor} options={[{ value: "", label: "All vendors" }, ...vendors]} placeholder="All vendors" /></div>}
        rowActions={(b) => [{ label: "View bill", icon: Eye, onClick: () => router.push(`/payables/bills/${b.id}`) }, { label: "Edit draft", icon: Pencil, onClick: () => router.push(`/payables/bills/${b.id}`), hidden: () => !["draft", "rejected"].includes(b.status) },
          { label: "Approve & post", icon: CheckCircle2, onClick: () => approve.mutate(b.id), hidden: () => !["draft", "pending_approval"].includes(b.status) }, { label: "Record payment", icon: Banknote, onClick: () => setPay(b.id), hidden: () => b.outstanding <= 0.01 },
          { label: "Void bill", icon: Ban, destructive: true, separatorBefore: true, hidden: () => !b.journalId || b.paid > 0 || b.status === "void", onClick: async () => { if (await confirm({ title: `Void ${b.number}?`, description: "Posts a reversing journal. Bills with payments can't be voided.", destructive: true, confirmLabel: "Void bill" })) voidB.mutate(b.id); } }]} />
      {pay !== null && <PaymentDialog kind="payment" open onOpenChange={(o) => !o && setPay(null)} docId={pay || undefined} />}
    </>
  );
}
