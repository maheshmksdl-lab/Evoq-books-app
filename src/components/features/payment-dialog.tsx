"use client";

import * as React from "react";
import { Loader2, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Combobox, DateField, FieldShell, SelectField } from "@/components/shared/form-controls";
import { SimNotice } from "@/components/shared/states";
import { useBankOptions, useContactOptions } from "@/hooks/use-options";
import { useBankAccounts, useBills, useContacts, useEntityMutation, useInvoices } from "@/hooks/use-data";
import { useApp, useFormat } from "@/providers/app-provider";
import { services } from "@/services";
import { paymentSchema } from "@/lib/validators";
import { PAYMENT_METHODS } from "@/lib/constants";
import { sampleRate } from "@/lib/mock/generate";
import { formatDate, round2 } from "@/lib/formatters";

/** Record a customer receipt or a vendor payment with allocation to open documents. Simulated — no money moves. */
export function PaymentDialog({ kind, open, onOpenChange, contactId: presetContact, docId: presetDoc }: { kind: "receipt" | "payment"; open: boolean; onOpenChange: (o: boolean) => void; contactId?: string; docId?: string }) {
  const f = useFormat(); const { today, entity } = useApp(); const base = entity?.baseCurrency ?? "INR";
  const parties = useContactOptions(kind === "receipt" ? "customer" : "vendor"); const banks = useBankOptions(["bank", "cash"]); const bankRows = useBankAccounts().data ?? [];
  const invoices = useInvoices().data ?? []; const bills = useBills().data ?? []; const contacts = useContacts().data ?? [];
  const [contactId, setContactId] = React.useState(""); const [date, setDate] = React.useState(today); const [amount, setAmount] = React.useState(""); const [method, setMethod] = React.useState("neft"); const [bankId, setBankId] = React.useState(""); const [reference, setReference] = React.useState(""); const [notes, setNotes] = React.useState("");
  const [alloc, setAlloc] = React.useState<Record<string, string>>({}); const [fx, setFx] = React.useState(""); const [errors, setErrors] = React.useState<Record<string, string>>({}); const [serverErr, setServerErr] = React.useState<string | null>(null);

  const contact = contacts.find((c) => c.id === contactId); const cur = contact?.currency ?? base; const foreign = cur !== base;
  const open_ = React.useMemo(() => (kind === "receipt" ? invoices.filter((i) => i.customerId === contactId && i.outstanding > 0.01 && !["draft", "void"].includes(i.displayStatus)).map((i) => ({ id: i.id, number: i.number, date: i.date, due: i.dueDate, outstanding: i.outstanding, currency: i.currency, status: i.displayStatus })) : bills.filter((b) => b.vendorId === contactId && b.outstanding > 0.01 && !["draft", "pending_approval", "rejected", "void"].includes(b.displayStatus)).map((b) => ({ id: b.id, number: `${b.number} · ${b.vendorBillNo}`, date: b.date, due: b.dueDate, outstanding: b.outstanding, currency: b.currency, status: b.displayStatus }))).sort((a, b) => a.due.localeCompare(b.due)), [kind, invoices, bills, contactId]);

  React.useEffect(() => {
    if (!open) return;
    const doc = presetDoc ? (kind === "receipt" ? invoices.find((i) => i.id === presetDoc) : bills.find((b) => b.id === presetDoc)) : undefined;
    const pc = presetContact ?? (doc ? (kind === "receipt" ? (doc as typeof invoices[number]).customerId : (doc as typeof bills[number]).vendorId) : "");
    setContactId(pc); setDate(today); setMethod("neft"); setBankId(bankRows.find((b) => b.type === "bank")?.id ?? ""); setReference(""); setNotes(""); setErrors({}); setServerErr(null); setFx("");
    setAlloc(doc ? { [doc.id]: String(doc.outstanding) } : {}); setAmount(doc ? String(doc.outstanding) : "");
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open]);
  React.useEffect(() => { if (foreign) setFx(String(sampleRate(cur, base, date))); else setFx(""); }, [cur, foreign, date, base]);

  const allocTotal = round2(Object.values(alloc).reduce((s, v) => s + (Number(v) || 0), 0)); const amt = Number(amount) || 0; const unalloc = round2(amt - allocTotal);
  const autoAlloc = () => { let left = amt; const next: Record<string, string> = {}; for (const d of open_) { if (left <= 0) break; const use = Math.min(left, d.outstanding); next[d.id] = String(round2(use)); left = round2(left - use); } setAlloc(next); };
  const m = useEntityMutation((e, i: Parameters<typeof services.receivables.recordReceipt>[1]) => (kind === "receipt" ? services.receivables.recordReceipt(e, i) : services.payables.recordPayment(e, i)), { success: (p) => (p.status === "pending_approval" ? `${p.number} sent for approval (above the payment limit)` : `${kind === "receipt" ? "Receipt" : "Payment"} ${p.number} recorded`) });

  const submit = async () => {
    const parsed = paymentSchema.safeParse({ date, amount, method, bankAccountId: bankId, reference, notes }); const errs: Record<string, string> = {};
    if (!contactId) errs.contactId = `Select a ${kind === "receipt" ? "customer" : "vendor"}`;
    if (!parsed.success) parsed.error.issues.forEach((is) => { errs[String(is.path[0])] = is.message; });
    if (allocTotal > amt + 0.005) errs.alloc = "Allocated amount exceeds the payment amount";
    setErrors(errs); setServerErr(null); if (Object.keys(errs).length) return;
    try {
      await m.mutateAsync({ contactId, date, amount: amt, method: method as never, bankAccountId: bankId, reference, notes, currency: cur, fxRate: foreign ? Number(fx) || 1 : 1, allocations: Object.entries(alloc).filter(([, v]) => Number(v) > 0).map(([docId, v]) => ({ docId, amount: Number(v) })) });
      onOpenChange(false);
    } catch (e) { setServerErr((e as Error).message); }
  };
  const title = kind === "receipt" ? "Record customer receipt" : "Record vendor payment";
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[92vh] overflow-y-auto sm:max-w-2xl">
        <DialogHeader><DialogTitle>{title}</DialogTitle><DialogDescription>Allocate to open {kind === "receipt" ? "invoices" : "bills"}. Any unallocated amount is booked as a {kind === "receipt" ? "customer advance" : "vendor advance"}.</DialogDescription></DialogHeader>
        <SimNotice title="Simulated payment">This records an entry in the mock books only — no bank transfer or payment gateway is involved.</SimNotice>
        <div className="grid gap-3 sm:grid-cols-2">
          <FieldShell label={kind === "receipt" ? "Customer" : "Vendor"} required error={errors.contactId}><Combobox value={contactId} onChange={(v) => { setContactId(v); setAlloc({}); }} options={parties} placeholder="Select…" invalid={!!errors.contactId} /></FieldShell>
          <FieldShell label="Date" required error={errors.date}><DateField value={date} onChange={setDate} /></FieldShell>
          <FieldShell label={`Amount (${cur})`} required error={errors.amount}><Input type="number" step="0.01" min="0" className="tnum text-right" value={amount} onChange={(e) => setAmount(e.target.value)} aria-invalid={!!errors.amount} /></FieldShell>
          <FieldShell label={kind === "receipt" ? "Deposit to" : "Pay from"} required error={errors.bankAccountId}><SelectField value={bankId} onChange={setBankId} options={banks} invalid={!!errors.bankAccountId} /></FieldShell>
          <FieldShell label="Method"><SelectField value={method} onChange={setMethod} options={PAYMENT_METHODS.map((x) => ({ value: x.value, label: x.label }))} /></FieldShell>
          <FieldShell label="Reference / UTR"><Input value={reference} onChange={(e) => setReference(e.target.value)} placeholder="e.g. NEFT123456789" /></FieldShell>
          {foreign && <FieldShell label={`Exchange rate (1 ${cur} = ? ${base})`} hint="Difference from the invoice rate is booked as realised FX gain/loss"><Input type="number" step="0.0001" className="tnum text-right" value={fx} onChange={(e) => setFx(e.target.value)} /></FieldShell>}
        </div>
        <div className="rounded-lg border">
          <div className="flex items-center justify-between border-b bg-muted/40 px-3 py-1.5"><p className="text-xs font-semibold">Allocate to open {kind === "receipt" ? "invoices" : "bills"}</p><Button type="button" size="xs" variant="outline" disabled={!amt || !open_.length} onClick={autoAlloc}><Wand2 /> Auto-allocate (oldest due first)</Button></div>
          {!contactId ? <p className="p-3 text-xs text-muted-foreground">Select a {kind === "receipt" ? "customer" : "vendor"} to see open documents.</p> : open_.length === 0 ? <p className="p-3 text-xs text-muted-foreground">Nothing outstanding — the full amount will be booked as an advance.</p> : (
            <table className="w-full text-[13px]"><thead className="text-[11px] uppercase text-muted-foreground"><tr><th className="px-3 py-1 text-left">Document</th><th className="px-2 py-1 text-left">Due</th><th className="px-2 py-1 text-right">Outstanding</th><th className="w-36 px-3 py-1 text-right">Apply</th></tr></thead>
              <tbody>{open_.map((d) => <tr key={d.id} className="border-t"><td className="px-3 py-1">{d.number}</td><td className="px-2 py-1 text-xs text-muted-foreground">{formatDate(d.due, "dd MMM yy")}</td><td className="num px-2 py-1">{f.money(d.outstanding, d.currency)}</td>
                <td className="px-3 py-1"><Input type="number" step="0.01" min="0" max={d.outstanding} className="h-7 tnum text-right" aria-label={`Apply to ${d.number}`} value={alloc[d.id] ?? ""} onChange={(e) => setAlloc((a) => ({ ...a, [d.id]: e.target.value }))} /></td></tr>)}</tbody></table>)}
          <div className="flex flex-wrap justify-between gap-2 border-t bg-muted/30 px-3 py-1.5 text-xs"><span>Allocated <b className="tnum">{f.money(allocTotal, cur)}</b></span><span className={unalloc < 0 ? "text-error" : ""}>{unalloc < 0 ? "Over-allocated by" : "Unallocated (advance)"} <b className="tnum">{f.money(Math.abs(unalloc), cur)}</b></span></div>
        </div>
        {errors.alloc && <p role="alert" className="text-xs text-destructive">{errors.alloc}</p>}
        <FieldShell label="Notes"><Textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} /></FieldShell>
        {serverErr && <p role="alert" className="tone-error rounded-md border px-3 py-2 text-xs">{serverErr}</p>}
        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button><Button onClick={submit} disabled={m.isPending}>{m.isPending && <Loader2 className="animate-spin" />}{kind === "receipt" ? "Record receipt" : "Record payment"}</Button></DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
