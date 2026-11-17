import type { AccountingPeriod, AppUser, DocumentFile, Entity, FiscalYear, ID, PermissionAction, PermissionGroup, Role } from "@/types";
import { get, list, logAudit, newId, nowIso, patch, remove, resetDemoData, upsert, currentUser } from "@/lib/mock/db";
import { closingEntries } from "@/lib/accounting/engine";
import { buildAccounts } from "@/lib/mock/chart";
import { fiscalYearByStartYear } from "@/lib/accounting/fiscal";
import { format, addMonths, parseISO } from "date-fns";
import { ServiceError, latency, ledgerData, maybeFail, createJournalRecord, matchingRule, requestApproval } from "./base";
import { accId } from "@/lib/mock/chart";

export interface EntityInput { name: string; legalName: string; country: string; state: string; city: string; address: string; baseCurrency: string; fyStartMonth: number; taxRegime: Entity["taxRegime"]; gstin?: string; pan?: string; industry: string; role: Entity["role"]; ownership: number }

export const entitiesService = {
  async list(): Promise<Entity[]> { await latency(30); maybeFail(); return list("entities"); },
  async get(id: ID) { await latency(30); const e = get("entities", id); if (!e) throw new ServiceError("Entity not found", "NOT_FOUND"); return e; },
  async create(_e: ID, input: EntityInput): Promise<Entity> {
    await latency(200);
    const id = newId("ent").replace("ent-", "e");
    const entity: Entity = { ...input, id, accountSettings: { allowBackdated: true, requireJournalApproval: false, autoNumbering: true, decimalPlaces: 2 } };
    upsert("entities", entity);
    buildAccounts(entity, {}).forEach((a) => upsert("accounts", a));
    const fy = fiscalYearByStartYear(2026, input.fyStartMonth);
    const fyRec: FiscalYear = { id: `${id}-fy`, entityId: id, label: fy.label, start: fy.start, end: fy.end, status: "open" };
    upsert("fiscalYears", fyRec);
    for (let i = 0; i < 12; i++) { const s = addMonths(parseISO(fy.start), i); upsert("periods", { id: `${fyRec.id}-p${i + 1}`, entityId: id, fyId: fyRec.id, name: format(s, "MMM yyyy"), start: format(s, "yyyy-MM-01"), end: format(new Date(s.getFullYear(), s.getMonth() + 1, 0), "yyyy-MM-dd"), status: "open" });}
    logAudit(id, "Created entity", "entity", id, entity.name, `Base currency ${entity.baseCurrency}`);
    return entity;
  },
  async update(_e: ID, input: { id: ID } & Partial<EntityInput> & { accountSettings?: Entity["accountSettings"] }) {
    await latency(120); const { id, ...rest } = input; const r = patch("entities", id, rest as Partial<Entity>); logAudit(id, "Updated entity settings", "entity", id, r.name, Object.keys(rest).join(", ")); return r;
  },
};

export const periodsService = {
  async fiscalYears(e: ID) { await latency(40); return list("fiscalYears", e).sort((a, b) => b.start.localeCompare(a.start)); },
  async periods(e: ID) { await latency(40); return list("periods", e).sort((a, b) => a.start.localeCompare(b.start)); },
  async setStatus(e: ID, i: { periodId: ID; status: AccountingPeriod["status"] }) {
    await latency(150);
    const p = get("periods", i.periodId); if (!p) throw new ServiceError("Period not found");
    if (i.status === "closed") {
      const earlier = list("periods", e).filter((x) => x.end < p.start && x.status === "open");
      if (earlier.length) throw new ServiceError(`Close earlier periods first: ${earlier.map((x) => x.name).join(", ")}.`);
      const pending = list("journals", e).filter((j) => j.date >= p.start && j.date <= p.end && (j.status === "draft" || j.status === "pending_approval"));
      if (pending.length) throw new ServiceError(`${pending.length} draft/pending journal(s) exist in ${p.name}. Post or discard them before closing.`);
      const rule = matchingRule(e, "period_close", 0);
      if (rule && !list("approvals", e).some((a) => a.docType === "period_close" && a.docId === p.id && a.status === "approved")) {
        requestApproval(e, { docType: "period_close", docId: p.id, docRef: p.name, title: `Close period ${p.name}`, amount: 0, rule });
        throw new ServiceError(`Closing ${p.name} needs ${rule.approverRole} approval. A request was added to Advanced Finance → Approvals — approve it, then close the period.`, "APPROVAL_REQUIRED");
      }
    }
    const r = patch("periods", p.id, { status: i.status });
    logAudit(e, `Period ${i.status}`, "period", p.id, p.name, `Status changed to ${i.status} (simulated lock)`);
    return r;
  },
  /** Simulates year-end closing: no journals are posted; the fiscal year and its periods are flagged closed. */
  async closeYear(e: ID, fyId: ID) {
    await latency(300);
    const fy = get("fiscalYears", fyId); if (!fy) throw new ServiceError("Fiscal year not found");
    const open = list("periods", e).filter((p) => p.fyId === fyId && p.status === "open" && p.end <= "2026-11-17");
    if (open.length) throw new ServiceError(`Close all periods first (${open.length} still open).`);
    patch("fiscalYears", fyId, { status: "closed" });
    list("periods", e).filter((p) => p.fyId === fyId).forEach((p) => patch("periods", p.id, { status: "locked" }));
    logAudit(e, "Closed financial year (simulation)", "fiscal_year", fyId, fy.label, "Retained earnings transfer simulated; periods locked");
    return fy;
  },
  async reopenYear(e: ID, fyId: ID) {
    await latency(200); const fy = get("fiscalYears", fyId)!; patch("fiscalYears", fyId, { status: "open" });
    list("periods", e).filter((p) => p.fyId === fyId && p.status === "locked").forEach((p) => patch("periods", p.id, { status: "closed" }));
    logAudit(e, "Re-opened financial year", "fiscal_year", fyId, fy.label, "Periods set to closed (not locked)"); return fy;
  },
  async createFiscalYear(e: ID, i: { startYear: number }) {
    await latency(150);
    const ent = get("entities", e)!; const fy = fiscalYearByStartYear(i.startYear, ent.fyStartMonth);
    if (list("fiscalYears", e).some((x) => x.start === fy.start)) throw new ServiceError(`${fy.label} already exists.`);
    const id = `${e}-fy${i.startYear}`; upsert("fiscalYears", { id, entityId: e, label: fy.label, start: fy.start, end: fy.end, status: "open" });
    for (let k = 0; k < 12; k++) { const s = addMonths(parseISO(fy.start), k); upsert("periods", { id: `${id}-p${k + 1}`, entityId: e, fyId: id, name: format(s, "MMM yyyy"), start: format(s, "yyyy-MM-01"), end: format(new Date(s.getFullYear(), s.getMonth() + 1, 0), "yyyy-MM-dd"), status: "open" }); }
    logAudit(e, "Created fiscal year", "fiscal_year", id, fy.label, `${fy.start} → ${fy.end}`); return fy;
  },
  async closingPreview(e: ID, fyId: ID) {
    await latency(100); const fy = get("fiscalYears", fyId)!; return { fy, ...closingEntries(ledgerData(e), fy.start, fy.end) };
  },
  /** Posts a year-end adjustment entry dated on the last day of the FY (must be an open period). */
  async yearEndAdjustment(e: ID, i: { fyId: ID; description: string; debitAccountId: ID; creditAccountId: ID; amount: number }) {
    await latency(150); const fy = get("fiscalYears", i.fyId)!;
    return createJournalRecord(e, { date: fy.end, description: `Year-end adjustment – ${i.description}`, kind: "adjustment", status: "posted", lines: [{ accountId: i.debitAccountId, debit: i.amount, credit: 0 }, { accountId: i.creditAccountId, debit: 0, credit: i.amount }] });
  },
};

const emptyPerms = (): Role["permissions"] => ({ dashboard: [], accounts: [], journals: [], banking: [], receivables: [], payables: [], expenses: [], tax: [], reports: [], settings: [], approvals: [] });
export const orgService = {
  async roles() { await latency(40); return list("roles"); },
  async saveRole(_e: ID, i: { id?: ID; name: string; description: string; permissions: Record<PermissionGroup, PermissionAction[]> }) {
    await latency(120);
    const cur = i.id ? get("roles", i.id) : undefined;
    const r = upsert("roles", { id: i.id ?? newId("role"), name: i.name, description: i.description, system: cur?.system ?? false, permissions: { ...emptyPerms(), ...i.permissions } });
    logAudit(_e, cur ? "Updated role permissions" : "Created role", "role", r.id, r.name, "Frontend simulation – not server-side authorisation"); return r;
  },
  async deleteRole(e: ID, id: ID) { await latency(100); const r = get("roles", id); if (r?.system) throw new ServiceError("Built-in roles cannot be deleted."); if (list("users").some((u) => u.roleId === id)) throw new ServiceError("Role is assigned to users."); remove("roles", id); logAudit(e, "Deleted role", "role", id, r?.name ?? id, ""); },
  async users(e: ID) { await latency(40); return list("users", e); },
  async saveUser(e: ID, i: Partial<AppUser> & { name: string; email: string; roleId: ID }) {
    await latency(120);
    const u = upsert("users", { id: i.id ?? newId("u"), entityId: e, name: i.name, email: i.email, roleId: i.roleId, status: i.status ?? (i.id ? "active" : "invited"), lastActive: i.lastActive ?? "" });
    logAudit(e, i.id ? "Updated user" : "Invited user (simulated)", "user", u.id, u.name, `Role ${i.roleId}`); return u;
  },
  async documents(e: ID) { await latency(40); return list("documents", e).sort((a, b) => b.createdAt.localeCompare(a.createdAt)); },
  async addDocument(e: ID, i: { name: string; size: number; mime: string; category: DocumentFile["category"]; linkedType: string; linkedId?: ID; linkedRef?: string; dataUrl?: string; previewText?: string }) {
    await latency(250);
    const doc = upsert("documents", { id: newId("doc"), entityId: e, ...i, uploadedBy: currentUser(), createdAt: nowIso(), modifiedBy: currentUser(), modifiedAt: nowIso(), simulated: true as const });
    logAudit(e, "Uploaded document (simulated storage)", "document", doc.id, doc.name, `${i.category}${i.linkedRef ? " · " + i.linkedRef : ""}`);
    return doc;
  },
  async updateDocument(e: ID, i: { id: ID; category?: DocumentFile["category"]; name?: string; linkedId?: ID; linkedRef?: string; linkedType?: string }) { await latency(80); const d = patch("documents", i.id, { ...i, modifiedBy: currentUser(), modifiedAt: nowIso() }); logAudit(e, "Updated document", "document", d.id, d.name, ""); return d; },
  async deleteDocument(e: ID, id: ID) { await latency(100); const d = get("documents", id); remove("documents", id); logAudit(e, "Deleted document", "document", id, d?.name ?? id, ""); },
  async audit(e: ID) { await latency(40); return list("audit", e).sort((a, b) => b.at.localeCompare(a.at)); },
  async notifications(e: ID) { await latency(30); return list("notifications", e).sort((a, b) => b.at.localeCompare(a.at)); },
  async resetDemo() { resetDemoData(); },
};
void accId;
