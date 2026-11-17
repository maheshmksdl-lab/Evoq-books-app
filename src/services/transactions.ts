import type { Bill, BillStatus, CreditNote, DocLine, Expense, ID, Invoice, InvoiceStatus, Payment } from "@/types";
import { get, list, logAudit, newId, nextNumber, nowIso, patch, upsert, currentUser } from "@/lib/mock/db";
import { ageing, billOutstandingTxn, invoiceOutstandingTxn, type AgeItem } from "@/lib/accounting/engine";
import { gstSplit, calcTax } from "@/lib/accounting/tax";
import { TODAY } from "@/lib/constants";
import { round2 } from "@/lib/formatters";
import { accId } from "@/lib/mock/chart";
import { addDaysISO } from "@/lib/accounting/fiscal";
import { sampleRate } from "@/lib/mock/generate";
import { ServiceError, createJournalRecord, latency, matchingRule, maybeFail, requestApproval } from "./base";

const name = (id: ID) => get("contacts", id)?.name ?? "—";
const bankLedger = (bankId: ID) => { const b = get("bankAccounts", bankId); if (!b) throw new ServiceError("Select a payment account."); return b.ledgerAccountId; };

// ---------------------------------------------------------------- derived rows
export interface InvoiceRow extends Invoice { customerName: string; outstanding: number; outstandingBase: number; daysOverdue: number; displayStatus: InvoiceStatus }
export function invoiceRow(i: Invoice): InvoiceRow {
  const out = invoiceOutstandingTxn(i);
  const st: InvoiceStatus = ["draft", "void", "written_off"].includes(i.status) && out > 0.01 ? i.status : out <= 0.01 ? (i.status === "written_off" ? "written_off" : "paid") : i.paid > 0 ? (i.dueDate < TODAY ? "overdue" : "partial") : i.dueDate < TODAY ? "overdue" : "sent";
  return { ...i, customerName: name(i.customerId), outstanding: out, outstandingBase: round2(out * i.fxRate), daysOverdue: out > 0.01 ? Math.max(0, Math.round((new Date(TODAY).getTime() - new Date(i.dueDate).getTime()) / 86400000)) : 0, displayStatus: st };
}
export interface BillRow extends Bill { vendorName: string; outstanding: number; outstandingBase: number; daysOverdue: number; displayStatus: BillStatus; netPayable: number }
export function billRow(b: Bill): BillRow {
  const out = ["draft", "pending_approval", "rejected", "void"].includes(b.status) ? round2(b.total - b.tdsAmount) : billOutstandingTxn(b);
  const settled = !["draft", "pending_approval", "rejected", "void"].includes(b.status);
  const st: BillStatus = !settled ? b.status : out <= 0.01 ? "paid" : b.paid > 0 ? (b.dueDate < TODAY ? "overdue" : "partial") : b.dueDate < TODAY ? "overdue" : "approved";
  return { ...b, vendorName: name(b.vendorId), outstanding: settled ? out : 0, outstandingBase: settled ? round2(out * b.fxRate) : 0, daysOverdue: settled && out > 0.01 ? Math.max(0, Math.round((new Date(TODAY).getTime() - new Date(b.dueDate).getTime()) / 86400000)) : 0, displayStatus: st, netPayable: round2(b.total - b.tdsAmount) };
}

// ---------------------------------------------------------------- payment engine (shared)
export interface PaymentInput { kind: "receipt" | "payment"; contactId: ID; date: string; amount: number; method: Payment["method"]; bankAccountId: ID; reference: string; notes?: string; currency?: string; fxRate?: number; allocations: { docId: ID; amount: number }[] }

function validatePayment(e: ID, i: PaymentInput) {
  if (!(i.amount > 0)) throw new ServiceError("Enter an amount greater than zero.");
  const alloc = i.allocations.filter((a) => a.amount > 0);
  const total = round2(alloc.reduce((s, a) => s + a.amount, 0));
  if (total > i.amount + 0.005) throw new ServiceError(`Allocated amount (${total.toFixed(2)}) exceeds the payment amount (${i.amount.toFixed(2)}).`);
  for (const a of alloc) {
    const out = i.kind === "receipt" ? (() => { const d = get("invoices", a.docId); return d ? invoiceOutstandingTxn(d) : 0; })() : (() => { const d = get("bills", a.docId); return d ? billOutstandingTxn(d) : 0; })();
    if (a.amount > out + 0.005) throw new ServiceError(`Allocation to ${i.kind === "receipt" ? get("invoices", a.docId)?.number : get("bills", a.docId)?.number} exceeds its outstanding balance (${out.toFixed(2)}).`);
  }
  return alloc;
}

/** Posts the journal and updates documents for a payment record. */
function settlePayment(e: ID, p: Payment): Payment {
  const ledger = bankLedger(p.bankAccountId); const fx = p.fxRate;
  const alloc = p.allocations; const allocTotal = round2(alloc.reduce((s, a) => s + a.amount, 0)); const rest = round2(p.amount - allocTotal);
  const docs = alloc.map((a) => (p.kind === "receipt" ? get("invoices", a.docId)! : get("bills", a.docId)!));
  const booked = round2(alloc.reduce((s, a, i) => s + a.amount * docs[i].fxRate, 0));
  const cash = round2(p.amount * fx); const arAp = round2(booked + rest * fx); const diff = round2(p.kind === "receipt" ? cash - arAp : arAp - cash);
  const gain = accId(e, "4220"), loss = accId(e, "5520");
  const control = (d: Invoice | Bill) => (("intercompany" in d && d.intercompany) ? (p.kind === "receipt" ? accId(e, "1180") : accId(e, "2170")) : p.kind === "receipt" ? accId(e, "1120") : accId(e, "2110"));
  const lines = p.kind === "receipt"
    ? [{ accountId: ledger, debit: cash, credit: 0 }, ...alloc.map((a, i) => ({ accountId: control(docs[i]), debit: 0, credit: round2(a.amount * docs[i].fxRate), contactId: p.contactId, description: docs[i].number })),
        ...(rest > 0 ? [{ accountId: accId(e, "2160"), debit: 0, credit: round2(rest * fx), contactId: p.contactId, description: "Unallocated – customer advance" }] : []),
        ...(diff > 0 ? [{ accountId: gain, debit: 0, credit: diff }] : diff < 0 ? [{ accountId: loss, debit: -diff, credit: 0 }] : [])]
    : [...alloc.map((a, i) => ({ accountId: control(docs[i]), debit: round2(a.amount * docs[i].fxRate), credit: 0, contactId: p.contactId, description: docs[i].number })),
        ...(rest > 0 ? [{ accountId: accId(e, "1160"), debit: round2(rest * fx), credit: 0, contactId: p.contactId, description: "Unallocated – vendor advance" }] : []),
        { accountId: ledger, debit: 0, credit: cash }, ...(diff > 0 ? [{ accountId: gain, debit: 0, credit: diff }] : diff < 0 ? [{ accountId: loss, debit: -diff, credit: 0 }] : [])];
  const j = createJournalRecord(e, { date: p.date, description: `${p.kind === "receipt" ? "Receipt from" : "Payment to"} ${name(p.contactId)}`, kind: p.kind === "receipt" ? "receipt" : "payment", sourceType: "payment", sourceId: p.id, sourceRef: p.number, currency: p.currency, fxRate: fx, status: "posted", lines });
  alloc.forEach((a, i) => {
    if (p.kind === "receipt") { const inv = docs[i] as Invoice; const paid = round2(inv.paid + a.amount); patch("invoices", inv.id, { paid, status: round2(inv.total - paid) <= 0.01 ? "paid" : "partial" }); }
    else { const b = docs[i] as Bill; const paid = round2(b.paid + a.amount); patch("bills", b.id, { paid, status: round2(b.total - b.tdsAmount - paid) <= 0.01 ? "paid" : "partial" }); }
  });
  const done = upsert("payments", { ...p, status: "recorded", journalId: j.id, realizedFx: p.currency !== get("entities", e)!.baseCurrency ? diff : undefined });
  logAudit(e, p.kind === "receipt" ? "Recorded receipt" : "Recorded payment", "payment", p.id, p.number, `${p.amount} via ${p.method}`);
  return done;
}

function recordPayment(e: ID, i: PaymentInput): Payment {
  const alloc = validatePayment(e, i);
  const ent = get("entities", e)!;
  const p: Payment = { id: newId("pay"), entityId: e, number: nextNumber(e, "payments", i.kind === "receipt" ? "RCT" : "PAY", i.date, ((r: Payment) => r.kind === i.kind) as never), kind: i.kind, contactId: i.contactId, date: i.date, amount: round2(i.amount), currency: i.currency ?? ent.baseCurrency, fxRate: i.fxRate ?? 1, method: i.method, bankAccountId: i.bankAccountId, reference: i.reference, allocations: alloc.map((a) => ({ ...a })), journalId: "", status: "recorded", notes: i.notes };
  const baseAmount = round2(p.amount * p.fxRate);
  const rule = i.kind === "payment" ? matchingRule(e, "payment", baseAmount) : undefined;
  if (rule) {
    upsert("payments", { ...p, status: "pending_approval" });
    requestApproval(e, { docType: "payment", docId: p.id, docRef: p.number, title: `Payment to ${name(i.contactId)}`, amount: baseAmount, rule });
    return { ...p, status: "pending_approval" };
  }
  return settlePayment(e, p);
}

export const paymentsHelpers = { settlePayment };

// ---------------------------------------------------------------- Receivables
export const receivablesService = {
  async invoices(e: ID): Promise<InvoiceRow[]> { await latency(70); maybeFail(); return list("invoices", e).map(invoiceRow).sort((a, b) => b.date.localeCompare(a.date)); },
  async invoice(e: ID, id: ID) {
    await latency(50); const i = get("invoices", id); if (!i) throw new ServiceError("Invoice not found", "NOT_FOUND");
    const pays = list("payments", e).filter((p) => p.allocations.some((a) => a.docId === id)).map((p) => ({ ...p, applied: p.allocations.find((a) => a.docId === id)!.amount }));
    const cns = list("creditNotes", e).filter((c) => c.appliedTo === id);
    return { invoice: invoiceRow(i), payments: pays, creditNotes: cns };
  },
  async receipts(e: ID) { await latency(60); return list("payments", e).filter((p) => p.kind === "receipt").map((p) => ({ ...p, contactName: name(p.contactId), bankName: get("bankAccounts", p.bankAccountId)?.name ?? "" })).sort((a, b) => b.date.localeCompare(a.date)); },
  async recordReceipt(e: ID, i: Omit<PaymentInput, "kind">) { await latency(200); return recordPayment(e, { ...i, kind: "receipt" }); },
  async creditNotes(e: ID, kind: "customer" | "vendor") { await latency(60); return list("creditNotes", e).filter((c) => c.kind === kind).map((c) => ({ ...c, contactName: name(c.contactId) })).sort((a, b) => b.date.localeCompare(a.date)); },
  async createCreditNote(e: ID, i: { kind: "customer" | "vendor"; contactId: ID; date: string; net: number; taxRate: number; reason: string }) {
    await latency(150);
    const c = get("contacts", i.contactId)!; const ent = get("entities", e)!;
    if (!(i.net > 0)) throw new ServiceError("Enter an amount greater than zero.");
    const t = gstSplit(ent, c.state, c.country, i.net, i.taxRate); const tax = round2(t.cgst + t.sgst + t.igst); const amount = round2(i.net + tax);
    const id = newId("cn"); const flat = ent.taxRegime === "flat-gst";
    const outHeads = [[flat ? "2123" : "2121", flat ? t.igst : t.cgst], ["2122", flat ? 0 : t.sgst], ["2123", flat ? 0 : t.igst]] as const;
    const inHeads = [[flat ? "1143" : "1141", flat ? t.igst : t.cgst], ["1142", flat ? 0 : t.sgst], ["1143", flat ? 0 : t.igst]] as const;
    const number = nextNumber(e, "creditNotes", i.kind === "customer" ? "CN" : "VCN", i.date, ((r: CreditNote) => r.kind === i.kind) as never);
    const j = createJournalRecord(e, { date: i.date, description: `${i.kind === "customer" ? "Customer" : "Vendor"} credit note – ${c.name}`, kind: "credit_note", sourceType: "credit_note", sourceId: id, sourceRef: number, status: "posted",
      lines: i.kind === "customer" ? [{ accountId: accId(e, "4190"), debit: i.net, credit: 0 }, ...outHeads.map(([code, v]) => ({ accountId: accId(e, code), debit: v, credit: 0 })), { accountId: accId(e, "1120"), debit: 0, credit: amount, contactId: c.id }]
        : [{ accountId: accId(e, "2110"), debit: amount, credit: 0, contactId: c.id }, { accountId: accId(e, "5110"), debit: 0, credit: i.net }, ...inHeads.map(([code, v]) => ({ accountId: accId(e, code), debit: 0, credit: v }))] });
    const cn = upsert("creditNotes", { id, entityId: e, kind: i.kind, number, contactId: c.id, date: i.date, amount, tax, reason: i.reason, status: "open" as const, journalId: j.id });
    logAudit(e, "Created credit note", "credit_note", id, number, `${amount}`); return cn;
  },
  async applyCreditNote(e: ID, i: { id: ID; docId: ID }) {
    await latency(120); const cn = get("creditNotes", i.id)!; if (cn.status !== "open") throw new ServiceError("This credit note has already been applied.");
    if (cn.kind === "customer") { const inv = get("invoices", i.docId)!; if (inv.customerId !== cn.contactId) throw new ServiceError("Credit note and invoice belong to different customers."); const out = invoiceOutstandingTxn(inv); if (out <= 0) throw new ServiceError("Invoice has nothing outstanding."); const use = Math.min(out, cn.amount); patch("invoices", inv.id, { paid: round2(inv.paid + use), status: round2(out - use) <= 0.01 ? "paid" : "partial" }); }
    else { const b = get("bills", i.docId)!; if (b.vendorId !== cn.contactId) throw new ServiceError("Credit note and bill belong to different vendors."); const out = billOutstandingTxn(b); if (out <= 0) throw new ServiceError("Bill has nothing outstanding."); const use = Math.min(out, cn.amount); patch("bills", b.id, { paid: round2(b.paid + use), status: round2(out - use) <= 0.01 ? "paid" : "partial" }); }
    logAudit(e, "Applied credit note", "credit_note", cn.id, cn.number, `to ${i.docId}`); return patch("creditNotes", cn.id, { status: "applied", appliedTo: i.docId });
  },
  /** Bad-debt write-off. Above the configured limit it becomes a pending journal needing approval. */
  async writeOff(e: ID, i: { invoiceId: ID; amount: number; reason: string; date: string }) {
    await latency(150); const inv = get("invoices", i.invoiceId)!; const out = invoiceOutstandingTxn(inv);
    if (!(i.amount > 0) || i.amount > out + 0.005) throw new ServiceError(`Write-off must be between 0.01 and the outstanding balance (${out.toFixed(2)}).`);
    const base = round2(i.amount * inv.fxRate); const rule = matchingRule(e, "adjustment", base);
    const j = createJournalRecord(e, { date: i.date, description: `Bad debt write-off – ${inv.number} (${i.reason})`, kind: "adjustment", sourceType: "writeoff", sourceId: inv.id, sourceRef: inv.number, status: rule ? "pending_approval" : "posted",
      lines: [{ accountId: accId(e, "5310"), debit: base, credit: 0 }, { accountId: accId(e, "1120"), debit: 0, credit: base, contactId: inv.customerId }] });
    if (rule) { requestApproval(e, { docType: "adjustment", docId: j.id, docRef: j.number, title: `Write-off ${inv.number}`, amount: base, rule }); return { journal: j, pending: true }; }
    const paid = round2(inv.paid + i.amount); patch("invoices", inv.id, { paid, status: round2(inv.total - paid) <= 0.01 ? "written_off" : "partial" });
    return { journal: j, pending: false };
  },
  async adjust(e: ID, i: { customerId: ID; type: "increase" | "decrease"; amount: number; reason: string; date: string }) {
    await latency(150); if (!(i.amount > 0)) throw new ServiceError("Enter an amount greater than zero.");
    const rule = matchingRule(e, "adjustment", i.amount);
    const j = createJournalRecord(e, { date: i.date, description: `Receivable adjustment – ${name(i.customerId)} (${i.reason})`, kind: "adjustment", sourceType: "adjustment", sourceRef: "Adjustment", status: rule ? "pending_approval" : "posted",
      lines: i.type === "decrease" ? [{ accountId: accId(e, "4190"), debit: i.amount, credit: 0 }, { accountId: accId(e, "1120"), debit: 0, credit: i.amount, contactId: i.customerId }] : [{ accountId: accId(e, "1120"), debit: i.amount, credit: 0, contactId: i.customerId }, { accountId: accId(e, "4230"), debit: 0, credit: i.amount }] });
    if (rule) requestApproval(e, { docType: "adjustment", docId: j.id, docRef: j.number, title: `Adjustment – ${name(i.customerId)}`, amount: i.amount, rule });
    return { journal: j, pending: !!rule };
  },
  async ageing(e: ID, asOf: string) {
    await latency(70);
    const items: AgeItem[] = list("invoices", e).filter((i) => !["draft", "void"].includes(i.status) && !i.intercompany).map((i) => ({ id: i.id, partyId: i.customerId, number: i.number, date: i.date, dueDate: i.dueDate, outstanding: round2(invoiceOutstandingTxn(i) * i.fxRate) }));
    const r = ageing(items, asOf); return { ...r, rows: r.rows.map((x) => ({ ...x, name: name(x.partyId) })) };
  },
};

// ---------------------------------------------------------------- Payables
export interface BillInput { id?: ID; vendorId: ID; date: string; dueDate: string; vendorBillNo: string; currency?: string; lines: { description: string; accountId: ID; qty: number; rate: number; taxRate: number }[]; tdsSection?: string; tdsRate?: number; notes?: string; attachments?: ID[]; mode: "draft" | "submit" }

function postBill(e: ID, b: Bill) {
  const v = get("contacts", b.vendorId)!; const flat = get("entities", e)!.taxRegime === "flat-gst"; const fx = b.fxRate;
  const exp = new Map<ID, number>(); b.lines.forEach((l) => exp.set(l.accountId!, round2((exp.get(l.accountId!) ?? 0) + l.amount * fx)));
  const ap = round2((b.total - b.tdsAmount) * fx), tds = round2(b.tdsAmount * fx), c = round2(b.cgst * fx), s = round2(b.sgst * fx), ig = round2(b.igst * fx);
  const firstKey = [...exp.keys()][0]; const plug = round2(ap + tds - c - s - ig - [...exp.values()].reduce((x, y) => x + y, 0)); exp.set(firstKey, round2(exp.get(firstKey)! + plug));
  const j = createJournalRecord(e, { date: b.date, description: `Vendor bill – ${v.name}`, kind: "bill", sourceType: "bill", sourceId: b.id, sourceRef: b.number, currency: b.currency, fxRate: fx, status: "posted",
    lines: [...[...exp.entries()].map(([accountId, debit]) => ({ accountId, debit, credit: 0 })), { accountId: accId(e, flat ? "1143" : "1141"), debit: flat ? ig : c, credit: 0 }, { accountId: accId(e, "1142"), debit: flat ? 0 : s, credit: 0 }, { accountId: accId(e, "1143"), debit: flat ? 0 : ig, credit: 0 },
      { accountId: accId(e, "2110"), debit: 0, credit: ap, contactId: v.id }, { accountId: accId(e, "2130"), debit: 0, credit: tds }] });
  const rec = patch("bills", b.id, { journalId: j.id, status: "approved" });
  if (b.tdsSection && tds > 0) upsert("tdsRecords", { id: newId("tds"), entityId: e, vendorId: v.id, billId: b.id, billNo: b.number, section: b.tdsSection, baseAmount: b.subtotal, rate: round2((b.tdsAmount / b.subtotal) * 100), amount: b.tdsAmount, date: b.date, status: "deducted" as const, quarter: `Q${Math.floor(((new Date(b.date).getMonth() + 9) % 12) / 3) + 1} FY` });
  return rec;
}

export const payablesService = {
  async bills(e: ID): Promise<BillRow[]> { await latency(70); maybeFail(); return list("bills", e).map(billRow).sort((a, b) => b.date.localeCompare(a.date)); },
  async bill(e: ID, id: ID) {
    await latency(50); const b = get("bills", id); if (!b) throw new ServiceError("Bill not found", "NOT_FOUND");
    const pays = list("payments", e).filter((p) => p.allocations.some((a) => a.docId === id)).map((p) => ({ ...p, applied: p.allocations.find((a) => a.docId === id)!.amount }));
    const approvals = list("approvals", e).filter((a) => a.docId === id); const docs = list("documents", e).filter((d) => d.linkedId === id);
    return { bill: billRow(b), payments: pays, approvals, documents: docs, creditNotes: list("creditNotes", e).filter((c) => c.appliedTo === id) };
  },
  async saveBill(e: ID, i: BillInput) {
    await latency(180); const ent = get("entities", e)!; const v = get("contacts", i.vendorId); if (!v) throw new ServiceError("Select a vendor.");
    const lines: DocLine[] = i.lines.filter((l) => l.description || l.rate).map((l) => ({ id: newId("dl"), description: l.description, accountId: l.accountId, qty: l.qty, rate: l.rate, taxRate: l.taxRate, amount: round2(l.qty * l.rate) }));
    if (!lines.length) throw new ServiceError("Add at least one line item.");
    if (lines.some((l) => !l.accountId)) throw new ServiceError("Every line needs an expense/asset account.");
    if (i.dueDate < i.date) throw new ServiceError("Due date cannot be before the bill date.");
    const dup = list("bills", e).find((b) => b.id !== i.id && b.vendorId === i.vendorId && b.vendorBillNo.trim().toLowerCase() === i.vendorBillNo.trim().toLowerCase() && b.status !== "void");
    if (dup) throw new ServiceError(`Possible duplicate: ${dup.number} already uses vendor bill number “${i.vendorBillNo}”.`);
    const subtotal = round2(lines.reduce((s, l) => s + l.amount, 0)); const fx = i.currency && i.currency !== ent.baseCurrency ? sampleRate(i.currency, ent.baseCurrency, i.date) : 1;
    let cgst = 0, sgst = 0, igst = 0;
    lines.forEach((l) => { const t = gstSplit(ent, v.state, v.country, l.amount, l.taxRate, fx !== 1); cgst += t.cgst; sgst += t.sgst; igst += t.igst; });
    const tds = i.tdsSection && i.tdsRate ? round2((subtotal * i.tdsRate) / 100) : 0; const total = round2(subtotal + cgst + sgst + igst);
    const prev = i.id ? get("bills", i.id) : undefined;
    if (prev && !["draft", "rejected"].includes(prev.status)) throw new ServiceError("Approved bills cannot be edited. Record a vendor credit note instead.", "IMMUTABLE");
    const id = i.id ?? newId("bill");
    const bill = upsert("bills", { id, entityId: e, number: prev?.number ?? nextNumber(e, "bills", "BILL", i.date), vendorBillNo: i.vendorBillNo, vendorId: v.id, date: i.date, dueDate: i.dueDate, currency: i.currency ?? ent.baseCurrency, fxRate: fx, lines, subtotal, cgst: round2(cgst), sgst: round2(sgst), igst: round2(igst), tdsSection: tds ? i.tdsSection : undefined, tdsAmount: tds, total, paid: 0, status: "draft" as BillStatus, notes: i.notes, attachments: i.attachments ?? [], createdBy: prev?.createdBy ?? currentUser(), createdAt: prev?.createdAt ?? nowIso() } as Bill);
    logAudit(e, prev ? "Updated bill" : "Created bill", "bill", id, bill.number, `${i.mode}`);
    if (i.mode === "draft") return bill;
    const rule = matchingRule(e, "bill", round2(total * fx));
    if (rule) { requestApproval(e, { docType: "bill", docId: id, docRef: bill.number, title: `Bill ${bill.vendorBillNo} – ${v.name}`, amount: round2(total * fx), rule }); return patch("bills", id, { status: "pending_approval" }); }
    return postBill(e, bill);
  },
  async approveBill(e: ID, id: ID) { await latency(120); const b = get("bills", id)!; if (!["draft", "pending_approval"].includes(b.status)) throw new ServiceError("Bill is already processed."); return postBill(e, b); },
  async rejectBill(e: ID, id: ID) { await latency(100); logAudit(e, "Rejected bill", "bill", id, get("bills", id)!.number, ""); return patch("bills", id, { status: "rejected" }); },
  async voidBill(e: ID, id: ID) {
    await latency(120); const b = get("bills", id)!; if (b.paid > 0) throw new ServiceError("Bills with payments cannot be voided. Record a vendor credit note instead.");
    if (b.journalId) { const { journalsService } = await import("./accounting"); await journalsService.reverse(e, { id: b.journalId, date: TODAY, reason: "bill voided" }); }
    logAudit(e, "Voided bill", "bill", id, b.number, ""); return patch("bills", id, { status: "void" });
  },
  async payments(e: ID) { await latency(60); return list("payments", e).filter((p) => p.kind === "payment").map((p) => ({ ...p, contactName: name(p.contactId), bankName: get("bankAccounts", p.bankAccountId)?.name ?? "" })).sort((a, b) => b.date.localeCompare(a.date)); },
  async recordPayment(e: ID, i: Omit<PaymentInput, "kind">) { await latency(200); return recordPayment(e, { ...i, kind: "payment" }); },
  async ageing(e: ID, asOf: string) {
    await latency(70);
    const items: AgeItem[] = list("bills", e).filter((b) => !["draft", "pending_approval", "rejected", "void"].includes(b.status) && !b.intercompany).map((b) => ({ id: b.id, partyId: b.vendorId, number: b.number, date: b.date, dueDate: b.dueDate, outstanding: round2(billOutstandingTxn(b) * b.fxRate) }));
    const r = ageing(items, asOf); return { ...r, rows: r.rows.map((x) => ({ ...x, name: name(x.partyId) })) };
  },
  async applyVendorCredit(e: ID, i: { id: ID; docId: ID }) { return receivablesService.applyCreditNote(e, i); },
};

// ---------------------------------------------------------------- Expenses
export interface ExpenseInput { id?: ID; date: string; categoryId: ID; vendorId?: ID; description: string; amount: number; taxTreatment: Expense["taxTreatment"]; gstRate: number; paymentAccountId: ID; paymentMethod: Payment["method"]; recurring?: Expense["recurring"]; receiptDocId?: ID; departmentId?: ID; projectId?: ID; mode: "draft" | "submit" }

function postExpense(e: ID, x: Expense) {
  const cat = get("expenseCategories", x.categoryId)!; const flat = get("entities", e)!.taxRegime === "flat-gst"; const net = round2(x.amount - x.taxAmount); const half = flat ? 0 : round2(x.taxAmount / 2);
  const j = createJournalRecord(e, { date: x.date, description: x.description, kind: "expense", sourceType: "expense", sourceId: x.id, sourceRef: x.number, status: "posted",
    lines: [{ accountId: cat.accountId, debit: net, credit: 0, contactId: x.vendorId, departmentId: x.departmentId, projectId: x.projectId }, { accountId: accId(e, flat ? "1143" : "1141"), debit: flat ? x.taxAmount : half, credit: 0 }, { accountId: accId(e, "1142"), debit: flat ? 0 : round2(x.taxAmount - half), credit: 0 }, { accountId: bankLedger(x.paymentAccountId), debit: 0, credit: x.amount }] });
  return patch("expenses", x.id, { status: "paid", journalId: j.id });
}

export const expensesService = {
  async list(e: ID) { await latency(70); maybeFail(); return list("expenses", e).map((x) => ({ ...x, categoryName: get("expenseCategories", x.categoryId)?.name ?? "—", vendorName: x.vendorId ? name(x.vendorId) : "", paymentName: get("bankAccounts", x.paymentAccountId)?.name ?? "" })).sort((a, b) => b.date.localeCompare(a.date)); },
  async get(e: ID, id: ID) {
    await latency(50); const x = get("expenses", id); if (!x) throw new ServiceError("Expense not found", "NOT_FOUND");
    return { expense: { ...x, categoryName: get("expenseCategories", x.categoryId)?.name ?? "—", vendorName: x.vendorId ? name(x.vendorId) : "", paymentName: get("bankAccounts", x.paymentAccountId)?.name ?? "" }, approvals: list("approvals", e).filter((a) => a.docId === id), receipt: x.receiptDocId ? get("documents", x.receiptDocId) : undefined, journal: x.journalId ? get("journals", x.journalId) : undefined };
  },
  async categories(e: ID) { await latency(40); return list("expenseCategories", e); },
  async saveCategory(e: ID, i: { id?: ID; name: string; accountId: ID; defaultTaxRate: number; budgetMonthly?: number; active: boolean }) { await latency(100); const a = get("accounts", i.accountId); if (!a || a.type !== "expense" || a.isGroup) throw new ServiceError("Choose an expense ledger account."); return upsert("expenseCategories", { id: i.id ?? newId("cat"), entityId: e, name: i.name, accountId: i.accountId, defaultTaxRate: i.defaultTaxRate, active: i.active, budgetMonthly: i.budgetMonthly }); },
  async save(e: ID, i: ExpenseInput) {
    await latency(150); if (!(i.amount > 0)) throw new ServiceError("Enter an amount greater than zero.");
    const prev = i.id ? get("expenses", i.id) : undefined;
    if (prev && !["draft", "rejected"].includes(prev.status)) throw new ServiceError("Approved or paid expenses cannot be edited.", "IMMUTABLE");
    const rate = i.taxTreatment === "none" ? 0 : i.gstRate; const t = calcTax(i.amount, rate, i.taxTreatment === "exclusive" ? "exclusive" : "inclusive");
    const gross = i.taxTreatment === "exclusive" ? t.total : round2(i.amount);
    const x = upsert("expenses", { id: prev?.id ?? newId("exp"), entityId: e, number: prev?.number ?? nextNumber(e, "expenses", "EXP", i.date), date: i.date, categoryId: i.categoryId, vendorId: i.vendorId, description: i.description, amount: gross, taxAmount: t.tax, taxTreatment: i.taxTreatment, gstRate: rate, paymentAccountId: i.paymentAccountId, paymentMethod: i.paymentMethod, status: "draft" as const, recurring: i.recurring ?? null, receiptDocId: i.receiptDocId, submittedBy: prev?.submittedBy ?? currentUser(), departmentId: i.departmentId, projectId: i.projectId, createdAt: prev?.createdAt ?? nowIso() } as Expense);
    logAudit(e, prev ? "Updated expense" : "Created expense", "expense", x.id, x.number, i.mode);
    if (i.mode === "draft") return x;
    const rule = matchingRule(e, "expense", gross);
    if (rule) { requestApproval(e, { docType: "expense", docId: x.id, docRef: x.number, title: x.description, amount: gross, rule }); return patch("expenses", x.id, { status: "pending_approval" }); }
    return postExpense(e, x);
  },
  async approve(e: ID, id: ID) { await latency(120); const x = get("expenses", id)!; if (!["draft", "pending_approval", "approved"].includes(x.status)) throw new ServiceError("Expense already processed."); return postExpense(e, x); },
  async reject(e: ID, id: ID) { await latency(100); logAudit(e, "Rejected expense", "expense", id, get("expenses", id)!.number, ""); return patch("expenses", id, { status: "rejected" }); },
  async remove(e: ID, id: ID) { await latency(100); const x = get("expenses", id)!; if (!["draft", "rejected"].includes(x.status)) throw new ServiceError("Only draft or rejected expenses can be deleted."); const { remove } = await import("@/lib/mock/db"); remove("expenses", id); logAudit(e, "Deleted expense", "expense", id, x.number, ""); },
  async runRecurring(e: ID, id: ID) {
    await latency(150); const x = get("expenses", id)!; if (!x.recurring) throw new ServiceError("Not a recurring expense.");
    const date = x.recurring.nextDate; const n = upsert("expenses", { ...x, id: newId("exp"), number: nextNumber(e, "expenses", "EXP", date), date, status: "draft" as const, journalId: undefined, receiptDocId: undefined, createdAt: nowIso(), recurring: { ...x.recurring, nextDate: addDaysISO(date, x.recurring.frequency === "monthly" ? 30 : x.recurring.frequency === "quarterly" ? 91 : 365) } });
    patch("expenses", x.id, { recurring: null }); logAudit(e, "Generated recurring expense", "expense", n.id, n.number, `from ${x.number}`); return n;
  },
};
