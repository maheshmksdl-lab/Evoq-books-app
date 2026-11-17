import type { BankAccount, BankTxn, ID } from "@/types";
import { get, list, logAudit, newId, nowIso, patch, upsert, currentUser } from "@/lib/mock/db";
import { balancesAsOf } from "@/lib/accounting/engine";
import { TODAY } from "@/lib/constants";
import { round2 } from "@/lib/formatters";
import { accId } from "@/lib/mock/chart";
import { addDaysISO, daysBetween } from "@/lib/accounting/fiscal";
import { ServiceError, createJournalRecord, latency, ledgerData, maybeFail } from "./base";

export interface BankAccountRow extends BankAccount { bookBalance: number; unmatched: number; unmatchedValue: number }
export interface BookLine { lineId: ID; journalId: ID; journalNumber: string; date: string; description: string; sourceRef: string; debit: number; credit: number; reconciled: boolean; reconciledWith?: ID }

function reconciledLineMap(e: ID) {
  const m = new Map<string, string>();
  for (const t of list("bankTxns", e)) for (const l of t.matchedLineIds) m.set(l, t.id);
  return m;
}
export function bookLinesFor(e: ID, bankId: ID): BookLine[] {
  const b = get("bankAccounts", bankId); if (!b) return [];
  const map = reconciledLineMap(e); const out: BookLine[] = [];
  for (const j of list("journals", e)) if (j.status === "posted" || j.status === "reversed") for (const l of j.lines) if (l.accountId === b.ledgerAccountId)
    out.push({ lineId: l.id, journalId: j.id, journalNumber: j.number, date: j.date, description: l.description || j.description, sourceRef: j.sourceRef, debit: l.debit, credit: l.credit, reconciled: map.has(l.id), reconciledWith: map.get(l.id) });
  return out.sort((a, b2) => b2.date.localeCompare(a.date));
}
const txnAmount = (t: BankTxn) => round2(t.deposit - t.withdrawal);

export const bankingService = {
  async accounts(e: ID): Promise<BankAccountRow[]> {
    await latency(60); maybeFail();
    const bal = balancesAsOf(ledgerData(e), TODAY); const txns = list("bankTxns", e);
    return list("bankAccounts", e).map((b) => {
      const natural = bal.get(b.ledgerAccountId) ?? 0; const u = txns.filter((t) => t.bankAccountId === b.id && t.status === "unmatched");
      return { ...b, bookBalance: b.type === "credit_card" ? -natural : natural, unmatched: u.length, unmatchedValue: round2(u.reduce((s, t) => s + t.deposit + t.withdrawal, 0)) };
    });
  },
  async account(e: ID, id: ID) { const a = (await bankingService.accounts(e)).find((x) => x.id === id); if (!a) throw new ServiceError("Bank account not found", "NOT_FOUND"); return a; },
  async createAccount(e: ID, i: { name: string; bankName: string; accountNo: string; type: BankAccount["type"]; ledgerAccountId: ID; openingStatement: number }) {
    await latency(150); const a = get("accounts", i.ledgerAccountId); if (!a || a.isGroup) throw new ServiceError("Choose a ledger account for this bank account.");
    if (list("bankAccounts", e).some((b) => b.ledgerAccountId === i.ledgerAccountId)) throw new ServiceError("That ledger account is already linked to a bank account.");
    const b = upsert("bankAccounts", { id: newId("ba"), entityId: e, name: i.name, bankName: i.bankName, accountNo: i.accountNo, type: i.type, currency: get("entities", e)!.baseCurrency, ledgerAccountId: i.ledgerAccountId, statementBalance: i.openingStatement });
    logAudit(e, "Added bank account", "bank_account", b.id, b.name, ""); return b;
  },
  async txns(e: ID, bankAccountId?: ID) {
    await latency(70); maybeFail();
    const lines = new Map<string, { number: string; description: string }>();
    list("journals", e).forEach((j) => j.lines.forEach((l) => lines.set(l.id, { number: j.number, description: j.description })));
    return list("bankTxns", e).filter((t) => !bankAccountId || t.bankAccountId === bankAccountId).map((t) => ({ ...t, matchedRefs: t.matchedLineIds.map((l) => lines.get(l)?.number ?? "").filter(Boolean), accountName: t.accountId ? get("accounts", t.accountId)?.name : undefined, bankName: get("bankAccounts", t.bankAccountId)?.name ?? "" })).sort((a, b) => b.date.localeCompare(a.date) || b.id.localeCompare(a.id));
  },
  async bookLines(e: ID, bankId: ID) { await latency(60); return bookLinesFor(e, bankId); },
  async categorize(e: ID, i: { txnId: ID; accountId: ID; description?: string }) {
    await latency(150); const t = get("bankTxns", i.txnId)!; const bank = get("bankAccounts", t.bankAccountId)!; const acc = get("accounts", i.accountId);
    if (!acc || acc.isGroup) throw new ServiceError("Choose a valid ledger account.");
    if (t.status === "matched") throw new ServiceError("Transaction is already matched.");
    const amt = round2(t.deposit || t.withdrawal);
    const j = createJournalRecord(e, { date: t.date, description: i.description || t.description, kind: "bank", sourceType: "bank_txn", sourceId: t.id, sourceRef: t.reference, status: "posted",
      lines: t.deposit > 0 ? [{ accountId: bank.ledgerAccountId, debit: amt, credit: 0 }, { accountId: acc.id, debit: 0, credit: amt }] : [{ accountId: acc.id, debit: amt, credit: 0 }, { accountId: bank.ledgerAccountId, debit: 0, credit: amt }] });
    const line = j.lines.find((l) => l.accountId === bank.ledgerAccountId)!;
    logAudit(e, "Categorised bank transaction", "bank_txn", t.id, t.description, `→ ${acc.name} (${j.number})`);
    return patch("bankTxns", t.id, { status: "matched", matchedLineIds: [line.id], matchedJournalIds: [j.id], category: acc.name, accountId: acc.id });
  },
  async setCategory(e: ID, i: { txnId: ID; accountId: ID }) { await latency(60); const a = get("accounts", i.accountId)!; return patch("bankTxns", i.txnId, { status: "categorized", category: a.name, accountId: a.id }); },
  async match(e: ID, i: { txnId: ID; lineIds: ID[] }) {
    await latency(120); const t = get("bankTxns", i.txnId)!; if (!i.lineIds.length) throw new ServiceError("Select at least one book transaction.");
    const lines = bookLinesFor(e, t.bankAccountId).filter((l) => i.lineIds.includes(l.lineId));
    if (lines.some((l) => l.reconciled)) throw new ServiceError("One of the selected book entries is already matched.");
    const book = round2(lines.reduce((s, l) => s + l.debit - l.credit, 0)); const diff = round2(txnAmount(t) - book);
    if (Math.abs(diff) > 0.005) throw new ServiceError(`Selected entries total ${book.toFixed(2)} but the statement line is ${txnAmount(t).toFixed(2)} — a difference of ${diff.toFixed(2)}.`);
    logAudit(e, "Matched bank transaction", "bank_txn", t.id, t.description, `${lines.length} book entr${lines.length > 1 ? "ies" : "y"}`);
    return patch("bankTxns", t.id, { status: "matched", matchedLineIds: lines.map((l) => l.lineId), matchedJournalIds: [...new Set(lines.map((l) => l.journalId))] });
  },
  async unmatch(e: ID, txnId: ID) { await latency(80); logAudit(e, "Unmatched bank transaction", "bank_txn", txnId, get("bankTxns", txnId)!.description, ""); return patch("bankTxns", txnId, { status: "unmatched", matchedLineIds: [], matchedJournalIds: [], category: undefined, accountId: undefined }); },
  async exclude(e: ID, txnId: ID) { await latency(80); logAudit(e, "Excluded bank transaction (duplicate/bank error)", "bank_txn", txnId, get("bankTxns", txnId)!.description, ""); return patch("bankTxns", txnId, { status: "excluded" }); },
  async autoMatch(e: ID, bankId: ID) {
    await latency(600); let n = 0; const used = new Set<string>(); const books = bookLinesFor(e, bankId).filter((l) => !l.reconciled);
    for (const t of list("bankTxns", e).filter((x) => x.bankAccountId === bankId && x.status === "unmatched" && !x.duplicateOf)) {
      const amt = txnAmount(t);
      const hit = books.find((l) => !used.has(l.lineId) && Math.abs(round2(l.debit - l.credit) - amt) < 0.005 && Math.abs(daysBetween(l.date, t.date)) <= 5);
      if (hit) { used.add(hit.lineId); patch("bankTxns", t.id, { status: "matched", matchedLineIds: [hit.lineId], matchedJournalIds: [hit.journalId] }); n++; }
    }
    logAudit(e, "Auto-match run (simulated rules)", "bank_account", bankId, get("bankAccounts", bankId)!.name, `${n} matched`); return n;
  },
  async importStatement(e: ID, i: { bankAccountId: ID; fileName: string; rows?: { date: string; description: string; withdrawal: number; deposit: number }[] }) {
    await latency(700);
    const b = get("bankAccounts", i.bankAccountId)!; const existing = list("bankTxns", e).filter((t) => t.bankAccountId === b.id);
    const rows = i.rows?.length ? i.rows : sampleStatement(e, b);
    const batch = `imp-${Date.now().toString(36)}`; let imported = 0, dupes = 0; let bal = existing.sort((a, c) => a.date.localeCompare(c.date)).at(-1)?.balance ?? b.statementBalance;
    for (const r of rows) {
      const dup = existing.find((t) => t.date === r.date && t.withdrawal === r.withdrawal && t.deposit === r.deposit && t.description.slice(0, 12) === r.description.slice(0, 12));
      bal = round2(bal + r.deposit - r.withdrawal);
      upsert("bankTxns", { id: newId("bt"), entityId: e, bankAccountId: b.id, date: r.date, description: r.description, reference: `IMP${Math.floor(Math.random() * 1e8)}`, withdrawal: r.withdrawal, deposit: r.deposit, balance: bal, status: "unmatched", matchedLineIds: [], matchedJournalIds: [], duplicateOf: dup?.id, importBatch: batch });
      dup ? dupes++ : imported++;
    }
    patch("bankAccounts", b.id, { statementBalance: bal });
    logAudit(e, "Imported bank statement (simulated)", "bank_account", b.id, i.fileName, `${imported} new, ${dupes} possible duplicates`); return { imported, dupes, batch };
  },
  async summary(e: ID, i: { bankAccountId: ID; asOf: string }) {
    await latency(80); const b = get("bankAccounts", i.bankAccountId)!; const bal = balancesAsOf(ledgerData(e), i.asOf);
    const txns = list("bankTxns", e).filter((t) => t.bankAccountId === b.id && t.date <= i.asOf).sort((a, c) => a.date.localeCompare(c.date) || a.id.localeCompare(c.id));
    const statementClosing = txns.at(-1)?.balance ?? b.statementBalance; const bookClosing = bal.get(b.ledgerAccountId) ?? 0;
    const bankOnly = txns.filter((t) => t.status === "unmatched" || t.status === "excluded" || t.status === "categorized");
    const bookOnly = bookLinesFor(e, b.id).filter((l) => !l.reconciled && l.date <= i.asOf);
    const bankOnlyNet = round2(bankOnly.reduce((s, t) => s + txnAmount(t), 0)); const bookOnlyNet = round2(bookOnly.reduce((s, l) => s + l.debit - l.credit, 0));
    const unresolved = txns.filter((t) => t.status === "unmatched" || t.status === "categorized");
    return { bank: b, statementClosing: round2(statementClosing), bookClosing: round2(bookClosing), difference: round2(statementClosing - bookClosing), bankOnly, bookOnly, bankOnlyNet, bookOnlyNet, explained: round2(bankOnlyNet - bookOnlyNet), unresolvedCount: unresolved.length, matchedCount: txns.filter((t) => t.status === "matched").length, openingBook: round2(get("accounts", b.ledgerAccountId)?.openingBalance ?? 0) };
  },
  async reconciliations(e: ID, bankAccountId?: ID) { await latency(50); return list("reconciliations", e).filter((r) => !bankAccountId || r.bankAccountId === bankAccountId).sort((a, b) => b.periodEnd.localeCompare(a.periodEnd)); },
  async completeReconciliation(e: ID, i: { bankAccountId: ID; asOf: string }) {
    await latency(250); const s = await bankingService.summary(e, i);
    if (s.unresolvedCount > 0) throw new ServiceError(`${s.unresolvedCount} statement line(s) are still unmatched or uncategorised. Match, categorise or exclude them first.`);
    const existing = list("reconciliations", e).find((r) => r.bankAccountId === i.bankAccountId && r.periodEnd === i.asOf);
    const rec = { id: existing?.id ?? newId("rc"), entityId: e, bankAccountId: i.bankAccountId, periodEnd: i.asOf, statementClosing: s.statementClosing, bookClosing: s.bookClosing, difference: s.difference, status: "reconciled" as const, by: currentUser(), completedAt: nowIso(), matchedCount: s.matchedCount };
    upsert("reconciliations", rec); patch("bankAccounts", i.bankAccountId, { lastReconciled: i.asOf });
    logAudit(e, "Completed bank reconciliation", "bank_account", i.bankAccountId, i.asOf, `Difference explained by ${s.bookOnly.length} outstanding book item(s)`); return rec;
  },
  // ---- Bank feeds (sample providers; no live connectivity)
  async feeds(e: ID) { await latency(60); return list("bankFeeds", e); },
  async syncFeed(e: ID, id: ID) {
    await latency(900); const f = get("bankFeeds", id)!;
    if (f.status === "reconnect_required" || f.status === "disconnected") throw new ServiceError(`${f.bankName} is not connected — reconnect first.`);
    const fail = f.status === "error"; const at = nowIso(); const n = fail ? 0 : Math.floor(Math.random() * 3) + 1;
    const hist = [{ id: newId("h"), at, result: fail ? "failed" as const : "success" as const, imported: n, message: fail ? "Provider timeout again (simulated)" : `${n} new statement line${n > 1 ? "s" : ""} imported (sample data)` }, ...f.history].slice(0, 12);
    patch("bankFeeds", id, { history: hist, lastSync: fail ? f.lastSync : at, status: fail ? "error" : "connected", errorMessage: fail ? "Provider timeout (simulated)" : undefined });
    if (fail) throw new ServiceError("Sync failed: provider timeout (simulated). Try again.");
    const acct = list("bankAccounts", e).find((b) => b.name === f.accounts[0]); if (acct && n) await bankingService.importStatement(e, { bankAccountId: acct.id, fileName: `${f.provider} sync`, rows: Array.from({ length: n }, (_, k) => ({ date: TODAY, description: `FEED SYNC ${f.bankName.toUpperCase().slice(0, 8)} NEFT CR-SAMPLE PAYER ${k + 1}`, withdrawal: 0, deposit: round2(12500 * (k + 1) + 340) })) });
    return n;
  },
  async reconnectFeed(e: ID, id: ID) { await latency(700); logAudit(e, "Re-authorised bank feed (simulated)", "bank_feed", id, get("bankFeeds", id)!.bankName, ""); return patch("bankFeeds", id, { status: "connected", errorMessage: undefined, lastSync: nowIso() }); },
  async disconnectFeed(e: ID, id: ID) { await latency(200); return patch("bankFeeds", id, { status: "disconnected" }); },
};

function sampleStatement(e: ID, b: BankAccount) {
  const open = list("invoices", e).filter((i) => i.currency === b.currency && i.total - i.paid > 0).slice(0, 2);
  return [
    { date: addDaysISO(TODAY, -2), description: "NEFT CR-SAMPLE CUSTOMER LTD", withdrawal: 0, deposit: open[0] ? round2(open[0].total - open[0].paid) : 150000 },
    { date: addDaysISO(TODAY, -2), description: "POS DR-OFFICE SUPPLIES PUNE", withdrawal: 2480, deposit: 0 },
    { date: addDaysISO(TODAY, -1), description: "CHRG-SMS ALERT QTR", withdrawal: 59, deposit: 0 },
    { date: addDaysISO(TODAY, -1), description: "UPI-FUEL STATION-PUNE", withdrawal: 3100, deposit: 0 },
    { date: TODAY, description: "NEFT CR-ANOTHER PAYER INDUSTRIES", withdrawal: 0, deposit: open[1] ? round2(open[1].total - open[1].paid) : 98000 },
  ];
}
void accId;
