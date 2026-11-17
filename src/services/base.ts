// Shared helpers for the mock service layer. Services are the only code that touches the mock DB;
// UI code talks to services through TanStack Query hooks, so a real API adapter can replace them.
import type { ApprovalDocType, ApprovalRule, Journal, JournalKind, JournalLine, ID } from "@/types";
import { get, list, logAudit, newId, nextJournalNumber, nowIso, upsert, currentUser } from "@/lib/mock/db";
import { journalTotals, type LedgerData } from "@/lib/accounting/engine";
import { round2 } from "@/lib/formatters";

export class ServiceError extends Error {
  constructor(message: string, public code: string = "VALIDATION") { super(message); this.name = "ServiceError"; }
}

export const latency = (ms = 80) => new Promise<void>((r) => setTimeout(r, ms));

/** Simulates a failing request when the global “simulate error” switch is on (Settings → Appearance → Developer). */
export function maybeFail() {
  try { if (typeof window !== "undefined" && window.localStorage.getItem("evoq-books:simulate-error") === "1") throw new ServiceError("Simulated network error — the mock service was told to fail.", "NETWORK"); }
  catch (e) { if (e instanceof ServiceError) throw e; }
}

export function ledgerData(entityId: ID): LedgerData {
  const entity = get("entities", entityId);
  if (!entity) throw new ServiceError(`Entity ${entityId} not found`, "NOT_FOUND");
  return { entity, accounts: list("accounts", entityId), journals: list("journals", entityId) };
}

export function findPeriod(entityId: ID, date: string) {
  return list("periods", entityId).find((p) => date >= p.start && date <= p.end);
}
export function assertPeriodOpen(entityId: ID, date: string) {
  const p = findPeriod(entityId, date);
  if (p && p.status !== "open") throw new ServiceError(`${p.name} is ${p.status}. Re-open the period (Accounting → Financial Periods) or choose another date.`, "PERIOD_CLOSED");
}

export function matchingRule(entityId: ID, docType: ApprovalDocType, amount: number): ApprovalRule | undefined {
  return list("approvalRules", entityId).find((r) => r.enabled && r.docType === docType && amount >= r.minAmount && (r.minAmount > 0 || docType === "period_close"));
}

export function requestApproval(entityId: ID, o: { docType: ApprovalDocType; docId: ID; docRef: string; title: string; amount: number; rule: ApprovalRule; by?: string }) {
  const at = nowIso();
  return upsert("approvals", { id: newId("rq"), entityId, docType: o.docType, docId: o.docId, docRef: o.docRef, title: o.title, amount: o.amount, requestedBy: o.by ?? currentUser(), requestedAt: at, status: "pending", approverRole: o.rule.approverRole, history: [{ at, by: o.by ?? currentUser(), action: "submitted" }] });
}

export interface JournalInput {
  date: string; description: string; reference?: string; kind?: JournalKind; sourceType?: string; sourceId?: string; sourceRef?: string;
  currency?: string; fxRate?: number; status?: Journal["status"]; attachments?: ID[]; aiSuggested?: boolean;
  lines: { accountId: ID; debit: number; credit: number; description?: string; contactId?: ID; departmentId?: ID; costCenterId?: ID; projectId?: ID }[];
  recurring?: Journal["recurrence"]; template?: boolean; reversalOf?: ID;
}

export function validateJournalLines(entityId: ID, lines: JournalInput["lines"], opts: { requireBalanced: boolean }) {
  const accounts = list("accounts", entityId);
  const errors: string[] = [];
  const clean = lines.filter((l) => (Number(l.debit) || 0) !== 0 || (Number(l.credit) || 0) !== 0 || l.accountId);
  if (clean.length < 2) errors.push("A journal needs at least two lines.");
  clean.forEach((l, i) => {
    const a = accounts.find((x) => x.id === l.accountId);
    if (!a) errors.push(`Line ${i + 1}: select a valid account.`);
    else if (a.isGroup) errors.push(`Line ${i + 1}: “${a.name}” is a group account and cannot be posted to.`);
    else if (!a.active) errors.push(`Line ${i + 1}: “${a.name}” is inactive.`);
    if ((Number(l.debit) || 0) < 0 || (Number(l.credit) || 0) < 0) errors.push(`Line ${i + 1}: amounts cannot be negative.`);
    if ((Number(l.debit) || 0) > 0 && (Number(l.credit) || 0) > 0) errors.push(`Line ${i + 1}: enter either a debit or a credit, not both.`);
  });
  const t = journalTotals(clean.map((l) => ({ debit: Number(l.debit) || 0, credit: Number(l.credit) || 0 })));
  if (opts.requireBalanced && !t.balanced) errors.push(`Total debits (${t.debit.toFixed(2)}) must equal total credits (${t.credit.toFixed(2)}).`);
  if (errors.length) throw new ServiceError(errors.join(" "));
  return clean;
}

/** Creates a journal record. Posted journals are validated for balance, valid accounts and an open period. */
export function createJournalRecord(entityId: ID, input: JournalInput, existingId?: ID): Journal {
  const status = input.status ?? "posted";
  const isDraft = status === "draft";
  if (!isDraft) assertPeriodOpen(entityId, input.date);
  const lines = validateJournalLines(entityId, input.lines, { requireBalanced: !isDraft });
  const id = existingId ?? newId("jv");
  const prev = existingId ? get("journals", existingId) : undefined;
  const now = nowIso(), user = currentUser();
  const j: Journal = {
    id, entityId, number: prev?.number ?? nextJournalNumber(entityId, input.date), date: input.date, reference: input.reference, description: input.description, status,
    kind: input.kind ?? (input.template ? "recurring" : "manual"), sourceType: input.sourceType ?? "manual", sourceId: input.sourceId, sourceRef: input.sourceRef ?? "Manual journal",
    currency: input.currency ?? get("entities", entityId)!.baseCurrency, fxRate: input.fxRate ?? 1,
    lines: lines.map((l, i) => ({ id: `${id}-l${i + 1}`, accountId: l.accountId, debit: round2(Number(l.debit) || 0), credit: round2(Number(l.credit) || 0), description: l.description, contactId: l.contactId, departmentId: l.departmentId, costCenterId: l.costCenterId, projectId: l.projectId } as JournalLine)),
    attachments: input.attachments ?? prev?.attachments ?? [], createdBy: prev?.createdBy ?? user, createdAt: prev?.createdAt ?? now, updatedBy: user, updatedAt: now,
    postedBy: status === "posted" ? user : prev?.postedBy, postedAt: status === "posted" ? now : prev?.postedAt, recurringTemplate: input.template, recurrence: input.recurring, reversalOf: input.reversalOf, aiSuggested: input.aiSuggested,
  };
  upsert("journals", j);
  logAudit(entityId, status === "posted" ? "Posted journal" : prev ? "Updated journal" : "Created journal", "journal", id, j.number, `${j.description} (${status})`);
  return j;
}

export const sumLines = (lines: { debit: number; credit: number }[]) => journalTotals(lines);
