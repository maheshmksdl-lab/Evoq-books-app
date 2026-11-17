// In-browser mock database. Seeded deterministically; user changes are stored as a small overlay in
// localStorage ("simulated persistence" — NOT a backend). A real API adapter replaces the services, not this file's callers.
import { buildSeed } from "./seed";
import type { CollectionName, Collections } from "./collections";
import { SIMULATED_USER, TODAY } from "@/lib/constants";
import { fiscalYearOf } from "@/lib/accounting/fiscal";

const KEY = "evoq-books:overlay:v1";
type Overlay = Partial<Record<CollectionName, Record<string, unknown | null>>>;

let store: Collections | null = null;
let overlay: Overlay = {};
let saveTimer: ReturnType<typeof setTimeout> | null = null;

function readOverlay(): Overlay {
  try { if (typeof window === "undefined") return {}; const raw = window.localStorage.getItem(KEY); return raw ? (JSON.parse(raw) as Overlay) : {}; } catch { return {}; }
}
function persist() {
  if (typeof window === "undefined") return;
  if (saveTimer) clearTimeout(saveTimer);
  saveTimer = setTimeout(() => { try { window.localStorage.setItem(KEY, JSON.stringify(overlay)); } catch { /* storage full or blocked — demo continues in memory */ } }, 150);
}

export function db(): Collections {
  if (store) return store;
  store = buildSeed();
  overlay = readOverlay();
  for (const [c, recs] of Object.entries(overlay) as [CollectionName, Record<string, unknown | null>][]) {
    const arr = store[c] as { id: string }[];
    for (const [id, rec] of Object.entries(recs)) {
      const i = arr.findIndex((x) => x.id === id);
      if (rec === null) { if (i >= 0) arr.splice(i, 1); } else if (i >= 0) arr[i] = rec as { id: string }; else arr.push(rec as { id: string });
    }
  }
  return store;
}

export function list<K extends CollectionName>(c: K, entityId?: string): Collections[K] {
  const arr = db()[c] as unknown as { entityId?: string }[];
  return (entityId ? arr.filter((x) => x.entityId === entityId) : arr.slice()) as unknown as Collections[K];
}
export function get<K extends CollectionName>(c: K, id: string): Collections[K][number] | undefined {
  return (db()[c] as unknown as { id: string }[]).find((x) => x.id === id) as Collections[K][number] | undefined;
}
export function upsert<K extends CollectionName, T extends Collections[K][number]>(c: K, rec: T): T {
  const arr = db()[c] as unknown as { id: string }[];
  const i = arr.findIndex((x) => x.id === (rec as { id: string }).id);
  if (i >= 0) arr[i] = rec as never; else arr.push(rec as never);
  (overlay[c] ??= {} as Record<string, unknown | null>)[(rec as { id: string }).id] = JSON.parse(JSON.stringify(rec));
  persist();
  return rec;
}
export function patch<K extends CollectionName>(c: K, id: string, changes: Partial<Collections[K][number]>): Collections[K][number] {
  const cur = get(c, id);
  if (!cur) throw new Error(`${c}/${id} not found`);
  return upsert(c, { ...(cur as object), ...(changes as object) } as Collections[K][number]);
}
export function remove(c: CollectionName, id: string) {
  const arr = db()[c] as unknown as { id: string }[];
  const i = arr.findIndex((x) => x.id === id);
  if (i >= 0) arr.splice(i, 1);
  (overlay[c] ??= {} as Record<string, unknown | null>)[id] = null;
  persist();
}
export function resetDemoData() {
  overlay = {}; store = null;
  try { window.localStorage.removeItem(KEY); } catch { /* ignore */ }
}
export function hasOverlay() { db(); return Object.values(overlay).some((o) => o && Object.keys(o).length > 0); }

let counter = 0;
export const newId = (prefix: string) => `${prefix}-${Date.now().toString(36)}${(counter++).toString(36)}`;
export const nowIso = () => `${TODAY}T${new Date().toTimeString().slice(0, 8)}`;
export const currentUser = () => SIMULATED_USER;

/** Next sequential document number for an entity within a fiscal year, e.g. INV-2627-0042. */
export function nextNumber(entityId: string, collection: "invoices" | "bills" | "payments" | "expenses" | "creditNotes", prefix: string, date: string, filter?: (r: never) => boolean) {
  const e = db().entities.find((x) => x.id === entityId)!;
  const fy = fiscalYearOf(date, e.fyStartMonth).short;
  const arr = (db()[collection] as unknown as { entityId: string; number: string }[]).filter((r) => r.entityId === entityId && r.number.startsWith(`${prefix}-${fy}-`) && (!filter || filter(r as never)));
  const max = arr.reduce((m, r) => Math.max(m, Number(r.number.split("-")[2]) || 0), 0);
  return `${prefix}-${fy}-${String(max + 1).padStart(4, "0")}`;
}
export function nextJournalNumber(entityId: string, date: string) {
  const e = db().entities.find((x) => x.id === entityId)!;
  const fy = fiscalYearOf(date, e.fyStartMonth).short;
  const max = db().journals.filter((j) => j.entityId === entityId && j.number.startsWith(`JV-${fy}-`)).reduce((m, j) => Math.max(m, Number(j.number.split("-")[2]) || 0), 0);
  return `JV-${fy}-${String(max + 1).padStart(5, "0")}`;
}
export function logAudit(entityId: string, action: string, objectType: string, objectId: string, ref: string, detail: string) {
  upsert("audit", { id: newId("aud"), entityId, at: nowIso(), user: currentUser(), action, objectType, objectId, ref, detail });
}
