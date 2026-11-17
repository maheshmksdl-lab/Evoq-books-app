"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { HandCoins } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/shared/page-header";
import { ErrorState, SimNotice, TableSkeleton } from "@/components/shared/states";
import { KV, Panel, StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { PaymentDialog } from "@/components/features/payment-dialog";
import { useEntityQuery } from "@/hooks/use-data";
import { useFormat } from "@/providers/app-provider";
import { services } from "@/services";
import { formatDate } from "@/lib/formatters";

export default function InvoiceDetailPage() {
  const { id } = useParams<{ id: string }>(); const f = useFormat(); const [pay, setPay] = React.useState(false);
  const { data, isLoading, error, refetch } = useEntityQuery(["invoice", id], (e) => services.receivables.invoice(e, id));
  if (error) return <ErrorState error={error as Error} onRetry={() => refetch()} />;
  if (isLoading || !data) return <TableSkeleton />;
  const { invoice: i, payments, creditNotes } = data; const tax = i.cgst + i.sgst + i.igst;
  return (
    <>
      <PageHeader title={<span className="flex items-center gap-2">{i.number} <StatusBadge status={i.displayStatus} /></span>} description={`${i.customerName} · issued ${formatDate(i.date)} · due ${formatDate(i.dueDate)}`} trail={[{ label: i.number }]}
        actions={<>{i.outstanding > 0.01 && <Button size="sm" onClick={() => setPay(true)}><HandCoins /> Record receipt</Button>}<Button variant="outline" size="sm" asChild><Link href={`/accounting/journals/${i.journalId}`}>View journal</Link></Button></>} />
      <SimNotice className="mb-3" title="Integration-generated">This invoice simulates a record received from EVOQ Billing. It cannot be edited in EVOQ Books.</SimNotice>
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4"><StatCard label="Invoice total" value={f.money(i.total, i.currency)} /><StatCard label="Received / settled" value={f.money(i.paid, i.currency)} /><StatCard label="Outstanding" value={f.money(i.outstanding, i.currency)} valueClassName={i.daysOverdue ? "text-error" : undefined} hint={i.daysOverdue ? `${i.daysOverdue} days overdue` : undefined} /><StatCard label="Currency" value={i.currency} hint={i.currency !== f.currency ? `Booked at ${i.fxRate}` : "Base currency"} /></div>
      <div className="grid gap-4 xl:grid-cols-[1fr_340px]">
        <div className="space-y-4">
          <Panel title="Line items" noPad>
            <Table><TableHeader className="bg-muted/50"><TableRow><TableHead>Description</TableHead><TableHead className="text-right">Qty</TableHead><TableHead className="text-right">Rate</TableHead><TableHead className="text-right">GST %</TableHead><TableHead className="text-right">Amount</TableHead></TableRow></TableHeader>
              <TableBody>{i.lines.map((l) => <TableRow key={l.id}><TableCell className="py-1.5">{l.description}</TableCell><TableCell className="num py-1.5">{l.qty}</TableCell><TableCell className="num py-1.5">{f.money(l.rate, i.currency)}</TableCell><TableCell className="num py-1.5">{l.taxRate}%</TableCell><TableCell className="num py-1.5">{f.money(l.amount, i.currency)}</TableCell></TableRow>)}</TableBody>
              <TableFooter><TableRow><TableCell colSpan={4} className="text-right text-xs">Subtotal</TableCell><TableCell className="num">{f.money(i.subtotal, i.currency)}</TableCell></TableRow>
                {i.cgst > 0 && <TableRow><TableCell colSpan={4} className="text-right text-xs">CGST</TableCell><TableCell className="num">{f.money(i.cgst, i.currency)}</TableCell></TableRow>}{i.sgst > 0 && <TableRow><TableCell colSpan={4} className="text-right text-xs">SGST</TableCell><TableCell className="num">{f.money(i.sgst, i.currency)}</TableCell></TableRow>}{i.igst > 0 && <TableRow><TableCell colSpan={4} className="text-right text-xs">IGST</TableCell><TableCell className="num">{f.money(i.igst, i.currency)}</TableCell></TableRow>}
                {tax === 0 && <TableRow><TableCell colSpan={4} className="text-right text-xs">Tax (zero-rated / export)</TableCell><TableCell className="num">{f.money(0, i.currency)}</TableCell></TableRow>}
                <TableRow><TableCell colSpan={4} className="text-right font-semibold">Total</TableCell><TableCell className="num font-semibold">{f.money(i.total, i.currency)}</TableCell></TableRow></TableFooter></Table>
          </Panel>
          <Panel title="Receipts & credits applied" noPad>
            {payments.length + creditNotes.length === 0 ? <p className="p-3 text-xs text-muted-foreground">Nothing received yet.</p> : <ul className="divide-y">{payments.map((p) => <li key={p.id} className="flex items-center justify-between gap-2 px-3 py-2 text-[13px]"><span><Link href="/receivables/payments" className="font-medium text-primary hover:underline">{p.number}</Link> <span className="text-muted-foreground">· {formatDate(p.date)} · {p.method.toUpperCase()} · {p.reference}</span></span><span className="tnum">{f.money(p.applied, i.currency)}</span></li>)}{creditNotes.map((c) => <li key={c.id} className="flex items-center justify-between px-3 py-2 text-[13px]"><span className="font-medium">{c.number} <span className="font-normal text-muted-foreground">· credit note · {c.reason}</span></span><span className="tnum">{f.money(c.amount, i.currency)}</span></li>)}</ul>}
          </Panel>
        </div>
        <Panel title="Details"><dl className="space-y-3"><KV label="Customer"><Link className="text-primary hover:underline" href={`/receivables/customers/${i.customerId}`}>{i.customerName}</Link></KV><KV label="Place of supply">{i.placeOfSupply}</KV><KV label="Source">{i.source}</KV><KV label="Terms">{Math.round((new Date(i.dueDate).getTime() - new Date(i.date).getTime()) / 86400000)} days</KV><KV label="Ledger journal"><Link className="text-primary hover:underline" href={`/accounting/journals/${i.journalId}`}>Open posting</Link></KV></dl></Panel>
      </div>
      <PaymentDialog kind="receipt" open={pay} onOpenChange={setPay} docId={i.id} />
    </>
  );
}
