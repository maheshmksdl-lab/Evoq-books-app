import type { Allocation, ApprovalRule, ApprovalRequest, Budget, Dimension, FixedAsset, ID, ISODate } from "@/types";
import { get, list, logAudit, newId, nowIso, patch, upsert, currentUser, remove } from "@/lib/mock/db";
import { balancesAsOf, budgetVariance, natural, postedJournals, profitAndLoss, balanceSheet, cashFlow, invoiceOutstandingTxn, billOutstandingTxn, type LedgerData, type ReportNode } from "@/lib/accounting/engine";
import { depreciationSchedule, accumulatedAt } from "@/lib/accounting/depreciation";
import { fiscalYearOf, monthEnd, addDaysISO } from "@/lib/accounting/fiscal";
import { sampleRate } from "@/lib/mock/generate";
import { TODAY } from "@/lib/constants";
import { round2 } from "@/lib/formatters";
import { accId } from "@/lib/mock/chart";
import { ServiceError, createJournalRecord, latency, ledgerData, maybeFail, assertPeriodOpen } from "./base";
import { payablesService, expensesService, paymentsHelpers } from "./transactions";

const CLASS_ACC: Record<FixedAsset["category"], string> = { "Plant & Machinery": "1210", "Office Equipment": "1220", "Computers & IT": "1230", "Furniture & Fixtures": "1240", Vehicles: "1250" };

// ---------------------------------------------------------------- Fixed assets
function lastDepMonth(e: ID) {
  const m = list("journals", e).filter((j) => j.kind === "depreciation" && j.status === "posted").map((j) => j.sourceRef.replace("DEP-", "")).sort();
  return m.at(-1) ?? "2025-03";
}
export interface AssetRow extends FixedAsset { accumulated: number; nbv: number; monthly: number; annual: number; postedThrough: string; fullyDepreciated: boolean }
const assetRow = (a: FixedAsset, through: string): AssetRow => {
  const sched = depreciationSchedule(a); const acc = accumulatedAt(a, through); const next = sched.find((r) => r.month > through);
  return { ...a, accumulated: acc, nbv: round2(a.cost - acc), monthly: next?.depreciation ?? 0, annual: round2((next?.depreciation ?? 0) * 12), postedThrough: through, fullyDepreciated: sched.length > 0 && sched.at(-1)!.month <= through };
};
export interface AssetInput { id?: ID; name: string; category: FixedAsset["category"]; purchaseDate: string; vendorId?: ID; invoiceRef?: string; cost: number; residual: number; usefulLifeYears: number; method: FixedAsset["method"]; location: string; department?: string; postAcquisition?: boolean; paymentAccountId?: ID }

export const assetsService = {
  async list(e: ID): Promise<AssetRow[]> { await latency(70); maybeFail(); const t = lastDepMonth(e); return list("assets", e).map((a) => assetRow(a, t)).sort((a, b) => a.tag.localeCompare(b.tag)); },
  async get(e: ID, id: ID) { await latency(40); const a = get("assets", id); if (!a) throw new ServiceError("Asset not found", "NOT_FOUND"); return { asset: assetRow(a, lastDepMonth(e)), schedule: depreciationSchedule(a) }; },
  async save(e: ID, i: AssetInput) {
    await latency(150);
    if (i.residual >= i.cost) throw new ServiceError("Residual value must be lower than the acquisition cost.");
    const prev = i.id ? get("assets", i.id) : undefined; const n = list("assets", e).length + 1;
    const a = upsert("assets", { id: prev?.id ?? newId("fa"), entityId: e, tag: prev?.tag ?? `FA-${String(n).padStart(4, "0")}`, name: i.name, category: i.category, purchaseDate: i.purchaseDate, vendorId: i.vendorId, invoiceRef: i.invoiceRef, cost: i.cost, residual: i.residual, usefulLifeYears: i.usefulLifeYears, method: i.method, location: i.location, department: i.department, status: prev?.status ?? "active", assetAccountId: accId(e, CLASS_ACC[i.category]), transfers: prev?.transfers ?? [] } as FixedAsset);
    if (!prev && i.postAcquisition && i.paymentAccountId) {
      const bank = get("bankAccounts", i.paymentAccountId); if (!bank) throw new ServiceError("Select a payment account for the acquisition entry.");
      createJournalRecord(e, { date: i.purchaseDate, description: `Asset acquisition – ${i.name}`, kind: "manual", sourceType: "asset", sourceId: a.id, sourceRef: a.tag, status: "posted", lines: [{ accountId: a.assetAccountId, debit: i.cost, credit: 0 }, { accountId: bank.ledgerAccountId, debit: 0, credit: i.cost }] });
    }
    logAudit(e, prev ? "Updated asset" : "Created asset", "asset", a.id, a.tag, a.name); return a;
  },
  async depreciationPreview(e: ID, month: string) {
    await latency(80); const rows = list("assets", e).filter((a) => a.status === "active").map((a) => ({ asset: a, dep: depreciationSchedule(a).find((r) => r.month === month)?.depreciation ?? 0 })).filter((r) => r.dep > 0);
    const posted = list("journals", e).find((j) => j.kind === "depreciation" && j.sourceRef === `DEP-${month}`);
    return { month, rows, total: round2(rows.reduce((s, r) => s + r.dep, 0)), alreadyPosted: !!posted, journalNumber: posted?.number };
  },
  async postDepreciation(e: ID, month: string) {
    await latency(250); const p = await assetsService.depreciationPreview(e, month);
    if (p.alreadyPosted) throw new ServiceError(`Depreciation for ${month} is already posted (${p.journalNumber}).`);
    if (p.total <= 0) throw new ServiceError("Nothing to depreciate for this month.");
    const date = monthEnd(`${month}-01`); if (date > TODAY) throw new ServiceError("Depreciation can only be posted at or after month-end.");
    const j = createJournalRecord(e, { date, description: `Monthly depreciation – ${month}`, kind: "depreciation", sourceType: "depreciation", sourceRef: `DEP-${month}`, status: "posted", lines: [{ accountId: accId(e, "5410"), debit: p.total, credit: 0 }, { accountId: accId(e, "1290"), debit: 0, credit: p.total }] });
    return j;
  },
  async dispose(e: ID, i: { id: ID; date: string; proceeds: number; bankAccountId: ID }) {
    await latency(200); const a = get("assets", i.id)!; if (a.status !== "active") throw new ServiceError("Asset is not active.");
    const through = i.date.slice(0, 7) > lastDepMonth(e) ? lastDepMonth(e) : i.date.slice(0, 7); const acc = accumulatedAt(a, through); const nbv = round2(a.cost - acc); const gl = round2(i.proceeds - nbv);
    const bank = get("bankAccounts", i.bankAccountId); if (i.proceeds > 0 && !bank) throw new ServiceError("Select the account receiving the proceeds.");
    createJournalRecord(e, { date: i.date, description: `Disposal of ${a.name} (${a.tag})`, kind: "adjustment", sourceType: "asset", sourceId: a.id, sourceRef: a.tag, status: "posted",
      lines: [{ accountId: bank?.ledgerAccountId ?? accId(e, "1111"), debit: i.proceeds, credit: 0 }, { accountId: accId(e, "1290"), debit: acc, credit: 0 }, { accountId: accId(e, "5330"), debit: gl < 0 ? -gl : 0, credit: 0 }, { accountId: a.assetAccountId, debit: 0, credit: a.cost }, { accountId: accId(e, "4240"), debit: 0, credit: gl > 0 ? gl : 0 }] });
    logAudit(e, "Disposed asset", "asset", a.id, a.tag, `proceeds ${i.proceeds}, ${gl >= 0 ? "gain" : "loss"} ${Math.abs(gl)}`);
    return patch("assets", a.id, { status: "disposed", disposal: { date: i.date, proceeds: i.proceeds, gainLoss: gl } });
  },
  async transfer(e: ID, i: { id: ID; to: string; department: string; date: string }) {
    await latency(120); const a = get("assets", i.id)!; if (a.status !== "active") throw new ServiceError("Only active assets can be transferred.");
    logAudit(e, "Transferred asset", "asset", a.id, a.tag, `${a.location} → ${i.to}`);
    return patch("assets", a.id, { location: i.to, department: i.department, transfers: [...a.transfers, { date: i.date, from: a.location, to: i.to, by: currentUser() }] });
  },
};

// ---------------------------------------------------------------- Currency
export function rateOn(e: ID, currency: string, date: ISODate): number {
  const base = get("entities", e)!.baseCurrency; if (currency === base) return 1;
  const rows = list("fxRates", e).filter((r) => r.currency === currency && r.date <= date).sort((a, b) => a.date.localeCompare(b.date) || (a.source === "manual" ? 1 : -1));
  return rows.at(-1)?.rate ?? sampleRate(currency, base, date);
}
export const currencyService = {
  async overview(e: ID) {
    await latency(80); maybeFail(); const ent = get("entities", e)!; const base = ent.baseCurrency;
    const rates = list("fxRates", e); const currencies = [...new Set(rates.map((r) => r.currency))];
    const latest = currencies.map((c) => { const hist = rates.filter((r) => r.currency === c).sort((a, b) => b.date.localeCompare(a.date)); const cur = rateOn(e, c, TODAY); const prev = hist.find((r) => r.date < TODAY.slice(0, 7) + "-01")?.rate ?? cur; return { currency: c, rate: cur, prev, change: round2(((cur - prev) / prev) * 100), asOf: hist[0]?.date ?? TODAY, manual: hist[0]?.source === "manual" }; });
    // Foreign-currency balances: open receivables/payables, plus realised/unrealised FX preview
    const rows: { currency: string; kind: "Receivable" | "Payable"; docNo: string; party: string; amount: number; booked: number; revalued: number; unrealized: number }[] = [];
    list("invoices", e).filter((i) => i.currency !== base && i.total - i.paid > 0.01).forEach((i) => { const out = invoiceOutstandingTxn(i); const booked = round2(out * i.fxRate), rev = round2(out * rateOn(e, i.currency, TODAY)); rows.push({ currency: i.currency, kind: "Receivable", docNo: i.number, party: get("contacts", i.customerId)?.name ?? "", amount: out, booked, revalued: rev, unrealized: round2(rev - booked) }); });
    list("bills", e).filter((b) => b.currency !== base && billOutstandingTxn(b) > 0.01 && !["draft", "pending_approval", "rejected", "void"].includes(b.status)).forEach((b) => { const out = billOutstandingTxn(b); const booked = round2(out * b.fxRate), rev = round2(out * rateOn(e, b.currency, TODAY)); rows.push({ currency: b.currency, kind: "Payable", docNo: b.number, party: get("contacts", b.vendorId)?.name ?? "", amount: out, booked, revalued: rev, unrealized: round2(booked - rev) }); });
    const realized = list("payments", e).filter((p) => p.realizedFx !== undefined && p.status === "recorded").map((p) => ({ id: p.id, number: p.number, date: p.date, currency: p.currency, party: get("contacts", p.contactId)?.name ?? "", amount: p.amount, rate: p.fxRate, gainLoss: p.realizedFx ?? 0 })).sort((a, b) => b.date.localeCompare(a.date));
    const foreignTxns = [...list("invoices", e).filter((i) => i.currency !== base).map((i) => ({ id: i.id, kind: "Invoice", number: i.number, date: i.date, party: get("contacts", i.customerId)?.name ?? "", currency: i.currency, amount: i.total, rate: i.fxRate, base: round2(i.total * i.fxRate) })), ...list("bills", e).filter((b) => b.currency !== base).map((b) => ({ id: b.id, kind: "Bill", number: b.number, date: b.date, party: get("contacts", b.vendorId)?.name ?? "", currency: b.currency, amount: b.total, rate: b.fxRate, base: round2(b.total * b.fxRate) }))].sort((a, b) => b.date.localeCompare(a.date));
    return { base, currencies: latest, rows, realized, foreignTxns, unrealizedTotal: round2(rows.reduce((s, r) => s + r.unrealized, 0)), realizedTotal: round2(realized.reduce((s, r) => s + r.gainLoss, 0)), history: rates.sort((a, b) => b.date.localeCompare(a.date)) };
  },
  async addRate(e: ID, i: { currency: string; date: string; rate: number }) {
    await latency(100); if (!(i.rate > 0)) throw new ServiceError("Rate must be greater than zero."); if (i.currency === get("entities", e)!.baseCurrency) throw new ServiceError("The base currency always has a rate of 1.");
    const r = upsert("fxRates", { id: newId("fx"), entityId: e, currency: i.currency, date: i.date, rate: i.rate, source: "manual" as const }); logAudit(e, "Added exchange rate", "fx_rate", r.id, i.currency, `${i.rate} on ${i.date}`); return r;
  },
  async setBase(e: ID, currency: string) { await latency(120); if (list("journals", e).some((j) => j.status === "posted" && j.kind !== "opening")) throw new ServiceError("Base currency cannot change once transactions are posted. Create a new entity instead."); return patch("entities", e, { baseCurrency: currency }); },
  async addCurrency(e: ID, currency: string) { await latency(100); if (list("fxRates", e).some((r) => r.currency === currency)) throw new ServiceError(`${currency} is already enabled.`); const base = get("entities", e)!.baseCurrency; return upsert("fxRates", { id: newId("fx"), entityId: e, currency, date: TODAY, rate: sampleRate(currency, base, TODAY), source: "reference (sample)" as const }); },
};

// ---------------------------------------------------------------- Budgets
function fyStartFor(e: ID, label: string) { return list("fiscalYears", e).find((f) => f.label === label)?.start ?? fiscalYearOf(TODAY, get("entities", e)!.fyStartMonth).start; }
export const budgetsService = {
  async list(e: ID) { await latency(60); return list("budgets", e).map((b) => ({ ...b, total: round2(b.lines.reduce((s, l) => s + l.monthly.reduce((x, y) => x + y, 0), 0)), dimensionName: b.dimensionId ? get("dimensions", b.dimensionId)?.name : undefined })); },
  async get(e: ID, id: ID) { await latency(40); const b = get("budgets", id); if (!b) throw new ServiceError("Budget not found", "NOT_FOUND"); return b; },
  async save(e: ID, i: Omit<Budget, "entityId" | "createdAt" | "id"> & { id?: ID }) {
    await latency(150); if (!i.lines.length) throw new ServiceError("Add at least one account line.");
    const dup = i.lines.map((l) => l.accountId).find((a, idx, arr) => arr.indexOf(a) !== idx); if (dup) throw new ServiceError(`${get("accounts", dup)?.name} appears more than once.`);
    if (i.scope !== "annual" && !i.dimensionId) throw new ServiceError(`Select a ${i.scope} for this budget.`);
    const prev = i.id ? get("budgets", i.id) : undefined; const b = upsert("budgets", { ...i, id: i.id ?? newId("bud"), entityId: e, createdAt: prev?.createdAt ?? nowIso() } as Budget);
    logAudit(e, prev ? "Updated budget" : "Created budget", "budget", b.id, b.name, ""); return b;
  },
  async variance(e: ID, id: ID, throughIdx?: number) {
    await latency(100); const b = get("budgets", id)!; const d = ledgerData(e); const fyStart = fyStartFor(e, b.fiscalYear);
    const startMonth = Number(fyStart.slice(5, 7)), nowIdx = (Number(TODAY.slice(5, 7)) - startMonth + 12) % 12; const idx = throughIdx ?? Math.max(0, nowIdx - 1);
    const dim = b.dimensionId; const filter = b.scope === "department" ? (l: { departmentId?: string }) => l.departmentId === dim : b.scope === "project" ? (l: { projectId?: string }) => l.projectId === dim : undefined;
    const rows = budgetVariance(d, b, fyStart, filter, idx);
    return { budget: b, rows, throughIdx: idx, fyStart, totals: { budget: round2(rows.reduce((s, r) => s + (r.type === "expense" ? r.budgetTotal : 0), 0)), actual: round2(rows.reduce((s, r) => s + (r.type === "expense" ? r.actualTotal : 0), 0)), incomeBudget: round2(rows.reduce((s, r) => s + (r.type === "income" ? r.budgetTotal : 0), 0)), incomeActual: round2(rows.reduce((s, r) => s + (r.type === "income" ? r.actualTotal : 0), 0)) } };
  },
  async forecast(e: ID) {
    await latency(120); const d = ledgerData(e); const months: { month: string; label: string; revenue: number; expense: number; forecast: boolean }[] = [];
    const base = new Date(TODAY + "T00:00:00"); const mk = (off: number) => { const x = new Date(base.getFullYear(), base.getMonth() + off, 1); return `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, "0")}`; };
    for (let off = -11; off <= -1; off++) { const m = mk(off); const p = profitAndLoss(d, `${m}-01`, monthEnd(`${m}-01`)); months.push({ month: m, label: m, revenue: p.totalRevenue, expense: round2(p.totalCogs + p.totalOpex + p.totalDep + p.totalFinance), forecast: false }); }
    const trend = (key: "revenue" | "expense") => { const ys = months.slice(-6).map((m) => m[key]); const n = ys.length; const xs = ys.map((_, i) => i); const mx = (n - 1) / 2, my = ys.reduce((s, y) => s + y, 0) / n; const slope = xs.reduce((s, x, i) => s + (x - mx) * (ys[i] - my), 0) / xs.reduce((s, x) => s + (x - mx) ** 2, 0); return (k: number) => Math.max(0, my + slope * (n + k - mx)); };
    const fr = trend("revenue"), fe = trend("expense");
    for (let k = 0; k < 6; k++) { const m = mk(k); months.push({ month: m, label: m, revenue: round2(fr(k)), expense: round2(fe(k)), forecast: true }); }
    return months;
  },
};

// ---------------------------------------------------------------- Dimensions
export const dimensionsService = {
  async list(e: ID, kind?: Dimension["kind"]) { await latency(50); return list("dimensions", e).filter((d) => !kind || d.kind === kind); },
  async save(e: ID, i: Omit<Dimension, "entityId" | "id"> & { id?: ID }) {
    await latency(100); if (list("dimensions", e).some((d) => d.id !== i.id && d.kind === i.kind && d.code.toLowerCase() === i.code.toLowerCase())) throw new ServiceError(`Code ${i.code} is already used.`);
    return upsert("dimensions", { ...i, id: i.id ?? newId("dim"), entityId: e } as Dimension);
  },
  async report(e: ID, i: { kind: Dimension["kind"]; from: string; to: string }) {
    await latency(110); const d = ledgerData(e); const accMap = new Map(d.accounts.map((a) => [a.id, a])); const dims = list("dimensions", e).filter((x) => x.kind === i.kind);
    const key = i.kind === "department" ? "departmentId" : i.kind === "costCenter" ? "costCenterId" : "projectId";
    const agg = new Map<string, { revenue: number; cost: number; lines: number }>();
    for (const j of postedJournals(d, i.from, i.to)) for (const l of j.lines) { const id = l[key]; if (!id) continue; const a = accMap.get(l.accountId); if (!a) continue; const x = agg.get(id) ?? { revenue: 0, cost: 0, lines: 0 }; if (a.type === "income") x.revenue += l.credit - l.debit; else if (a.type === "expense") x.cost += l.debit - l.credit; x.lines++; agg.set(id, x); }
    const allocRows = list("allocations", e).filter((a) => a.date >= i.from && a.date <= i.to);
    allocRows.forEach((al) => al.splits.filter((s) => s.kind === i.kind).forEach((s) => { const x = agg.get(s.dimensionId) ?? { revenue: 0, cost: 0, lines: 0 }; const amt = (al.amount * s.percent) / 100; if (al.type === "revenue") x.revenue += amt; else x.cost += amt; agg.set(s.dimensionId, x); }));
    return dims.map((dm) => { const x = agg.get(dm.id) ?? { revenue: 0, cost: 0, lines: 0 }; const profit = round2(x.revenue - x.cost); return { ...dm, revenue: round2(x.revenue), cost: round2(x.cost), profit, margin: x.revenue ? round2((profit / x.revenue) * 100) : 0, budgetUsed: dm.budget ? round2((x.cost / dm.budget) * 100) : 0, lines: x.lines }; });
  },
  async allocations(e: ID) { await latency(50); return list("allocations", e).sort((a, b) => b.date.localeCompare(a.date)); },
  async saveAllocation(e: ID, i: Omit<Allocation, "entityId" | "createdBy" | "id"> & { id?: ID }) {
    await latency(120); if (!i.splits.length) throw new ServiceError("Add at least one allocation split."); const total = round2(i.splits.reduce((s, x) => s + x.percent, 0));
    if (Math.abs(total - 100) > 0.01) throw new ServiceError(`Splits must total 100% (currently ${total}%).`);
    return upsert("allocations", { ...i, id: i.id ?? newId("al"), entityId: e, createdBy: currentUser() } as Allocation);
  },
  async removeAllocation(e: ID, id: ID) { await latency(80); remove("allocations", id); },
};

// ---------------------------------------------------------------- Approvals
export const approvalsService = {
  async requests(e: ID) { await latency(60); maybeFail(); return list("approvals", e).sort((a, b) => b.requestedAt.localeCompare(a.requestedAt)); },
  async rules(e: ID) { await latency(40); return list("approvalRules", e); },
  async saveRule(e: ID, i: Omit<ApprovalRule, "entityId" | "id"> & { id?: ID }) { await latency(100); if (i.minAmount < 0) throw new ServiceError("Limit cannot be negative."); return upsert("approvalRules", { ...i, id: i.id ?? newId("ar"), entityId: e } as ApprovalRule); },
  async removeRule(e: ID, id: ID) { await latency(80); remove("approvalRules", id); },
  async comment(e: ID, i: { id: ID; text: string }) { await latency(60); const r = get("approvals", i.id)!; return patch("approvals", i.id, { history: [...r.history, { at: nowIso(), by: currentUser(), action: "commented", comment: i.text }] }); },
  /** Frontend-simulated role-based approval. `actingRole` is the demo role the viewer is currently simulating. */
  async act(e: ID, i: { id: ID; action: "approve" | "reject"; comment?: string; actingRole: string; canApprove: boolean }) {
    await latency(200); const r = get("approvals", i.id); if (!r) throw new ServiceError("Request not found"); if (r.status !== "pending") throw new ServiceError("This request has already been decided.");
    if (!i.canApprove) throw new ServiceError(`${i.actingRole} does not have the “approve” permission. Switch role from the profile menu to simulate an approver.`, "FORBIDDEN");
    if (!["Owner", "Administrator"].includes(i.actingRole) && i.actingRole !== r.approverRole) throw new ServiceError(`This request is assigned to ${r.approverRole}. You are acting as ${i.actingRole}.`, "FORBIDDEN");
    const at = nowIso(); const user = currentUser();
    if (r.requestedBy === user && i.action === "approve" && !["Owner", "Administrator"].includes(i.actingRole)) throw new ServiceError("Segregation of duties: you submitted this request, so a different approver is needed. Switch to Owner or Administrator from the profile menu to simulate one.", "FORBIDDEN");
    const rule = list("approvalRules", e).find((x) => x.docType === r.docType && x.approverRole === r.approverRole);
    const history = [...r.history, { at, by: `${user} (${i.actingRole})`, action: i.action === "approve" ? "approved" as const : "rejected" as const, comment: i.comment }];
    if (i.action === "approve" && rule?.secondApproverRole && !r.history.some((h) => h.action === "approved") && r.approverRole !== rule.secondApproverRole) {
      patch("approvals", r.id, { history, approverRole: rule.secondApproverRole }); return { final: false, message: `First approval recorded. Awaiting ${rule.secondApproverRole}.` };
    }
    patch("approvals", r.id, { history, status: i.action === "approve" ? "approved" : "rejected" });
    if (i.action === "approve") {
      if (r.docType === "journal" || r.docType === "adjustment") {
        const j = get("journals", r.docId)!; assertPeriodOpen(e, j.date); const posted = patch("journals", j.id, { status: "posted", postedBy: user, postedAt: at, updatedAt: at });
        if (j.sourceType === "writeoff" && j.sourceId) { const inv = get("invoices", j.sourceId)!; const base = j.lines.find((l) => l.debit > 0)!.debit; const amt = round2(base / inv.fxRate); const paid = round2(inv.paid + amt); patch("invoices", inv.id, { paid, status: round2(inv.total - paid) <= 0.01 ? "written_off" : "partial" }); }
        logAudit(e, "Journal approved & posted", "journal", j.id, posted.number, i.comment ?? "");
      } else if (r.docType === "bill") await payablesService.approveBill(e, r.docId);
      else if (r.docType === "expense") await expensesService.approve(e, r.docId);
      else if (r.docType === "payment") { const p = get("payments", r.docId)!; paymentsHelpers.settlePayment(e, p); }
      else if (r.docType === "period_close") patch("periods", r.docId, { status: "closed" });
    } else {
      if (r.docType === "journal" || r.docType === "adjustment") patch("journals", r.docId, { status: "rejected" });
      else if (r.docType === "bill") patch("bills", r.docId, { status: "rejected" });
      else if (r.docType === "expense") patch("expenses", r.docId, { status: "rejected" });
      else if (r.docType === "payment") patch("payments", r.docId, { status: "void" });
    }
    logAudit(e, `Approval ${i.action === "approve" ? "approved" : "rejected"}`, "approval", r.id, r.docRef, i.comment ?? "");
    return { final: true, message: i.action === "approve" ? "Approved — the record was processed in the mock books." : "Rejected." };
  },
};

// ---------------------------------------------------------------- Consolidation (simulated)
const avgRate = (cur: string, to: string, from: string, end: string) => { if (cur === to) return 1; const pts: number[] = []; for (let d = new Date(from + "T00:00:00"); d <= new Date(end + "T00:00:00"); d.setMonth(d.getMonth() + 1)) pts.push(sampleRate(cur, to, d.toISOString().slice(0, 10))); pts.push(sampleRate(cur, to, end)); return round2(pts.reduce((s, x) => s + x, 0) / pts.length * 10000) / 10000; };
export interface ConsRow { key: string; label: string; depth: number; kind: "line" | "subtotal" | "total"; values: Record<string, number>; elimination: number; adjustment: number; consolidated: number }

export const consolidationService = {
  async run(_e: ID, i: { entityIds: ID[]; from: string; to: string; currency: string }) {
    await latency(300); maybeFail();
    if (i.entityIds.length < 2) throw new ServiceError("Select at least two entities to consolidate.");
    const entities = i.entityIds.map((id) => get("entities", id)!); const cur = i.currency;
    const per = entities.map((en) => { const d = ledgerData(en.id); const avg = avgRate(en.baseCurrency, cur, i.from, i.to); const close = en.baseCurrency === cur ? 1 : sampleRate(en.baseCurrency, cur, i.to); return { en, d, avg, close, pl: profitAndLoss(d, i.from, i.to), bs: balanceSheet(d, i.to), cf: cashFlow(d, i.from, i.to) }; });
    // Intercompany: parent-side invoices to subsidiaries (sales) and matching purchases in subsidiaries
    const icList: { date: string; from: string; to: string; docFrom: string; docTo: string; currency: string; amount: number; seller: number; buyer: number; paid: number; open: number }[] = [];
    for (const p of per) for (const inv of list("invoices", p.en.id).filter((x) => x.intercompany && x.date >= i.from && x.date <= i.to)) {
      const cust = get("contacts", inv.customerId)!; const buyerEntity = per.find((x) => x.en.id === cust.intercompanyEntityId); if (!buyerEntity) continue;
      const bill = list("bills", buyerEntity.en.id).find((b) => b.intercompany && b.date === inv.date && Math.abs(b.total - inv.total) < 0.01);
      icList.push({ date: inv.date, from: p.en.name, to: buyerEntity.en.name, docFrom: inv.number, docTo: bill?.number ?? "—", currency: inv.currency, amount: inv.total, seller: round2(inv.total * inv.fxRate * (p.en.baseCurrency === cur ? 1 : p.avg)), buyer: round2(inv.total * (bill?.fxRate ?? 1) * buyerEntity.avg), paid: inv.paid, open: round2(inv.total - inv.paid) });
    }
    const icRevenue = round2(icList.reduce((s, x) => s + x.seller, 0)); const icPurchases = round2(icList.reduce((s, x) => s + x.buyer, 0));
    const icOpenAR = round2(icList.reduce((s, x) => s + x.open, 0));
    const adjustments = list("consolidationAdjustments");
    const sections = [["revenue", "Operating revenue", "totalRevenue"], ["cogs", "Cost of goods sold", "totalCogs"], ["opex", "Operating expenses", "totalOpex"], ["dep", "Depreciation", "totalDep"], ["other", "Other income", "totalOther"], ["fin", "Finance costs", "totalFinance"]] as const;
    const tr = (v: number, p: (typeof per)[number]) => round2(v * p.avg);
    const mk = (key: string, label: string, depth: number, kind: ConsRow["kind"], values: Record<string, number>, elim = 0, adj = 0): ConsRow => ({ key, label, depth, kind, values, elimination: elim, adjustment: adj, consolidated: round2(Object.values(values).reduce((s, x) => s + x, 0) + elim + adj) });
    const val = (f: (p: (typeof per)[number]) => number) => Object.fromEntries(per.map((p) => [p.en.id, tr(f(p), p)]));
    const adjOf = (s: string) => round2(adjustments.filter((a) => a.section === s).reduce((t, a) => t + a.amount, 0));
    const pnl: ConsRow[] = [
      mk("revenue", "Operating revenue", 0, "line", val((p) => p.pl.totalRevenue), -icRevenue, adjOf("revenue")),
      mk("cogs", "Cost of goods sold", 0, "line", val((p) => p.pl.totalCogs), -icPurchases, adjOf("cogs")),
    ];
    const gp = mk("gp", "Gross profit", 0, "subtotal", Object.fromEntries(per.map((p) => [p.en.id, round2(pnl[0].values[p.en.id] - pnl[1].values[p.en.id])])), round2(pnl[0].elimination - pnl[1].elimination), round2(pnl[0].adjustment - pnl[1].adjustment));
    const opex = mk("opex", "Operating expenses", 0, "line", val((p) => p.pl.totalOpex), 0, adjOf("opex"));
    const dep = mk("dep", "Depreciation", 0, "line", val((p) => p.pl.totalDep));
    const other = mk("other", "Other income", 0, "line", val((p) => p.pl.totalOther), 0, adjOf("other"));
    const fin = mk("fin", "Finance costs", 0, "line", val((p) => p.pl.totalFinance), 0, adjOf("finance"));
    const net = mk("net", "Net profit", 0, "total", Object.fromEntries(per.map((p) => [p.en.id, round2(gp.values[p.en.id] - opex.values[p.en.id] - dep.values[p.en.id] + other.values[p.en.id] - fin.values[p.en.id])])), round2(gp.elimination), round2(gp.adjustment - opex.adjustment + other.adjustment - fin.adjustment));
    pnl.splice(2, 0, gp); pnl.push(opex, dep, other, fin, net);
    void sections;
    // Balance sheet
    const bsGroups = (node: ReportNode | null) => (node?.children ?? []).map((c) => c);
    const labels = new Set<string>(); const lookup = (p: (typeof per)[number], root: "assets" | "liabilities" | "equity") => { const m = new Map<string, number>(); bsGroups(p.bs[root]).forEach((c) => { labels.add(`${root}|${c.label}`); m.set(c.label, round2(c.amount * p.close)); }); return m; };
    const lk = per.map((p) => ({ p, assets: lookup(p, "assets"), liabilities: lookup(p, "liabilities"), equity: lookup(p, "equity") }));
    const bsRows: ConsRow[] = [];
    (["assets", "liabilities", "equity"] as const).forEach((root) => {
      const names = [...new Set(lk.flatMap((x) => [...x[root].keys()]))];
      names.forEach((n) => bsRows.push(mk(`${root}-${n}`, n, 1, "line", Object.fromEntries(lk.map((x) => [x.p.en.id, x[root].get(n) ?? 0])), root === "assets" && n === "Current Assets" ? -icOpenAR : root === "liabilities" && n === "Current Liabilities" ? -round2(icOpenAR) : 0)));
      bsRows.push(mk(`${root}-total`, root === "assets" ? "Total assets" : root === "liabilities" ? "Total liabilities" : "Total equity (translated)", 0, "total", Object.fromEntries(lk.map((x) => [x.p.en.id, round2([...x[root].values()].reduce((s, v) => s + v, 0))])), root === "assets" ? -icOpenAR : root === "liabilities" ? -icOpenAR : 0));
    });
    const totalA = bsRows.find((r) => r.key === "assets-total")!, totalL = bsRows.find((r) => r.key === "liabilities-total")!, totalE = bsRows.find((r) => r.key === "equity-total")!;
    const cta = round2(totalA.consolidated - totalL.consolidated - totalE.consolidated);
    bsRows.push(mk("cta", "Currency translation reserve (computed balancing figure)", 1, "line", { _: 0 }, cta));
    // Cash flow
    const cfRows: ConsRow[] = [
      mk("cf-op", "Net cash from operating activities", 0, "line", val((p) => p.cf.operatingTotal)), mk("cf-inv", "Net cash from investing activities", 0, "line", val((p) => p.cf.investingTotal)),
      mk("cf-fin", "Net cash from financing activities", 0, "line", val((p) => p.cf.financingTotal)),
    ];
    const netChange = mk("cf-net", "Net change in cash", 0, "subtotal", Object.fromEntries(per.map((p) => [p.en.id, round2(cfRows[0].values[p.en.id] + cfRows[1].values[p.en.id] + cfRows[2].values[p.en.id])])));
    const openCash = mk("cf-open", "Opening cash (translated at opening rate)", 0, "line", Object.fromEntries(per.map((p) => [p.en.id, round2(p.cf.openingCash * (p.en.baseCurrency === cur ? 1 : sampleRate(p.en.baseCurrency, cur, addDaysISO(i.from, -1))))])));
    const closeCash = mk("cf-close", "Closing cash (translated at closing rate)", 0, "total", Object.fromEntries(per.map((p) => [p.en.id, round2(p.cf.closingCash * p.close)])));
    const fxEffect = mk("cf-fx", "Effect of exchange rate changes (computed)", 0, "line", { _: round2(closeCash.consolidated - openCash.consolidated - netChange.consolidated) });
    cfRows.push(netChange, fxEffect, openCash, closeCash);
    return { currency: cur, entities: per.map((p) => ({ id: p.en.id, name: p.en.name, baseCurrency: p.en.baseCurrency, avg: p.avg, close: p.close })), pnl, balanceSheet: bsRows, cashFlow: cfRows, intercompany: icList, eliminations: icList.length ? [
      { id: "el1", description: "Eliminate intercompany sales against purchases", debit: "Operating revenue (parent)", credit: "Cost of goods sold (subsidiary)", amount: icRevenue },
      { id: "el2", description: "Eliminate intercompany receivable / payable", debit: "Intercompany payable (subsidiary)", credit: "Intercompany receivable (parent)", amount: icOpenAR },
      { id: "el3", description: "Translation difference on intercompany sales (seller vs buyer rate)", debit: "Cost of goods sold", credit: "Currency translation reserve", amount: round2(Math.abs(icRevenue - icPurchases)) },
    ] : [], adjustments, netProfit: net.consolidated };
  },
  async addAdjustment(e: ID, i: { description: string; section: "revenue" | "cogs" | "opex" | "other" | "finance"; amount: number }) { await latency(100); if (!i.amount) throw new ServiceError("Enter a non-zero amount."); return upsert("consolidationAdjustments", { id: newId("ca"), entityId: "group" as const, ...i, createdAt: nowIso(), createdBy: currentUser() }); },
  async removeAdjustment(e: ID, id: ID) { await latency(60); remove("consolidationAdjustments", id); },
  async groupSummary() {
    await latency(150); const ents = list("entities"); const cur = ents[0].baseCurrency; const from = fiscalYearOf(TODAY, ents[0].fyStartMonth).start;
    return ents.map((en) => { const d = ledgerData(en.id); const pl = profitAndLoss(d, en.fyStartMonth === ents[0].fyStartMonth ? from : fiscalYearOf(TODAY, en.fyStartMonth).start, TODAY); const bs = balanceSheet(d, TODAY); const r = en.baseCurrency === cur ? 1 : sampleRate(en.baseCurrency, cur, TODAY); const bal = balancesAsOf(d, TODAY); const cash = d.accounts.filter((a) => a.cashFlow === "cash").reduce((s, a) => s + (bal.get(a.id) ?? 0), 0); return { id: en.id, name: en.name, baseCurrency: en.baseCurrency, role: en.role, rate: r, revenue: round2(pl.totalRevenue * r), netProfit: round2(pl.netProfit * r), assets: round2(bs.totalAssets * r), cash: round2(cash * r), nativeRevenue: pl.totalRevenue, nativeProfit: pl.netProfit, currency: cur }; });
  },
};
void natural; void accId; void ((_: LedgerData) => 0);
export type { ApprovalRequest };
