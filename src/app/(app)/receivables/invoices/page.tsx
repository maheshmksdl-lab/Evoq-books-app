"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Eye, HandCoins, Scale, SlidersHorizontal, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable, type Column } from "@/components/shared/data-table";
import { Combobox } from "@/components/shared/form-controls";
import { FormDialog } from "@/components/shared/form-dialog";
import { SimNotice } from "@/components/shared/states";
import { Panel, StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { PaymentDialog } from "@/components/features/payment-dialog";
import { AgeingBar } from "@/components/features/ageing";
import { useArAgeing, useEntityMutation, useInvoices } from "@/hooks/use-data";
import { useContactOptions } from "@/hooks/use-options";
import { useApp, useFormat } from "@/providers/app-provider";
import { services, type InvoiceRow } from "@/services";
import { writeOffSchema } from "@/lib/validators";
import { formatDate } from "@/lib/formatters";
import { z } from "zod";

export default function ReceivablesPage() {
  const router = useRouter(); const f = useFormat(); const { today } = useApp();
  const { data, isLoading, error, refetch } = useInvoices(); const ageing = useArAgeing(today); const customers = useContactOptions("customer");
  const [tab, setTab] = React.useState("outstanding"); const [cust, setCust] = React.useState(""); const [pay, setPay] = React.useState<{ doc?: string; contact?: string } | null>(null); const [wo, setWo] = React.useState<InvoiceRow | null>(null); const [adj, setAdj] = React.useState(false);
  const writeOff = useEntityMutation((e, i: { invoiceId: string; amount: number; reason: string; date: string }) => services.receivables.writeOff(e, i), { success: (r) => (r.pending ? "Write-off sent for approval" : "Bad debt written off") });
  const adjust = useEntityMutation((e, i: { customerId: string; type: "increase" | "decrease"; amount: number; reason: string; date: string }) => services.receivables.adjust(e, i), { success: (r) => (r.pending ? "Adjustment sent for approval" : "Adjustment posted") });
  const all = (data ?? []).filter((i) => !cust || i.customerId === cust);
  const rows = all.filter((i) => tab === "all" || (tab === "outstanding" && i.outstanding > 0.01) || (tab === "overdue" && i.displayStatus === "overdue") || (tab === "paid" && (i.displayStatus === "paid" || i.displayStatus === "written_off")));
  const out = all.reduce((s, i) => s + (i.outstanding > 0.01 ? i.outstandingBase : 0), 0), overdue = all.filter((i) => i.displayStatus === "overdue").reduce((s, i) => s + i.outstandingBase, 0);
  const cols: Column<InvoiceRow>[] = [
    { id: "n", header: "Invoice", accessor: (i) => i.number, cell: (i) => <Link className="font-medium text-primary hover:underline" href={`/receivables/invoices/${i.id}`} onClick={(e) => e.stopPropagation()}>{i.number}</Link> },
    { id: "c", header: "Customer", accessor: (i) => i.customerName, className: "max-w-[220px] truncate" }, { id: "d", header: "Date", accessor: (i) => i.date, cell: (i) => formatDate(i.date), hideBelow: "md" },
    { id: "due", header: "Due", accessor: (i) => i.dueDate, cell: (i) => <span>{formatDate(i.dueDate)}{i.daysOverdue > 0 && <span className="ml-1 text-[11px] text-error">+{i.daysOverdue}d</span>}</span> },
    { id: "t", header: "Total", align: "right", accessor: (i) => i.total, cell: (i) => f.money(i.total, i.currency), hideBelow: "md" }, { id: "o", header: "Outstanding", align: "right", accessor: (i) => i.outstanding, cell: (i) => f.money(i.outstanding, i.currency) },
    { id: "s", header: "Status", accessor: (i) => i.displayStatus, cell: (i) => <StatusBadge status={i.displayStatus} /> },
    { id: "src", header: "Source", accessor: (i) => i.source, cell: () => <span className="text-[11px] text-muted-foreground">EVOQ Billing · sample</span>, hideBelow: "lg" },
  ];
  return (
    <>
      <PageHeader title="Receivables" description="Outstanding customer invoices, receipts, credit notes and adjustments." actions={<><Button variant="outline" size="sm" onClick={() => setAdj(true)}><SlidersHorizontal /> Adjustment</Button><Button variant="outline" size="sm" asChild><Link href="/reports/view/ar-ageing"><Scale /> Ageing report</Link></Button><Button size="sm" onClick={() => setPay({})}><HandCoins /> Record receipt</Button></>} />
      <SimNotice className="mb-3" title="Integration-generated sample data">Invoices simulate records arriving from EVOQ Billing. They are read-only here — creating and editing invoices belongs to that product.</SimNotice>
      <div className="mb-3 grid gap-3 lg:grid-cols-[1fr_1.4fr]">
        <div className="grid grid-cols-2 gap-3"><StatCard label="Total outstanding" value={f.money(out)} /><StatCard label="Overdue" value={f.money(overdue)} valueClassName={overdue ? "text-error" : undefined} hint={`${all.filter((i) => i.displayStatus === "overdue").length} invoices`} /></div>
        <Panel title="Receivables ageing" description="Outstanding by days past due">{ageing.data ? <AgeingBar totals={ageing.data.totals} /> : <div className="h-12" />}</Panel>
      </div>
      <Tabs value={tab} onValueChange={setTab} className="mb-2"><TabsList><TabsTrigger value="outstanding">Outstanding</TabsTrigger><TabsTrigger value="overdue">Overdue</TabsTrigger><TabsTrigger value="paid">Paid / settled</TabsTrigger><TabsTrigger value="all">All</TabsTrigger></TabsList></Tabs>
      <DataTable columns={cols} data={rows} rowKey={(i) => i.id} isLoading={isLoading} error={error as Error | null} onRetry={() => refetch()} exportName="receivables" onRowClick={(i) => router.push(`/receivables/invoices/${i.id}`)} defaultSort={{ id: "due", dir: "asc" }} searchPlaceholder="Search invoice or customer…"
        filters={<div className="w-56"><Combobox value={cust} onChange={setCust} options={[{ value: "", label: "All customers" }, ...customers]} placeholder="All customers" /></div>}
        rowActions={(i) => [{ label: "View invoice", icon: Eye, onClick: () => router.push(`/receivables/invoices/${i.id}`) }, { label: "Record receipt", icon: HandCoins, onClick: () => setPay({ doc: i.id }), hidden: () => i.outstanding <= 0.01 }, { label: "Write off bad debt…", icon: Trash2, destructive: true, onClick: () => setWo(i), hidden: () => i.outstanding <= 0.01, separatorBefore: true }]} />
      {pay && <PaymentDialog kind="receipt" open onOpenChange={(o) => !o && setPay(null)} docId={pay.doc} contactId={pay.contact} />}
      <FormDialog open={!!wo} onOpenChange={(o) => !o && setWo(null)} size="sm" title={`Bad debt write-off – ${wo?.number}`} description={wo ? `Outstanding ${f.money(wo.outstanding, wo.currency)}. Posts Dr Bad Debts / Cr Accounts Receivable.` : undefined} submitLabel="Write off" schema={writeOffSchema}
        fields={[{ name: "amount", label: "Amount to write off", type: "money", required: true }, { name: "date", label: "Date", type: "date", required: true }, { name: "reason", label: "Reason", type: "textarea", required: true }]} defaultValues={{ amount: wo?.outstanding ?? "", date: today, reason: "" }}
        onSubmit={async (v: { amount: number; reason: string; date: string }) => { await writeOff.mutateAsync({ invoiceId: wo!.id, amount: Number(v.amount), reason: v.reason, date: v.date }); }} />
      <FormDialog open={adj} onOpenChange={setAdj} size="sm" title="Receivable adjustment" description="Increase (e.g. late fee) or decrease (e.g. discount allowed) a customer's balance." submitLabel="Post adjustment"
        schema={z.object({ customerId: z.string().min(1, "Select a customer"), type: z.enum(["increase", "decrease"]), amount: z.coerce.number().gt(0, "Must be greater than zero"), date: z.string().min(1), reason: z.string().min(1, "Reason is required") })}
        fields={[{ name: "customerId", label: "Customer", type: "combobox", options: customers, required: true, span: 2 }, { name: "type", label: "Type", type: "select", options: [{ value: "decrease", label: "Decrease balance (discount / waiver)" }, { value: "increase", label: "Increase balance (charge)" }] }, { name: "amount", label: "Amount", type: "money", required: true }, { name: "date", label: "Date", type: "date" }, { name: "reason", label: "Reason", required: true }]}
        defaultValues={{ customerId: "", type: "decrease", amount: "", date: today, reason: "" }} onSubmit={async (v: { customerId: string; type: "increase" | "decrease"; amount: number; date: string; reason: string }) => { await adjust.mutateAsync({ ...v, amount: Number(v.amount) }); }} />
    </>
  );
}
