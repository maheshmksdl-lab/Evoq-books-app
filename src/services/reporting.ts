import type { ID } from "@/types";
import { get, list, logAudit, newId, upsert } from "@/lib/mock/db";
import { addMonths, format, parseISO } from "date-fns";
import {
  balanceSheet, balancesAsOf, cashFlow, invoiceOutstanding, billOutstanding, movements, postedJournals, profitAndLoss, taxSummary, trialBalance, journalAmount, ageing, type AgeItem,
} from "@/lib/accounting/engine";
import { fiscalYearOf, monthEnd, monthLabel } from "@/lib/accounting/fiscal";
import { TODAY } from "@/lib/constants";
import { round2 } from "@/lib/formatters";
import { accId } from "@/lib/mock/chart";
import { ServiceError, createJournalRecord, latency, ledgerData, maybeFail } from "./base";
import { bankingService } from "./banking";
import { invoiceRow, billRow } from "./transactions";

const monthsBack = (n: number, until = TODAY) => Array.from({ length: n }, (_, i) => format(addMonths(parseISO(until), -(n - 1 - i)), "yyyy-MM"));
const nm = (id: ID) => get("contacts", id)?.name ?? "—";

function expenseTaxRows(e: ID, from: string, to: string) {
  const ent = get("entities", e)!; const flat = ent.taxRegime === "flat-gst";
  return list("expenses", e).filter((x) => x.status === "paid" && x.date >= from && x.date <= to && x.taxAmount > 0).map((x) => ({ cgst: flat ? 0 : round2(x.taxAmount / 2), sgst: flat ? 0 : round2(x.taxAmount - round2(x.taxAmount / 2)), igst: flat ? x.taxAmount : 0, base: round2(x.amount - x.taxAmount) }));
}

export const taxService = {
  async summary(e: ID, from: string, to: string) { await latency(70); maybeFail(); return taxSummary(list("invoices", e), list("bills", e), expenseTaxRows(e, from, to), from, to); },
  async overview(e: ID, from: string, to: string) {
    await latency(90); maybeFail();
    const d = ledgerData(e); const bal = balancesAsOf(d, TODAY); const g = (c: string) => bal.get(accId(e, c)) ?? 0;
    const months = monthsBack(8).map((m) => { const s = taxSummary(list("invoices", e), list("bills", e), expenseTaxRows(e, `${m}-01`, monthEnd(`${m}-01`)), `${m}-01`, monthEnd(`${m}-01`)); return { month: m, label: monthLabel(m), output: s.outputTotal, input: s.inputTotal, net: s.netPayable }; });
    const outLedger = g("2121") + g("2122") + g("2123"), inLedger = g("1141") + g("1142") + g("1143");
    return { period: taxSummary(list("invoices", e), list("bills", e), expenseTaxRows(e, from, to), from, to), months, gstPayableLedger: round2(outLedger), itcBalance: round2(inLedger), netGstLiability: round2(outLedger - inLedger), tdsPayable: round2(g("2130")), tdsReceivable: round2(g("1150")), unpaidTds: list("tdsRecords", e).filter((t) => t.status === "deducted").reduce((s, t) => s + t.amount, 0) };
  },
  async transactions(e: ID, from: string, to: string) {
    await latency(70);
    const rows: { id: string; date: string; type: "Output" | "Input"; docType: string; docNo: string; party: string; taxable: number; cgst: number; sgst: number; igst: number; tax: number; href: string }[] = [];
    for (const i of list("invoices", e)) if (i.date >= from && i.date <= to && !["draft", "void"].includes(i.status)) rows.push({ id: i.id, date: i.date, type: "Output", docType: "Invoice", docNo: i.number, party: nm(i.customerId), taxable: round2(i.subtotal * i.fxRate), cgst: round2(i.cgst * i.fxRate), sgst: round2(i.sgst * i.fxRate), igst: round2(i.igst * i.fxRate), tax: round2((i.cgst + i.sgst + i.igst) * i.fxRate), href: `/receivables/invoices/${i.id}` });
    for (const b of list("bills", e)) if (b.date >= from && b.date <= to && !["draft", "pending_approval", "rejected", "void"].includes(b.status)) rows.push({ id: b.id, date: b.date, type: "Input", docType: "Bill", docNo: b.number, party: nm(b.vendorId), taxable: round2(b.subtotal * b.fxRate), cgst: round2(b.cgst * b.fxRate), sgst: round2(b.sgst * b.fxRate), igst: round2(b.igst * b.fxRate), tax: round2((b.cgst + b.sgst + b.igst) * b.fxRate), href: `/payables/bills/${b.id}` });
    const flat = get("entities", e)!.taxRegime === "flat-gst";
    for (const x of list("expenses", e)) if (x.status === "paid" && x.date >= from && x.date <= to && x.taxAmount > 0) { const h = flat ? 0 : round2(x.taxAmount / 2); rows.push({ id: x.id, date: x.date, type: "Input", docType: "Expense", docNo: x.number, party: x.vendorId ? nm(x.vendorId) : x.description, taxable: round2(x.amount - x.taxAmount), cgst: h, sgst: flat ? 0 : round2(x.taxAmount - h), igst: flat ? x.taxAmount : 0, tax: x.taxAmount, href: `/expenses/${x.id}` }); }
    return rows.filter((r) => r.tax > 0 || r.taxable > 0).sort((a, b) => b.date.localeCompare(a.date));
  },
  async tds(e: ID) { await latency(60); return list("tdsRecords", e).map((t) => ({ ...t, vendorName: nm(t.vendorId) })).sort((a, b) => b.date.localeCompare(a.date)); },
  async depositTds(e: ID, ids: ID[]) {
    await latency(250); const recs = ids.map((id) => get("tdsRecords", id)!).filter((t) => t.status === "deducted"); if (!recs.length) throw new ServiceError("Select deducted TDS records to deposit.");
    const total = round2(recs.reduce((s, t) => s + t.amount, 0)); const bank = list("bankAccounts", e).find((b) => b.type === "bank")!; const challan = `CHL-SIM-${Math.floor(Math.random() * 90000 + 10000)}`;
    createJournalRecord(e, { date: TODAY, description: `TDS deposit (simulated challan ${challan})`, kind: "tax", sourceType: "tax", sourceRef: challan, status: "posted", reference: challan, lines: [{ accountId: accId(e, "2130"), debit: total, credit: 0 }, { accountId: bank.ledgerAccountId, debit: 0, credit: total }] });
    recs.forEach((t) => upsert("tdsRecords", { ...t, status: "deposited" as const, challan, depositDate: TODAY })); logAudit(e, "Recorded TDS deposit (simulated)", "tds", challan, challan, `${recs.length} records · ${total}`); return { challan, total };
  },
  async codes(e: ID) { await latency(40); return list("taxCodes", e); },
  async saveCode(e: ID, i: { id?: ID; name: string; head: "CGST" | "SGST" | "IGST" | "GST" | "TDS"; rate: number; type: "output" | "input" | "withholding"; accountId: ID; active: boolean; section?: string }) { await latency(100); return upsert("taxCodes", { id: i.id ?? newId("tx"), entityId: e, ...i }); },
  async itc(e: ID, from: string, to: string) {
    await latency(70);
    const d = ledgerData(e); const js = postedJournals(d, from, to); const heads = ["1141", "1142", "1143"].map((c) => accId(e, c));
    const rows = heads.map((id) => { let avail = 0, used = 0; for (const j of js) for (const l of j.lines) if (l.accountId === id) { avail += l.debit; used += l.credit; } const a = d.accounts.find((x) => x.id === id)!; const bal = balancesAsOf(d, to).get(id) ?? 0; return { accountId: id, name: a.name, opening: round2(bal - avail + used), availed: round2(avail), utilised: round2(used), closing: round2(bal) }; });
    const monthly = monthsBack(8).map((m) => { const mj = postedJournals(d, `${m}-01`, monthEnd(`${m}-01`)); let a = 0, u = 0; for (const j of mj) for (const l of j.lines) if (heads.includes(l.accountId)) { a += l.debit; u += l.credit; } return { month: m, label: monthLabel(m), availed: round2(a), utilised: round2(u) }; });
    return { rows, monthly };
  },
};

export const reportsService = {
  async dashboard(e: ID, i: { from: string; to: string }) {
    await latency(120); maybeFail();
    const d = ledgerData(e); const ent = d.entity; const base = ent.baseCurrency;
    const span = Math.round((parseISO(i.to).getTime() - parseISO(i.from).getTime()) / 86400000) + 1;
    const prevTo = format(new Date(parseISO(i.from).getTime() - 86400000), "yyyy-MM-dd"), prevFrom = format(new Date(parseISO(prevTo).getTime() - (span - 1) * 86400000), "yyyy-MM-dd");
    const pl = profitAndLoss(d, i.from, i.to), prev = profitAndLoss(d, prevFrom, prevTo);
    const income = round2(pl.totalRevenue + pl.totalOther), expense = round2(pl.totalCogs + pl.totalOpex + pl.totalDep + pl.totalFinance);
    const prevIncome = round2(prev.totalRevenue + prev.totalOther), prevExpense = round2(prev.totalCogs + prev.totalOpex + prev.totalDep + prev.totalFinance);
    const bal = balancesAsOf(d, TODAY);
    const banks = list("bankAccounts", e).map((b) => { const n = bal.get(b.ledgerAccountId) ?? 0; return { id: b.id, name: b.name, type: b.type, balance: b.type === "credit_card" ? -n : n }; });
    const cashTotal = round2(banks.filter((b) => b.type !== "credit_card").reduce((s, b) => s + b.balance, 0));
    const invoices = list("invoices", e).map(invoiceRow), bills = list("bills", e).map(billRow);
    const ar = round2(bal.get(accId(e, "1120")) ?? 0), ap = round2(bal.get(accId(e, "2110")) ?? 0);
    const overdueAr = round2(invoices.filter((x) => x.displayStatus === "overdue").reduce((s, x) => s + x.outstandingBase, 0));
    const months = monthsBack(12);
    const series = months.map((m) => { const p = profitAndLoss(d, `${m}-01`, monthEnd(`${m}-01`)); const inc = p.totalRevenue + p.totalOther, exp = p.totalCogs + p.totalOpex + p.totalDep + p.totalFinance; const cashBal = ["1111", "1112", "1113", "1114"].reduce((s, c) => s + (balancesAsOf(d, monthEnd(`${m}-01`)).get(accId(e, c)) ?? 0), 0); const mv = movements(d, `${m}-01`, monthEnd(`${m}-01`), (_l, j) => !j.sourceRef.startsWith("TRF-")); const cashIds = d.accounts.filter((a) => a.cashFlow === "cash").map((a) => a.id); let inflow = 0, outflow = 0; cashIds.forEach((id) => { const x = mv.get(id); if (x) { inflow += x.debit; outflow += x.credit; } }); return { month: m, label: monthLabel(m), income: round2(inc), expense: round2(exp), profit: round2(inc - exp), cash: round2(cashBal), inflow: round2(inflow), outflow: round2(outflow), revenue: p.totalRevenue, gross: p.grossProfit }; });
    const custMap = new Map<string, number>(); invoices.forEach((x) => { if (x.outstanding > 0.01 && !["draft", "void"].includes(x.status)) custMap.set(x.customerId, (custMap.get(x.customerId) ?? 0) + x.outstandingBase); });
    const topCustomers = [...custMap.entries()].map(([id, amt]) => ({ id, name: nm(id), amount: round2(amt), overdue: round2(invoices.filter((x) => x.customerId === id && x.displayStatus === "overdue").reduce((s, x) => s + x.outstandingBase, 0)) })).sort((a, b) => b.amount - a.amount).slice(0, 6);
    const upcoming = bills.filter((b) => b.outstanding > 0.01 && !["draft", "pending_approval", "rejected", "void", "paid"].includes(b.displayStatus)).sort((a, b) => a.dueDate.localeCompare(b.dueDate)).slice(0, 7).map((b) => ({ id: b.id, number: b.number, vendor: b.vendorName, dueDate: b.dueDate, amount: b.outstandingBase, overdue: b.dueDate < TODAY }));
    const recent = d.journals.filter((j) => j.status === "posted").sort((a, b) => b.date.localeCompare(a.date) || b.number.localeCompare(a.number)).slice(0, 8).map((j) => ({ id: j.id, number: j.number, date: j.date, description: j.description, kind: j.kind, amount: journalAmount(j), sourceRef: j.sourceRef }));
    const unrec = list("bankTxns", e).filter((t) => t.status === "unmatched");
    const tax = await taxService.overview(e, i.from, i.to);
    const fy = fiscalYearOf(TODAY, ent.fyStartMonth); const elapsed = Math.round(((parseISO(TODAY).getTime() - parseISO(fy.start).getTime()) / (parseISO(fy.end).getTime() - parseISO(fy.start).getTime())) * 100);
    const periods = list("periods", e).filter((p) => p.start >= fy.start && p.end <= fy.end);
    return { base, income, expense, netProfit: round2(income - expense), prevIncome, prevExpense, prevNet: round2(prevIncome - prevExpense), cashTotal, banks, ar, ap, overdueAr, series, topCustomers, upcoming, recent, unreconciled: { count: unrec.length, value: round2(unrec.reduce((s, t) => s + t.deposit + t.withdrawal, 0)), items: unrec.slice(0, 5) }, tax: { net: tax.netGstLiability, tds: tax.tdsPayable, itc: tax.itcBalance, gst: tax.gstPayableLedger }, fy: { label: fy.label, start: fy.start, end: fy.end, elapsed, openPeriods: periods.filter((p) => p.status === "open").length, closedPeriods: periods.filter((p) => p.status !== "open").length }, pl };
  },
  async pnl(e: ID, i: { from: string; to: string; compareFrom?: string; compareTo?: string }) { await latency(90); maybeFail(); const d = ledgerData(e); return { current: profitAndLoss(d, i.from, i.to), previous: i.compareFrom && i.compareTo ? profitAndLoss(d, i.compareFrom, i.compareTo) : null }; },
  async balanceSheet(e: ID, i: { asOf: string; compareAsOf?: string }) { await latency(90); maybeFail(); const d = ledgerData(e); return { current: balanceSheet(d, i.asOf), previous: i.compareAsOf ? balanceSheet(d, i.compareAsOf) : null }; },
  async cashFlow(e: ID, i: { from: string; to: string }) { await latency(90); return cashFlow(ledgerData(e), i.from, i.to); },
  async trialBalance(e: ID, i: { asOf: string }) { await latency(80); maybeFail(); return trialBalance(ledgerData(e), i.asOf); },
  async journalReport(e: ID, i: { from: string; to: string; kind?: string }) { await latency(80); return list("journals", e).filter((j) => j.status !== "draft" && j.date >= i.from && j.date <= i.to && (!i.kind || i.kind === "all" || j.kind === i.kind)).map((j) => ({ ...j, amount: journalAmount(j) })).sort((a, b) => a.date.localeCompare(b.date)); },
  async expenseReport(e: ID, i: { from: string; to: string }) {
    await latency(80); const rows = list("expenses", e).filter((x) => x.date >= i.from && x.date <= i.to && ["paid", "approved"].includes(x.status));
    const byCat = new Map<string, { name: string; amount: number; count: number }>(); const byMonth = new Map<string, number>(); const byMethod = new Map<string, number>();
    rows.forEach((x) => { const n = get("expenseCategories", x.categoryId)?.name ?? "Other"; const c = byCat.get(n) ?? { name: n, amount: 0, count: 0 }; c.amount += x.amount; c.count++; byCat.set(n, c); byMonth.set(x.date.slice(0, 7), (byMonth.get(x.date.slice(0, 7)) ?? 0) + x.amount); byMethod.set(x.paymentMethod, (byMethod.get(x.paymentMethod) ?? 0) + x.amount); });
    return { total: round2(rows.reduce((s, x) => s + x.amount, 0)), tax: round2(rows.reduce((s, x) => s + x.taxAmount, 0)), count: rows.length, byCategory: [...byCat.values()].map((x) => ({ ...x, amount: round2(x.amount) })).sort((a, b) => b.amount - a.amount), byMonth: [...byMonth.entries()].sort().map(([m, v]) => ({ month: m, label: monthLabel(m), amount: round2(v) })), byMethod: [...byMethod.entries()].map(([method, v]) => ({ method, amount: round2(v) })), rows: rows.map((x) => ({ ...x, categoryName: get("expenseCategories", x.categoryId)?.name ?? "" })) };
  },
  async bankRecon(e: ID, asOf: string) { const accts = list("bankAccounts", e).filter((b) => b.type === "bank"); return Promise.all(accts.map((b) => bankingService.summary(e, { bankAccountId: b.id, asOf }))); },
  async customAge(e: ID, kind: "ar" | "ap", asOf: string) {
    await latency(60);
    const items: AgeItem[] = kind === "ar" ? list("invoices", e).filter((i) => !["draft", "void"].includes(i.status)).map((i) => ({ id: i.id, partyId: i.customerId, number: i.number, date: i.date, dueDate: i.dueDate, outstanding: invoiceOutstanding(i) })) : list("bills", e).filter((b) => !["draft", "pending_approval", "rejected", "void"].includes(b.status)).map((b) => ({ id: b.id, partyId: b.vendorId, number: b.number, date: b.date, dueDate: b.dueDate, outstanding: billOutstanding(b) }));
    const r = ageing(items, asOf); return { ...r, rows: r.rows.map((x) => ({ ...x, name: nm(x.partyId) })) };
  },
};
