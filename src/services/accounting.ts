import type { Account, AccountType, Contact, ContactKind, ID, Journal } from "@/types";
import { get, list, logAudit, newId, nowIso, patch, upsert, currentUser } from "@/lib/mock/db";
import { balancesAsOf, journalAmount, ledgerEntries, natural, postedJournals, childrenOf, descendantsOf } from "@/lib/accounting/engine";
import { TODAY } from "@/lib/constants";
import { round2 } from "@/lib/formatters";
import { accId } from "@/lib/mock/chart";
import { ServiceError, createJournalRecord, latency, ledgerData, matchingRule, maybeFail, requestApproval, validateJournalLines, type JournalInput } from "./base";

// ---------------------------------------------------------------- Chart of accounts
export interface AccountRow extends Account { balance: number; hasActivity: boolean; level: number }
const TYPE_PREFIX: Record<AccountType, string> = { asset: "1", liability: "2", equity: "3", income: "4", expense: "5" };
export interface AccountInput { code: string; name: string; type: AccountType; parentId: ID | null; isGroup: boolean; openingBalance: number; description?: string; active?: boolean; cashFlow?: Account["cashFlow"] }

export function validateAccountInput(e: ID, i: AccountInput, selfId?: ID) {
  const accounts = list("accounts", e);
  if (!/^\d{4,6}$/.test(i.code)) throw new ServiceError("Account code must be 4–6 digits.");
  if (!i.code.startsWith(TYPE_PREFIX[i.type])) throw new ServiceError(`${i.type[0].toUpperCase() + i.type.slice(1)} account codes must start with ${TYPE_PREFIX[i.type]}.`);
  if (accounts.some((a) => a.code === i.code && a.id !== selfId)) throw new ServiceError(`Code ${i.code} is already used.`);
  if (!i.parentId) throw new ServiceError("Select a parent group.");
  const parent = accounts.find((a) => a.id === i.parentId);
  if (!parent) throw new ServiceError("Parent account not found.");
  if (!parent.isGroup) throw new ServiceError("Parent must be a group account. Accounts that hold transactions cannot have children.");
  if (parent.type !== i.type) throw new ServiceError(`Parent group is ${parent.type}; the child must be the same type.`);
  if (selfId && descendantsOf(accounts, selfId).some((d) => d.id === i.parentId) || selfId === i.parentId) throw new ServiceError("An account cannot be its own parent.");
  if (i.isGroup && i.openingBalance) throw new ServiceError("Group accounts cannot carry an opening balance.");
  if (i.openingBalance < 0 && !(i.type === "asset" && /accumulated/i.test(i.name))) throw new ServiceError("Opening balance is entered on the account's normal side and cannot be negative.");
}

export const accountsService = {
  async list(e: ID): Promise<AccountRow[]> {
    await latency(60); maybeFail();
    const d = ledgerData(e); const bal = balancesAsOf(d, TODAY);
    const used = new Set(d.journals.filter((j) => j.status !== "draft").flatMap((j) => j.lines.map((l) => l.accountId)));
    const rollup = (a: Account): number => (a.isGroup ? childrenOf(d.accounts, a.id).reduce((s, c) => s + rollup(c), 0) : bal.get(a.id) ?? 0);
    const depth = (a: Account): number => (a.parentId ? 1 + depth(d.accounts.find((x) => x.id === a.parentId)!) : 0);
    const hasAct = (a: Account): boolean => (a.isGroup ? childrenOf(d.accounts, a.id).some(hasAct) : used.has(a.id));
    return d.accounts.map((a) => ({ ...a, balance: round2(rollup(a)), hasActivity: hasAct(a), level: depth(a) })).sort((a, b) => a.code.localeCompare(b.code));
  },
  async create(e: ID, i: AccountInput) {
    await latency(120); validateAccountInput(e, i);
    const ent = get("entities", e)!; const a = upsert("accounts", { id: accId(e, i.code), entityId: e, code: i.code, name: i.name.trim(), type: i.type, group: get("accounts", i.parentId!)?.name ?? "", parentId: i.parentId, isGroup: i.isGroup, openingBalance: round2(i.openingBalance), currency: ent.baseCurrency, active: true, system: false, description: i.description, cashFlow: i.cashFlow });
    logAudit(e, "Created account", "account", a.id, `${a.code} ${a.name}`, a.type); return a;
  },
  async update(e: ID, i: AccountInput & { id: ID }) {
    await latency(120); const cur = get("accounts", i.id); if (!cur) throw new ServiceError("Account not found");
    validateAccountInput(e, i, i.id);
    const d = ledgerData(e); const hasTx = d.journals.some((j) => j.status !== "draft" && j.lines.some((l) => l.accountId === i.id));
    if (cur.system && (cur.type !== i.type || cur.isGroup !== i.isGroup)) throw new ServiceError("System accounts cannot change type or group status.");
    if (hasTx && (cur.type !== i.type || cur.isGroup !== i.isGroup)) throw new ServiceError("This account has posted transactions — its type and group status can no longer change.");
    const a = patch("accounts", i.id, { code: i.code, name: i.name.trim(), type: i.type, parentId: i.parentId, isGroup: i.isGroup, openingBalance: round2(i.openingBalance), description: i.description, group: get("accounts", i.parentId!)?.name ?? cur.group });
    logAudit(e, "Updated account", "account", a.id, `${a.code} ${a.name}`, ""); return a;
  },
  async setActive(e: ID, i: { id: ID; active: boolean }) {
    await latency(100); const a = get("accounts", i.id); if (!a) throw new ServiceError("Account not found");
    if (!i.active) {
      if (a.system) throw new ServiceError("System accounts cannot be deactivated.");
      const d = ledgerData(e); const bal = balancesAsOf(d, TODAY);
      const ids = a.isGroup ? descendantsOf(d.accounts, a.id).filter((x) => !x.isGroup && x.active) : [a];
      const nonZero = ids.filter((x) => Math.abs(bal.get(x.id) ?? 0) > 0.005);
      if (nonZero.length) throw new ServiceError(`Cannot deactivate: ${nonZero.map((x) => x.name).slice(0, 3).join(", ")} still has a balance. Transfer it first.`);
      if (a.isGroup) descendantsOf(d.accounts, a.id).forEach((x) => patch("accounts", x.id, { active: false }));
    }
    const r = patch("accounts", i.id, { active: i.active }); logAudit(e, i.active ? "Activated account" : "Deactivated account", "account", a.id, `${a.code} ${a.name}`, ""); return r;
  },
  async importRows(e: ID, rows: { code: string; name: string; type: AccountType; parentCode: string; openingBalance: number }[]) {
    await latency(500);
    const accounts = list("accounts", e); const results: { row: number; code: string; ok: boolean; message: string }[] = [];
    rows.forEach((r, idx) => {
      try {
        const parent = accounts.find((a) => a.code === r.parentCode) ?? list("accounts", e).find((a) => a.code === r.parentCode);
        if (!parent) throw new ServiceError(`Parent ${r.parentCode} not found`);
        validateAccountInput(e, { code: r.code, name: r.name, type: r.type, parentId: parent.id, isGroup: false, openingBalance: r.openingBalance });
        upsert("accounts", { id: accId(e, r.code), entityId: e, code: r.code, name: r.name, type: r.type, group: parent.name, parentId: parent.id, isGroup: false, openingBalance: r.openingBalance, currency: get("entities", e)!.baseCurrency, active: true, system: false });
        results.push({ row: idx + 1, code: r.code, ok: true, message: "Imported" });
      } catch (err) { results.push({ row: idx + 1, code: r.code, ok: false, message: (err as Error).message }); }
    });
    logAudit(e, "Imported accounts (simulated file)", "account", "import", `${results.filter((x) => x.ok).length} rows`, `${results.filter((x) => !x.ok).length} rejected`);
    return results;
  },
};

// ---------------------------------------------------------------- Journals
export interface JournalRow extends Journal { amount: number }
export interface JournalSave extends Omit<JournalInput, "status"> { id?: ID; mode: "draft" | "post" }

export const journalsService = {
  async list(e: ID): Promise<JournalRow[]> {
    await latency(70); maybeFail();
    return list("journals", e).map((j) => ({ ...j, amount: journalAmount(j) })).sort((a, b) => b.date.localeCompare(a.date) || b.number.localeCompare(a.number));
  },
  async get(e: ID, id: ID): Promise<JournalRow> { await latency(40); const j = get("journals", id); if (!j || j.entityId !== e) throw new ServiceError("Journal not found", "NOT_FOUND"); return { ...j, amount: journalAmount(j) }; },
  async save(e: ID, i: JournalSave) {
    await latency(150);
    const prev = i.id ? get("journals", i.id) : undefined;
    if (prev && !["draft", "rejected"].includes(prev.status)) throw new ServiceError("Posted journals cannot be edited. Create a reversal or adjustment entry instead.", "IMMUTABLE");
    if (i.mode === "draft") return createJournalRecord(e, { ...i, status: "draft" }, i.id);
    const total = round2(i.lines.reduce((s, l) => s + (Number(l.debit) || 0), 0));
    validateJournalLines(e, i.lines, { requireBalanced: true });
    const ent = get("entities", e)!;
    const rule = ent.accountSettings.requireJournalApproval ? matchingRule(e, "journal", total) : undefined;
    if (rule) {
      const j = createJournalRecord(e, { ...i, status: "pending_approval" }, i.id);
      requestApproval(e, { docType: "journal", docId: j.id, docRef: j.number, title: j.description, amount: total, rule });
      return j;
    }
    return createJournalRecord(e, { ...i, status: "posted" }, i.id);
  },
  async remove(e: ID, id: ID) {
    await latency(100); const j = get("journals", id); if (!j) throw new ServiceError("Journal not found");
    if (!["draft", "rejected"].includes(j.status)) throw new ServiceError("Posted journals cannot be deleted. Use “Reverse” to correct them.", "IMMUTABLE");
    const { remove } = await import("@/lib/mock/db"); remove("journals", id); logAudit(e, "Deleted draft journal", "journal", id, j.number, j.description);
  },
  async reverse(e: ID, i: { id: ID; date: string; reason?: string }) {
    await latency(150);
    const j = get("journals", i.id); if (!j) throw new ServiceError("Journal not found");
    if (j.status !== "posted") throw new ServiceError("Only posted journals can be reversed.");
    if (j.reversedBy) throw new ServiceError("This journal has already been reversed.");
    const rev = createJournalRecord(e, { date: i.date, description: `Reversal of ${j.number}${i.reason ? ` – ${i.reason}` : ""}`, kind: "reversal", sourceType: "reversal", sourceRef: j.number, reversalOf: j.id, status: "posted",
      lines: j.lines.map((l) => ({ accountId: l.accountId, debit: l.credit, credit: l.debit, description: l.description, contactId: l.contactId, departmentId: l.departmentId, projectId: l.projectId, costCenterId: l.costCenterId })) });
    patch("journals", j.id, { status: "reversed", reversedBy: rev.id, updatedAt: nowIso(), updatedBy: currentUser() });
    logAudit(e, "Reversed journal", "journal", j.id, j.number, `Reversal ${rev.number}`);
    return rev;
  },
  async history(e: ID, id: ID) {
    await latency(40);
    const j = get("journals", id)!;
    const audit = list("audit", e).filter((a) => a.objectId === id).map((a) => ({ at: a.at, user: a.user, action: a.action, detail: a.detail }));
    const approvals = list("approvals", e).filter((a) => a.docId === id).flatMap((a) => a.history.map((h) => ({ at: h.at, user: h.by, action: `Approval ${h.action}`, detail: h.comment ?? "" })));
    const base = [{ at: j.createdAt, user: j.createdBy, action: "Created", detail: j.description }, ...(j.postedAt ? [{ at: j.postedAt, user: j.postedBy ?? "", action: "Posted", detail: j.number }] : [])];
    return [...base, ...audit, ...approvals].sort((a, b) => a.at.localeCompare(b.at));
  },
  async runRecurring(e: ID, id: ID) {
    await latency(200); const t = get("journals", id); if (!t?.recurrence) throw new ServiceError("Not a recurring template");
    const d = createJournalRecord(e, { date: t.recurrence.nextDate, description: t.description.replace(/^Recurring – /, ""), kind: "recurring", status: "draft", lines: t.lines.map((l) => ({ accountId: l.accountId, debit: l.debit, credit: l.credit })) });
    const next = new Date(t.recurrence.nextDate); next.setMonth(next.getMonth() + (t.recurrence.frequency === "monthly" ? 1 : t.recurrence.frequency === "quarterly" ? 3 : 12));
    patch("journals", t.id, { recurrence: { ...t.recurrence, nextDate: next.toISOString().slice(0, 10) } }); return d;
  },
};

// ---------------------------------------------------------------- Ledger
export const ledgerService = {
  async entries(e: ID, i: { accountId?: ID; from?: string; to?: string }) {
    await latency(70); maybeFail();
    const d = ledgerData(e); return ledgerEntries(d, i);
  },
  async accountSummary(e: ID, i: { from: string; to: string }) {
    await latency(70);
    const d = ledgerData(e); const js = postedJournals(d, i.from, i.to); const m = new Map<string, { debit: number; credit: number }>();
    for (const j of js) for (const l of j.lines) { const c = m.get(l.accountId) ?? { debit: 0, credit: 0 }; c.debit += l.debit; c.credit += l.credit; m.set(l.accountId, c); }
    const opening = balancesAsOf(d, new Date(new Date(i.from).getTime() - 86400000).toISOString().slice(0, 10), i.from);
    return d.accounts.filter((a) => !a.isGroup && (m.has(a.id) || Math.abs(opening.get(a.id) ?? 0) > 0.005)).map((a) => {
      const x = m.get(a.id) ?? { debit: 0, credit: 0 }; const o = opening.get(a.id) ?? 0; const isPl = a.type === "income" || a.type === "expense";
      const op = isPl ? 0 : o; return { accountId: a.id, code: a.code, name: a.name, type: a.type, opening: round2(op), debit: round2(x.debit), credit: round2(x.credit), closing: round2(op + natural(a.type, x.debit, x.credit)) };
    }).sort((a, b) => a.code.localeCompare(b.code));
  },
};

// ---------------------------------------------------------------- Contacts
export interface ContactRow extends Contact { balance: number; lastActivity?: string; docCount: number }
export interface ContactInput { id?: ID; kind: ContactKind; name: string; email: string; phone: string; address: string; city: string; state: string; country: string; taxId: string; gstin: string; pan: string; openingBalance: number; creditDays: number; paymentTerms: string; ledgerAccountId: ID; currency: string; status: "active" | "inactive"; tdsSection?: string; tdsRate?: number }

export function contactBalance(e: ID, c: Contact): number {
  const sign = c.kind === "customer" ? 1 : -1; let s = 0;
  const control = new Set([accId(e, "1120"), accId(e, "1180"), accId(e, "2110"), accId(e, "2170"), c.ledgerAccountId]);
  for (const j of list("journals", e)) if (j.status === "posted" || j.status === "reversed") for (const l of j.lines) if (l.contactId === c.id && control.has(l.accountId)) s += l.debit - l.credit;
  return round2(s * sign);
}

export const contactsService = {
  async list(e: ID, kind?: ContactKind): Promise<ContactRow[]> {
    await latency(60); maybeFail();
    const journals = list("journals", e).filter((j) => j.status === "posted" || j.status === "reversed");
    const bal = new Map<string, number>(), last = new Map<string, string>(), cnt = new Map<string, number>();
    const ctrl = new Set([accId(e, "1120"), accId(e, "1180"), accId(e, "2110"), accId(e, "2170")]);
    for (const j of journals) for (const l of j.lines) if (l.contactId) { if (ctrl.has(l.accountId)) bal.set(l.contactId, (bal.get(l.contactId) ?? 0) + l.debit - l.credit); if (!last.get(l.contactId) || last.get(l.contactId)! < j.date) last.set(l.contactId, j.date); cnt.set(l.contactId, (cnt.get(l.contactId) ?? 0) + 1); }
    return list("contacts", e).filter((c) => !kind || c.kind === kind).map((c) => ({ ...c, balance: round2((bal.get(c.id) ?? 0) * (c.kind === "customer" ? 1 : -1)), lastActivity: last.get(c.id), docCount: cnt.get(c.id) ?? 0 }));
  },
  async get(e: ID, id: ID): Promise<ContactRow> { const all = await contactsService.list(e); const c = all.find((x) => x.id === id); if (!c) throw new ServiceError("Contact not found", "NOT_FOUND"); return c; },
  async save(e: ID, i: ContactInput) {
    await latency(150);
    if (i.gstin && !/^\d{2}[A-Z0-9]{10}\d[A-Z]\d$/i.test(i.gstin) && !/^\d{2}[A-Z]{5}\d{4}[A-Z][A-Z0-9]Z[A-Z0-9]$/i.test(i.gstin)) throw new ServiceError("GSTIN must be 15 characters (e.g. 27AABCA4821K1Z5).");
    if (i.pan && !/^[A-Z]{5}\d{4}[A-Z]$/i.test(i.pan)) throw new ServiceError("PAN must be 10 characters (e.g. AABCA4821K).");
    const dup = list("contacts", e).find((c) => c.id !== i.id && c.name.trim().toLowerCase() === i.name.trim().toLowerCase() && c.kind === i.kind);
    if (dup) throw new ServiceError(`A ${i.kind} named “${dup.name}” already exists.`);
    const prev = i.id ? get("contacts", i.id) : undefined;
    const c = upsert("contacts", { ...(prev ?? { createdAt: nowIso() }), ...i, id: i.id ?? newId("ct"), entityId: e, gstin: i.gstin.toUpperCase(), pan: i.pan.toUpperCase() } as Contact);
    if (!prev && i.openingBalance > 0 && i.kind !== "other") {
      const obe = accId(e, "3300");
      createJournalRecord(e, { date: TODAY, description: `Opening balance – ${c.name}`, kind: "opening", sourceType: "contact", sourceId: c.id, sourceRef: c.name, status: "posted",
        lines: i.kind === "customer" ? [{ accountId: c.ledgerAccountId, debit: i.openingBalance, credit: 0, contactId: c.id }, { accountId: obe, debit: 0, credit: i.openingBalance }] : [{ accountId: obe, debit: i.openingBalance, credit: 0 }, { accountId: c.ledgerAccountId, debit: 0, credit: i.openingBalance, contactId: c.id }] });
    }
    logAudit(e, prev ? "Updated contact" : "Created contact", "contact", c.id, c.name, c.kind); return c;
  },
  async setStatus(e: ID, i: { id: ID; status: "active" | "inactive" }) { await latency(80); const c = patch("contacts", i.id, { status: i.status }); logAudit(e, `Marked contact ${i.status}`, "contact", c.id, c.name, ""); return c; },
  async importRows(e: ID, kind: ContactKind, names: string[]) {
    await latency(450); let n = 0;
    const base = kind === "customer" ? accId(e, "1120") : kind === "vendor" ? accId(e, "2110") : accId(e, "2140");
    for (const name of names) { if (list("contacts", e).some((c) => c.name === name)) continue; upsert("contacts", { id: newId("ct"), entityId: e, kind, name, email: "", phone: "", address: "", city: "", state: "", country: "India", taxId: "", gstin: "", pan: "", openingBalance: 0, creditDays: 30, paymentTerms: "Net 30", ledgerAccountId: base, status: "active", currency: get("entities", e)!.baseCurrency, createdAt: nowIso() }); n++; }
    logAudit(e, "Imported contacts (simulated file)", "contact", "import", `${n} records`, kind); return n;
  },
  async statement(e: ID, i: { contactId: ID; from: string; to: string }) {
    await latency(70);
    const c = get("contacts", i.contactId); if (!c) throw new ServiceError("Contact not found");
    const sign = c.kind === "customer" ? 1 : -1; const ctrl = new Set([accId(e, "1120"), accId(e, "1180"), accId(e, "2110"), accId(e, "2170")]);
    const rows: { date: string; ref: string; description: string; debit: number; credit: number; journalId: string }[] = [];
    let opening = 0;
    for (const j of [...list("journals", e)].sort((a, b) => a.date.localeCompare(b.date))) if (j.status === "posted" || j.status === "reversed") for (const l of j.lines) if (l.contactId === c.id && ctrl.has(l.accountId)) {
      const net = (l.debit - l.credit) * sign;
      if (j.date < i.from) opening += net; else if (j.date <= i.to) rows.push({ date: j.date, ref: j.sourceRef, description: j.description, debit: c.kind === "customer" ? l.debit : l.credit, credit: c.kind === "customer" ? l.credit : l.debit, journalId: j.id });
    }
    let run = opening;
    const out = rows.map((r) => { run = round2(run + r.debit - r.credit); return { ...r, balance: run }; });
    return { contact: c, opening: round2(opening), rows: out, closing: round2(run) };
  },
};
