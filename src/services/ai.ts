// AI & automation services — everything here is a deterministic simulation over the mock dataset.
// No model, OCR, agent runtime or notification delivery is connected.
import type { Automation, ID } from "@/types";
import { get, list, logAudit, newId, nowIso, patch, upsert, remove, currentUser } from "@/lib/mock/db";
import { addMonths, format, parseISO } from "date-fns";
import { flatten, profitAndLoss, type ReportNode, balancesAsOf } from "@/lib/accounting/engine";
import { TODAY } from "@/lib/constants";
import { round2, formatMoney, formatDate, formatCompact } from "@/lib/formatters";
import { accId } from "@/lib/mock/chart";
import { addDaysISO, monthEnd, monthLabel, daysBetween } from "@/lib/accounting/fiscal";
import { ServiceError, createJournalRecord, latency, ledgerData, maybeFail } from "./base";
import { bankingService } from "./banking";
import { payablesService, billRow, invoiceRow } from "./transactions";
import { reportsService } from "./reporting";
import { orgService } from "./core";

export interface AiAnswer {
  text: string;
  kpis?: { label: string; value: number; money?: boolean; tone?: "good" | "bad" | "neutral" }[];
  table?: { columns: { key: string; label: string; money?: boolean; align?: "right" }[]; rows: Record<string, string | number>[] };
  chart?: { kind: "bar" | "line"; series: { key: string; label: string }[]; data: Record<string, string | number>[] };
  links?: { label: string; href: string }[];
  followUps: string[];
}

export const SUGGESTED_QUESTIONS = [
  "What is our current cash position?",
  "Which customers have overdue balances?",
  "What were our highest expenses this month?",
  "Compare this month's expenses with last month.",
  "Which vendor payments are due this week?",
  "Show our gross profit trend.",
  "Explain the difference in our bank reconciliation.",
  "Summarize the current financial position.",
];

const flatLeaves = (n: ReportNode | null) => (n ? flatten([n]).filter((x) => !x.isGroup) : []);

export const aiService = {
  async ask(e: ID, question: string): Promise<AiAnswer> {
    await latency(650);
    const q = question.toLowerCase(); const ent = get("entities", e)!; const cur = ent.baseCurrency; const d = ledgerData(e);
    const monthStart = `${TODAY.slice(0, 7)}-01`; const lastStart = format(addMonths(parseISO(monthStart), -1), "yyyy-MM-dd"); const lastEnd = monthEnd(lastStart);
    const money = (n: number) => formatMoney(n, cur);
    if (/cash|bank balance|liquidity/.test(q)) {
      const dash = await reportsService.dashboard(e, { from: monthStart, to: TODAY });
      return { text: `Your total cash and bank balance is **${money(dash.cashTotal)}** across ${dash.banks.filter((b) => b.type !== "credit_card").length} accounts as of ${formatDate(TODAY)}. ${dash.banks.filter((b) => b.type === "credit_card").map((b) => `The credit card shows ${money(b.balance)} outstanding.`).join(" ")}`,
        kpis: [{ label: "Total cash & bank", value: dash.cashTotal, money: true }, { label: "Receivables", value: dash.ar, money: true }, { label: "Payables", value: dash.ap, money: true }],
        table: { columns: [{ key: "name", label: "Account" }, { key: "balance", label: "Book balance", money: true, align: "right" }], rows: dash.banks.map((b) => ({ name: b.name, balance: b.balance })) }, links: [{ label: "Open bank accounts", href: "/banking/accounts" }], followUps: ["Explain the difference in our bank reconciliation.", "Which vendor payments are due this week?"] };
    }
    if (/overdue|owe us|outstanding customer|receivable/.test(q)) {
      const rows = list("invoices", e).map(invoiceRow).filter((i) => i.displayStatus === "overdue"); const by = new Map<string, { name: string; amount: number; oldest: number; count: number }>();
      rows.forEach((i) => { const x = by.get(i.customerId) ?? { name: i.customerName, amount: 0, oldest: 0, count: 0 }; x.amount += i.outstandingBase; x.oldest = Math.max(x.oldest, i.daysOverdue); x.count++; by.set(i.customerId, x); });
      const list_ = [...by.values()].sort((a, b) => b.amount - a.amount); const total = round2(list_.reduce((s, x) => s + x.amount, 0));
      return { text: `${list_.length} customers have overdue balances totalling **${money(total)}** across ${rows.length} invoices. ${list_[0] ? `${list_[0].name} is the largest at ${money(list_[0].amount)}` : ""}${list_[0] ? ` (oldest invoice ${list_[0].oldest} days past due).` : ""}`, table: { columns: [{ key: "name", label: "Customer" }, { key: "count", label: "Invoices", align: "right" }, { key: "oldest", label: "Oldest (days)", align: "right" }, { key: "amount", label: "Overdue", money: true, align: "right" }], rows: list_.slice(0, 8) }, links: [{ label: "Receivables ageing", href: "/reports/view/ar-ageing" }, { label: "Open receivables", href: "/receivables/invoices" }], followUps: ["Summarize the current financial position."] };
    }
    if (/highest expense|top expense|biggest expense|largest expense/.test(q)) {
      const pl = profitAndLoss(d, monthStart, TODAY); const leaves = [...flatLeaves(pl.cogs), ...flatLeaves(pl.opex), ...flatLeaves(pl.finance), ...flatLeaves(pl.depreciation)].sort((a, b) => b.amount - a.amount).slice(0, 6); const total = pl.totalCogs + pl.totalOpex + pl.totalDep + pl.totalFinance;
      return { text: `So far in ${format(parseISO(TODAY), "MMMM")} total expenses are **${money(total)}**. The largest is **${leaves[0]?.label}** at ${money(leaves[0]?.amount ?? 0)} (${Math.round(((leaves[0]?.amount ?? 0) / (total || 1)) * 100)}% of the total).`, chart: { kind: "bar", series: [{ key: "amount", label: "This month" }], data: leaves.map((l) => ({ label: l.label, amount: l.amount })) }, table: { columns: [{ key: "label", label: "Account" }, { key: "amount", label: "Amount", money: true, align: "right" }], rows: leaves.map((l) => ({ label: l.label, amount: l.amount })) }, links: [{ label: "Profit & Loss", href: "/reports/view/pnl" }], followUps: ["Compare this month's expenses with last month."] };
    }
    if (/compare/.test(q) && /expense/.test(q)) {
      const a = profitAndLoss(d, monthStart, TODAY), b = profitAndLoss(d, lastStart, lastEnd); const lines = [["Cost of goods sold", a.totalCogs, b.totalCogs], ["Operating expenses", a.totalOpex, b.totalOpex], ["Depreciation", a.totalDep, b.totalDep], ["Finance costs", a.totalFinance, b.totalFinance]] as const;
      const ta = lines.reduce((s, l) => s + l[1], 0), tb = lines.reduce((s, l) => s + l[2], 0);
      return { text: `Expenses for ${format(parseISO(monthStart), "MMM")} (to date) are **${money(ta)}** versus **${money(tb)}** for the whole of ${format(parseISO(lastStart), "MMM")} — ${ta < tb ? "lower" : "higher"} by ${money(Math.abs(ta - tb))}. The month is only ${Math.round((parseISO(TODAY).getDate() / 30) * 100)}% complete, so compare run-rates rather than totals. Payroll and depreciation post at month-end.`,
        chart: { kind: "bar", series: [{ key: "current", label: "This month (to date)" }, { key: "previous", label: "Last month" }], data: lines.map(([label, c, p]) => ({ label, current: round2(c), previous: round2(p) })) }, table: { columns: [{ key: "label", label: "Group" }, { key: "current", label: "This month", money: true, align: "right" }, { key: "previous", label: "Last month", money: true, align: "right" }], rows: lines.map(([label, c, p]) => ({ label, current: round2(c), previous: round2(p) })) }, followUps: ["What were our highest expenses this month?", "Show our gross profit trend."] };
    }
    if (/due this week|vendor payment|payable|due soon/.test(q)) {
      const end = addDaysISO(TODAY, 7); const bills = list("bills", e).map(billRow).filter((b) => b.outstanding > 0.01 && b.dueDate <= end && !["draft", "pending_approval", "rejected", "void"].includes(b.status)).sort((a, b) => a.dueDate.localeCompare(b.dueDate)); const total = round2(bills.reduce((s, b) => s + b.outstandingBase, 0));
      return { text: bills.length ? `${bills.length} vendor bills fall due by ${formatDate(end)} totalling **${money(total)}**; ${bills.filter((b) => b.dueDate < TODAY).length} are already overdue. The Payables Agent has prepared a payment run for your approval.` : "No vendor bills fall due in the next 7 days.", table: { columns: [{ key: "number", label: "Bill" }, { key: "vendor", label: "Vendor" }, { key: "due", label: "Due" }, { key: "amount", label: "Outstanding", money: true, align: "right" }], rows: bills.slice(0, 10).map((b) => ({ number: b.number, vendor: b.vendorName, due: formatDate(b.dueDate), amount: b.outstandingBase })) }, links: [{ label: "Payables Agent", href: "/ai/agents" }, { label: "All bills", href: "/payables/bills" }], followUps: ["What is our current cash position?"] };
    }
    if (/gross profit|margin|profit trend/.test(q)) {
      const months = Array.from({ length: 8 }, (_, i) => format(addMonths(parseISO(monthStart), -(8 - i)), "yyyy-MM")); const data = months.map((m) => { const p = profitAndLoss(d, `${m}-01`, monthEnd(`${m}-01`)); return { label: monthLabel(m), gross: p.grossProfit, margin: p.totalRevenue ? round2((p.grossProfit / p.totalRevenue) * 100) : 0 }; });
      const first = data[0], last = data[data.length - 1];
      return { text: `Gross profit moved from **${money(first.gross)}** in ${first.label} to **${money(last.gross)}** in ${last.label}; gross margin is currently ${last.margin}% (${first.margin}% eight months ago).`, chart: { kind: "line", series: [{ key: "gross", label: "Gross profit" }], data }, table: { columns: [{ key: "label", label: "Month" }, { key: "gross", label: "Gross profit", money: true, align: "right" }, { key: "margin", label: "Margin %", align: "right" }], rows: data }, links: [{ label: "Profit & Loss", href: "/reports/view/pnl" }], followUps: ["Compare this month's expenses with last month."] };
    }
    if (/reconcil|difference/.test(q)) {
      const acct = list("bankAccounts", e).find((b) => b.type === "bank")!; const s = await bankingService.summary(e, { bankAccountId: acct.id, asOf: TODAY });
      return { text: `${acct.name}: the statement closes at **${money(s.statementClosing)}** while the books show **${money(s.bookClosing)}** — a difference of **${money(s.difference)}**. It is fully explained by ${s.bankOnly.length} statement lines not yet booked (net ${money(s.bankOnlyNet)}) and ${s.bookOnly.length} book entries not yet on the statement, such as uncleared cheques (net ${money(s.bookOnlyNet)}).`,
        kpis: [{ label: "Statement", value: s.statementClosing, money: true }, { label: "Books", value: s.bookClosing, money: true }, { label: "Difference", value: s.difference, money: true, tone: Math.abs(s.difference) > 0.01 ? "bad" : "good" }],
        table: { columns: [{ key: "type", label: "Reconciling item" }, { key: "desc", label: "Description" }, { key: "amount", label: "Amount", money: true, align: "right" }], rows: [...s.bankOnly.slice(0, 5).map((t) => ({ type: "On statement only", desc: t.description, amount: round2(t.deposit - t.withdrawal) })), ...s.bookOnly.slice(0, 4).map((l) => ({ type: "In books only (outstanding)", desc: l.description, amount: round2(l.debit - l.credit) }))] }, links: [{ label: "Open reconciliation", href: "/banking/reconciliation" }], followUps: ["What is our current cash position?"] };
    }
    if (/summar|position|overview|how are we|financial position/.test(q)) {
      const dash = await reportsService.dashboard(e, { from: ent.fyStartMonth === 4 ? "2026-04-01" : `${TODAY.slice(0, 4)}-01-01`, to: TODAY });
      return { text: `**Financial year to date**: income ${money(dash.income)}, expenses ${money(dash.expense)}, net profit **${money(dash.netProfit)}** (${dash.income ? Math.round((dash.netProfit / dash.income) * 100) : 0}% margin). **Position**: cash ${money(dash.cashTotal)}, receivables ${money(dash.ar)} (${money(dash.overdueAr)} overdue), payables ${money(dash.ap)}. Net GST payable ${money(dash.tax.net)}; ${dash.unreconciled.count} bank lines await reconciliation.`,
        kpis: [{ label: "Net profit (FYTD)", value: dash.netProfit, money: true, tone: dash.netProfit >= 0 ? "good" : "bad" }, { label: "Cash", value: dash.cashTotal, money: true }, { label: "Overdue receivables", value: dash.overdueAr, money: true, tone: "bad" }], chart: { kind: "bar", series: [{ key: "income", label: "Income" }, { key: "expense", label: "Expense" }], data: dash.series.slice(-8).map((s) => ({ label: s.label, income: s.income, expense: s.expense })) }, links: [{ label: "Dashboard", href: "/dashboard" }], followUps: SUGGESTED_QUESTIONS.slice(0, 3) };
    }
    return { text: "I can answer questions from the sample books — cash position, overdue customers, expenses, vendor payments due, gross-profit trend, reconciliation differences, and an overall summary. I'm a simulated assistant using prepared logic over the mock data, so free-form questions outside these topics aren't supported yet.", followUps: SUGGESTED_QUESTIONS.slice(0, 4) };
  },
  async analyze(e: ID, i: { from: string; to: string; compareFrom: string; compareTo: string }) {
    await latency(500); const d = ledgerData(e); const cur = profitAndLoss(d, i.from, i.to), prev = profitAndLoss(d, i.compareFrom, i.compareTo); const base = get("entities", e)!.baseCurrency;
    const sections = [["Revenue", cur.totalRevenue, prev.totalRevenue, true], ["Cost of goods sold", cur.totalCogs, prev.totalCogs, false], ["Gross profit", cur.grossProfit, prev.grossProfit, true], ["Operating expenses", cur.totalOpex, prev.totalOpex, false], ["Depreciation", cur.totalDep, prev.totalDep, false], ["Finance costs", cur.totalFinance, prev.totalFinance, false], ["Net profit", cur.netProfit, prev.netProfit, true]] as const;
    const rows = sections.map(([label, a, b, income]) => ({ label, current: a, previous: b, change: round2(a - b), pct: b ? round2(((a - b) / Math.abs(b)) * 100) : 0, good: income ? a >= b : a <= b }));
    const exp = (n: ReportNode | null) => flatLeaves(n); const prevMap = new Map([...exp(prev.cogs), ...exp(prev.opex)].map((n) => [n.id, n.amount]));
    const drivers = [...exp(cur.cogs), ...exp(cur.opex)].map((n) => ({ label: n.label, delta: round2(n.amount - (prevMap.get(n.id) ?? 0)) })).sort((a, b) => Math.abs(b.delta) - Math.abs(a.delta)).slice(0, 5);
    const profitDelta = cur.netProfit - prev.netProfit;
    const insights = [
      `Net profit ${profitDelta >= 0 ? "improved" : "declined"} by ${formatMoney(Math.abs(profitDelta), base)} (${prev.netProfit ? Math.round((profitDelta / Math.abs(prev.netProfit)) * 100) : 0}%) versus the comparison period.`,
      `Revenue ${cur.totalRevenue >= prev.totalRevenue ? "grew" : "fell"} ${prev.totalRevenue ? Math.abs(Math.round(((cur.totalRevenue - prev.totalRevenue) / prev.totalRevenue) * 100)) : 0}%; gross margin is ${cur.totalRevenue ? Math.round((cur.grossProfit / cur.totalRevenue) * 100) : 0}% vs ${prev.totalRevenue ? Math.round((prev.grossProfit / prev.totalRevenue) * 100) : 0}%.`,
      drivers[0] ? `The largest cost movement is ${drivers[0].label} (${drivers[0].delta >= 0 ? "+" : "−"}${formatMoney(Math.abs(drivers[0].delta), base)}).` : "No significant cost movements.",
    ];
    const [catRows] = await Promise.all([reportsService.expenseReport(e, { from: i.from, to: i.to })]);
    return { rows, drivers, insights, expenseCategories: catRows.byCategory.slice(0, 6), base };
  },

  // ---- Suggestions
  async categorization(e: ID) { await latency(70); return list("catSuggestions", e).map((s) => ({ ...s, suggestedAccount: get("accounts", s.suggestedAccountId)?.name ?? "", finalAccount: s.finalAccountId ? get("accounts", s.finalAccountId)?.name : undefined })); },
  async decideCategorization(e: ID, i: { id: ID; action: "accept" | "reject" | "change"; accountId?: ID }) {
    await latency(150); const s = get("catSuggestions", i.id)!;
    if (i.action === "reject") return patch("catSuggestions", s.id, { status: "rejected" });
    const accountId = i.action === "change" ? i.accountId : s.suggestedAccountId; if (!accountId) throw new ServiceError("Choose a ledger account.");
    await bankingService.setCategory(e, { txnId: s.bankTxnId, accountId }); logAudit(e, `AI categorisation ${i.action === "change" ? "changed" : "accepted"}`, "bank_txn", s.bankTxnId, s.description, get("accounts", accountId)!.name);
    return patch("catSuggestions", s.id, { status: i.action === "change" ? "changed" : "accepted", finalAccountId: accountId });
  },
  async journalSuggestions(e: ID) { await latency(70); return list("jvSuggestions", e).map((s) => ({ ...s, debitAccount: get("accounts", s.debitAccountId)?.name ?? "", creditAccount: get("accounts", s.creditAccountId)?.name ?? "", journalNumber: s.createdJournalId ? get("journals", s.createdJournalId)?.number : undefined })); },
  /** Approving a suggestion only creates a DRAFT journal — it is never posted automatically. */
  async decideJournal(e: ID, i: { id: ID; action: "approve" | "reject" }) {
    await latency(180); const s = get("jvSuggestions", i.id)!; if (i.action === "reject") return patch("jvSuggestions", s.id, { status: "rejected" });
    const j = createJournalRecord(e, { date: s.date, description: `${s.sourceDescription} (AI-suggested)`, kind: "manual", sourceType: "ai_suggestion", sourceId: s.id, sourceRef: s.sourceRef, status: "draft", aiSuggested: true, lines: [{ accountId: s.debitAccountId, debit: s.amount, credit: 0 }, { accountId: s.creditAccountId, debit: 0, credit: s.amount }] });
    return patch("jvSuggestions", s.id, { status: "approved", createdJournalId: j.id });
  },
  async matchSuggestions(e: ID) { await latency(70); return list("matchSuggestions", e).map((m) => { const t = get("bankTxns", m.bankTxnId); return { ...m, txn: t, matched: t?.status === "matched" }; }); },
  async decideMatch(e: ID, i: { id: ID; action: "accept" | "reject" }) {
    await latency(150); const m = get("matchSuggestions", i.id)!; if (i.action === "reject") return patch("matchSuggestions", m.id, { status: "rejected" });
    await bankingService.match(e, { txnId: m.bankTxnId, lineIds: m.lineIds }); return patch("matchSuggestions", m.id, { status: "accepted" });
  },

  // ---- Anomalies
  async anomalies(e: ID) { await latency(70); maybeFail(); return list("anomalies", e); },
  async markReviewed(e: ID, i: { id: ID; reviewed: boolean }) { await latency(60); return patch("anomalies", i.id, { status: i.reviewed ? "reviewed" : "open" }); },

  // ---- Document extraction (simulation)
  async extract(e: ID, i: { fileName: string; size: number }) {
    await latency(1400); const vendors = list("contacts", e).filter((c) => c.kind === "vendor" && !c.intercompanyEntityId); let h = 0; for (const ch of i.fileName) h = (h * 31 + ch.charCodeAt(0)) >>> 0;
    const v = vendors[h % vendors.length]; const day = 3 + (h % 20); const date = `${TODAY.slice(0, 7)}-${String(Math.min(day, 17)).padStart(2, "0")}`; const rate = [18, 18, 12, 5][h % 4]; const lines = [{ description: "Supply of goods per PO", qty: 10 + (h % 40), rate: 1450 + (h % 900) }, { description: "Handling & packing", qty: 1, rate: 3200 + (h % 1500) }];
    const ent = get("entities", e)!; const sub = lines.reduce((s, l) => s + l.qty * l.rate, 0); const tax = round2((sub * rate) / 100);
    return { vendorId: v.id, vendorName: v.name, invoiceNo: `${v.name.replace(/[^A-Z]/g, "").slice(0, 3) || "INV"}/${TODAY.slice(2, 4)}/${400 + (h % 500)}`, invoiceDate: date, dueDate: addDaysISO(date, v.creditDays || 30), gstRate: rate, gstin: v.gstin, lines, subtotal: round2(sub), tax, total: round2(sub + tax), currency: ent.baseCurrency, confidence: { vendor: 0.96, invoiceNo: 0.91, dates: 0.88, tax: 0.84, lines: 0.79, total: 0.97 }, fileName: i.fileName };
  },
  async acceptExtraction(e: ID, i: { vendorId: ID; invoiceNo: string; invoiceDate: string; dueDate: string; gstRate: number; lines: { description: string; qty: number; rate: number }[]; fileName: string; size: number }) {
    await latency(200); const cat = list("accounts", e).find((a) => a.code === "5110")!;
    const doc = await orgService.addDocument(e, { name: i.fileName, size: i.size, mime: "application/pdf", category: "Invoice", linkedType: "bill", previewText: `Extracted (simulated): ${i.invoiceNo}` });
    const bill = await payablesService.saveBill(e, { vendorId: i.vendorId, date: i.invoiceDate, dueDate: i.dueDate, vendorBillNo: i.invoiceNo, lines: i.lines.map((l) => ({ ...l, accountId: cat.id, taxRate: i.gstRate })), mode: "draft", attachments: [doc.id], notes: "Created from simulated document extraction — review before submitting." });
    patch("documents", doc.id, { linkedId: bill.id, linkedRef: bill.number }); return bill;
  },

  // ---- Cash flow insights
  async cashInsights(e: ID, days = 90) {
    await latency(150); maybeFail(); const d = ledgerData(e); const bal = balancesAsOf(d, TODAY); const bankIds = d.accounts.filter((a) => a.cashFlow === "cash").map((a) => a.id);
    const start = round2(bankIds.reduce((s, id) => s + (bal.get(id) ?? 0), 0));
    const invoices = list("invoices", e).map(invoiceRow).filter((i) => i.outstanding > 0.01 && !["draft", "void"].includes(i.displayStatus)); const bills = list("bills", e).map(billRow).filter((b) => b.outstanding > 0.01 && !["draft", "pending_approval", "rejected", "void"].includes(b.displayStatus));
    const avgDelay = (() => { const paid = list("payments", e).filter((p) => p.kind === "receipt"); const ds = paid.map((p) => { const inv = get("invoices", p.allocations[0]?.docId ?? ""); return inv ? daysBetween(inv.dueDate, p.date) : 0; }); return ds.length ? Math.round(ds.reduce((s, x) => s + x, 0) / ds.length) : 0; })();
    const events: { date: string; label: string; amount: number; kind: "in" | "out"; source: string }[] = [];
    invoices.forEach((i) => events.push({ date: i.dueDate < TODAY ? addDaysISO(TODAY, 7 + (i.daysOverdue > 60 ? 30 : 0)) : addDaysISO(i.dueDate, Math.max(0, avgDelay)), label: `${i.number} · ${i.customerName}`, amount: i.outstandingBase, kind: "in", source: "Receivable" }));
    bills.forEach((b) => events.push({ date: b.dueDate < TODAY ? addDaysISO(TODAY, 3) : b.dueDate, label: `${b.number} · ${b.vendorName}`, amount: b.outstandingBase, kind: "out", source: "Payable" }));
    const lastPayroll = d.journals.filter((j) => j.kind === "payroll").sort((a, b) => b.date.localeCompare(a.date))[0]; const payroll = lastPayroll ? lastPayroll.lines.reduce((s, l) => s + l.credit, 0) : 0;
    const gst = Math.max(0, -((bal.get(accId(e, "2121")) ?? 0) + (bal.get(accId(e, "2122")) ?? 0) + (bal.get(accId(e, "2123")) ?? 0)) - ((bal.get(accId(e, "1141")) ?? 0) + (bal.get(accId(e, "1142")) ?? 0) + (bal.get(accId(e, "1143")) ?? 0)) * -1);
    const gstDue = round2(Math.max(0, ((bal.get(accId(e, "2121")) ?? 0) + (bal.get(accId(e, "2122")) ?? 0) + (bal.get(accId(e, "2123")) ?? 0)) - ((bal.get(accId(e, "1141")) ?? 0) + (bal.get(accId(e, "1142")) ?? 0) + (bal.get(accId(e, "1143")) ?? 0))));
    void gst;
    for (let k = 0; k <= days; k += 1) { const date = addDaysISO(TODAY, k); const day = Number(date.slice(8, 10)); const last = Number(monthEnd(date).slice(8, 10)); if (day === last && payroll) events.push({ date, label: "Payroll run (estimated)", amount: payroll, kind: "out", source: "Recurring" }); if (day === 20 && gstDue && k > 0) events.push({ date, label: "GST payment (estimated)", amount: gstDue, kind: "out", source: "Tax" }); if (day === 5 && k > 0) events.push({ date, label: "Loan EMI", amount: round2(82000 * (get("entities", e)!.baseCurrency === "INR" ? 1 : 0.012)), kind: "out", source: "Recurring" }); }
    const avgNewSales = round2(list("invoices", e).filter((i) => i.date >= addDaysISO(TODAY, -90)).reduce((s, i) => s + i.total * i.fxRate, 0) / 90); const avgNewCosts = round2(list("bills", e).filter((b) => b.date >= addDaysISO(TODAY, -90) && b.journalId).reduce((s, b) => s + (b.total - b.tdsAmount) * b.fxRate, 0) / 90);
    let bal_ = start; const points: { date: string; label: string; balance: number; inflow: number; outflow: number; baseline: number }[] = []; let baseline = start; let low = { date: TODAY, balance: start };
    for (let k = 0; k <= days; k++) {
      const date = addDaysISO(TODAY, k); const evs = events.filter((x) => x.date === date); const inflow = round2(evs.filter((x) => x.kind === "in").reduce((s, x) => s + x.amount, 0)); const outflow = round2(evs.filter((x) => x.kind === "out").reduce((s, x) => s + x.amount, 0));
      const runIn = k > 20 ? avgNewSales * 0.9 : k > 10 ? avgNewSales * 0.4 : 0, runOut = k > 0 ? avgNewCosts * 0.5 : 0; bal_ = round2(bal_ + inflow - outflow + runIn - runOut); baseline = round2(baseline + inflow - outflow);
      if (bal_ < low.balance) low = { date, balance: bal_ }; points.push({ date, label: formatDate(date, "dd MMM"), balance: bal_, inflow, outflow, baseline });
    }
    const threshold = round2(Math.max(start * 0.35, 1)); const warnings = [] as { level: "warning" | "error"; text: string }[];
    if (low.balance < threshold) warnings.push({ level: low.balance < 0 ? "error" : "warning", text: `Projected balance dips to ${formatCompact(low.balance, get("entities", e)!.baseCurrency)} around ${formatDate(low.date)} — below the ${formatCompact(threshold, get("entities", e)!.baseCurrency)} comfort level.` });
    const overdueIn = invoices.filter((i) => i.daysOverdue > 30).reduce((s, i) => s + i.outstandingBase, 0); if (overdueIn > 0) warnings.push({ level: "warning", text: `${formatCompact(overdueIn, get("entities", e)!.baseCurrency)} of receivables are 30+ days overdue; collecting them would lift the balance directly.` });
    return { start, points, low, threshold, warnings, upcomingIn: events.filter((x) => x.kind === "in" && x.date <= addDaysISO(TODAY, 30)).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 8), upcomingOut: events.filter((x) => x.kind === "out" && x.date <= addDaysISO(TODAY, 30)).sort((a, b) => a.date.localeCompare(b.date)).slice(0, 8), receivablesImpact: round2(invoices.reduce((s, i) => s + i.outstandingBase, 0)), payablesImpact: round2(bills.reduce((s, b) => s + b.outstandingBase, 0)), avgDelay, end: points.at(-1)?.balance ?? start };
  },

  // ---- Agents
  async agents(e: ID) { await latency(70); return list("agents", e); },
  async decideTask(e: ID, i: { agentId: ID; taskId: ID; action: "approve" | "reject" }) {
    await latency(500); const ag = get("agents", i.agentId)!; const t = ag.tasks.find((x) => x.id === i.taskId)!; if (t.status !== "proposed") throw new ServiceError("This task has already been decided.");
    let result = "";
    if (i.action === "approve") {
      if (ag.name.startsWith("Reconciliation") && t.id === "t1") { let n = 0; for (const m of list("matchSuggestions", e).filter((x) => x.status === "pending")) { try { await aiService.decideMatch(e, { id: m.id, action: "accept" }); n++; } catch { /* skip */ } } result = `Matched ${n} statement lines (simulated execution).`; }
      else if (ag.name.startsWith("Reconciliation")) { let n = 0; for (const s of list("jvSuggestions", e).filter((x) => x.status === "pending")) { await aiService.decideJournal(e, { id: s.id, action: "approve" }); n++; } result = `Created ${n} DRAFT journals — review and post them in Journal Entries.`; }
      else if (ag.name.startsWith("Expense") && t.id === "t1") { list("anomalies", e).filter((a) => a.kind === "unusual_amount").forEach((a) => patch("anomalies", a.id, { status: "reviewed" })); result = "Expense held for review and anomaly marked reviewed (simulated)."; }
      else if (ag.name.startsWith("Expense")) { const cat = list("expenseCategories", e).find((c) => c.name === "Staff Welfare"); list("expenses", e).slice(-3).forEach((x) => { if (cat && ["draft", "pending_approval", "rejected"].includes(x.status)) patch("expenses", x.id, { categoryId: cat.id }); }); result = "Re-categorised editable expenses (posted ones left unchanged)."; }
      else if (ag.name.startsWith("Payables")) {
        const bank = list("bankAccounts", e).find((b) => b.type === "bank")!; let n = 0, pend = 0; const bills = list("bills", e).map(billRow).filter((b) => b.outstanding > 0.01 && b.dueDate <= "2026-11-24" && !["draft", "pending_approval", "rejected", "void"].includes(b.status)).slice(0, 6);
        for (const b of bills) { try { const p = await payablesService.recordPayment(e, { contactId: b.vendorId, date: TODAY, amount: b.outstanding, method: "neft", bankAccountId: bank.id, reference: "AGENT-RUN", currency: b.currency, fxRate: b.currency === get("entities", e)!.baseCurrency ? 1 : b.fxRate, allocations: [{ docId: b.id, amount: b.outstanding }], notes: "Prepared by Payables Agent (simulated)" }); if (p.status === "pending_approval") pend++; else n++; } catch { /* skip */ } }
        result = `Recorded ${n} simulated payments${pend ? `; ${pend} above the approval limit await an approver` : ""}. No real money moved.`;
      } else if (ag.name.startsWith("Financial")) { await orgService.addDocument(e, { name: "Management-summary-Oct-2026.pdf", size: 183000, mime: "application/pdf", category: "Other", linkedType: "report", linkedRef: "Oct 2026", previewText: "Management summary generated by the Financial Reporting Agent (simulated)." }); result = "Management summary saved to Documents (simulated file)."; }
      else result = "Closing checklist created (simulated). Resolve the listed items, then close the period.";
    }
    const tasks = ag.tasks.map((x) => (x.id === t.id ? { ...x, status: (i.action === "approve" ? "executed" : "rejected") as typeof x.status } : x));
    const history = [{ id: newId("h"), at: nowIso(), text: i.action === "approve" ? `Approved by ${currentUser()}: ${t.title}. ${result}` : `Rejected by ${currentUser()}: ${t.title}.`, outcome: (i.action === "approve" ? "approved" : "rejected") as "approved" | "rejected" }, ...ag.history];
    logAudit(e, `Agent task ${i.action === "approve" ? "approved" : "rejected"}`, "agent", ag.id, ag.name, t.title);
    return patch("agents", ag.id, { tasks, history, status: tasks.some((x) => x.status === "proposed") ? "awaiting_approval" : "idle", lastActivity: nowIso() });
  },
  async runAgent(e: ID, id: ID) { await latency(900); const ag = get("agents", id)!; return patch("agents", id, { lastActivity: nowIso(), history: [{ id: newId("h"), at: nowIso(), text: "Re-scanned the books (simulated). No new items found beyond the pending proposals.", outcome: "info" as const }, ...ag.history] }); },

  // ---- Automation rules
  async automations(e: ID) { await latency(60); return list("automations", e); },
  async saveAutomation(e: ID, i: Omit<Automation, "entityId" | "executions" | "lastExecuted" | "id"> & { id?: ID }) { await latency(120); const prev = i.id ? get("automations", i.id) : undefined; return upsert("automations", { ...i, id: i.id ?? newId("au"), entityId: e, executions: prev?.executions ?? [], lastExecuted: prev?.lastExecuted } as Automation); },
  async toggleAutomation(e: ID, id: ID) { await latency(60); const a = get("automations", id)!; return patch("automations", id, { status: a.status === "active" ? "paused" : "active" }); },
  async removeAutomation(e: ID, id: ID) { await latency(80); remove("automations", id); },
  async runAutomation(e: ID, id: ID) {
    await latency(700); const a = get("automations", id)!; if (a.status === "paused") throw new ServiceError("Rule is paused. Activate it before running.");
    const overdue = list("invoices", e).map(invoiceRow).filter((x) => x.displayStatus === "overdue").length; const soon = list("bills", e).map(billRow).filter((b) => b.outstanding > 0 && b.dueDate >= TODAY && b.dueDate <= addDaysISO(TODAY, 5)).length;
    const msg = /overdue/i.test(a.name) ? `${overdue} overdue invoices found — in-app notification created (simulated)` : /due date/i.test(a.name) ? `${soon} bills due within 5 days flagged (simulated)` : /bank balance/i.test(a.name) ? "Balance above threshold — nothing to do" : /recurring/i.test(a.name) ? "1 draft journal prepared from template (simulated)" : /unmatched/i.test(a.name) ? `${list("bankTxns", e).filter((t) => t.status === "unmatched").length} unmatched lines would be notified` : "Summary prepared (simulated)";
    const ex = { id: newId("x"), at: nowIso(), result: "success" as const, message: msg }; return patch("automations", id, { lastExecuted: ex.at, executions: [ex, ...a.executions].slice(0, 20) });
  },
};
