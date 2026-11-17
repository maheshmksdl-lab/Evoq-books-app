"use client";

import * as React from "react";
import { FilePlus2, Link2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable, type Column } from "@/components/shared/data-table";
import { FormDialog } from "@/components/shared/form-dialog";
import { StatusBadge } from "@/components/shared/status-badge";
import { useBills, useCreditNotes, useEntityMutation, useInvoices } from "@/hooks/use-data";
import { useContactOptions } from "@/hooks/use-options";
import { useApp, useFormat } from "@/providers/app-provider";
import { services } from "@/services";
import { creditNoteSchema } from "@/lib/validators";
import { GST_RATES } from "@/lib/constants";
import { formatDate } from "@/lib/formatters";
import { z } from "zod";

type CN = NonNullable<ReturnType<typeof useCreditNotes>["data"]>[number];

export function CreditNotesPage({ kind }: { kind: "customer" | "vendor" }) {
  const f = useFormat(); const { today, entity } = useApp(); const cust = kind === "customer";
  const { data, isLoading, error, refetch } = useCreditNotes(kind); const parties = useContactOptions(kind);
  const invoices = useInvoices().data ?? [], bills = useBills().data ?? [];
  const [create, setCreate] = React.useState(false); const [apply, setApply] = React.useState<CN | null>(null);
  const mk = useEntityMutation((e, i: Parameters<typeof services.receivables.createCreditNote>[1]) => services.receivables.createCreditNote(e, i), { success: (c) => `Credit note ${c.number} created` });
  const ap = useEntityMutation((e, i: { id: string; docId: string }) => services.receivables.applyCreditNote(e, i), { success: "Credit note applied" });
  const docOpts = apply ? (cust ? invoices.filter((i) => i.customerId === apply.contactId && i.outstanding > 0.01).map((i) => ({ value: i.id, label: `${i.number} · outstanding ${f.money(i.outstanding, i.currency)}` })) : bills.filter((b) => b.vendorId === apply.contactId && b.outstanding > 0.01 && b.journalId).map((b) => ({ value: b.id, label: `${b.number} · outstanding ${f.money(b.outstanding, b.currency)}` }))) : [];
  const cols: Column<CN>[] = [
    { id: "n", header: "Number", accessor: (c) => c.number, cell: (c) => <span className="font-medium">{c.number}</span> }, { id: "d", header: "Date", accessor: (c) => c.date, cell: (c) => formatDate(c.date) }, { id: "c", header: cust ? "Customer" : "Vendor", accessor: (c) => c.contactName },
    { id: "r", header: "Reason", accessor: (c) => c.reason, hideBelow: "md", className: "max-w-[260px] truncate" }, { id: "tax", header: "Tax", align: "right", accessor: (c) => c.tax, cell: (c) => f.money(c.tax), hideBelow: "lg" },
    { id: "a", header: "Amount", align: "right", accessor: (c) => c.amount, cell: (c) => f.money(c.amount) }, { id: "s", header: "Status", accessor: (c) => c.status, cell: (c) => <StatusBadge status={c.status} /> },
  ];
  return (
    <>
      <PageHeader title={cust ? "Credit Notes" : "Vendor Credits"} description={cust ? "Credits issued to customers for returns, rebates and corrections. Posting reduces receivables." : "Credits received from vendors. Posting reduces payables and input tax credit."} actions={<Button size="sm" onClick={() => setCreate(true)}><FilePlus2 /> New {cust ? "credit note" : "vendor credit"}</Button>} />
      <DataTable columns={cols} data={data ?? []} rowKey={(c) => c.id} isLoading={isLoading} error={error as Error | null} onRetry={() => refetch()} exportName={cust ? "credit-notes" : "vendor-credits"} defaultSort={{ id: "d", dir: "desc" }}
        rowActions={(c) => [{ label: `Apply to ${cust ? "invoice" : "bill"}…`, icon: Link2, onClick: () => setApply(c), hidden: () => c.status !== "open" }]} emptyTitle="No credit notes yet" />
      <FormDialog open={create} onOpenChange={setCreate} size="sm" title={cust ? "New credit note" : "New vendor credit"} description="Tax is calculated from the party's state and the entity's tax regime." submitLabel="Post credit note" schema={creditNoteSchema}
        fields={[{ name: "contactId", label: cust ? "Customer" : "Vendor", type: "combobox", options: parties, required: true, span: 2 }, { name: "date", label: "Date", type: "date", required: true }, { name: "net", label: "Amount before tax", type: "money", required: true }, { name: "taxRate", label: "GST %", type: "select", options: GST_RATES.map((r) => ({ value: String(r), label: `${r}%` })), show: () => entity?.taxRegime === "india-gst" }, { name: "reason", label: "Reason", type: "textarea", required: true }]}
        defaultValues={{ contactId: "", date: today, net: "", taxRate: entity?.taxRegime === "india-gst" ? "18" : "9", reason: "" }} onSubmit={async (v: { contactId: string; date: string; net: number; taxRate: number; reason: string }) => { await mk.mutateAsync({ kind, contactId: v.contactId, date: v.date, net: Number(v.net), taxRate: Number(v.taxRate), reason: v.reason }); }} />
      <FormDialog open={!!apply} onOpenChange={(o) => !o && setApply(null)} size="sm" title={`Apply ${apply?.number}`} description={`Settles up to ${apply ? f.money(apply.amount) : ""} of an open ${cust ? "invoice" : "bill"}. No new journal is posted — the credit was already recorded.`} submitLabel="Apply credit"
        schema={z.object({ docId: z.string().min(1, `Choose a ${cust ? "invoice" : "bill"}`) })} fields={[{ name: "docId", label: cust ? "Invoice" : "Bill", type: "select", options: docOpts, required: true, span: 2, hint: docOpts.length ? undefined : "No open documents for this party" }]} defaultValues={{ docId: "" }} onSubmit={async (v: { docId: string }) => { await ap.mutateAsync({ id: apply!.id, docId: v.docId }); }} />
    </>
  );
}
