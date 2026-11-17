"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Banknote, CheckCircle2, XCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/shared/page-header";
import { ErrorState, TableSkeleton } from "@/components/shared/states";
import { KV, Panel, StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { BillForm } from "@/components/features/bill-form";
import { PaymentDialog } from "@/components/features/payment-dialog";
import { useBill, useEntityMutation } from "@/hooks/use-data";
import { useFormat } from "@/providers/app-provider";
import { services } from "@/services";
import { formatBytes, formatDate, formatDateTime } from "@/lib/formatters";

export default function BillDetailPage() {
  const { id } = useParams<{ id: string }>(); const f = useFormat(); const { data, isLoading, error, refetch } = useBill(id); const [pay, setPay] = React.useState(false);
  const approve = useEntityMutation((e, i: string) => services.payables.approveBill(e, i), { success: "Bill approved & posted" });
  const reject = useEntityMutation((e, i: string) => services.payables.rejectBill(e, i), { success: "Bill rejected" });
  if (error) return <ErrorState error={error as Error} onRetry={() => refetch()} />;
  if (isLoading || !data) return <TableSkeleton />;
  const { bill: b, payments, approvals, documents, creditNotes } = data;
  if (["draft", "rejected"].includes(b.status)) return <BillForm initial={{ id: b.id, vendorId: b.vendorId, vendorBillNo: b.vendorBillNo, date: b.date, dueDate: b.dueDate, currency: b.currency, notes: b.notes ?? "", tdsKey: b.tdsSection ? `${b.tdsSection}|${b.subtotal ? Math.round((b.tdsAmount / b.subtotal) * 1000) / 10 : 0}` : "", attachments: b.attachments, lines: b.lines.map((l) => ({ description: l.description, accountId: l.accountId ?? "", qty: l.qty, rate: l.rate, taxRate: l.taxRate })) }} />;
  return (
    <>
      <PageHeader title={<span className="flex items-center gap-2">{b.number} <StatusBadge status={b.displayStatus} /></span>} description={`${b.vendorName} · vendor ref ${b.vendorBillNo} · due ${formatDate(b.dueDate)}`} trail={[{ label: b.number }]}
        actions={<>
          {b.status === "pending_approval" && <><Button variant="outline" size="sm" onClick={() => reject.mutate(b.id)}><XCircle /> Reject</Button><Button size="sm" onClick={() => approve.mutate(b.id)}><CheckCircle2 /> Approve & post</Button></>}
          {b.outstanding > 0.01 && <Button size="sm" onClick={() => setPay(true)}><Banknote /> Record payment</Button>}
          {b.journalId && <Button variant="outline" size="sm" asChild><Link href={`/accounting/journals/${b.journalId}`}>View journal</Link></Button>}
        </>} />
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4"><StatCard label="Bill total" value={f.money(b.total, b.currency)} /><StatCard label="TDS withheld" value={f.money(b.tdsAmount, b.currency)} hint={b.tdsSection} /><StatCard label="Paid / settled" value={f.money(b.paid, b.currency)} /><StatCard label="Outstanding" value={f.money(b.outstanding, b.currency)} valueClassName={b.daysOverdue ? "text-error" : undefined} hint={b.daysOverdue ? `${b.daysOverdue} days overdue` : undefined} /></div>
      <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          <Panel title="Line items" noPad><Table><TableHeader className="bg-muted/50"><TableRow><TableHead>Description</TableHead><TableHead className="text-right">Qty</TableHead><TableHead className="text-right">Rate</TableHead><TableHead className="text-right">GST %</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
            <TableBody>{b.lines.map((l) => <TableRow key={l.id}><TableCell className="py-1.5">{l.description}</TableCell><TableCell className="num py-1.5">{l.qty}</TableCell><TableCell className="num py-1.5">{f.money(l.rate, b.currency)}</TableCell><TableCell className="num py-1.5">{l.taxRate}%</TableCell><TableCell className="num py-1.5">{f.money(l.amount, b.currency)}</TableCell></TableRow>)}</TableBody>
            <TableFooter><TableRow><TableCell colSpan={4} className="text-right text-xs">Subtotal</TableCell><TableCell className="num">{f.money(b.subtotal, b.currency)}</TableCell></TableRow>{b.cgst > 0 && <TableRow><TableCell colSpan={4} className="text-right text-xs">CGST</TableCell><TableCell className="num">{f.money(b.cgst, b.currency)}</TableCell></TableRow>}{b.sgst > 0 && <TableRow><TableCell colSpan={4} className="text-right text-xs">SGST</TableCell><TableCell className="num">{f.money(b.sgst, b.currency)}</TableCell></TableRow>}{b.igst > 0 && <TableRow><TableCell colSpan={4} className="text-right text-xs">IGST</TableCell><TableCell className="num">{f.money(b.igst, b.currency)}</TableCell></TableRow>}<TableRow><TableCell colSpan={4} className="text-right font-semibold">Total</TableCell><TableCell className="num font-semibold">{f.money(b.total, b.currency)}</TableCell></TableRow>{b.tdsAmount > 0 && <TableRow><TableCell colSpan={4} className="text-right text-xs">Less TDS ({b.tdsSection})</TableCell><TableCell className="num">− {f.money(b.tdsAmount, b.currency)}</TableCell></TableRow>}<TableRow><TableCell colSpan={4} className="text-right font-semibold">Net payable</TableCell><TableCell className="num font-semibold">{f.money(b.netPayable, b.currency)}</TableCell></TableRow></TableFooter></Table></Panel>
          <Panel title="Payment history" noPad>{payments.length + creditNotes.length === 0 ? <p className="p-3 text-xs text-muted-foreground">No payments yet.</p> : <ul className="divide-y">{payments.map((p) => <li key={p.id} className="flex items-center justify-between px-3 py-2 text-[13px]"><span><Link className="font-medium text-primary hover:underline" href={p.journalId ? `/accounting/journals/${p.journalId}` : "#"}>{p.number}</Link> <span className="text-muted-foreground">· {formatDate(p.date)} · {p.method.toUpperCase()} {p.reference}</span></span><span className="tnum">{f.money(p.applied, b.currency)} <StatusBadge status={p.status} className="ml-1" /></span></li>)}{creditNotes.map((c) => <li key={c.id} className="flex items-center justify-between px-3 py-2 text-[13px]"><span className="font-medium">{c.number} <span className="font-normal text-muted-foreground">· vendor credit</span></span><span className="tnum">{f.money(c.amount, b.currency)}</span></li>)}</ul>}</Panel>
        </div>
        <div className="space-y-4">
          <Panel title="Details"><dl className="space-y-3"><KV label="Vendor"><Link className="text-primary hover:underline" href={`/payables/vendors/${b.vendorId}`}>{b.vendorName}</Link></KV><KV label="Bill date">{formatDate(b.date)}</KV><KV label="Due date">{formatDate(b.dueDate)}</KV><KV label="Created">{b.createdBy} · {formatDateTime(b.createdAt)}</KV>{b.notes && <KV label="Notes">{b.notes}</KV>}{b.intercompany && <KV label="Intercompany"><StatusBadge status="info" label="Intercompany bill" tone="info" /></KV>}</dl></Panel>
          <Panel title="Approval history">{approvals.length === 0 ? <p className="text-xs text-muted-foreground">No approval was required.</p> : <ol className="space-y-2 border-l pl-3">{approvals.flatMap((a) => a.history).map((h, i) => <li key={i} className="relative text-xs"><span className="absolute -left-[17px] top-1 size-2 rounded-full bg-action" /><p className="font-medium capitalize">{h.action}</p><p className="text-muted-foreground">{h.by} · {formatDateTime(h.at)}</p>{h.comment && <p>{h.comment}</p>}</li>)}</ol>}</Panel>
          <Panel title="Documents">{documents.length === 0 ? <p className="text-xs text-muted-foreground">No attachments.</p> : <ul className="space-y-1">{documents.map((d) => <li key={d.id} className="flex justify-between rounded border px-2 py-1 text-xs"><span className="truncate">{d.name}</span><span className="text-muted-foreground">{formatBytes(d.size)}</span></li>)}</ul>}</Panel>
        </div>
      </div>
      <PaymentDialog kind="payment" open={pay} onOpenChange={setPay} docId={b.id} />
    </>
  );
}
