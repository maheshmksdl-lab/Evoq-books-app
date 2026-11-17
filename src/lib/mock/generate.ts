import { addMonths, endOfMonth, format, parseISO } from "date-fns";
import type {
  Account, Bill, BankAccount, BankTxn, Contact, CreditNote, DocLine, Entity, Expense, FixedAsset, Invoice, Journal, JournalKind,
  Payment, Reconciliation, TdsRecord, AssetCategory,
} from "@/types";
import { BOOKS_START, TODAY } from "@/lib/constants";
import { round2 } from "@/lib/formatters";
import { addDaysISO, daysBetween, fiscalYearOf, monthEnd } from "@/lib/accounting/fiscal";
import { accumulatedAt, depreciationSchedule } from "@/lib/accounting/depreciation";
import { buildAccounts, accId } from "./chart";
import { makeRng } from "./rng";
import type { Collections } from "./collections";

export interface ContactSeed {
  name: string; city: string; state: string; country?: string; currency?: string; creditDays: number;
  scale?: number; weight?: number; late?: number; category?: string; tds?: [string, number]; rate?: number; ic?: boolean; gstin?: string;
}
export interface AssetSeed { name: string; category: AssetCategory; date: string; cost: number; res: number; life: number; method: "SLM" | "WDV" | "DDB"; location: string; dept: string; vendor?: string }
export interface Profile {
  entity: Entity; seed: number; customers: ContactSeed[]; vendors: ContactSeed[]; others: ContactSeed[]; assets: AssetSeed[];
  revenueScale: number; rmRatio: number; monthlyInvoices: number; salary: number; directLabour: number; rent: number; loanOpening: number; emi: number;
  opening: Record<string, number>; gstRate: number; scenario: boolean; banks: { name: string; bank: string; no: string; code: string; type: "bank" | "cash" | "credit_card" }[];
}

export interface Refs {
  dupBills: string[]; unusualExpense?: string; pettyJournal?: string; roundBills: string[]; unmatchedTxns: string[]; bookOnlyJournals: string[];
  multiMatchTxn?: string; multiMatchJournals: string[]; bankOnlyTxns: string[]; duplicateTxn?: string; missingRentMonth?: string; icInvoice?: string;
}

const USERS = ["Meera Iyer", "Rahul Deshmukh", "Kavita Rao", "Arjun Mehta"];
const PRODUCTS = ["Precision shafts – EN8", "Hydraulic manifold blocks", "CNC machined brackets", "Gear housing castings", "Bearing sleeves – set", "Flange couplings", "Forged pinion gears", "Valve body assemblies"];
const SERVICES = ["Installation & commissioning", "Annual maintenance contract", "On-site calibration service", "Retrofit & alignment work"];
const RAW = ["MS flats & rounds", "Aluminium extrusions 6061", "Industrial lubricants – drums", "Forging billets EN19", "Stainless steel sheets 304"];
const CLASS_CODE: Record<AssetCategory, string> = { "Plant & Machinery": "1210", "Office Equipment": "1220", "Computers & IT": "1230", "Furniture & Fixtures": "1240", Vehicles: "1250" };

export const IC_DEALS = [
  { date: "2026-06-10", usd: 18500, desc: "Contract machining – batch IC-06", paid: "2026-07-12" },
  { date: "2026-08-22", usd: 24000, desc: "Fabricated assemblies – batch IC-08", paid: "2026-09-25" },
  { date: "2026-10-05", usd: 12750, desc: "Tooling & fixtures – batch IC-10", paid: null as string | null },
];

/** Sample FX series (units of base currency per 1 foreign). Deterministic and smooth. */
export function sampleRate(from: string, to: string, date: string): number {
  const m = (parseISO(date).getFullYear() - 2025) * 12 + parseISO(date).getMonth() - 3;
  const wobble = Math.sin(m * 1.3) * 0.35;
  const usdInr = 83.4 + 0.27 * m + wobble;
  const perInr: Record<string, number> = { INR: 1, USD: usdInr, AED: usdInr / 3.6725, EUR: usdInr * 1.085 + Math.cos(m) * 0.4, GBP: usdInr * 1.27 + Math.sin(m) * 0.5, SGD: usdInr / 1.34, JPY: usdInr / 150 };
  return round4(perInr[from] / perInr[to]);
}
const round4 = (n: number) => Math.round(n * 10000) / 10000;

export function generateEntity(out: Collections, p: Profile): Refs {
  const e = p.entity;
  const R = makeRng(p.seed);
  const base = e.baseCurrency;
  const A = (c: string) => accId(e.id, c);
  const flat = e.taxRegime === "flat-gst";
  const refs: Refs = { dupBills: [], roundBills: [], unmatchedTxns: [], bookOnlyJournals: [], multiMatchJournals: [], bankOnlyTxns: [] };
  let seq = 0;
  const uid = (pfx: string) => `${e.id}-${pfx}${(++seq).toString(36)}`;
  const user = () => R.pick(USERS);
  const sc = Math.max(p.revenueScale / 6e6, 0.012);
  const DEPT = { sales: `${e.id}-dept-sales`, ops: `${e.id}-dept-ops`, admin: `${e.id}-dept-admin` };
  const fxr = (cur: string, date: string) => (cur === base ? 1 : sampleRate(cur, base, date));

  // ---------- Opening balances & accounts ----------
  const opening: Record<string, number> = { ...p.opening };
  for (const a of p.assets) {
    if (a.date < BOOKS_START) {
      const code = CLASS_CODE[a.category];
      opening[code] = (opening[code] ?? 0) + a.cost;
      opening["1290"] = (opening["1290"] ?? 0) + accumulatedAt({ cost: a.cost, residual: round2(a.cost * a.res), usefulLifeYears: a.life, method: a.method, purchaseDate: a.date, disposal: undefined }, "2025-03");
    }
  }
  const accDep = round2(opening["1290"] ?? 0);
  const assetSum = ["1111", "1112", "1113", "1114", "1130", "1160", "1143", "1210", "1220", "1230", "1240", "1250"].reduce((s, c) => s + (opening[c] ?? 0), 0) - accDep;
  opening["1290"] = -accDep;
  opening["3200"] = round2(assetSum - (opening["2210"] ?? 0) - (opening["3100"] ?? 0));
  const accounts = buildAccounts(e, opening);
  if (flat) {
    const rn: Record<string, string> = { "1111": "DBS Bank – Operating A/c", "1112": "OCBC – Reserve A/c", "1113": "UOB – Collections A/c", "2210": "Term Loan – DBS", "2150": "DBS Business Credit Card" };
    accounts.forEach((a) => { if (rn[a.code]) a.name = rn[a.code]; });
  }
  out.accounts.push(...accounts);

  // ---------- Contacts ----------
  const contacts: Contact[] = [];
  const mkContacts = (list: ContactSeed[], kind: "customer" | "vendor" | "other", pfx: string) =>
    list.map((s, i) => {
      const slug = s.name.replace(/[^A-Za-z]/g, "").slice(0, 6).toUpperCase();
      const c: Contact = {
        id: `${e.id}-${pfx}${i + 1}`, entityId: e.id, kind, name: s.name,
        email: `accounts@${s.name.toLowerCase().replace(/[^a-z]/g, "").slice(0, 14)}.example`,
        phone: `+91 ${R.int(70, 99)}${R.int(10000000, 99999999)}`,
        address: `${R.int(12, 480)}, ${R.pick(["Industrial Estate", "MIDC Phase II", "Business Park", "Main Road", "Trade Centre"])}`,
        city: s.city, state: s.state, country: s.country ?? e.country, taxId: flat ? `T${R.int(10, 99)}LL${R.int(1000, 9999)}A` : "",
        gstin: flat ? "" : s.gstin ?? (s.country && s.country !== "India" ? "" : `${stateCode(s.state)}${slug.padEnd(5, "X").slice(0, 5)}${R.int(1000, 9999)}A1Z${R.int(1, 9)}`),
        pan: flat ? "" : (s.country && s.country !== "India" ? "" : `${slug.padEnd(5, "X").slice(0, 5)}${R.int(1000, 9999)}${R.pick(["A", "K", "L", "F"])}`),
        openingBalance: 0, creditDays: s.creditDays, paymentTerms: s.creditDays === 0 ? "Due on receipt" : `Net ${s.creditDays}`,
        ledgerAccountId: s.ic ? (kind === "customer" ? A("1180") : A("2170")) : kind === "customer" ? A("1120") : kind === "vendor" ? A("2110") : A("2140"),
        status: "active", currency: s.currency ?? base, intercompanyEntityId: s.ic ? (e.id === "e1" ? "e2" : "e1") : undefined,
        tdsSection: s.tds?.[0], tdsRate: s.tds?.[1], createdAt: "2025-04-02T09:00:00",
      };
      contacts.push(c);
      return c;
    });
  const customers = mkContacts(p.customers, "customer", "cu");
  const vendors = mkContacts(p.vendors, "vendor", "ve");
  mkContacts(p.others, "other", "ot");
  out.contacts.push(...contacts);
  const seedOf = (c: Contact, list: ContactSeed[], pfx: string) => list[Number(c.id.replace(`${e.id}-${pfx}`, "")) - 1];

  // ---------- Bank accounts ----------
  const banks: BankAccount[] = p.banks.map((b, i) => ({
    id: `${e.id}-ba${i + 1}`, entityId: e.id, name: b.name, bankName: b.bank, accountNo: b.no, type: b.type, currency: base,
    ledgerAccountId: A(b.code), ifsc: flat ? undefined : b.type === "bank" ? `${b.bank.slice(0, 4).toUpperCase()}0001234` : undefined, statementBalance: 0,
  }));
  out.bankAccounts.push(...banks);
  const bankByCode = (code: string) => banks.find((b) => b.ledgerAccountId === A(code))!;
  const primary = banks[0], second = banks[1], third = banks[2], card = banks.find((b) => b.type === "credit_card");

  // ---------- Journal helper ----------
  type L = { acc: string; dr?: number; cr?: number; contact?: string; desc?: string; dept?: string; proj?: string; cc?: string };
  function jv(o: { date: string; kind: JournalKind; sourceType: string; sourceId?: string; sourceRef: string; description: string; lines: L[]; currency?: string; fxRate?: number; status?: Journal["status"]; ref?: string }): Journal {
    const id = uid("j");
    const lines = o.lines.filter((l) => (l.dr ?? 0) !== 0 || (l.cr ?? 0) !== 0).map((l, i) => ({
      id: `${id}-l${i + 1}`, accountId: A(l.acc), debit: round2(l.dr ?? 0), credit: round2(l.cr ?? 0), description: l.desc, contactId: l.contact, departmentId: l.dept, projectId: l.proj, costCenterId: l.cc,
    }));
    const d = lines.reduce((s, l) => s + l.debit, 0), c = lines.reduce((s, l) => s + l.credit, 0);
    if (Math.abs(d - c) > 0.01) console.warn(`[seed] unbalanced journal ${o.sourceRef} ${o.date}: ${d} vs ${c}`);
    const u = user();
    const j: Journal = {
      id, entityId: e.id, number: "", date: o.date, reference: o.ref, description: o.description, status: o.status ?? "posted", kind: o.kind, sourceType: o.sourceType,
      sourceId: o.sourceId, sourceRef: o.sourceRef, currency: o.currency ?? base, fxRate: o.fxRate ?? 1, lines, attachments: [], createdBy: u, createdAt: `${o.date}T10:00:00`,
      updatedBy: u, updatedAt: `${o.date}T10:00:00`, postedBy: o.status && o.status !== "posted" ? undefined : u, postedAt: o.status && o.status !== "posted" ? undefined : `${o.date}T10:05:00`,
    };
    out.journals.push(j);
    return j;
  }
  const bal = (code: string, upto: string) => {
    const id = A(code); const ac = accounts.find((x) => x.id === id)!;
    let s = ac.type === "asset" || ac.type === "expense" ? (opening[code] ?? 0) : -(opening[code] ?? 0);
    for (const j of out.journals) if (j.entityId === e.id && j.status === "posted" && j.date <= upto) for (const l of j.lines) if (l.accountId === id) s += l.debit - l.credit;
    return s;
  };

  // ---------- Months ----------
  const months: string[] = [];
  for (let d = parseISO(BOOKS_START); format(d, "yyyy-MM-dd") <= TODAY; d = addMonths(d, 1)) months.push(format(d, "yyyy-MM"));
  const dayIn = (m: string, lo: number, hi: number) => {
    const last = Math.min(Number(format(endOfMonth(parseISO(`${m}-01`)), "dd")), hi);
    return `${m}-${String(R.int(Math.min(lo, last), last)).padStart(2, "0")}`;
  };

  // ---------- Tax helper ----------
  function taxFor(subtotal: number, rate: number, partyState: string, partyCountry: string, foreign: boolean) {
    if (foreign || (partyCountry !== e.country)) return { cgst: 0, sgst: 0, igst: 0 };
    if (flat) return { cgst: 0, sgst: 0, igst: round2((subtotal * rate) / 100) };
    if (partyState === e.state) { const h = round2((subtotal * rate) / 200); return { cgst: h, sgst: h, igst: 0 }; }
    return { cgst: 0, sgst: 0, igst: round2((subtotal * rate) / 100) };
  }

  // ---------- Invoices (AR) ----------
  const invoices: Invoice[] = [];
  function makeInvoice(c: Contact, date: string, lines: { description: string; acc: string; qty: number; rate: number }[], rateGst: number, icDeal?: boolean): Invoice {
    const cur = c.currency; const foreign = cur !== base;
    const fx = fxr(cur, date);
    const docLines: DocLine[] = lines.map((l) => ({ id: uid("dl"), description: l.description, accountId: A(l.acc), qty: l.qty, rate: l.rate, taxRate: foreign ? 0 : rateGst, amount: round2(l.qty * l.rate) }));
    const subtotal = round2(docLines.reduce((s, l) => s + l.amount, 0));
    const t = taxFor(subtotal, rateGst, c.state, c.country, foreign);
    const total = round2(subtotal + t.cgst + t.sgst + t.igst);
    const id = uid("inv");
    const arBase = round2(total * fx);
    const taxBase = { cgst: round2(t.cgst * fx), sgst: round2(t.sgst * fx), igst: round2(t.igst * fx) };
    const revBy: Record<string, number> = {};
    docLines.forEach((l) => { const code = l.accountId!.split("-")[1]; revBy[code] = round2((revBy[code] ?? 0) + l.amount * fx); });
    const first = Object.keys(revBy)[0];
    revBy[first] = round2(revBy[first] + (arBase - taxBase.cgst - taxBase.sgst - taxBase.igst - Object.values(revBy).reduce((s, x) => s + x, 0)));
    const j = jv({
      date, kind: icDeal ? "intercompany" : "invoice", sourceType: "invoice", sourceId: id, sourceRef: id, description: `Sales invoice – ${c.name}`, currency: cur, fxRate: fx,
      lines: [{ acc: icDeal ? "1180" : "1120", dr: arBase, contact: c.id }, ...Object.entries(revBy).map(([acc, cr]) => ({ acc, cr })),
        { acc: flat ? "2123" : "2121", cr: flat ? 0 : taxBase.cgst }, { acc: "2122", cr: taxBase.sgst }, { acc: "2123", cr: flat ? taxBase.igst : taxBase.igst }].filter((l) => !(l.acc === "2121" && flat)) as L[],
    });
    const inv: Invoice = {
      id, entityId: e.id, number: "", customerId: c.id, date, dueDate: addDaysISO(date, c.creditDays), currency: cur, fxRate: fx, subtotal, ...t, total, paid: 0, status: "sent",
      source: "EVOQ Billing (sample integration)", journalId: j.id, lines: docLines, placeOfSupply: c.state, intercompany: icDeal,
    };
    invoices.push(inv);
    return inv;
  }

  // ---------- Bills (AP) ----------
  const bills: Bill[] = [];
  const tdsRecords: TdsRecord[] = [];
  function makeBill(v: Contact, date: string, lines: { description: string; acc: string; qty: number; rate: number }[], rateGst: number, o: { status?: Bill["status"]; vendorBillNo?: string; ic?: boolean; dept?: string; tds?: boolean } = {}): Bill {
    const status = o.status ?? "approved";
    const docLines: DocLine[] = lines.map((l) => ({ id: uid("dl"), description: l.description, accountId: A(l.acc), qty: l.qty, rate: l.rate, taxRate: o.ic ? 0 : rateGst, amount: round2(l.qty * l.rate) }));
    const subtotal = round2(docLines.reduce((s, l) => s + l.amount, 0));
    const foreign = v.currency !== base;
    const t = o.ic ? { cgst: 0, sgst: 0, igst: 0 } : taxFor(subtotal, rateGst, v.state, v.country, foreign);
    const sec = v.tdsSection && o.tds !== false && !o.ic ? v.tdsSection : undefined;
    const tds = sec ? round2((subtotal * (v.tdsRate ?? 0)) / 100) : 0;
    const total = round2(subtotal + t.cgst + t.sgst + t.igst);
    const id = uid("bill");
    const fx = fxr(v.currency, date);
    const vbn = o.vendorBillNo ?? `${v.name.replace(/[^A-Z]/g, "").slice(0, 3) || "VB"}/${date.slice(2, 4)}/${R.int(100, 999)}`;
    let journalId: string | undefined;
    if (["approved", "partial", "paid", "overdue"].includes(status)) {
      const apBase = round2((total - tds) * fx);
      const exp: Record<string, number> = {};
      docLines.forEach((l) => { const code = l.accountId!.split("-")[1]; exp[code] = round2((exp[code] ?? 0) + l.amount * fx); });
      const tb = { cgst: round2(t.cgst * fx), sgst: round2(t.sgst * fx), igst: round2(t.igst * fx) }, tdsB = round2(tds * fx);
      const first = Object.keys(exp)[0];
      exp[first] = round2(exp[first] + (apBase + tdsB - tb.cgst - tb.sgst - tb.igst - Object.values(exp).reduce((s, x) => s + x, 0)));
      const j = jv({
        date, kind: o.ic ? "intercompany" : "bill", sourceType: "bill", sourceId: id, sourceRef: id, description: `Vendor bill – ${v.name}`, currency: v.currency, fxRate: fx,
        lines: [...Object.entries(exp).map(([acc, dr]) => ({ acc, dr, dept: o.dept })), { acc: "1141", dr: tb.cgst }, { acc: "1142", dr: tb.sgst }, { acc: "1143", dr: tb.igst },
          { acc: o.ic ? "2170" : "2110", cr: apBase, contact: v.id }, { acc: "2130", cr: tdsB }] as L[],
      });
      journalId = j.id;
    }
    const bill: Bill = {
      id, entityId: e.id, number: "", vendorBillNo: vbn, vendorId: v.id, date, dueDate: addDaysISO(date, v.creditDays), currency: v.currency, fxRate: fx, lines: docLines, subtotal, ...t,
      tdsSection: sec, tdsAmount: tds, total, paid: 0, status, journalId, attachments: [], createdBy: user(), createdAt: `${date}T09:30:00`, intercompany: o.ic,
    };
    bills.push(bill);
    if (sec && journalId) {
      const q = fiscalYearOf(date, e.fyStartMonth);
      tdsRecords.push({ id: uid("tds"), entityId: e.id, vendorId: v.id, billId: id, billNo: id, section: sec, baseAmount: subtotal, rate: v.tdsRate ?? 0, amount: tds, date, status: "deducted", quarter: `Q${Math.floor(((parseISO(date).getMonth() + 12 - (e.fyStartMonth - 1)) % 12) / 3) + 1} ${q.label.replace("FY ", "FY")}` });
    }
    return bill;
  }

  // ---------- Payments ----------
  const payments: Payment[] = [];
  const unclearedJournals = new Set<string>();
  function bankFor(kind: "in" | "out"): BankAccount { return kind === "in" ? R.weighted([primary, third, second], [55, 20, 25]) : R.weighted([primary, second], [45, 55]); }
  function receipt(inv: Invoice, date: string, amount: number, bank = bankFor("in"), method: Payment["method"] = R.pick(["neft", "rtgs", "bank_transfer", "upi"] as const)): Payment {
    const c = contacts.find((x) => x.id === inv.customerId)!;
    const foreign = inv.currency !== base;
    const fxPay = foreign ? round4(fxr(inv.currency, date) * (1 + R.range(-0.006, 0.006))) : 1;
    const received = round2(amount * fxPay), arCr = round2(amount * inv.fxRate), diff = round2(received - arCr);
    const id = uid("pay");
    const j = jv({
      date, kind: inv.intercompany ? "intercompany" : "receipt", sourceType: "payment", sourceId: id, sourceRef: id, description: `Receipt from ${c.name}`, currency: inv.currency, fxRate: fxPay,
      lines: [{ acc: bank.ledgerAccountId.split("-")[1], dr: received }, { acc: inv.intercompany ? "1180" : "1120", cr: arCr, contact: c.id }, { acc: "4220", cr: diff > 0 ? diff : 0 }, { acc: "5520", dr: diff < 0 ? -diff : 0 }],
    });
    const pay: Payment = { id, entityId: e.id, number: "", kind: "receipt", contactId: c.id, date, amount, currency: inv.currency, fxRate: fxPay, method, bankAccountId: bank.id, reference: `${method.toUpperCase()}${R.int(100000000, 999999999)}`, allocations: [{ docId: inv.id, amount }], journalId: j.id, status: "recorded", realizedFx: foreign ? diff : undefined };
    payments.push(pay);
    inv.paid = round2(inv.paid + amount);
    return pay;
  }
  function payBill(b: Bill, date: string, amount: number, bank = bankFor("out"), method: Payment["method"] = R.pick(["neft", "rtgs", "bank_transfer", "upi"] as const)): Payment {
    const v = contacts.find((x) => x.id === b.vendorId)!;
    const id = uid("pay");
    const fx = fxr(b.currency, date);
    const apDr = round2(amount * b.fxRate), cash = round2(amount * fx), diff = round2(apDr - cash);
    const j = jv({
      date, kind: b.intercompany ? "intercompany" : "payment", sourceType: "payment", sourceId: id, sourceRef: id, description: `Payment to ${v.name}`, currency: b.currency, fxRate: fx,
      lines: [{ acc: b.intercompany ? "2170" : "2110", dr: apDr, contact: v.id }, { acc: bank.ledgerAccountId.split("-")[1], cr: cash }, { acc: "4220", cr: diff > 0 ? diff : 0 }, { acc: "5520", dr: diff < 0 ? -diff : 0 }],
    });
    const pay: Payment = { id, entityId: e.id, number: "", kind: "payment", contactId: v.id, date, amount, currency: b.currency, fxRate: fx, method, bankAccountId: bank.id, reference: `${method.toUpperCase()}${R.int(100000000, 999999999)}`, allocations: [{ docId: b.id, amount }], journalId: j.id, status: "recorded" };
    payments.push(pay);
    b.paid = round2(b.paid + amount);
    return pay;
  }

  // ---------- Expenses ----------
  const expenses: Expense[] = [];
  const catIds = {
    travel: `${e.id}-cat-travel`, office: `${e.id}-cat-office`, marketing: `${e.id}-cat-marketing`, utilities: `${e.id}-cat-utilities`, software: `${e.id}-cat-software`,
    repairs: `${e.id}-cat-repairs`, telecom: `${e.id}-cat-telecom`, welfare: `${e.id}-cat-welfare`, professional: `${e.id}-cat-professional`, insurance: `${e.id}-cat-insurance`,
  };
  const catAcc: Record<string, string> = { travel: "5250", office: "5270", marketing: "5240", utilities: "5230", software: "5295", repairs: "5280", telecom: "5320", welfare: "5340", professional: "5260", insurance: "5290" };
  function makeExpense(o: { date: string; cat: keyof typeof catIds; desc: string; gross: number; gst: number; pay: BankAccount; method: Payment["method"]; status: Expense["status"]; vendor?: string; recurring?: Expense["recurring"]; dept?: string }): Expense {
    const taxAmount = o.gst ? round2(o.gross - o.gross / (1 + o.gst / 100)) : 0;
    const net = round2(o.gross - taxAmount);
    const id = uid("exp");
    let journalId: string | undefined;
    if (o.status === "paid") {
      const half = flat ? 0 : round2(taxAmount / 2);
      const j = jv({
        date: o.date, kind: "expense", sourceType: "expense", sourceId: id, sourceRef: id, description: o.desc,
        lines: [{ acc: catAcc[o.cat], dr: net, dept: o.dept, contact: o.vendor }, { acc: flat ? "1143" : "1141", dr: flat ? taxAmount : half }, { acc: "1142", dr: flat ? 0 : round2(taxAmount - half) },
          { acc: o.pay.ledgerAccountId.split("-")[1], cr: o.gross }],
      });
      journalId = j.id;
    }
    const ex: Expense = {
      id, entityId: e.id, number: "", date: o.date, categoryId: catIds[o.cat], vendorId: o.vendor, description: o.desc, amount: o.gross, taxAmount, taxTreatment: o.gst ? "inclusive" : "none", gstRate: o.gst,
      paymentAccountId: o.pay.id, paymentMethod: o.method, status: o.status, recurring: o.recurring ?? null, submittedBy: user(), journalId, departmentId: o.dept, createdAt: `${o.date}T11:00:00`,
    };
    expenses.push(ex);
    return ex;
  }

  // ---------- Assets ----------
  const assets: FixedAsset[] = p.assets.map((a, i) => ({
    id: `${e.id}-fa${i + 1}`, entityId: e.id, tag: `FA-${String(i + 1).padStart(4, "0")}`, name: a.name, category: a.category, purchaseDate: a.date, cost: a.cost, residual: round2(a.cost * a.res),
    usefulLifeYears: a.life, method: a.method, location: a.location, department: a.dept, status: "active", assetAccountId: A(CLASS_CODE[a.category]), transfers: [],
    vendorId: a.vendor ? vendors.find((v) => v.name === a.vendor)?.id : undefined, invoiceRef: a.date >= BOOKS_START ? `CAPEX-${a.date.slice(0, 7)}` : undefined,
  }));
  out.assets.push(...assets);

  // ---------- Monthly loop ----------
  let loan = p.loanOpening;
  const custW = p.customers.map((c) => (c.ic ? 0 : c.weight ?? 1));
  months.forEach((m, mi) => {
    const mEnd = monthEnd(`${m}-01`);
    const season = 1 + 0.14 * Math.sin((mi + 1) / 1.9) + 0.018 * mi;
    const monthRevenueTarget = p.revenueScale * season;
    // Sales invoices
    const nInv = p.monthlyInvoices + R.int(-1, 2);
    let revenueThisMonth = 0;
    for (let i = 0; i < nInv; i++) {
      const date = dayIn(m, 1, 28); if (date > TODAY) continue;
      const cs = R.weighted(customers.filter((_, k) => custW[k] > 0), custW.filter((w) => w > 0));
      const seed = seedOf(cs, p.customers, "cu");
      const foreign = cs.currency !== base;
      const sub = round2((seed.scale ?? 6e5) * R.range(0.6, 1.5) * (foreign ? 1 : monthRevenueTarget / p.revenueScale));
      const isService = !foreign && R.chance(0.22);
      const gstRate = R.weighted([18, 12, 5], [86, 8, 6]);
      const n = R.int(1, 3);
      const lineAmts = Array.from({ length: n }, () => R.range(0.5, 1.5)); const tot = lineAmts.reduce((s, x) => s + x, 0);
      const lines = lineAmts.map((w) => {
        const amt = round2((sub * w) / tot); const qty = foreign ? R.int(20, 120) : R.int(10, 400);
        return { description: isService ? R.pick(SERVICES) : R.pick(PRODUCTS), acc: foreign ? "4130" : isService ? "4120" : "4110", qty, rate: round2(amt / qty) };
      });
      makeInvoice(cs, date, lines, gstRate);
      revenueThisMonth += sub * (foreign ? fxr(cs.currency, date) : 1);
    }
    // Vendor bills
    const rmVendors = vendors.filter((v) => seedOf(v, p.vendors, "ve").category === "raw");
    const rmSpend = revenueThisMonth * p.rmRatio;
    const nRm = 5;
    for (let i = 0; i < nRm; i++) {
      const date = dayIn(m, 2, 27); if (date > TODAY) continue;
      const v = R.pick(rmVendors); const amt = round2((rmSpend / nRm) * R.range(0.7, 1.3));
      const qty = R.int(5, 90);
      makeBill(v, date, [{ description: R.pick(RAW), acc: "5110", qty, rate: round2(amt / qty) }], 18, {});
    }
    const svcDefs: [string, string, string, number, number, number][] = [
      ["freight", "5120", "Freight & cartage – inbound", 38000, 72000, 5], ["freight", "5120", "Outbound freight (billed back)", 22000, 48000, 12],
      ["professional", "5260", "Audit & compliance retainer", 32000, 58000, 18], ["marketing", "5240", "Digital campaign & trade directories", 28000, 64000, 18],
      ["telecom", "5320", "Leased line & mobile plans", 16000, 19000, 18],
    ];
    svcDefs.forEach(([cat, acc, desc, lo, hi, rate], idx) => {
      if (idx === 1 && !R.chance(0.7)) return;
      const date = dayIn(m, 3, 26); if (date > TODAY) return;
      const v = vendors.find((x) => seedOf(x, p.vendors, "ve").category === cat); if (!v) return;
      const amt = round2(R.range(lo, hi) * sc);
      makeBill(v, date, [{ description: desc, acc, qty: 1, rate: amt }], rate);
    });
    // Rent (monthly, 1st) — November deliberately missing in the primary entity (anomaly scenario)
    const rentV = vendors.find((x) => seedOf(x, p.vendors, "ve").category === "rent");
    if (rentV) {
      const date = `${m}-01`;
      if (p.scenario && m === "2026-11") refs.missingRentMonth = m;
      else if (date <= TODAY) makeBill(rentV, date, [{ description: `Factory & office rent – ${format(parseISO(date), "MMM yyyy")}`, acc: "5220", qty: 1, rate: p.rent }], 18);
    }
    // Insurance quarterly
    const insV = vendors.find((x) => seedOf(x, p.vendors, "ve").category === "insurance");
    if (insV && [3, 6, 9, 0].includes((parseISO(`${m}-01`).getMonth() + 1) % 12) ) { const date = `${m}-12`; if (date <= TODAY) makeBill(insV, date, [{ description: "Property & stock insurance premium – quarter", acc: "5290", qty: 1, rate: round2(p.rent * 0.55) }], 18); }
    // Repairs
    const repV = vendors.find((x) => seedOf(x, p.vendors, "ve").category === "repairs");
    if (repV && R.chance(0.6)) { const date = dayIn(m, 5, 25); if (date <= TODAY) makeBill(repV, date, [{ description: "Machine servicing & spares", acc: "5280", qty: 1, rate: round2(R.range(0.5, 1.4) * p.rent * 0.4) }], 18); }

    // Expense claims
    const claimCount = R.int(6, 9);
    for (let i = 0; i < claimCount; i++) {
      const date = dayIn(m, 2, 28); if (date > TODAY) continue;
      const kind = R.weighted(["travel", "office", "welfare", "repairs", "marketing"] as const, [40, 22, 18, 8, 12]);
      const f = sc;
      const gross = round2((kind === "travel" ? R.range(2500, 14000) : kind === "office" ? R.range(1800, 9500) : kind === "welfare" ? R.range(3000, 12000) : kind === "repairs" ? R.range(4000, 18000) : R.range(6000, 22000)) * f);
      const gst = kind === "travel" ? R.pick([0, 5, 12]) : kind === "welfare" ? 0 : 18;
      const age = daysBetween(date, TODAY);
      const status: Expense["status"] = age > 25 ? "paid" : age > 12 ? R.weighted(["paid", "approved", "pending_approval"] as const, [70, 15, 15]) : R.weighted(["pending_approval", "paid", "draft", "rejected", "approved"] as const, [38, 30, 14, 8, 10]);
      const pay = R.weighted([second, card ?? second, banks.find((b) => b.type === "cash") ?? second], [55, 30, 15]);
      makeExpense({ date, cat: kind, desc: { travel: "Client visit – cab & train fares", office: "Stationery & printer consumables", welfare: "Staff tea, snacks & pantry", repairs: "Minor repairs – plant electricals", marketing: "Brochures & trade-show collateral" }[kind], gross, gst, pay, method: pay.type === "cash" ? "cash" : pay.type === "credit_card" ? "card" : "upi", status, dept: R.pick([DEPT.sales, DEPT.ops, DEPT.admin]) });
    }
    // Recurring: electricity (no GST), software (card)
    const eDate = `${m}-08`; if (eDate <= TODAY) makeExpense({ date: eDate, cat: "utilities", desc: "Electricity – plant & office (MSEDCL)", gross: round2(R.range(0.58, 0.76) * 1e6 * sc * 0.12), gst: 0, pay: second, method: "upi", status: "paid", recurring: { frequency: "monthly", nextDate: addMonthsStr(eDate) }, dept: DEPT.ops });
    const sDate = `${m}-14`; if (sDate <= TODAY && card) makeExpense({ date: sDate, cat: "software", desc: "Cloud ERP & productivity subscriptions", gross: round2(41000 * sc), gst: 18, pay: card, method: "card", status: "paid", recurring: { frequency: "monthly", nextDate: addMonthsStr(sDate) }, dept: DEPT.admin });

    // Payroll (last day)
    if (mEnd <= TODAY) {
      jv({ date: mEnd, kind: "payroll", sourceType: "payroll", sourceRef: `PAYROLL-${m}`, description: `Payroll – ${format(parseISO(`${m}-01`), "MMMM yyyy")}`,
        lines: [{ acc: "5210", dr: round2(p.salary * (1 + 0.004 * mi)), dept: DEPT.ops }, { acc: "5130", dr: round2(p.directLabour * (1 + 0.003 * mi)), dept: DEPT.ops },
          { acc: "1111", cr: round2(p.salary * (1 + 0.004 * mi) + p.directLabour * (1 + 0.003 * mi)) }] });
      // Depreciation
      let depTotal = 0;
      for (const a of assets) depTotal += depreciationSchedule(a, m).find((r) => r.month === m)?.depreciation ?? 0;
      depTotal = round2(depTotal);
      if (depTotal > 0) jv({ date: mEnd, kind: "depreciation", sourceType: "depreciation", sourceRef: `DEP-${m}`, description: `Monthly depreciation – ${m}`, lines: [{ acc: "5410", dr: depTotal }, { acc: "1290", cr: depTotal }] });
      // Bank charges (Oct 2026 booked entry intentionally omitted — appears only on the statement)
      if (!(p.scenario && m === "2026-10")) jv({ date: mEnd, kind: "bank", sourceType: "bank", sourceRef: `BANKCHG-${m}`, description: "Bank charges & service fees", lines: (() => { const a = round2(R.range(780, 1450) * sc); return [{ acc: "5300", dr: a }, { acc: "1111", cr: a }]; })() });
    }
    // Loan EMI on 5th
    const emiDate = `${m}-05`;
    if (p.loanOpening && emiDate <= TODAY && loan > 0) {
      const interest = round2((loan * 0.105) / 12); const principal = round2(Math.min(loan, p.emi - interest));
      loan = round2(loan - principal);
      jv({ date: emiDate, kind: "loan", sourceType: "loan", sourceRef: `EMI-${m}`, description: "Term loan EMI", lines: [{ acc: "2210", dr: principal }, { acc: "5510", dr: interest }, { acc: "1111", cr: round2(principal + interest) }] });
    }
    // Interest income quarterly (Oct 2026 interest credited only on statement)
    if (["06", "09", "12", "03"].includes(m.slice(5)) && `${m}-28` <= TODAY && !(p.scenario && m === "2026-09")) {
      const amt = round2(R.range(3200, 5400) * sc);
      jv({ date: `${m}-28`, kind: "bank", sourceType: "bank", sourceRef: `INT-${m}`, description: "Interest credited on savings sweep", lines: [{ acc: "1111", dr: amt }, { acc: "4210", cr: amt }] });
    }
    // Card settlement on 10th for previous month's spend
    const cDate = `${m}-10`;
    if (card && cDate <= TODAY && mi > 0) {
      const prevEnd = monthEnd(`${months[mi - 1]}-01`); const owed = -bal("2150", prevEnd);
      if (owed > 0) jv({ date: cDate, kind: "payment", sourceType: "payment", sourceRef: `CARD-${m}`, description: "Credit card statement payment", lines: [{ acc: "2150", dr: round2(owed) }, { acc: "1112", cr: round2(owed) }] });
    }
    // TDS deposit on 7th
    const tdsDate = `${m}-07`;
    if (mi > 0 && tdsDate <= TODAY) {
      const prevEnd = monthEnd(`${months[mi - 1]}-01`); const owed = -bal("2130", prevEnd);
      if (owed > 0.5) {
        const ch = `CHL-${m.replace("-", "")}-${R.int(1000, 9999)}`;
        jv({ date: tdsDate, kind: "tax", sourceType: "tax", sourceRef: `TDSPAY-${m}`, description: "TDS deposit (challan)", lines: [{ acc: "2130", dr: round2(owed) }, { acc: "1111", cr: round2(owed) }], ref: ch });
        tdsRecords.filter((t) => t.date <= prevEnd && t.status === "deducted").forEach((t) => { t.status = "deposited"; t.depositDate = tdsDate; t.challan = ch; });
      }
    }
    // GST settlement on 20th for previous month
    const gstDate = `${m}-20`;
    if (mi > 0 && gstDate <= TODAY) {
      const prevEnd = monthEnd(`${months[mi - 1]}-01`);
      const out_ = { c: -bal("2121", prevEnd), s: -bal("2122", prevEnd), i: -bal("2123", prevEnd) };
      const in_ = { c: bal("1141", prevEnd), s: bal("1142", prevEnd), i: bal("1143", prevEnd) };
      const totalOut = Math.max(0, out_.c) + Math.max(0, out_.s) + Math.max(0, out_.i), totalIn = Math.max(0, in_.c) + Math.max(0, in_.s) + Math.max(0, in_.i);
      const use = Math.min(totalOut, totalIn); let left = use;
      const take = (b: number) => { const t = Math.min(Math.max(0, b), left); left -= t; return round2(t); };
      const ui = take(in_.i), uc = take(in_.c), us = take(in_.s);
      const net = round2(totalOut - (ui + uc + us));
      jv({ date: gstDate, kind: "tax", sourceType: "tax", sourceRef: `GSTPAY-${m}`, description: `GST liability settlement – ${prevEnd.slice(0, 7)}`,
        lines: [{ acc: "2121", dr: round2(Math.max(0, out_.c)) }, { acc: "2122", dr: round2(Math.max(0, out_.s)) }, { acc: "2123", dr: round2(Math.max(0, out_.i)) },
          { acc: "1141", cr: uc }, { acc: "1142", cr: us }, { acc: "1143", cr: ui }, { acc: "1111", cr: net }], ref: `GSTR3B-${prevEnd.slice(0, 7)}` });
    }
    });

  // ---------- Capex purchases (bills tied to the asset register) ----------
  for (const a of p.assets.filter((x) => x.date >= BOOKS_START && x.date <= TODAY)) {
    const v = vendors.find((x) => x.name === a.vendor) ?? vendors[0];
    const asset = assets.find((x) => x.name === a.name)!;
    const b = makeBill(v, a.date, [{ description: a.name, acc: CLASS_CODE[a.category], qty: 1, rate: a.cost }], 18, { tds: false });
    asset.invoiceRef = b.id;
  }

  // ---------- Intercompany ----------
  if (e.id === "e1") {
    const icC = customers.find((c) => c.intercompanyEntityId);
    if (icC) for (const d of IC_DEALS) { const inv = makeInvoice(icC, d.date, [{ description: d.desc, acc: "4130", qty: 1, rate: d.usd }], 0, true); refs.icInvoice = inv.id; if (d.paid) receipt(inv, d.paid, inv.total, primary, "rtgs"); }
  } else {
    const icV = vendors.find((v) => v.intercompanyEntityId);
    if (icV) for (const d of IC_DEALS) { const b = makeBill(icV, d.date, [{ description: d.desc, acc: "5110", qty: 1, rate: d.usd }], 0, { ic: true }); if (d.paid) payBill(b, d.paid, b.total - b.tdsAmount, primary, "rtgs"); }
  }

  // ---------- Scenario items (primary entity only) ----------
  if (p.scenario) {
    const sf = vendors.find((v) => seedOf(v, p.vendors, "ve").category === "freight")!;
    const dupNo = "SF/26/884";
    const b1 = makeBill(sf, "2026-10-21", [{ description: "Freight & cartage – inbound (Oct consolidated)", acc: "5120", qty: 1, rate: 61800 }], 5, { vendorBillNo: dupNo });
    const b2 = makeBill(sf, "2026-10-23", [{ description: "Freight & cartage – inbound (Oct consolidated)", acc: "5120", qty: 1, rate: 61800 }], 5, { vendorBillNo: dupNo, status: "pending_approval" });
    refs.dupBills = [b1.id, b2.id];
    const mk = makeExpense({ date: "2026-10-27", cat: "marketing", desc: "Trade fair sponsorship – Pune Engg Expo (UPI)", gross: 420000, gst: 18, pay: second, method: "upi", status: "pending_approval", dept: DEPT.sales });
    refs.unusualExpense = mk.id;
    const rep = vendors.find((v) => seedOf(v, p.vendors, "ve").category === "repairs")!;
    ["2026-11-03", "2026-11-05", "2026-11-06"].forEach((d, i) => { const b = makeBill(rep, d, [{ description: `Machine overhaul – phase ${i + 1}`, acc: "5280", qty: 1, rate: 423000 }], 18); refs.roundBills.push(b.id); });
    const pj = jv({ date: "2026-11-12", kind: "manual", sourceType: "manual", sourceRef: "MANUAL", description: "Cash withdrawal for site expenses", lines: [{ acc: "1114", dr: 350000 }, { acc: "1111", cr: 350000 }] });
    refs.pettyJournal = pj.id;
  }

  // ---------- Payments for invoices and bills ----------
  const sortedInv = [...invoices].sort((a, b) => a.date.localeCompare(b.date));
  const lateOf = (c: string) => seedOf(contacts.find((x) => x.id === c)!, p.customers, "cu")?.late ?? 0;
  const writeOffTarget = sortedInv.find((i) => i.date >= "2025-06-01" && !i.intercompany && i.currency === base);
  let stuckCount = 0;
  for (const inv of sortedInv) {
    if (inv.intercompany) continue;
    const age = daysBetween(inv.date, TODAY);
    if (inv === writeOffTarget) { stuckCount++; continue; } // intentionally stays open (aged receivable)
    const stuck = age > 120 && R.chance(0.04) && stuckCount < 3;
    if (stuck) { stuckCount++; continue; }
    const payDate = addDaysISO(inv.dueDate, Math.round(R.range(-9, 14) + lateOf(inv.customerId)));
    if (R.chance(0.15)) {
      const first = round2(inv.total * R.pick([0.4, 0.5, 0.6])); const d1 = addDaysISO(inv.dueDate, R.int(-5, 8));
      if (d1 <= TODAY) { receipt(inv, d1, first); const d2 = addDaysISO(d1, R.int(25, 55)); if (d2 <= TODAY && R.chance(0.7)) receipt(inv, d2, round2(inv.total - inv.paid)); }
      continue;
    }
    if (payDate <= TODAY) receipt(inv, payDate, round2(inv.total - inv.paid));
  }
  // Multi-match scenario: one customer wiped two invoices with a single NEFT
  if (p.scenario) {
    const open = sortedInv.filter((i) => i.paid === 0 && !i.intercompany && i.currency === base && i.date >= "2026-09-01" && i.date <= "2026-10-10").slice(0, 2);
    if (open.length === 2) {
      const d = "2026-10-26"; const bank = primary;
      const p1 = receipt(open[0], d, open[0].total, bank, "neft"), p2 = receipt(open[1], d, open[1].total, bank, "neft");
      refs.multiMatchJournals = [p1.journalId, p2.journalId];
    }
  }
  const sortedBills = [...bills].sort((a, b) => a.date.localeCompare(b.date));
  let chequeCount = 0;
  for (const b of sortedBills) {
    if (!["approved"].includes(b.status)) continue;
    if (refs.dupBills.includes(b.id) || refs.roundBills.includes(b.id)) continue;
    if (b.intercompany) continue;
    const net = round2(b.total - b.tdsAmount);
    const payDate = addDaysISO(b.dueDate, R.int(-6, 6));
    if (R.chance(0.1) && payDate <= TODAY && daysBetween(b.date, TODAY) > 60) { const part = round2(net * 0.5); payBill(b, payDate, part); continue; }
    if (p.scenario && chequeCount < 2 && b.date >= "2026-10-10" && b.date <= "2026-10-20" && b.currency === base) {
      const d = chequeCount === 0 ? "2026-11-10" : "2026-11-12";
      const pay = payBill(b, d, net, primary, "cheque"); unclearedJournals.add(pay.journalId); refs.bookOnlyJournals.push(pay.journalId); pay.reference = `CHQ ${R.int(100200, 100999)}`; chequeCount++; continue;
    }
    if (payDate <= TODAY) payBill(b, payDate, net);
  }
  // Bill statuses
  for (const b of bills) {
    const outstanding = round2(b.total - b.tdsAmount - b.paid);
    if (["draft", "pending_approval", "rejected", "void"].includes(b.status)) continue;
    if (b.status === "approved" || b.status === "partial" || b.status === "paid" || b.status === "overdue") b.status = outstanding <= 0.01 ? "paid" : b.paid > 0 ? "partial" : b.dueDate < TODAY ? "overdue" : "approved";
  }
  // Seed some drafts / pending / rejected bills in recent days
  if (p.scenario) {
    const v = vendors.find((x) => seedOf(x, p.vendors, "ve").category === "professional")!;
    makeBill(v, "2026-11-10", [{ description: "GST annual return preparation", acc: "5260", qty: 1, rate: 45000 }], 18, { status: "pending_approval" });
    makeBill(v, "2026-11-14", [{ description: "Transfer pricing study – draft", acc: "5260", qty: 1, rate: 120000 }], 18, { status: "draft" });
    makeBill(vendors[0], "2026-11-09", [{ description: "MS flats & rounds (rejected – wrong rate)", acc: "5110", qty: 40, rate: 9800 }], 18, { status: "rejected" });
    makeBill(rmVendorOf(), "2026-11-13", [{ description: "Forging billets EN19", acc: "5110", qty: 55, rate: 8400 }], 18, { status: "pending_approval" });
  }
  function rmVendorOf() { return vendors.find((v) => seedOf(v, p.vendors, "ve").category === "raw")!; }
  // Invoice statuses
  for (const i of invoices) { const out_ = round2(i.total - i.paid); i.status = out_ <= 0.01 ? "paid" : i.paid > 0 ? "partial" : i.dueDate < TODAY ? "overdue" : "sent"; }

  // ---------- Credit notes ----------
  const cns: CreditNote[] = [];
  const mkCn = (kind: "customer" | "vendor", c: Contact, date: string, net: number, reason: string, apply?: Invoice | Bill) => {
    const rate = 18, ts = taxFor(net, rate, c.state, c.country, false);
    const tax = round2(ts.cgst + ts.sgst + ts.igst), amount = round2(net + tax), id = uid("cn");
    const half = (x: number) => round2(x / 2);
    const j = kind === "customer"
      ? jv({ date, kind: "credit_note", sourceType: "credit_note", sourceId: id, sourceRef: id, description: `Customer credit note – ${c.name}`, lines: [{ acc: "4190", dr: net }, { acc: flat ? "2123" : "2121", dr: flat ? ts.igst : ts.cgst }, { acc: "2122", dr: flat ? 0 : ts.sgst }, { acc: "2123", dr: flat ? 0 : ts.igst }, { acc: "1120", cr: amount, contact: c.id }] })
      : jv({ date, kind: "credit_note", sourceType: "credit_note", sourceId: id, sourceRef: id, description: `Vendor credit note – ${c.name}`, lines: [{ acc: "2110", dr: amount, contact: c.id }, { acc: "5110", cr: net }, { acc: flat ? "1143" : "1141", cr: flat ? ts.igst : ts.cgst }, { acc: "1142", cr: flat ? 0 : ts.sgst }, { acc: "1143", cr: flat ? 0 : ts.igst }] });
    void half;
    const cn: CreditNote = { id, entityId: e.id, kind, number: "", contactId: c.id, date, amount, tax, reason, status: apply ? "applied" : "open", appliedTo: apply?.id, journalId: j.id };
    if (apply) apply.paid = round2(apply.paid + Math.min(amount, round2(apply.total - (("tdsAmount" in apply ? apply.tdsAmount : 0)) - apply.paid)));
    cns.push(cn);
  };
  if (p.scenario) {
    const target = invoices.find((i) => i.date >= "2026-07-01" && i.paid === 0 && i.currency === base && !i.intercompany && i.total > 300000);
    const other = invoices.find((i) => i.date >= "2026-09-15" && i.paid === 0 && i.currency === base && !i.intercompany && i !== target);
    if (target) mkCn("customer", contacts.find((c) => c.id === target.customerId)!, "2026-08-12", 52000, "Rejected consignment – dimensional tolerance", target);
    if (other) mkCn("customer", contacts.find((c) => c.id === other.customerId)!, "2026-11-04", 38000, "Volume rebate – Q2 2026");
    const vb = bills.find((b) => b.date >= "2026-08-01" && b.status === "approved" && !b.intercompany && b.vendorId === rmVendorOf().id);
    if (vb) mkCn("vendor", contacts.find((c) => c.id === vb.vendorId)!, "2026-10-02", 24000, "Short supply – 3 pcs rejected", vb);
    mkCn("vendor", rmVendorOf(), "2026-11-08", 18500, "Price revision credit");
    for (const i of invoices) { const o = round2(i.total - i.paid); i.status = o <= 0.01 ? "paid" : i.paid > 0 ? "partial" : i.dueDate < TODAY ? "overdue" : "sent"; }
    for (const b of bills) { if (["draft", "pending_approval", "rejected", "void"].includes(b.status)) continue; const o = round2(b.total - b.tdsAmount - b.paid); b.status = o <= 0.01 ? "paid" : b.paid > 0 ? "partial" : b.dueDate < TODAY ? "overdue" : "approved"; }
  }

  // ---------- Bank guard: inter-bank transfers keep every bank account positive ----------
  {
    const bankIds = [primary, second, third].map((b) => b.ledgerAccountId);
    const run: Record<string, number> = Object.fromEntries(bankIds.map((id) => [id, opening[id.split("-")[1]] ?? 0]));
    const events = out.journals.filter((j) => j.entityId === e.id && j.status === "posted").flatMap((j) => j.lines.filter((l) => bankIds.includes(l.accountId)).map((l) => ({ date: j.date, id: l.accountId, delta: l.debit - l.credit })));
    events.sort((a, b) => a.date.localeCompare(b.date));
    const floor = 400000 * sc, target = 900000 * sc, step = 100000 * sc;
    let i = 0;
    while (i < events.length) {
      const date = events[i].date;
      while (i < events.length && events[i].date === date) { run[events[i].id] += events[i].delta; i++; }
      for (const need of bankIds) {
        if (run[need] >= floor) continue;
        const donor = bankIds.filter((x) => x !== need).sort((a, b) => run[b] - run[a])[0];
        const amt = Math.ceil((target - run[need]) / step) * step;
        if (run[donor] - amt < floor) continue;
        const tDate = date;
        jv({ date: tDate, kind: "bank", sourceType: "bank", sourceRef: `TRF-${tDate}`, description: "Inter-bank fund transfer", lines: [{ acc: need.split("-")[1], dr: amt }, { acc: donor.split("-")[1], cr: amt }] });
        run[need] += amt; run[donor] -= amt;
      }
    }
  }

  // ---------- Numbering ----------
  const numberDocs = <T extends { id: string; date: string; number: string }>(list: T[], prefix: string) => {
    const counters: Record<string, number> = {};
    [...list].sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id)).forEach((d) => {
      const fy = fiscalYearOf(d.date, e.fyStartMonth).short; counters[fy] = (counters[fy] ?? 0) + 1;
      d.number = `${prefix}-${fy}-${String(counters[fy]).padStart(4, "0")}`;
    });
  };
  numberDocs(invoices, "INV"); numberDocs(bills, "BILL"); numberDocs(cns.filter((c) => c.kind === "customer"), "CN"); numberDocs(cns.filter((c) => c.kind === "vendor"), "VCN");
  numberDocs(expenses, "EXP"); numberDocs(payments.filter((x) => x.kind === "receipt"), "RCT"); numberDocs(payments.filter((x) => x.kind === "payment"), "PAY");
  const docNo = new Map<string, string>();
  [...invoices, ...bills, ...cns, ...expenses, ...payments].forEach((d) => docNo.set(d.id, d.number));
  tdsRecords.forEach((t) => { t.billNo = docNo.get(t.billId) ?? t.billNo; });
  const myJournals = out.journals.filter((j) => j.entityId === e.id);
  myJournals.forEach((j) => { if (docNo.has(j.sourceRef)) j.sourceRef = docNo.get(j.sourceRef)!; });
  myJournals.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  const jc: Record<string, number> = {};
  myJournals.forEach((j) => { const fy = fiscalYearOf(j.date, e.fyStartMonth).short; jc[fy] = (jc[fy] ?? 0) + 1; j.number = `JV-${fy}-${String(jc[fy]).padStart(5, "0")}`; });

  out.invoices.push(...invoices); out.bills.push(...bills); out.payments.push(...payments); out.creditNotes.push(...cns); out.expenses.push(...expenses); out.tdsRecords.push(...tdsRecords);

  // ---------- Bank statement transactions ----------
  const stmtBanks = [primary, second, third];
  const txns: BankTxn[] = [];
  for (const j of myJournals) {
    if (j.status !== "posted" && j.status !== "reversed") continue;
    for (const l of j.lines) {
      const bk = stmtBanks.find((b) => b.ledgerAccountId === l.accountId);
      if (!bk) continue;
      if (unclearedJournals.has(j.id)) continue;
      if (l.debit === 0 && l.credit === 0) continue;
      const contact = contacts.find((c) => c.id === (j.lines.find((x) => x.contactId)?.contactId ?? ""));
      const narr = j.kind === "receipt" || j.kind === "intercompany" ? `NEFT CR-${(contact?.name ?? "CUSTOMER").toUpperCase().slice(0, 22)}-${j.sourceRef}`
        : j.kind === "payment" ? (j.sourceRef.startsWith("CARD") ? "CREDIT CARD PAYMENT" : `NEFT DR-${(contact?.name ?? "VENDOR").toUpperCase().slice(0, 22)}`)
        : j.kind === "expense" ? `UPI-${(j.description).toUpperCase().slice(0, 28)}` : j.kind === "payroll" ? "SALARY DISBURSEMENT BULK" : j.kind === "tax" ? j.description.toUpperCase().slice(0, 30)
        : j.kind === "loan" ? "ACH DR-HDFC LOAN EMI" : j.kind === "bank" ? j.description.toUpperCase().slice(0, 30) : j.description.toUpperCase().slice(0, 30);
      txns.push({
        id: uid("bt"), entityId: e.id, bankAccountId: bk.id, date: j.kind === "receipt" ? addDaysISO(j.date, 0) : j.date, description: narr, reference: j.reference ?? `REF${R.int(1e8, 9e8)}`,
        withdrawal: l.credit, deposit: l.debit, balance: 0, status: "matched", matchedLineIds: [l.id], matchedJournalIds: [j.id],
      });
    }
  }
  // Scenario statement-only items and unmatched flags
  if (p.scenario) {
    const addStmt = (bk: BankAccount, date: string, desc: string, w: number, d: number, extra: Partial<BankTxn> = {}) => {
      const t: BankTxn = { id: uid("bt"), entityId: e.id, bankAccountId: bk.id, date, description: desc, reference: `REF${R.int(1e8, 9e8)}`, withdrawal: w, deposit: d, balance: 0, status: "unmatched", matchedLineIds: [], matchedJournalIds: [], ...extra };
      txns.push(t); return t;
    };
    refs.bankOnlyTxns.push(addStmt(primary, "2026-10-31", "BANK CHARGES – OCT 2026 (INCL. GST)", 1180, 0).id);
    refs.bankOnlyTxns.push(addStmt(primary, "2026-10-01", "INT.PD – SAVINGS SWEEP Q2", 0, 4320).id);
    refs.bankOnlyTxns.push(addStmt(primary, "2026-11-11", "NEFT CR-HINDUSTAN FABRICATORS-ADV PMT", 0, 384500).id);
    refs.bankOnlyTxns.push(addStmt(second, "2026-11-13", "UPI-ZOMATO-TEAM LUNCH 0-0", 3640, 0).id);
    const m1 = txns.find((t) => t.matchedJournalIds[0] === refs.multiMatchJournals[0] && t.bankAccountId === primary.id);
    const m2 = txns.find((t) => t.matchedJournalIds[0] === refs.multiMatchJournals[1] && t.bankAccountId === primary.id);
    if (m1 && m2) {
      txns.splice(txns.indexOf(m2), 1);
      m1.deposit = round2(m1.deposit + m2.deposit); m1.description = "NEFT CR-COMBINED REMITTANCE (2 INVOICES)"; m1.status = "unmatched"; m1.matchedLineIds = []; m1.matchedJournalIds = []; refs.multiMatchTxn = m1.id;
    }
    // Duplicate statement line (bank re-sent the same debit)
    const dupSrc = txns.filter((t) => t.date >= "2026-10-15" && t.date <= "2026-11-10" && t.withdrawal > 20000 && t.description.startsWith("NEFT DR-") && t.bankAccountId === primary.id && t.status === "matched").sort((a, b) => b.withdrawal - a.withdrawal)[0];
    if (dupSrc) { const d = addStmt(primary, dupSrc.date, dupSrc.description, dupSrc.withdrawal, 0, { reference: dupSrc.reference, duplicateOf: dupSrc.id }); refs.duplicateTxn = d.id; }
    // Statement lines after Oct 15 that are not yet reviewed — leave ~35% unmatched
    txns.filter((t) => t.date >= "2026-10-20" && t.status === "matched" && !refs.bankOnlyTxns.includes(t.id) && t.id !== refs.multiMatchTxn).forEach((t, i) => {
      if (i % 3 === 0) { t.status = "unmatched"; t.matchedLineIds = []; t.matchedJournalIds = []; refs.unmatchedTxns.push(t.id); }
    });
    // Newest HDFC rows are uncategorised imports
  }
  txns.sort((a, b) => a.date.localeCompare(b.date) || a.id.localeCompare(b.id));
  for (const bk of stmtBanks) {
    let run = opening[bk.ledgerAccountId.split("-")[1]] ?? 0;
    for (const t of txns.filter((x) => x.bankAccountId === bk.id)) { run = round2(run + t.deposit - t.withdrawal); t.balance = run; }
    bk.statementBalance = run;
    bk.lastReconciled = "2026-09-30";
  }
  if (card) card.statementBalance = round2(-bal("2150", TODAY));
  const cashBk = banks.find((b) => b.type === "cash"); if (cashBk) cashBk.statementBalance = round2(bal("1114", TODAY));
  out.bankTxns.push(...txns);

  // ---------- Reconciliation history (HDFC month-ends through Sep 2026) ----------
  const recs: Reconciliation[] = [];
  months.filter((m) => m <= "2026-09").forEach((m) => {
    const end = monthEnd(`${m}-01`); const book = round2(bal("1111", end));
    recs.push({ id: uid("rc"), entityId: e.id, bankAccountId: primary.id, periodEnd: end, statementClosing: book, bookClosing: book, difference: 0, status: "reconciled", by: "Meera Iyer", completedAt: `${addDaysISO(end, 3)}T16:20:00`, matchedCount: R.int(28, 52) });
  });
  if (p.scenario) {
    const bookNow = round2(bal("1111", TODAY));
    recs.push({ id: uid("rc"), entityId: e.id, bankAccountId: primary.id, periodEnd: "2026-10-31", statementClosing: primary.statementBalance, bookClosing: bookNow, difference: round2(primary.statementBalance - bookNow), status: "difference", by: "Meera Iyer", matchedCount: 38 });
  }
  out.reconciliations.push(...recs);
  return refs;
}

function addMonthsStr(d: string) { return format(addMonths(parseISO(d), 1), "yyyy-MM-dd"); }
function stateCode(state: string) {
  return ({ Maharashtra: "27", Gujarat: "24", "Tamil Nadu": "33", Karnataka: "29", Delhi: "07", Telangana: "36", "West Bengal": "19", Rajasthan: "08", "Uttar Pradesh": "09", Kerala: "32" } as Record<string, string>)[state] ?? "27";
}
export type { Account };
