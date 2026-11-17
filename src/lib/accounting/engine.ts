import type { Account, AccountType, Bill, Budget, Entity, Invoice, ISODate, Journal, JournalLine } from "@/types";
import { round2 } from "@/lib/formatters";
import { BOOKS_START } from "@/lib/constants";
import { addDaysISO, daysBetween, fiscalYearOf } from "./fiscal";

/** Entity-scoped accounting dataset consumed by every calculation below. */
export interface LedgerData { entity: Entity; accounts: Account[]; journals: Journal[] }

export const isDebitNormal = (t: AccountType) => t === "asset" || t === "expense";
export const natural = (t: AccountType, debit: number, credit: number) => (isDebitNormal(t) ? debit - credit : credit - debit);
export const isPnl = (t: AccountType) => t === "income" || t === "expense";

export function postedJournals(d: LedgerData, from?: ISODate, to?: ISODate): Journal[] {
  return d.journals.filter((j) => (j.status === "posted" || j.status === "reversed") && (!from || j.date >= from) && (!to || j.date <= to));
}

export interface Movement { debit: number; credit: number }
export function movements(d: LedgerData, from?: ISODate, to?: ISODate, filter?: (l: JournalLine, j: Journal) => boolean): Map<string, Movement> {
  const m = new Map<string, Movement>();
  for (const j of postedJournals(d, from, to)) for (const l of j.lines) {
    if (filter && !filter(l, j)) continue;
    const cur = m.get(l.accountId) ?? { debit: 0, credit: 0 };
    cur.debit += l.debit; cur.credit += l.credit; m.set(l.accountId, cur);
  }
  return m;
}

export function childrenOf(accounts: Account[], parentId: string | null) {
  return accounts.filter((a) => a.parentId === parentId).sort((a, b) => a.code.localeCompare(b.code));
}
export function descendantsOf(accounts: Account[], id: string): Account[] {
  const kids = accounts.filter((a) => a.parentId === id);
  return kids.flatMap((k) => [k, ...descendantsOf(accounts, k.id)]);
}

/** Natural balance of each leaf account. BS accounts include opening balance; P&L accounts only the range movement. */
export function balancesAsOf(d: LedgerData, asOf: ISODate, plFrom?: ISODate): Map<string, number> {
  const fyStart = plFrom ?? fiscalYearOf(asOf, d.entity.fyStartMonth).start;
  const bsMov = movements(d, undefined, asOf);
  const plMov = movements(d, fyStart, asOf);
  const out = new Map<string, number>();
  for (const a of d.accounts) {
    if (a.isGroup) continue;
    if (isPnl(a.type)) { const m = plMov.get(a.id); out.set(a.id, m ? natural(a.type, m.debit, m.credit) : 0); }
    else { const m = bsMov.get(a.id); out.set(a.id, a.openingBalance + (m ? natural(a.type, m.debit, m.credit) : 0)); }
  }
  return out;
}

export function netProfit(d: LedgerData, from: ISODate, to: ISODate): number {
  const m = movements(d, from, to);
  let np = 0;
  for (const a of d.accounts) {
    if (a.isGroup) continue;
    const x = m.get(a.id); if (!x) continue;
    if (a.type === "income") np += x.credit - x.debit;
    else if (a.type === "expense") np -= x.debit - x.credit;
  }
  return round2(np);
}

// ---------------- Report trees ----------------
export interface ReportNode {
  id: string; accountId?: string; code: string; label: string; amount: number; isGroup: boolean; depth: number; children?: ReportNode[]; synthetic?: boolean;
}

export function buildTree(accounts: Account[], rootId: string, balances: Map<string, number>, opts: { hideZero?: boolean; sign?: number } = {}): ReportNode | null {
  const sign = opts.sign ?? 1;
  const walk = (a: Account, depth: number): ReportNode | null => {
    if (!a.isGroup) {
      const amt = round2((balances.get(a.id) ?? 0) * sign);
      if (opts.hideZero !== false && Math.abs(amt) < 0.005) return null;
      return { id: a.id, accountId: a.id, code: a.code, label: a.name, amount: amt, isGroup: false, depth };
    }
    const kids = childrenOf(accounts, a.id).map((k) => walk(k, depth + 1)).filter(Boolean) as ReportNode[];
    if (!kids.length && opts.hideZero !== false) return null;
    return { id: a.id, accountId: a.id, code: a.code, label: a.name, amount: round2(kids.reduce((s, k) => s + k.amount, 0)), isGroup: true, depth, children: kids };
  };
  const root = accounts.find((a) => a.id === rootId);
  return root ? walk(root, 0) : null;
}

export function flatten(nodes: ReportNode[], open?: (n: ReportNode) => boolean): ReportNode[] {
  const out: ReportNode[] = [];
  const go = (n: ReportNode) => { out.push(n); if (n.children && (!open || open(n))) n.children.forEach(go); };
  nodes.forEach(go);
  return out;
}

const byCode = (d: LedgerData, code: string) => d.accounts.find((a) => a.code === code);

export interface PnL {
  from: ISODate; to: ISODate;
  revenue: ReportNode | null; cogs: ReportNode | null; opex: ReportNode | null; depreciation: ReportNode | null; otherIncome: ReportNode | null; finance: ReportNode | null;
  totalRevenue: number; totalCogs: number; grossProfit: number; totalOpex: number; ebitda: number; totalDep: number; totalOther: number; totalFinance: number; netProfit: number;
}
export function profitAndLoss(d: LedgerData, from: ISODate, to: ISODate): PnL {
  const bal = balancesAsOf(d, to, from);
  const t = (code: string) => { const a = byCode(d, code); return a ? buildTree(d.accounts, a.id, bal) : null; };
  const revenue = t("4100"), cogs = t("5100"), opex = t("5200"), depreciation = t("5400"), otherIncome = t("4200"), finance = t("5500");
  const v = (n: ReportNode | null) => n?.amount ?? 0;
  const grossProfit = round2(v(revenue) - v(cogs));
  const ebitda = round2(grossProfit - v(opex));
  const netProfit = round2(ebitda - v(depreciation) + v(otherIncome) - v(finance));
  return { from, to, revenue, cogs, opex, depreciation, otherIncome, finance, totalRevenue: v(revenue), totalCogs: v(cogs), grossProfit, totalOpex: v(opex), ebitda, totalDep: v(depreciation), totalOther: v(otherIncome), totalFinance: v(finance), netProfit };
}

export interface BalanceSheet {
  asOf: ISODate; assets: ReportNode | null; liabilities: ReportNode | null; equity: ReportNode | null;
  totalAssets: number; totalLiabilities: number; totalEquity: number; priorEarnings: number; currentEarnings: number; balanced: boolean;
}
export function balanceSheet(d: LedgerData, asOf: ISODate): BalanceSheet {
  const fy = fiscalYearOf(asOf, d.entity.fyStartMonth);
  const bal = balancesAsOf(d, asOf);
  const prior = fy.start > BOOKS_START ? netProfit(d, BOOKS_START, addDaysISO(fy.start, -1)) : 0;
  const current = netProfit(d, fy.start > BOOKS_START ? fy.start : BOOKS_START, asOf);
  const root = (code: string) => { const a = byCode(d, code); return a ? buildTree(d.accounts, a.id, bal) : null; };
  const assets = root("1000"), liabilities = root("2000"), equity = root("3000");
  if (equity && equity.children) {
    equity.children.push({ id: "syn-prior", code: "—", label: "Retained earnings – prior periods (computed)", amount: prior, isGroup: false, depth: 1, synthetic: true });
    equity.children.push({ id: "syn-current", code: "—", label: "Current period earnings (computed)", amount: current, isGroup: false, depth: 1, synthetic: true });
    equity.amount = round2(equity.children.reduce((s, c) => s + c.amount, 0));
  }
  const totalAssets = assets?.amount ?? 0, totalLiabilities = liabilities?.amount ?? 0, totalEquity = equity?.amount ?? 0;
  return { asOf, assets, liabilities, equity, totalAssets, totalLiabilities, totalEquity, priorEarnings: prior, currentEarnings: current, balanced: Math.abs(totalAssets - totalLiabilities - totalEquity) < 0.05 };
}

export interface TBRow { accountId: string; code: string; name: string; type: AccountType; debit: number; credit: number; synthetic?: boolean }
export function trialBalance(d: LedgerData, asOf: ISODate): { rows: TBRow[]; totalDebit: number; totalCredit: number } {
  const bal = balancesAsOf(d, asOf);
  const fy = fiscalYearOf(asOf, d.entity.fyStartMonth);
  const rows: TBRow[] = [];
  for (const a of d.accounts) {
    if (a.isGroup) continue;
    const n = bal.get(a.id) ?? 0; if (Math.abs(n) < 0.005) continue;
    const debitSide = isDebitNormal(a.type) ? n : -n;
    rows.push({ accountId: a.id, code: a.code, name: a.name, type: a.type, debit: debitSide > 0 ? round2(debitSide) : 0, credit: debitSide < 0 ? round2(-debitSide) : 0 });
  }
  const prior = fy.start > BOOKS_START ? netProfit(d, BOOKS_START, addDaysISO(fy.start, -1)) : 0;
  if (Math.abs(prior) > 0.005) rows.push({ accountId: "syn-prior", code: "3200*", name: "Retained earnings – prior periods (carried forward)", type: "equity", debit: prior < 0 ? -prior : 0, credit: prior > 0 ? prior : 0, synthetic: true });
  rows.sort((a, b) => a.code.localeCompare(b.code));
  return { rows, totalDebit: round2(rows.reduce((s, r) => s + r.debit, 0)), totalCredit: round2(rows.reduce((s, r) => s + r.credit, 0)) };
}

// ---------------- Cash flow (indirect) ----------------
export interface CashFlowLine { label: string; amount: number; accountId?: string }
export interface CashFlow {
  from: ISODate; to: ISODate; netProfit: number; operating: CashFlowLine[]; investing: CashFlowLine[]; financing: CashFlowLine[];
  operatingTotal: number; investingTotal: number; financingTotal: number; netChange: number; openingCash: number; closingCash: number; difference: number;
}
export function cashFlow(d: LedgerData, from: ISODate, to: ISODate): CashFlow {
  const open = balancesAsOf(d, addDaysISO(from, -1));
  const close = balancesAsOf(d, to);
  const np = netProfit(d, from, to);
  const operating: CashFlowLine[] = [], investing: CashFlowLine[] = [], financing: CashFlowLine[] = [];
  let openingCash = 0, closingCash = 0;
  // BS deltas on balance-sheet accounts only (P&L accounts reset by FY, so compare using cumulative balances)
  const cum = (asOf: ISODate) => { const m = movements(d, undefined, asOf); return (a: Account) => a.openingBalance + (m.get(a.id) ? natural(a.type, m.get(a.id)!.debit, m.get(a.id)!.credit) : 0); };
  const co = cum(addDaysISO(from, -1)), cc = cum(to);
  void open; void close;
  let dep = 0;
  for (const a of d.accounts) {
    if (a.isGroup || isPnl(a.type)) continue;
    const delta = cc(a) - co(a);
    if (a.cashFlow === "cash") { openingCash += co(a); closingCash += cc(a); continue; }
    if (Math.abs(delta) < 0.005) continue;
    const cashEffect = a.type === "asset" ? -delta : delta;
    if (a.cashFlow === "noncash") { dep += cashEffect; continue; }
    if (a.cashFlow === "working_capital") operating.push({ label: `${a.type === "asset" ? "(Increase)/decrease in" : "Increase/(decrease) in"} ${a.name}`, amount: round2(cashEffect), accountId: a.id });
    else if (a.cashFlow === "investing") investing.push({ label: delta > 0 ? `Purchase – ${a.name}` : `Disposal – ${a.name}`, amount: round2(cashEffect), accountId: a.id });
    else if (a.cashFlow === "financing") financing.push({ label: `${a.name} – ${cashEffect >= 0 ? "proceeds / increase" : "repayment / decrease"}`, amount: round2(cashEffect), accountId: a.id });
  }
  const opLines: CashFlowLine[] = [{ label: "Net profit for the period", amount: np }, { label: "Add: depreciation & non-cash items", amount: round2(dep) }, ...operating];
  const sum = (l: CashFlowLine[]) => round2(l.reduce((s, x) => s + x.amount, 0));
  const operatingTotal = sum(opLines), investingTotal = sum(investing), financingTotal = sum(financing);
  const netChange = round2(operatingTotal + investingTotal + financingTotal);
  return { from, to, netProfit: np, operating: opLines, investing, financing, operatingTotal, investingTotal, financingTotal, netChange, openingCash: round2(openingCash), closingCash: round2(closingCash), difference: round2(closingCash - openingCash - netChange) };
}

// ---------------- Ledger ----------------
export interface LedgerEntry {
  key: string; date: ISODate; journalId: string; journalNumber: string; sourceType: string; sourceRef: string; description: string; kind: string; accountId: string;
  accountCode: string; accountName: string; debit: number; credit: number; balance: number; contactId?: string; lineId: string;
}
/** Ledger entries for one account (or all accounts) with running balance computed in date order from the opening balance. */
export function ledgerEntries(d: LedgerData, opts: { accountId?: string; from?: ISODate; to?: ISODate }): { entries: LedgerEntry[]; opening: number } {
  const accIds = opts.accountId ? new Set([opts.accountId, ...descendantsOf(d.accounts, opts.accountId).map((a) => a.id)]) : null;
  const accMap = new Map(d.accounts.map((a) => [a.id, a]));
  const rows: Omit<LedgerEntry, "balance">[] = [];
  let opening = 0;
  const single = opts.accountId ? accMap.get(opts.accountId) : undefined;
  if (single && !single.isGroup && !isPnl(single.type)) opening = single.openingBalance;
  const js = postedJournals(d).sort((a, b) => a.date.localeCompare(b.date) || a.number.localeCompare(b.number));
  for (const j of js) for (const l of j.lines) {
    if (accIds && !accIds.has(l.accountId)) continue;
    const a = accMap.get(l.accountId)!;
    if (opts.from && j.date < opts.from) { if (single && !single.isGroup) opening += natural(a.type, l.debit, l.credit); continue; }
    if (opts.to && j.date > opts.to) continue;
    rows.push({ key: l.id, date: j.date, journalId: j.id, journalNumber: j.number, sourceType: j.sourceType, sourceRef: j.sourceRef, description: l.description || j.description, kind: j.kind, accountId: a.id, accountCode: a.code, accountName: a.name, debit: l.debit, credit: l.credit, contactId: l.contactId, lineId: l.id });
  }
  let run = opening;
  const entries = rows.map((r) => { run = round2(run + natural(accMap.get(r.accountId)!.type, r.debit, r.credit)); return { ...r, balance: run }; });
  return { entries, opening: round2(opening) };
}

// ---------------- Ageing ----------------
export const AGE_BUCKETS = ["Current", "1–30", "31–60", "61–90", "90+"] as const;
export interface AgeItem { id: string; partyId: string; number: string; dueDate: ISODate; date: ISODate; outstanding: number }
export interface AgeingRow { partyId: string; buckets: number[]; total: number; items: AgeItem[] }
export function bucketIndex(dueDate: ISODate, asOf: ISODate) {
  const late = daysBetween(dueDate, asOf);
  return late <= 0 ? 0 : late <= 30 ? 1 : late <= 60 ? 2 : late <= 90 ? 3 : 4;
}
export function ageing(items: AgeItem[], asOf: ISODate): { rows: AgeingRow[]; totals: number[]; total: number } {
  const map = new Map<string, AgeingRow>();
  for (const it of items) {
    if (it.outstanding <= 0.005 || it.date > asOf) continue;
    const row = map.get(it.partyId) ?? { partyId: it.partyId, buckets: [0, 0, 0, 0, 0], total: 0, items: [] };
    row.buckets[bucketIndex(it.dueDate, asOf)] = round2(row.buckets[bucketIndex(it.dueDate, asOf)] + it.outstanding);
    row.total = round2(row.total + it.outstanding); row.items.push(it); map.set(it.partyId, row);
  }
  const rows = [...map.values()].sort((a, b) => b.total - a.total);
  const totals = AGE_BUCKETS.map((_, i) => round2(rows.reduce((s, r) => s + r.buckets[i], 0)));
  return { rows, totals, total: round2(totals.reduce((s, x) => s + x, 0)) };
}
/** Outstanding in base currency (as booked). */
export const invoiceOutstanding = (i: Invoice) => round2((i.total - i.paid) * i.fxRate);
export const invoiceOutstandingTxn = (i: Invoice) => round2(i.total - i.paid);
export const billOutstandingTxn = (b: Bill) => round2(b.total - b.tdsAmount - b.paid);
export const billOutstanding = (b: Bill) => round2((b.total - b.tdsAmount - b.paid) * b.fxRate);

// ---------------- Budget variance ----------------
export interface VarianceRow { accountId: string; code: string; name: string; type: AccountType; budget: number[]; actual: number[]; budgetTotal: number; actualTotal: number; variance: number; variancePct: number; favourable: boolean }
export function budgetVariance(d: LedgerData, budget: Budget, fyStart: ISODate, dimFilter?: (l: JournalLine) => boolean, upToMonthIdx = 11): VarianceRow[] {
  const accMap = new Map(d.accounts.map((a) => [a.id, a]));
  const start = new Date(fyStart + "T00:00:00");
  const monthIndex = (date: ISODate) => (Number(date.slice(0, 4)) - start.getFullYear()) * 12 + Number(date.slice(5, 7)) - 1 - start.getMonth();
  const actual = new Map<string, number[]>();
  for (const j of postedJournals(d, fyStart)) {
    const mi = monthIndex(j.date); if (mi < 0 || mi > 11) continue;
    for (const l of j.lines) {
      if (dimFilter && !dimFilter(l)) continue;
      const a = accMap.get(l.accountId); if (!a || !isPnl(a.type)) continue;
      const arr = actual.get(a.id) ?? Array(12).fill(0);
      arr[mi] += natural(a.type, l.debit, l.credit); actual.set(a.id, arr);
    }
  }
  return budget.lines.map((bl) => {
    const a = accMap.get(bl.accountId)!;
    const act = (actual.get(bl.accountId) ?? Array(12).fill(0)).map((x: number, i: number) => (i <= upToMonthIdx ? round2(x) : 0));
    const bud = bl.monthly.map((x, i) => (i <= upToMonthIdx ? x : 0));
    const bt = round2(bud.reduce((s, x) => s + x, 0)), at = round2(act.reduce((s: number, x: number) => s + x, 0));
    const variance = round2(at - bt);
    const favourable = a.type === "income" ? variance >= 0 : variance <= 0;
    return { accountId: a.id, code: a.code, name: a.name, type: a.type, budget: bl.monthly, actual: act, budgetTotal: bt, actualTotal: at, variance, variancePct: bt ? round2((variance / bt) * 100) : 0, favourable };
  });
}

// ---------------- Currency ----------------
export const convert = (amount: number, rate: number) => round2(amount * rate);

// ---------------- Tax ----------------
export interface TaxSummary { outputCgst: number; outputSgst: number; outputIgst: number; inputCgst: number; inputSgst: number; inputIgst: number; outputTotal: number; inputTotal: number; netPayable: number; taxableSales: number; taxablePurchases: number }
export function taxSummary(invoices: Invoice[], bills: Bill[], expenseTax: { cgst: number; sgst: number; igst: number; base: number }[], from: ISODate, to: ISODate): TaxSummary {
  let oc = 0, os = 0, oi = 0, ic = 0, is_ = 0, ii = 0, ts = 0, tp = 0;
  for (const i of invoices) { if (i.date < from || i.date > to || ["draft", "void"].includes(i.status)) continue; oc += i.cgst * i.fxRate; os += i.sgst * i.fxRate; oi += i.igst * i.fxRate; ts += i.subtotal * i.fxRate; }
  for (const b of bills) { if (b.date < from || b.date > to || ["draft", "pending_approval", "rejected", "void"].includes(b.status)) continue; ic += b.cgst * b.fxRate; is_ += b.sgst * b.fxRate; ii += b.igst * b.fxRate; tp += b.subtotal * b.fxRate; }
  for (const x of expenseTax) { ic += x.cgst; is_ += x.sgst; ii += x.igst; tp += x.base; }
  const outputTotal = oc + os + oi, inputTotal = ic + is_ + ii;
  return { outputCgst: round2(oc), outputSgst: round2(os), outputIgst: round2(oi), inputCgst: round2(ic), inputSgst: round2(is_), inputIgst: round2(ii), outputTotal: round2(outputTotal), inputTotal: round2(inputTotal), netPayable: round2(outputTotal - inputTotal), taxableSales: round2(ts), taxablePurchases: round2(tp) };
}

// ---------------- Journal helpers ----------------
export function journalTotals(lines: { debit: number; credit: number }[]) {
  const debit = round2(lines.reduce((s, l) => s + (Number(l.debit) || 0), 0)), credit = round2(lines.reduce((s, l) => s + (Number(l.credit) || 0), 0));
  return { debit, credit, difference: round2(debit - credit), balanced: Math.abs(debit - credit) < 0.005 && debit > 0 };
}
export function journalAmount(j: Journal) { return round2(j.lines.reduce((s, l) => s + l.debit, 0)); }

/** Closing entries preview: zero out income & expenses into retained earnings for a fiscal year. */
export function closingEntries(d: LedgerData, from: ISODate, to: ISODate) {
  const m = movements(d, from, to);
  const lines: { accountId: string; code: string; name: string; debit: number; credit: number }[] = [];
  for (const a of d.accounts) {
    if (a.isGroup) continue; const x = m.get(a.id); if (!x) continue;
    const net = a.type === "income" ? x.credit - x.debit : a.type === "expense" ? x.debit - x.credit : 0;
    if (!isPnl(a.type) || Math.abs(net) < 0.005) continue;
    lines.push({ accountId: a.id, code: a.code, name: a.name, debit: a.type === "income" ? round2(net) : 0, credit: a.type === "expense" ? round2(net) : 0 });
  }
  const np = netProfit(d, from, to);
  return { lines: lines.sort((a, b) => a.code.localeCompare(b.code)), netProfit: np, retainedEarnings: { debit: np < 0 ? -np : 0, credit: np > 0 ? np : 0 } };
}

// ---------------------------------------------------------------- Reporting basis
export type ReportBasis = "accrual" | "cash";

/**
 * Cash-basis view of the ledger for profit-and-loss reporting. Invoices and bills (and their revenue/expense lines)
 * are recognised in proportion to the payments applied to them, on the payment date. Everything else (expenses paid
 * at posting, payroll, depreciation, manual journals, credit notes) is kept as booked. Balance-sheet accounts are
 * dropped from the synthetic journals, so use the result for P&L-type calculations only.
 */
export function cashBasisData(d: LedgerData, invoices: Invoice[], bills: Bill[], payments: { date: ISODate; status: string; allocations: { docId: string; amount: number }[] }[]): LedgerData {
  const accType = new Map(d.accounts.map((a) => [a.id, a.type]));
  const pl = (l: JournalLine) => { const t = accType.get(l.accountId); return t === "income" || t === "expense"; };
  const byDoc = new Map<string, Journal>();
  const kept: Journal[] = [];
  for (const j of d.journals) {
    if ((j.kind === "invoice" || j.kind === "bill" || (j.kind === "intercompany" && (j.sourceType === "invoice" || j.sourceType === "bill"))) && j.sourceId) byDoc.set(j.sourceId, j);
    else kept.push(j);
  }
  const out: Journal[] = kept.filter((j) => j.status === "posted" || j.status === "reversed");
  const docBase = new Map<string, number>();
  invoices.forEach((i) => docBase.set(i.id, i.total));
  bills.forEach((b) => docBase.set(b.id, b.total - b.tdsAmount));
  for (const p of payments) {
    if (p.status !== "recorded") continue;
    for (const a of p.allocations) {
      const j = byDoc.get(a.docId); const total = docBase.get(a.docId);
      if (!j || !total || (j.status !== "posted" && j.status !== "reversed")) continue;
      const ratio = Math.min(1, a.amount / total);
      out.push({ ...j, id: `${j.id}-cash-${p.date}-${a.amount}`, date: p.date, status: "posted", lines: j.lines.filter(pl).map((l) => ({ ...l, debit: l.debit * ratio, credit: l.credit * ratio })) });
    }
  }
  return { ...d, journals: out };
}
