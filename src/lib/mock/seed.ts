import { addMonths, format, parseISO } from "date-fns";
import type { Agent, Allocation, Anomaly, ApprovalRequest, Automation, BankFeed, Budget, CategorizationSuggestion, DocumentFile, Entity, FxRate, Journal, JournalSuggestion, MatchSuggestion, PermissionAction, PermissionGroup, Role } from "@/types";
import { BOOKS_START, TODAY } from "@/lib/constants";
import { round2 } from "@/lib/formatters";
import { fiscalYearByStartYear, fiscalYearOf, monthEnd } from "@/lib/accounting/fiscal";
import { accId } from "./chart";
import { emptyCollections, type Collections } from "./collections";
import { generateEntity, sampleRate, type Profile, type Refs } from "./generate";
import { makeRng } from "./rng";

const E1: Entity = {
  id: "e1", name: "Aarav Industrial Supplies", legalName: "Aarav Industrial Supplies Pvt Ltd", country: "India", state: "Maharashtra", city: "Pune",
  address: "Plot 41, MIDC Bhosari, Pune 411026", baseCurrency: "INR", fyStartMonth: 4, taxRegime: "india-gst", gstin: "27AABCA4821K1Z5", pan: "AABCA4821K",
  role: "parent", ownership: 100, industry: "Industrial manufacturing & trading", accountSettings: { allowBackdated: true, requireJournalApproval: true, autoNumbering: true, decimalPlaces: 2 },
};
const E2: Entity = {
  id: "e2", name: "Aarav Global Pte Ltd", legalName: "Aarav Global Pte. Ltd.", country: "Singapore", state: "Singapore", city: "Singapore",
  address: "12 Tuas South Avenue 6, Singapore 637025", baseCurrency: "USD", fyStartMonth: 1, taxRegime: "flat-gst", gstin: "", pan: "",
  role: "subsidiary", ownership: 100, industry: "Export distribution (subsidiary)", accountSettings: { allowBackdated: false, requireJournalApproval: true, autoNumbering: true, decimalPlaces: 2 },
};

const P1: Profile = {
  entity: E1, seed: 11, revenueScale: 6e6, rmRatio: 0.64, monthlyInvoices: 9, salary: 9e5, directLabour: 8.5e5, rent: 1.4e5, loanOpening: 4e6, emi: 82000, gstRate: 18, scenario: true,
  opening: { "1111": 2850000, "1112": 975000, "1113": 420000, "1114": 25000, "1130": 1800000, "1160": 120000, "1143": 185000, "2210": 4000000, "3100": 5000000 },
  banks: [
    { name: "HDFC Bank – Current A/c", bank: "HDFC Bank", no: "••••4821", code: "1111", type: "bank" },
    { name: "ICICI Bank – Operations A/c", bank: "ICICI Bank", no: "••••7730", code: "1112", type: "bank" },
    { name: "SBI – Collections A/c", bank: "State Bank of India", no: "••••1156", code: "1113", type: "bank" },
    { name: "Petty Cash", bank: "Cash in hand", no: "—", code: "1114", type: "cash" },
    { name: "HDFC Business Credit Card", bank: "HDFC Bank", no: "••••9042", code: "2150", type: "credit_card" },
  ],
  customers: [
    { name: "Sundaram Auto Components Ltd", city: "Chennai", state: "Tamil Nadu", creditDays: 45, scale: 9e5, weight: 3 },
    { name: "Tata Precision Tools Pvt Ltd", city: "Pune", state: "Maharashtra", creditDays: 30, scale: 7e5, weight: 3 },
    { name: "Kirloskar Pumps & Systems", city: "Pune", state: "Maharashtra", creditDays: 45, scale: 8e5, weight: 2 },
    { name: "Bharat Engineering Works", city: "Ahmedabad", state: "Gujarat", creditDays: 30, scale: 5.5e5, weight: 2 },
    { name: "Hindustan Fabricators", city: "Nashik", state: "Maharashtra", creditDays: 30, scale: 4.2e5, weight: 2 },
    { name: "Reliance Infra Projects Ltd", city: "Mumbai", state: "Maharashtra", creditDays: 60, scale: 1.2e6, weight: 1.5, late: 22 },
    { name: "Mahindra Logistics Hub", city: "Mumbai", state: "Maharashtra", creditDays: 45, scale: 6e5, weight: 1.5 },
    { name: "L&T Heavy Fabrication Ltd", city: "Vadodara", state: "Gujarat", creditDays: 60, scale: 1.1e6, weight: 1.2, late: 18 },
    { name: "Ashok Leyland Supplies Co", city: "Chennai", state: "Tamil Nadu", creditDays: 45, scale: 6.5e5, weight: 1.5 },
    { name: "Godrej Industrial Systems", city: "Mumbai", state: "Maharashtra", creditDays: 30, scale: 5e5, weight: 1.5 },
    { name: "Atlas Tooling LLC", city: "Houston", state: "Texas", country: "United States", currency: "USD", creditDays: 30, scale: 9000, weight: 1.2 },
    { name: "Gulf Machinery Trading LLC", city: "Dubai", state: "Dubai", country: "United Arab Emirates", currency: "AED", creditDays: 30, scale: 38000, weight: 0.8 },
    { name: "Aarav Global Pte Ltd (Intercompany)", city: "Singapore", state: "Singapore", country: "Singapore", currency: "USD", creditDays: 30, ic: true },
  ],
  vendors: [
    { name: "Jindal Steel & Alloys Ltd", city: "Raigad", state: "Maharashtra", creditDays: 30, category: "raw" },
    { name: "Hindalco Aluminium Traders", city: "Mumbai", state: "Maharashtra", creditDays: 30, category: "raw" },
    { name: "Bharat Petro Lubricants", city: "Pune", state: "Maharashtra", creditDays: 30, category: "raw" },
    { name: "SafeFreight Logistics Pvt Ltd", city: "Pune", state: "Maharashtra", creditDays: 15, category: "freight", tds: ["194C", 1] },
    { name: "Skyline Realty LLP", city: "Pune", state: "Maharashtra", creditDays: 5, category: "rent", tds: ["194I", 10] },
    { name: "CA Narayan & Associates", city: "Pune", state: "Maharashtra", creditDays: 15, category: "professional", tds: ["194J", 10] },
    { name: "Digital Reach Marketing Pvt Ltd", city: "Bengaluru", state: "Karnataka", creditDays: 30, category: "marketing", tds: ["194C", 2] },
    { name: "Airtel Business", city: "New Delhi", state: "Delhi", creditDays: 15, category: "telecom" },
    { name: "Star Health & General Insurance", city: "Chennai", state: "Tamil Nadu", creditDays: 0, category: "insurance" },
    { name: "Pune Industrial Services", city: "Pune", state: "Maharashtra", creditDays: 15, category: "repairs", tds: ["194C", 2] },
    { name: "Dell Technologies India Pvt Ltd", city: "Bengaluru", state: "Karnataka", creditDays: 30, category: "capex" },
    { name: "Bystronic Lasers India Pvt Ltd", city: "Pune", state: "Maharashtra", creditDays: 45, category: "capex" },
    { name: "Mahindra Commercial Vehicles – Pune", city: "Pune", state: "Maharashtra", creditDays: 15, category: "capex" },
  ],
  others: [
    { name: "HDFC Bank Ltd (Lender)", city: "Mumbai", state: "Maharashtra", creditDays: 0 },
    { name: "Pune Municipal Corporation", city: "Pune", state: "Maharashtra", creditDays: 0 },
    { name: "Maharashtra Labour Welfare Board", city: "Mumbai", state: "Maharashtra", creditDays: 0 },
  ],
  assets: [
    { name: "CNC Machining Centre VMC-850", category: "Plant & Machinery", date: "2022-06-15", cost: 3800000, res: 0.05, life: 10, method: "SLM", location: "Plant 1 – Bay A", dept: "Operations" },
    { name: "Hydraulic Press 100T", category: "Plant & Machinery", date: "2021-09-10", cost: 2750000, res: 0.05, life: 12, method: "SLM", location: "Plant 1 – Bay B", dept: "Operations" },
    { name: "Packaging Line PL-2", category: "Plant & Machinery", date: "2023-11-20", cost: 1950000, res: 0.05, life: 10, method: "WDV", location: "Plant 1 – Dispatch", dept: "Operations" },
    { name: "Meeting Room AV System", category: "Office Equipment", date: "2023-02-01", cost: 250000, res: 0.05, life: 5, method: "SLM", location: "Head Office", dept: "Administration" },
    { name: "Split AC Units (12)", category: "Office Equipment", date: "2022-05-12", cost: 400000, res: 0.05, life: 8, method: "SLM", location: "Head Office", dept: "Administration" },
    { name: "Server Rack & NAS", category: "Computers & IT", date: "2023-08-20", cost: 320000, res: 0.05, life: 5, method: "SLM", location: "Server room", dept: "Administration" },
    { name: "Dell Latitude Laptops (10)", category: "Computers & IT", date: "2024-06-18", cost: 400000, res: 0.05, life: 4, method: "SLM", location: "Head Office", dept: "Sales" },
    { name: "Executive Furniture Set", category: "Furniture & Fixtures", date: "2022-04-10", cost: 380000, res: 0.05, life: 10, method: "SLM", location: "Head Office", dept: "Administration" },
    { name: "Tata Ace Delivery Van MH12-AB-4471", category: "Vehicles", date: "2023-03-25", cost: 700000, res: 0.1, life: 8, method: "SLM", location: "Dispatch", dept: "Operations" },
    { name: "Maruti Ertiga Company Car MH12-CD-9012", category: "Vehicles", date: "2024-01-15", cost: 500000, res: 0.1, life: 8, method: "SLM", location: "Head Office", dept: "Sales" },
    { name: "Dell Precision Workstations (5)", category: "Computers & IT", date: "2025-09-12", cost: 310000, res: 0.05, life: 4, method: "SLM", location: "Design studio", dept: "Operations", vendor: "Dell Technologies India Pvt Ltd" },
    { name: "Fibre Laser Cutting Machine 6kW", category: "Plant & Machinery", date: "2026-02-05", cost: 2200000, res: 0.05, life: 10, method: "SLM", location: "Plant 1 – Bay C", dept: "Operations", vendor: "Bystronic Lasers India Pvt Ltd" },
    { name: "Mahindra Bolero Pickup MH12-EF-3320", category: "Vehicles", date: "2026-07-18", cost: 950000, res: 0.1, life: 8, method: "WDV", location: "Dispatch", dept: "Operations", vendor: "Mahindra Commercial Vehicles – Pune" },
  ],
};

const P2: Profile = {
  entity: E2, seed: 29, revenueScale: 72000, rmRatio: 0.44, monthlyInvoices: 5, salary: 9000, directLabour: 3000, rent: 4200, loanOpening: 150000, emi: 3200, gstRate: 9, scenario: false,
  opening: { "1111": 120000, "1112": 45000, "1113": 18000, "1114": 800, "1130": 60000, "1160": 4000, "2210": 150000, "3100": 250000 },
  banks: [
    { name: "DBS Bank – Operating A/c", bank: "DBS Bank", no: "••••5530", code: "1111", type: "bank" },
    { name: "OCBC – Reserve A/c", bank: "OCBC Bank", no: "••••2208", code: "1112", type: "bank" },
    { name: "UOB – Collections A/c", bank: "UOB", no: "••••7741", code: "1113", type: "bank" },
    { name: "Petty Cash", bank: "Cash in hand", no: "—", code: "1114", type: "cash" },
    { name: "DBS Business Credit Card", bank: "DBS Bank", no: "••••3317", code: "2150", type: "credit_card" },
  ],
  customers: [
    { name: "Pacific Precision Engineering Pte Ltd", city: "Singapore", state: "Singapore", creditDays: 30, scale: 14000, weight: 3 },
    { name: "Lion City Automation Pte Ltd", city: "Singapore", state: "Singapore", creditDays: 30, scale: 11000, weight: 2.5 },
    { name: "Jurong Marine Supplies Pte Ltd", city: "Singapore", state: "Singapore", creditDays: 45, scale: 9500, weight: 2 },
    { name: "Borneo Industrial Sdn Bhd", city: "Kuching", state: "Sarawak", country: "Malaysia", creditDays: 45, scale: 12000, weight: 1.5, late: 12 },
    { name: "Kaveri Textiles Exports", city: "Coimbatore", state: "Tamil Nadu", country: "India", creditDays: 30, scale: 8000, weight: 1 },
  ],
  vendors: [
    { name: "Aarav Industrial Supplies Pvt Ltd (Intercompany)", city: "Pune", state: "Maharashtra", country: "India", currency: "USD", creditDays: 30, category: "ic", ic: true },
    { name: "Sembcorp Metals Trading Pte Ltd", city: "Singapore", state: "Singapore", creditDays: 30, category: "raw" },
    { name: "Tuas Industrial Components Pte Ltd", city: "Singapore", state: "Singapore", creditDays: 30, category: "raw" },
    { name: "Harbour Freight Services Pte Ltd", city: "Singapore", state: "Singapore", creditDays: 15, category: "freight" },
    { name: "Marina Bay Realty Pte Ltd", city: "Singapore", state: "Singapore", creditDays: 5, category: "rent" },
    { name: "Ang & Co Professional Services", city: "Singapore", state: "Singapore", creditDays: 15, category: "professional" },
    { name: "Kopi Digital Marketing", city: "Singapore", state: "Singapore", creditDays: 30, category: "marketing" },
    { name: "Singtel Business", city: "Singapore", state: "Singapore", creditDays: 15, category: "telecom" },
    { name: "Great Eastern General Insurance", city: "Singapore", state: "Singapore", creditDays: 0, category: "insurance" },
    { name: "Tuas Machine Services", city: "Singapore", state: "Singapore", creditDays: 15, category: "repairs" },
  ],
  others: [{ name: "IRAS (Inland Revenue Authority)", city: "Singapore", state: "Singapore", creditDays: 0 }],
  assets: [
    { name: "Warehouse Racking System", category: "Furniture & Fixtures", date: "2023-06-01", cost: 38000, res: 0.05, life: 10, method: "SLM", location: "Warehouse", dept: "Operations" },
    { name: "Electric Forklift", category: "Plant & Machinery", date: "2023-09-15", cost: 42000, res: 0.05, life: 8, method: "SLM", location: "Warehouse", dept: "Operations" },
    { name: "Office IT Equipment", category: "Computers & IT", date: "2024-02-10", cost: 18000, res: 0.05, life: 4, method: "SLM", location: "Office", dept: "Administration" },
    { name: "Inspection & Metrology Station", category: "Plant & Machinery", date: "2026-03-12", cost: 21000, res: 0.05, life: 8, method: "SLM", location: "Warehouse", dept: "Operations", vendor: "Tuas Machine Services" },
  ],
};

const READ: PermissionAction[] = ["view"];
const ALL: PermissionAction[] = ["view", "create", "edit", "delete", "approve"];
const CRUD: PermissionAction[] = ["view", "create", "edit"];
const groups: PermissionGroup[] = ["dashboard", "accounts", "journals", "banking", "receivables", "payables", "expenses", "tax", "reports", "settings", "approvals"];
const mkPerm = (f: (g: PermissionGroup) => PermissionAction[]) => Object.fromEntries(groups.map((g) => [g, f(g)])) as Role["permissions"];

export const ROLES: Role[] = [
  { id: "role-owner", name: "Owner", description: "Full access including company settings, approvals and role management.", system: true, permissions: mkPerm(() => ALL) },
  { id: "role-admin", name: "Administrator", description: "Manages configuration, users and all accounting data.", system: true, permissions: mkPerm((g) => (g === "approvals" ? ["view", "approve"] : ALL)) },
  { id: "role-accountant", name: "Accountant", description: "Day-to-day bookkeeping. Cannot change settings or approve.", system: true, permissions: mkPerm((g) => (g === "settings" || g === "approvals" ? READ : g === "reports" || g === "dashboard" ? READ : CRUD)) },
  { id: "role-finance", name: "Finance Manager", description: "Reviews, approves and closes periods. Read access to configuration.", system: true, permissions: mkPerm((g) => (g === "settings" ? READ : g === "approvals" ? ["view", "approve"] : g === "reports" || g === "dashboard" ? READ : ["view", "create", "edit", "approve"])) },
  { id: "role-viewer", name: "Viewer", description: "Read-only access to dashboards and reports.", system: true, permissions: mkPerm((g) => (["dashboard", "reports", "accounts"].includes(g) ? READ : [])) },
];

const hash = (s: string) => { let h = 0; for (let i = 0; i < s.length; i++) h = (h * 31 + s.charCodeAt(i)) >>> 0; return h; };

function extras(out: Collections, e: Entity, refs: Refs) {
  const R = makeRng(hash(e.id) + 5);
  const A = (c: string) => accId(e.id, c);
  const my = <T extends { entityId: string }>(l: T[]) => l.filter((x) => x.entityId === e.id);
  const ins = e.id === "e1";
  const cur = e.baseCurrency;

  // Fiscal years & periods
  const firstFy = fiscalYearOf(BOOKS_START, e.fyStartMonth), curFy = fiscalYearOf(TODAY, e.fyStartMonth);
  for (let y = firstFy.startYear; y <= curFy.startYear; y++) {
    const fy = fiscalYearByStartYear(y, e.fyStartMonth), id = `${e.id}-fy${y}`;
    const closed = y < curFy.startYear;
    out.fiscalYears.push({ id, entityId: e.id, label: fy.label, start: fy.start, end: fy.end, status: closed ? "closed" : "open" });
    for (let i = 0; i < 12; i++) {
      const s = addMonths(parseISO(fy.start), i), key = format(s, "yyyy-MM");
      out.periods.push({ id: `${id}-p${i + 1}`, entityId: e.id, fyId: id, name: format(s, "MMM yyyy"), start: format(s, "yyyy-MM-01"), end: monthEnd(`${key}-01`), status: closed ? "locked" : key <= "2026-09" ? "closed" : "open" });
    }
  }

  // Tax codes
  const tc = (name: string, head: "CGST" | "SGST" | "IGST" | "GST" | "TDS", rate: number, type: "output" | "input" | "withholding", code: string, section?: string) =>
    out.taxCodes.push({ id: `${e.id}-tx${out.taxCodes.length}`, entityId: e.id, name, head, rate, type, accountId: A(code), active: true, section });
  if (ins) {
    [5, 12, 18, 28].forEach((r) => { tc(`CGST ${r / 2}% (output)`, "CGST", r / 2, "output", "2121"); tc(`SGST ${r / 2}% (output)`, "SGST", r / 2, "output", "2122"); tc(`IGST ${r}% (output)`, "IGST", r, "output", "2123"); });
    [5, 12, 18, 28].forEach((r) => { tc(`CGST ${r / 2}% (input)`, "CGST", r / 2, "input", "1141"); tc(`SGST ${r / 2}% (input)`, "SGST", r / 2, "input", "1142"); tc(`IGST ${r}% (input)`, "IGST", r, "input", "1143"); });
    tc("TDS – Contractors (194C) 1%", "TDS", 1, "withholding", "2130", "194C"); tc("TDS – Contractors (194C) 2%", "TDS", 2, "withholding", "2130", "194C");
    tc("TDS – Rent (194I) 10%", "TDS", 10, "withholding", "2130", "194I"); tc("TDS – Professional fees (194J) 10%", "TDS", 10, "withholding", "2130", "194J");
  } else { tc("GST 9% (output)", "GST", 9, "output", "2123"); tc("GST 9% (input)", "GST", 9, "input", "1143"); tc("GST 0% (zero-rated exports)", "GST", 0, "output", "2123"); }

  // Expense categories
  const catDefs: [string, string, string, number, number][] = [["travel", "Travel & Conveyance", "5250", 5, 45000], ["office", "Office Supplies", "5270", 18, 20000], ["marketing", "Marketing & Advertising", "5240", 18, 60000], ["utilities", "Utilities", "5230", 0, 85000], ["software", "Software Subscriptions", "5295", 18, 41000], ["repairs", "Repairs & Maintenance", "5280", 18, 30000], ["telecom", "Telephone & Internet", "5320", 18, 17000], ["welfare", "Staff Welfare", "5340", 0, 25000], ["professional", "Professional Fees", "5260", 18, 50000], ["insurance", "Insurance", "5290", 18, 24000]];
  const f = ins ? 1 : 0.012;
  catDefs.forEach(([k, name, code, rate, bud]) => out.expenseCategories.push({ id: `${e.id}-cat-${k}`, entityId: e.id, name, accountId: A(code), defaultTaxRate: ins ? rate : rate ? 9 : 0, active: true, budgetMonthly: round2(bud * f) }));

  // Dimensions
  const dim = (kind: "department" | "costCenter" | "project", id: string, code: string, name: string, owner: string, budget: number, extra: Partial<Collections["dimensions"][number]> = {}) => out.dimensions.push({ id: `${e.id}-${id}`, entityId: e.id, kind, code, name, owner, status: "active", budget: round2(budget * f), ...extra });
  dim("department", "dept-sales", "D-SAL", "Sales & Marketing", "Rahul Deshmukh", 1.6e6); dim("department", "dept-ops", "D-OPS", "Operations", "Arjun Mehta", 9.5e6);
  dim("department", "dept-admin", "D-ADM", "Administration", "Kavita Rao", 3.2e6); dim("department", "dept-fin", "D-FIN", "Finance", "Meera Iyer", 1.4e6);
  dim("costCenter", "cc-plant", "CC-100", "Plant 1 – Bhosari", "Arjun Mehta", 8e6); dim("costCenter", "cc-ho", "CC-200", "Head Office", "Kavita Rao", 3e6); dim("costCenter", "cc-export", "CC-300", "Export Desk", "Rahul Deshmukh", 1.2e6);
  if (ins) {
    const cu = (n: string) => out.contacts.find((c) => c.entityId === e.id && c.name.startsWith(n))?.id;
    dim("project", "prj-101", "PRJ-101", "Sundaram – Line retrofit programme", "Arjun Mehta", 6.5e6, { customerId: cu("Sundaram"), startDate: "2025-10-01", endDate: "2027-03-31" });
    dim("project", "prj-102", "PRJ-102", "Kirloskar – Pump housing supply", "Rahul Deshmukh", 5.2e6, { customerId: cu("Kirloskar"), startDate: "2026-01-15", endDate: "2027-06-30" });
    dim("project", "prj-103", "PRJ-103", "Reliance Infra – Structural fabrication", "Arjun Mehta", 9e6, { customerId: cu("Reliance"), startDate: "2026-04-01", endDate: "2027-03-31" });
    dim("project", "prj-099", "PRJ-099", "Atlas Tooling – Export pilot", "Rahul Deshmukh", 1.8e6, { customerId: cu("Atlas"), startDate: "2025-04-15", endDate: "2025-12-31", status: "completed" });
  } else { dim("project", "prj-201", "PRJ-201", "Marina Bay warehouse fit-out", "Priya Nair", 60000, { startDate: "2026-01-01", endDate: "2026-12-31" }); }
  // Tag journal lines with dimensions (deterministic)
  const prjForCustomer = new Map(my(out.dimensions).filter((d) => d.kind === "project" && d.customerId).map((d) => [d.customerId!, d]));
  for (const j of out.journals) {
    if (j.entityId !== e.id || j.status !== "posted") continue;
    const cust = j.lines.find((l) => l.contactId && prjForCustomer.has(l.contactId))?.contactId;
    for (const l of j.lines) {
      const code = l.accountId.split("-")[1];
      const prj = cust ? prjForCustomer.get(cust) : undefined;
      if (j.kind === "invoice" && prj && code.startsWith("41") && j.date >= (prj.startDate ?? "") && j.date <= (prj.endDate ?? "9999")) l.projectId = prj.id;
      if (code === "5110" && hash(l.id) % 4 === 0 && ins) l.projectId = `${e.id}-prj-10${(hash(l.id) % 3) + 1}`;
      if (!l.departmentId && code.startsWith("52")) l.departmentId = code === "5240" ? `${e.id}-dept-sales` : code === "5260" || code === "5220" ? `${e.id}-dept-admin` : `${e.id}-dept-ops`;
      if (code.startsWith("5") && !l.costCenterId) l.costCenterId = code === "5130" || code === "5110" || code === "5120" ? `${e.id}-cc-plant` : `${e.id}-cc-ho`;
    }
  }
  if (ins) {
    const mkA = (n: number, date: string, desc: string, code: string, amount: number, type: Allocation["type"], splits: Allocation["splits"]) =>
      out.allocations.push({ id: `${e.id}-al${n}`, entityId: e.id, date, description: desc, accountId: A(code), amount, type, splits, createdBy: "Meera Iyer" });
    mkA(1, "2026-10-31", "Shared utilities – plant electricity split", "5230", 82000, "expense", [{ kind: "costCenter", dimensionId: `${e.id}-cc-plant`, percent: 80 }, { kind: "costCenter", dimensionId: `${e.id}-cc-ho`, percent: 20 }]);
    mkA(2, "2026-10-31", "Software subscriptions allocated to departments", "5295", 41000, "expense", [{ kind: "department", dimensionId: `${e.id}-dept-sales`, percent: 35 }, { kind: "department", dimensionId: `${e.id}-dept-ops`, percent: 40 }, { kind: "department", dimensionId: `${e.id}-dept-admin`, percent: 25 }]);
  }

  // Manual journals (draft / pending / posted / reversed / recurring)
  const jnum = (date: string) => { const fy = fiscalYearOf(date, e.fyStartMonth).short; const max = Math.max(0, ...out.journals.filter((j) => j.entityId === e.id && j.number.startsWith(`JV-${fy}-`)).map((j) => Number(j.number.split("-")[2]))); return `JV-${fy}-${String(max + 1).padStart(5, "0")}`; };
  const manual = (o: { date: string; desc: string; status: Journal["status"]; dr: string; cr: string; amount: number; by?: string; template?: boolean; reversalOf?: string; ref?: string }): Journal => {
    const id = `${e.id}-jm${out.journals.length}`; const by = o.by ?? "Kavita Rao";
    const j: Journal = { id, entityId: e.id, number: jnum(o.date), date: o.date, reference: o.ref, description: o.desc, status: o.status, kind: o.template ? "recurring" : o.reversalOf ? "reversal" : "manual", sourceType: "manual", sourceRef: o.reversalOf ? "Reversal" : "Manual journal", currency: cur, fxRate: 1,
      lines: [{ id: `${id}-l1`, accountId: A(o.dr), debit: o.amount, credit: 0 }, { id: `${id}-l2`, accountId: A(o.cr), debit: 0, credit: o.amount }], attachments: [], createdBy: by, createdAt: `${o.date}T15:00:00`, updatedBy: by, updatedAt: `${o.date}T15:00:00`,
      postedBy: o.status === "posted" || o.status === "reversed" ? "Meera Iyer" : undefined, postedAt: o.status === "posted" || o.status === "reversed" ? `${o.date}T17:00:00` : undefined, recurringTemplate: o.template, reversalOf: o.reversalOf };
    out.journals.push(j); return j;
  };
  const sc = f;
  const acc1 = manual({ date: "2026-09-30", desc: "Accrued bonus – Q2 FY27", status: "posted", dr: "5210", cr: "2140", amount: round2(250000 * sc), ref: "ACR-0926" });
  const rev1 = manual({ date: "2026-10-01", desc: "Reversal – Accrued bonus – Q2 FY27", status: "posted", dr: "2140", cr: "5210", amount: round2(250000 * sc), reversalOf: acc1.id });
  acc1.status = "reversed"; acc1.reversedBy = rev1.id;
  manual({ date: "2026-10-31", desc: "Prepaid insurance amortisation – Oct", status: "posted", dr: "5290", cr: "1160", amount: round2(20000 * sc), ref: "PPD-1026" });
  manual({ date: "2026-11-14", desc: "Reclassification – freight booked to repairs", status: "pending_approval", dr: "5120", cr: "5280", amount: round2(120000 * sc), by: "Rahul Deshmukh", ref: "RCL-1114" });
  manual({ date: "2026-11-15", desc: "Accrual – statutory audit fee Q2", status: "draft", dr: "5260", cr: "2140", amount: round2(85000 * sc), by: "Kavita Rao" });
  const tpl = manual({ date: "2026-11-30", desc: "Recurring – monthly prepaid insurance amortisation", status: "draft", dr: "5290", cr: "1160", amount: round2(20000 * sc), template: true });
  tpl.recurrence = { frequency: "monthly", nextDate: "2026-11-30" };

  // Approval rules & requests
  const rule = (name: string, docType: ApprovalRequest["docType"], min: number, role: string, second?: string) => out.approvalRules.push({ id: `${e.id}-ar${out.approvalRules.length}`, entityId: e.id, name, docType, minAmount: round2(min * f), approverRole: role, secondApproverRole: second, enabled: true });
  rule("Manual journals over ₹1,00,000", "journal", 100000, "Finance Manager"); rule("Vendor bills over ₹5,00,000", "bill", 500000, "Finance Manager", "Owner"); rule("Expense claims over ₹25,000", "expense", 25000, "Finance Manager");
  rule("Payments over ₹10,00,000", "payment", 1000000, "Owner"); rule("Period closing (any)", "period_close", 0, "Administrator", "Owner"); rule("Adjustments over ₹50,000", "adjustment", 50000, "Finance Manager");
  const req = (docType: ApprovalRequest["docType"], docId: string, docRef: string, title: string, amount: number, status: ApprovalRequest["status"], by: string, at: string, role: string, comment?: string) => {
    const hist: ApprovalRequest["history"] = [{ at, by, action: "submitted" }];
    if (status !== "pending") hist.push({ at: at.replace(/T.*/, "T16:40:00"), by: role === "Owner" ? "Rohan Kulkarni" : "Meera Iyer", action: status === "approved" ? "approved" : "rejected", comment });
    out.approvals.push({ id: `${e.id}-rq${out.approvals.length}`, entityId: e.id, docType, docId, docRef, title, amount, requestedBy: by, requestedAt: at, status, approverRole: role, history: hist });
  };
  for (const j of out.journals.filter((x) => x.entityId === e.id && x.status === "pending_approval")) req("journal", j.id, j.number, j.description, j.lines.reduce((s, l) => s + l.debit, 0), "pending", j.createdBy, `${j.date}T15:10:00`, "Finance Manager");
  for (const b of my(out.bills).filter((x) => x.status === "pending_approval")) req("bill", b.id, b.number, `Bill ${b.vendorBillNo} – ${out.contacts.find((c) => c.id === b.vendorId)?.name}`, b.total, "pending", b.createdBy, `${b.date}T11:20:00`, "Finance Manager");
  for (const x of my(out.expenses).filter((x) => x.status === "pending_approval" && x.amount >= 25000 * f)) req("expense", x.id, x.number, x.description, x.amount, "pending", x.submittedBy, `${x.date}T12:00:00`, "Finance Manager");
  const rb = my(out.bills).find((b) => b.status === "rejected"); if (rb) req("bill", rb.id, rb.number, `Bill ${rb.vendorBillNo} – rate mismatch`, rb.total, "rejected", rb.createdBy, `${rb.date}T10:00:00`, "Finance Manager", "Rate differs from PO. Ask vendor to re-issue.");
  my(out.expenses).filter((x) => x.status === "paid" && x.amount >= 25000 * f).slice(-4).forEach((x) => req("expense", x.id, x.number, x.description, x.amount, "approved", x.submittedBy, `${x.date}T12:00:00`, "Finance Manager", "Within policy."));
  my(out.bills).filter((b) => b.total >= 500000 * f && b.status === "paid").slice(-3).forEach((b) => req("bill", b.id, b.number, `Bill ${b.vendorBillNo}`, b.total, "approved", b.createdBy, `${b.date}T11:00:00`, "Finance Manager", "PO matched."));
  req("period_close", `${e.id}-fy-sep`, "Sep 2026", "Close period September 2026", 0, "approved", "Meera Iyer", "2026-10-06T10:00:00", "Administrator", "All reconciliations complete.");

  // Users (per entity)
  [["Rohan Kulkarni", "role-owner"], ["Meera Iyer", "role-finance"], ["Kavita Rao", "role-accountant"], ["Arjun Mehta", "role-admin"], ["Rahul Deshmukh", "role-accountant"], ["Sneha Patil", "role-viewer"]].forEach(([name, roleId], i) =>
    out.users.push({ id: `${e.id}-u${i + 1}`, entityId: e.id, name, email: `${name.toLowerCase().replace(/ /g, ".")}@aarav.example`, roleId, status: i === 5 ? "invited" : "active", lastActive: `2026-11-${String(17 - (i % 4)).padStart(2, "0")}T0${(i % 6) + 8}:15:00` }));

  // FX rates
  const foreign = ins ? ["USD", "EUR", "GBP", "AED", "SGD"] : ["INR", "SGD", "EUR", "GBP"];
  const rateDates: string[] = []; for (let d = parseISO(BOOKS_START); format(d, "yyyy-MM-dd") <= TODAY; d = addMonths(d, 1)) rateDates.push(format(d, "yyyy-MM-dd")); rateDates.push(TODAY);
  foreign.forEach((c) => rateDates.forEach((d) => out.fxRates.push({ id: `${e.id}-fx-${c}-${d}`, entityId: e.id, currency: c, date: d, rate: sampleRate(c, cur, d), source: "reference (sample)" } as FxRate)));

  // Budgets
  const fyActual = (from: string, to: string) => {
    const m = new Map<string, number[]>();
    for (const j of out.journals) if (j.entityId === e.id && j.status === "posted" && j.date >= from && j.date <= to) for (const l of j.lines) {
      const a = out.accounts.find((x) => x.id === l.accountId)!; if (a.type !== "income" && a.type !== "expense") continue;
      const mi = (Number(j.date.slice(0, 4)) - Number(from.slice(0, 4))) * 12 + Number(j.date.slice(5, 7)) - Number(from.slice(5, 7));
      const arr = m.get(a.id) ?? Array(12).fill(0); arr[mi] += a.type === "income" ? l.credit - l.debit : l.debit - l.credit; m.set(a.id, arr);
    }
    return m;
  };
  const prevFy = fiscalYearByStartYear(curFy.startYear - 1, e.fyStartMonth), base = fyActual(prevFy.start, prevFy.end);
  const budgetAccounts = ["4110", "4120", "4130", "5110", "5120", "5130", "5210", "5220", "5230", "5240", "5250", "5260", "5270", "5280", "5290", "5295", "5320", "5340"];
  const mkBudget = (id: string, name: string, scope: Budget["scope"], dimensionId: string | undefined, factor: number, codes: string[], status: Budget["status"] = "active") => {
    const lines = codes.map((c) => { const arr = base.get(A(c)) ?? Array(12).fill(0); const avg = arr.reduce((s, x) => s + x, 0) / 12; return { accountId: A(c), monthly: arr.map((x) => round2(Math.round((((x * 0.4 + avg * 0.6) * 1.08 * factor) / (ins ? 1000 : 10))) * (ins ? 1000 : 10))) }; });
    out.budgets.push({ id: `${e.id}-${id}`, entityId: e.id, name, fiscalYear: curFy.label, scope, dimensionId, lines, status, createdAt: `${curFy.start}T09:00:00` });
  };
  mkBudget("bud-annual", `${curFy.label} Operating Budget`, "annual", undefined, 1, budgetAccounts);
  mkBudget("bud-ops", "Operations Department Budget", "department", `${e.id}-dept-ops`, 0.55, ["5110", "5120", "5130", "5230", "5280"]);
  if (ins) mkBudget("bud-p101", "PRJ-101 Line Retrofit Budget", "project", `${e.id}-prj-101`, 0.2, ["4110", "4120", "5110", "5130"], "draft");

  // Bank feeds (sample providers)
  const feeds: BankFeed[] = ins ? [
    { id: "e1-bf1", entityId: "e1", provider: "SampleBank Connect (demo)", bankName: "HDFC Bank", status: "connected", accounts: ["HDFC Bank – Current A/c"], lastSync: "2026-11-17T06:30:00", history: [] },
    { id: "e1-bf2", entityId: "e1", provider: "SampleBank Connect (demo)", bankName: "ICICI Bank", status: "reconnect_required", accounts: ["ICICI Bank – Operations A/c"], lastSync: "2026-11-09T06:30:00", errorMessage: "Consent expired on 10 Nov 2026 — reconnect to resume.", history: [] },
    { id: "e1-bf3", entityId: "e1", provider: "OpenLedger Aggregator (demo)", bankName: "State Bank of India", status: "error", accounts: ["SBI – Collections A/c"], lastSync: "2026-11-15T06:30:00", errorMessage: "Provider timeout (HTTP 504 – simulated).", history: [] },
    { id: "e1-bf4", entityId: "e1", provider: "OpenLedger Aggregator (demo)", bankName: "HDFC Bank – Cards", status: "disconnected", accounts: ["HDFC Business Credit Card"], history: [] },
  ] : [{ id: "e2-bf1", entityId: "e2", provider: "SampleBank Connect (demo)", bankName: "DBS Bank", status: "connected", accounts: ["DBS Bank – Operating A/c"], lastSync: "2026-11-17T05:10:00", history: [] }];
  feeds.forEach((fd) => { const days = fd.status === "connected" ? [0, 1, 2, 3, 4] : [8, 9, 10, 11, 12]; fd.history = days.map((d, i) => ({ id: `${fd.id}-h${i}`, at: `2026-11-${String(17 - d).padStart(2, "0")}T06:30:00`, result: fd.status === "error" && i === 0 ? "failed" : i === 3 ? "partial" : "success", imported: i === 0 && fd.status === "error" ? 0 : R.int(4, 22), message: fd.status === "error" && i === 0 ? "Provider timeout (simulated)" : i === 3 ? "2 transactions skipped as duplicates" : "Statement lines imported" })); });
  out.bankFeeds.push(...feeds);

  if (!ins) return;
  // ---------- AI & automation seeds (primary entity) ----------
  const txnById = new Map(out.bankTxns.map((t) => [t.id, t]));
  const primary = out.bankAccounts.find((b) => b.id === "e1-ba1")!;
  const cat = (n: number, txnId: string, category: string, code: string, conf: number, why: string) => {
    const t = txnById.get(txnId); if (!t) return;
    out.catSuggestions.push({ id: `e1-cs${n}`, entityId: "e1", bankTxnId: txnId, date: t.date, description: t.description, amount: t.deposit || t.withdrawal, direction: t.deposit ? "in" : "out", suggestedCategory: category, suggestedAccountId: A(code), confidence: conf, explanation: why, status: "pending" } as CategorizationSuggestion);
  };
  const [b1, b2, b3, b4] = refs.bankOnlyTxns;
  cat(1, b1, "Bank Charges", "5300", 0.97, "Narration contains 'BANK CHARGES' and matches the recurring month-end fee pattern (12 prior months).");
  cat(2, b2, "Interest Income", "4210", 0.95, "'INT.PD' credits on the savings sweep have been booked to Interest Income in every previous quarter.");
  cat(3, b3, "Customer Advance", "2160", 0.71, "Counterparty 'Hindustan Fabricators' has open invoices, but the amount matches none of them — treated as an advance until allocated.");
  cat(4, b4, "Staff Welfare", "5340", 0.84, "UPI merchant 'ZOMATO' with team-lunch narration maps to Staff Welfare in 9 earlier transactions.");
  refs.unmatchedTxns.slice(0, 5).forEach((id, i) => { const t = txnById.get(id)!; cat(5 + i, id, t.withdrawal ? "Vendor Payment" : "Customer Receipt", t.withdrawal ? "2110" : "1120", 0.88 - i * 0.04, t.withdrawal ? "Debit narration contains a vendor name with an open bill of the same amount." : "Credit narration matches an open customer invoice number."); });
  const jvs = (n: number, txnId: string, ref: string, desc: string, dr: string, crc: string, amount: number, conf: number, why: string) => {
    const t = txnById.get(txnId); if (!t) return;
    out.jvSuggestions.push({ id: `e1-js${n}`, entityId: "e1", sourceType: "bank_txn", sourceRef: ref, sourceDescription: desc, date: t.date, amount, debitAccountId: A(dr), creditAccountId: A(crc), explanation: why, confidence: conf, status: "pending" } as JournalSuggestion);
  };
  jvs(1, b1, "STMT " + b1.slice(-6), "Bank charges Oct 2026 (statement only)", "5300", "1111", 1180, 0.97, "Statement debit has no book entry. Charges are expensed to Bank Charges and credited to the bank ledger.");
  jvs(2, b2, "STMT " + b2.slice(-6), "Interest credited – savings sweep Q2", "1111", "4210", 4320, 0.95, "Statement credit without a book entry. Interest earned is income; debit the bank ledger.");
  jvs(3, b3, "STMT " + b3.slice(-6), "NEFT credit – Hindustan Fabricators (unallocated)", "1111", "2160", 384500, 0.71, "No open invoice equals this amount, so it is suggested as a customer advance. You can re-allocate once the remittance advice is received.");
  jvs(4, b4, "STMT " + b4.slice(-6), "UPI – team lunch", "5340", "1112", 3640, 0.84, "Merchant 'ZOMATO' mapped to Staff Welfare based on 9 earlier transactions.");
  // Match suggestions for unmatched txns whose counterpart is in the books
  const lineByJ = new Map(out.journals.filter((j) => j.entityId === "e1").map((j) => [j.id, j]));
  void lineByJ;
  refs.unmatchedTxns.forEach((id, i) => {
    const t = txnById.get(id)!; const amt = t.deposit || t.withdrawal; const side = t.deposit ? "debit" : "credit";
    const hit = out.journals.find((j) => j.entityId === "e1" && j.status === "posted" && j.date >= t.date.slice(0, 8) + "01" && j.lines.some((l) => l.accountId === A("1111") && (side === "debit" ? l.debit : l.credit) === amt) && !out.bankTxns.some((x) => x.matchedJournalIds.includes(j.id)));
    const line = hit?.lines.find((l) => l.accountId === A("1111") && (side === "debit" ? l.debit : l.credit) === amt);
    if (hit && line) out.matchSuggestions.push({ id: `e1-ms${i}`, entityId: "e1", bankTxnId: id, lineIds: [line.id], journalIds: [hit.id], bookLabel: `${hit.number} · ${hit.description}`, bookAmount: amt, confidence: 0.96 - i * 0.03, explanation: `Same amount, ${side === "debit" ? "deposit" : "withdrawal"} dated ${hit.date} vs statement ${t.date}; reference text overlaps with the journal source ${hit.sourceRef}.`, status: "pending" } as MatchSuggestion);
  });
  if (refs.multiMatchTxn) { const t = txnById.get(refs.multiMatchTxn)!; const js = refs.multiMatchJournals.map((id) => out.journals.find((j) => j.id === id)!); out.matchSuggestions.push({ id: "e1-msm", entityId: "e1", bankTxnId: refs.multiMatchTxn, lineIds: js.map((j) => j.lines.find((l) => l.accountId === A("1111"))!.id), journalIds: js.map((j) => j.id), bookLabel: `${js.map((j) => j.number).join(" + ")} · two receipts`, bookAmount: t.deposit, confidence: 0.91, explanation: "A single NEFT credit equals the sum of two receipts booked on the same day from the same remittance.", status: "pending" }); }
  // Anomalies
  const an = (n: number, a: Omit<Anomaly, "id" | "entityId" | "status" | "detectedAt">) => out.anomalies.push({ id: `e1-an${n}`, entityId: "e1", status: n === 6 ? "reviewed" : "open", detectedAt: `2026-11-${String(16 - (n % 4)).padStart(2, "0")}T08:00:00`, ...a });
  const db1 = out.bills.find((b) => b.id === refs.dupBills[1]);
  an(1, { kind: "duplicate", severity: "high", title: "Possible duplicate vendor bill – SafeFreight Logistics", description: `Bill ${db1?.number} has the same vendor, bill number (SF/26/884) and amount as an earlier approved bill.`, refType: "bill", refId: refs.dupBills[1], refLabel: db1?.number ?? "", amount: db1?.total, explanation: "Vendor + supplier invoice number + amount are identical; dated two days apart. Duplicates cause double payment and double input-tax credit.", nextAction: "Reject the second bill or confirm with the vendor that it is a separate consignment." });
  const ux = out.expenses.find((x) => x.id === refs.unusualExpense);
  an(2, { kind: "unusual_amount", severity: "high", title: "Marketing expense far above normal", description: `Expense ${ux?.number} of ₹4,20,000 is about 9× the 12-month average marketing claim.`, refType: "expense", refId: refs.unusualExpense ?? "", refLabel: ux?.number ?? "", amount: 420000, explanation: "Z-score of 6.8 against historical marketing claims; submitted by UPI with no attached receipt.", nextAction: "Request the sponsorship agreement and receipt before approving." });
  an(3, { kind: "unexpected_movement", severity: "medium", title: "Petty cash balance jumped to ₹3.75 lakh", description: "A manual journal moved ₹3,50,000 from HDFC to Petty Cash on 12 Nov.", refType: "journal", refId: refs.pettyJournal ?? "", refLabel: "Manual journal 12 Nov", amount: 350000, explanation: "Petty cash normally stays below ₹30,000. Large cash balances increase control risk.", nextAction: "Confirm the purpose and document the cash disbursements, or reverse the transfer." });
  an(4, { kind: "payment_pattern", severity: "medium", title: "Three similar bills just under the approval limit", description: "Pune Industrial Services billed ₹4,99,140 three times between 3 and 6 Nov — each just under the ₹5,00,000 approval threshold.", refType: "bill", refId: refs.roundBills[0] ?? "", refLabel: "Pune Industrial Services", amount: 1497420, explanation: "Splitting a single job into multiple bills below the approval limit is a common control-avoidance pattern.", nextAction: "Review the work order; route the combined amount for Finance Manager approval." });
  an(5, { kind: "missing_entry", severity: "medium", title: "Rent bill for November not recorded", description: "Skyline Realty LLP has been billed on the 1st of every month since April 2025. No bill exists for Nov 2026.", refType: "vendor", refId: "e1-ve5", refLabel: "Skyline Realty LLP", amount: 165200, explanation: "Recurring monthly vendor entry is absent 16 days into the month.", nextAction: "Enter the November rent bill or confirm the landlord has not invoiced." });
  an(6, { kind: "reconciliation", severity: "low", title: "Unreconciled bank charges (Oct)", description: "Statement shows ₹1,180 bank charges with no book entry.", refType: "bank_txn", refId: b1, refLabel: "HDFC statement 31 Oct", amount: 1180, explanation: "Statement-only items create a reconciliation difference.", nextAction: "Accept the suggested journal in Transaction Categorization." });
  an(7, { kind: "reconciliation", severity: "high", title: "Duplicate line on HDFC statement", description: "The statement contains two identical debits on the same date with the same reference.", refType: "bank_txn", refId: refs.duplicateTxn ?? "", refLabel: "HDFC statement", amount: txnById.get(refs.duplicateTxn ?? "")?.withdrawal, explanation: "Same date, amount and bank reference — likely re-sent by the bank feed.", nextAction: "Exclude the duplicate line from reconciliation." });

  // Documents
  const docs: DocumentFile[] = []; let dn = 0;
  const addDoc = (name: string, category: DocumentFile["category"], linkedType: string, linkedId: string | undefined, linkedRef: string, text: string, size: number) => docs.push({ id: `e1-doc${++dn}`, entityId: "e1", name, category, size, mime: name.endsWith(".pdf") ? "application/pdf" : name.endsWith(".png") ? "image/png" : "text/csv", linkedType, linkedId, linkedRef, uploadedBy: R.pick(["Kavita Rao", "Meera Iyer", "Rahul Deshmukh"]), createdAt: "2026-11-05T11:00:00", modifiedBy: "Kavita Rao", modifiedAt: "2026-11-05T11:00:00", previewText: text, simulated: true });
  my(out.bills).filter((b) => b.date >= "2026-09-01" && ["approved", "paid", "pending_approval", "overdue", "partial"].includes(b.status)).slice(-8).forEach((b) => { addDoc(`${b.vendorBillNo.replace(/\//g, "-")}.pdf`, "Invoice", "bill", b.id, b.number, `TAX INVOICE\nInvoice no: ${b.vendorBillNo}\nDate: ${b.date}\nVendor: ${out.contacts.find((c) => c.id === b.vendorId)?.name}\nTaxable value: ${b.subtotal.toFixed(2)}\nGST: ${(b.cgst + b.sgst + b.igst).toFixed(2)}\nTotal: ${b.total.toFixed(2)}`, R.int(80000, 240000)); b.attachments.push(`e1-doc${dn}`); });
  my(out.expenses).filter((x) => x.date >= "2026-10-01").slice(-8).forEach((x) => { addDoc(`receipt-${x.number}.png`, "Receipt", "expense", x.id, x.number, `RECEIPT\n${x.description}\nDate: ${x.date}\nAmount: ${x.amount.toFixed(2)}\nPaid via: ${x.paymentMethod.toUpperCase()}`, R.int(40000, 160000)); x.receiptDocId = `e1-doc${dn}`; });
  addDoc("HDFC-statement-Oct-2026.csv", "Bank Statement", "bank_account", "e1-ba1", "HDFC ••••4821", "date,narration,withdrawal,deposit,balance\n2026-10-01,INT.PD – SAVINGS SWEEP Q2,,4320.00,...", 54000);
  addDoc("Skyline-rent-agreement-2025.pdf", "Contract", "vendor", "e1-ve5", "Skyline Realty LLP", "LEAVE AND LICENCE AGREEMENT\nPremises: Plot 41, MIDC Bhosari\nMonthly licence fee: INR 1,40,000 + GST\nTerm: 36 months from 01 Apr 2025", 310000);
  addDoc("GSTR-3B-Oct-2026-working.csv", "Tax", "tax", undefined, "GST Oct 2026", "head,output,input,net\nCGST,...", 22000);
  out.documents.push(...docs);

  // Agents
  const open = (k: string, n: number) => ({ k, n });
  void open;
  const unmatchedCount = refs.unmatchedTxns.length + refs.bankOnlyTxns.length + (refs.multiMatchTxn ? 1 : 0);
  const dueBills = my(out.bills).filter((b) => ["approved", "partial", "overdue"].includes(b.status) && b.dueDate <= "2026-11-24").sort((a, b) => a.dueDate.localeCompare(b.dueDate));
  const T = (id: string, title: string, description: string, requiresApproval: boolean, impact: string, items: { label: string; detail: string; amount?: number }[]) => ({ id, title, description, requiresApproval, status: "proposed" as const, items, createdAt: "2026-11-17T07:00:00", impact });
  const agents: Agent[] = [
    { id: "e1-ag1", entityId: "e1", name: "Reconciliation Agent", description: "Reviews unmatched bank transactions, suggests matches and prepares reconciliation actions for approval.", status: "awaiting_approval", lastActivity: "2026-11-17T07:00:00", actions: ["Review unmatched transactions", "Suggest matches", "Prepare reconciliation actions", "Request approval"], history: [{ id: "h1", at: "2026-11-16T07:00:00", text: "Scanned 214 statement lines; 31 matched automatically.", outcome: "info" }, { id: "h2", at: "2026-11-10T07:05:00", text: "Approved: matched 9 receipts to open invoices.", outcome: "approved" }],
      tasks: [T("t1", `Match ${out.matchSuggestions.length} bank transactions`, "High-confidence matches found between HDFC statement lines and posted receipts/payments.", true, "Marks transactions as reconciled; no journal is created.", out.matchSuggestions.slice(0, 5).map((m) => ({ label: txnById.get(m.bankTxnId)?.description ?? "", detail: `→ ${m.bookLabel} (${Math.round(m.confidence * 100)}%)`, amount: m.bookAmount }))),
        T("t2", `Draft ${out.jvSuggestions.length} journals for statement-only items`, `${unmatchedCount} statement lines have no book entry (charges, interest, unallocated receipt).`, true, "Creates DRAFT journals only — nothing is posted.", out.jvSuggestions.map((s) => ({ label: s.sourceDescription, detail: "Dr / Cr suggested", amount: s.amount })))] },
    { id: "e1-ag2", entityId: "e1", name: "Expense Review Agent", description: "Reviews expense records, flags unusual spend, and suggests categories before approval.", status: "awaiting_approval", lastActivity: "2026-11-17T06:40:00", actions: ["Review expense records", "Identify unusual expenses", "Suggest categories", "Prepare review actions"], history: [{ id: "h1", at: "2026-11-15T06:40:00", text: "Reviewed 31 expenses; flagged 1 unusual amount.", outcome: "reviewed" }],
      tasks: [T("t1", "Hold trade-fair sponsorship for review", "Marketing expense of ₹4,20,000 is ~9× the typical claim and has no receipt attached.", true, "Sets the expense to 'needs info' (simulated) and notifies the submitter.", [{ label: ux?.number ?? "", detail: "Trade fair sponsorship – Pune Engg Expo (UPI)", amount: 420000 }]),
        T("t2", "Re-categorise 3 expenses", "Three 'Office Supplies' claims look like Staff Welfare based on merchant names.", false, "Changes category only; no posted amounts change.", my(out.expenses).slice(-3).map((x) => ({ label: x.number, detail: `${x.description} → Staff Welfare`, amount: x.amount })))] },
    { id: "e1-ag3", entityId: "e1", name: "Payables Agent", description: "Identifies upcoming vendor payments, highlights overdue bills and prepares payment recommendations.", status: "awaiting_approval", lastActivity: "2026-11-17T06:20:00", actions: ["Identify upcoming vendor payments", "Highlight overdue bills", "Prepare payment recommendations"], history: [{ id: "h1", at: "2026-11-12T06:20:00", text: "Prepared payment run of 6 vendors; approved by Finance Manager.", outcome: "approved" }],
      tasks: [T("t1", `Pay ${dueBills.length} vendor bills due this week`, "Bills due on or before 24 Nov. Payment is only recorded after your approval.", true, "Simulated payment run — creates payment records in the mock books, no real money moves.", dueBills.slice(0, 6).map((b) => ({ label: `${b.number} · ${out.contacts.find((c) => c.id === b.vendorId)?.name}`, detail: `Due ${b.dueDate}`, amount: round2(b.total - b.tdsAmount - b.paid) })))] },
    { id: "e1-ag4", entityId: "e1", name: "Financial Reporting Agent", description: "Prepares financial summaries, compares reporting periods and highlights significant variances.", status: "idle", lastActivity: "2026-11-14T18:00:00", actions: ["Prepare financial summaries", "Compare reporting periods", "Highlight significant variances"], history: [{ id: "h1", at: "2026-11-14T18:00:00", text: "Generated October 2026 management summary.", outcome: "executed" }],
      tasks: [T("t1", "Publish October management summary", "Compares October 2026 with September 2026 and Oct 2025. Highlights marketing and freight variances.", false, "Generates a read-only summary document.", [{ label: "Revenue vs Sep", detail: "See Reports → Profit and Loss" }, { label: "Largest variance", detail: "Marketing & Advertising" }])] },
    { id: "e1-ag5", entityId: "e1", name: "Month-End Closing Agent", description: "Reviews outstanding accounting tasks, identifies unreconciled transactions and pending journals, and prepares a closing checklist.", status: "awaiting_approval", lastActivity: "2026-11-17T07:10:00", actions: ["Review outstanding tasks", "Identify unreconciled transactions", "Identify pending journals", "Prepare closing checklist"], history: [{ id: "h1", at: "2026-11-05T07:10:00", text: "Prepared September closing checklist (12/12 complete).", outcome: "approved" }],
      tasks: [T("t1", "October 2026 closing checklist", "4 open items block closing the October period.", true, "Creates a checklist and flags the period as 'ready to close' once complete (simulated).", [{ label: "Bank reconciliation – HDFC", detail: `${unmatchedCount} unmatched statement lines` }, { label: "Pending journals", detail: "1 awaiting approval, 1 draft" }, { label: "Pending approvals", detail: "Vendor bills & expenses awaiting review" }, { label: "Depreciation", detail: "Posted ✓" }])] },
  ];
  out.agents.push(...agents);

  // Automation rules
  const run = (n: number, ok: "success" | "skipped" | "failed", msg: string, day: number) => ({ id: `x${n}`, at: `2026-11-${String(day).padStart(2, "0")}T06:00:00`, result: ok, message: msg });
  const autos: Omit<Automation, "entityId">[] = [
    { id: "e1-au1", name: "Notify when a customer invoice becomes overdue", trigger: "Invoice due date passes", conditions: [{ field: "Outstanding amount", operator: ">", value: "₹50,000" }], action: "Notify Finance team (in-app)", status: "active", lastExecuted: "2026-11-17T06:00:00", executions: [run(1, "success", "5 overdue invoices notified", 17), run(2, "success", "2 overdue invoices notified", 16), run(3, "skipped", "No new overdue invoices", 15)] },
    { id: "e1-au2", name: "Flag vendor bills approaching due date", trigger: "Daily at 06:00", conditions: [{ field: "Days to due", operator: "<=", value: "5" }], action: "Flag bill & add to payment proposal", status: "active", lastExecuted: "2026-11-17T06:00:00", executions: [run(1, "success", "4 bills flagged", 17), run(2, "success", "3 bills flagged", 16)] },
    { id: "e1-au3", name: "Notify when bank balance falls below threshold", trigger: "Bank balance changes", conditions: [{ field: "Total bank balance", operator: "<", value: "₹15,00,000" }], action: "Alert Owner & Finance Manager", status: "active", lastExecuted: "2026-10-28T12:00:00", executions: [run(1, "skipped", "Balance above threshold", 17), run(2, "success", "Low-balance alert sent (sample)", 28)] },
    { id: "e1-au4", name: "Prepare recurring journal entries", trigger: "Last day of month", conditions: [{ field: "Template status", operator: "=", value: "Active" }], action: "Create DRAFT journals from templates", status: "active", lastExecuted: "2026-10-31T23:00:00", executions: [run(1, "success", "1 draft journal prepared", 30)] },
    { id: "e1-au5", name: "Alert when a bank transaction stays unmatched", trigger: "Bank transaction imported", conditions: [{ field: "Days unmatched", operator: ">", value: "7" }], action: "Notify Accountant", status: "paused", lastExecuted: "2026-11-03T06:00:00", executions: [run(1, "success", "6 alerts sent", 3)] },
    { id: "e1-au6", name: "Prepare monthly financial summary", trigger: "1st of month", conditions: [], action: "Generate summary report & notify Owner", status: "active", lastExecuted: "2026-11-01T07:00:00", executions: [run(1, "success", "October summary prepared", 1), run(2, "failed", "Summary failed: period still open (simulated)", 1)] },
  ];
  out.automations.push(...autos.map((a) => ({ ...a, entityId: "e1" })));

  // Audit log
  const audit: Collections["audit"] = [];
  my(out.journals).filter((j) => j.status !== "draft").forEach((j, i) => { if (i % 3 === 0 || j.kind === "manual") audit.push({ id: `${j.id}-au`, entityId: "e1", at: j.postedAt ?? j.createdAt, user: j.postedBy ?? j.createdBy, action: j.status === "posted" ? "Posted journal" : "Created journal", objectType: "journal", objectId: j.id, ref: j.number, detail: `${j.description} (${j.kind})` }); });
  audit.push({ id: "e1-au-x1", entityId: "e1", at: "2026-10-06T10:05:00", user: "Rohan Kulkarni", action: "Closed period", objectType: "period", objectId: "e1-fy2026-p6", ref: "Sep 2026", detail: "Period closed after approval (simulated)" });
  audit.push({ id: "e1-au-x2", entityId: "e1", at: "2026-11-02T09:00:00", user: "Arjun Mehta", action: "Updated role permissions", objectType: "role", objectId: "role-accountant", ref: "Accountant", detail: "Removed 'delete' on Journals" });
  out.audit.push(...audit);

  // Notifications
  const overdue = my(out.invoices).filter((i) => i.status === "overdue");
  out.notifications.push(
    { id: "e1-n1", entityId: "e1", at: "2026-11-17T06:00:00", title: `${overdue.length} invoices overdue`, body: "Receivables ageing shows balances more than 30 days past due.", level: "warning", href: "/receivables/invoices" },
    { id: "e1-n2", entityId: "e1", at: "2026-11-16T08:00:00", title: "Possible duplicate bill detected", body: "SafeFreight Logistics – SF/26/884", level: "error", href: "/ai/anomalies" },
    { id: "e1-n3", entityId: "e1", at: "2026-11-15T10:30:00", title: "ICICI bank feed needs reconnecting", body: "Consent expired on 10 Nov 2026 (sample provider).", level: "warning", href: "/banking/feeds" },
    { id: "e1-n4", entityId: "e1", at: "2026-11-14T09:00:00", title: "GST payment due 20 Nov", body: "October 2026 GST liability is awaiting payment.", level: "info", href: "/tax/overview" },
    { id: "e1-n5", entityId: "e1", at: "2026-11-13T16:00:00", title: "3 items awaiting your approval", body: "Journal, bills and expenses are pending.", level: "info", href: "/advanced-finance/approvals" },
  );
}

export function buildSeed(): Collections {
  const out = emptyCollections();
  out.entities.push(E1, E2);
  out.roles.push(...ROLES);
  const r1 = generateEntity(out, P1);
  const r2 = generateEntity(out, P2);
  extras(out, E1, r1);
  extras(out, E2, r2);
  return out;
}
