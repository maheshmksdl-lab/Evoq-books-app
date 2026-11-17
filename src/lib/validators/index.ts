import { z } from "zod";

// ---- primitives -------------------------------------------------------------------------------
export const isoDate = z.string().regex(/^\d{4}-\d{2}-\d{2}$/, "Choose a date");
export const money = z.coerce.number({ error: "Enter a valid amount" }).min(0, "Cannot be negative");
export const positiveMoney = z.coerce.number({ error: "Enter a valid amount" }).gt(0, "Must be greater than zero");
export const req = (label: string) => z.string().trim().min(1, `${label} is required`);
export const optionalText = z.string().trim().optional().or(z.literal(""));

// ---- chart of accounts ------------------------------------------------------------------------
export const accountSchema = z.object({
  code: z.string().regex(/^\d{4,6}$/, "Code must be 4–6 digits"),
  name: req("Account name").max(80, "Keep the name under 80 characters"),
  type: z.enum(["asset", "liability", "equity", "income", "expense"], { error: "Select an account type" }),
  parentId: req("Parent group"),
  isGroup: z.boolean(),
  openingBalance: z.coerce.number({ error: "Enter a valid amount" }),
  description: optionalText,
}).superRefine((v, ctx) => {
  const prefix = { asset: "1", liability: "2", equity: "3", income: "4", expense: "5" }[v.type];
  if (v.code && !v.code.startsWith(prefix)) ctx.addIssue({ code: "custom", path: ["code"], message: `${v.type} codes start with ${prefix}` });
  if (v.isGroup && v.openingBalance) ctx.addIssue({ code: "custom", path: ["openingBalance"], message: "Group accounts cannot carry a balance" });
});

// ---- journals ---------------------------------------------------------------------------------
export const journalLineSchema = z.object({
  accountId: z.string().min(1, "Select an account"),
  debit: z.coerce.number().min(0).default(0),
  credit: z.coerce.number().min(0).default(0),
  description: z.string().optional(),
  contactId: z.string().optional(),
  departmentId: z.string().optional(),
  projectId: z.string().optional(),
}).refine((l) => !(l.debit > 0 && l.credit > 0), { message: "Use either debit or credit on a line", path: ["debit"] });
export const journalSchema = z.object({
  date: isoDate, reference: optionalText, description: req("Description"),
  lines: z.array(journalLineSchema).min(2, "A journal needs at least two lines"),
}).superRefine((v, ctx) => {
  const d = v.lines.reduce((s, l) => s + (l.debit || 0), 0), c = v.lines.reduce((s, l) => s + (l.credit || 0), 0);
  if (Math.abs(d - c) > 0.004) ctx.addIssue({ code: "custom", path: ["lines"], message: `Debits and credits differ by ${Math.abs(d - c).toFixed(2)}` });
});

// ---- contacts ---------------------------------------------------------------------------------
export const contactSchema = z.object({
  kind: z.enum(["customer", "vendor", "other"]), name: req("Name"), email: z.string().email("Enter a valid email").or(z.literal("")), phone: optionalText,
  address: optionalText, city: optionalText, state: optionalText, country: req("Country"),
  taxId: optionalText, gstin: z.string().regex(/^(\d{2}[A-Z0-9]{10}\d[A-Z]\d|\d{2}[A-Z]{5}\d{4}[A-Z][A-Z0-9]Z[A-Z0-9])?$/i, "GSTIN must be 15 characters").optional().or(z.literal("")),
  pan: z.string().regex(/^([A-Z]{5}\d{4}[A-Z])?$/i, "PAN must be 10 characters (AAAAA9999A)").optional().or(z.literal("")),
  openingBalance: money, creditDays: z.coerce.number().int().min(0, "Cannot be negative").max(365), paymentTerms: optionalText,
  ledgerAccountId: req("Ledger account"), currency: req("Currency"), status: z.enum(["active", "inactive"]),
  tdsSection: optionalText, tdsRate: z.coerce.number().min(0).max(30).optional(),
});

// ---- bills / payments / expenses --------------------------------------------------------------
export const docLineSchema = z.object({ description: req("Description"), accountId: req("Account"), qty: z.coerce.number().gt(0, "Qty > 0"), rate: z.coerce.number().min(0, "Rate ≥ 0"), taxRate: z.coerce.number().min(0).max(28) });
export const billSchema = z.object({
  vendorId: req("Vendor"), vendorBillNo: req("Vendor bill number"), date: isoDate, dueDate: isoDate, currency: z.string().optional(),
  lines: z.array(docLineSchema).min(1, "Add at least one line"), tdsSection: optionalText, tdsRate: z.coerce.number().min(0).max(30).optional(), notes: optionalText,
}).refine((v) => v.dueDate >= v.date, { message: "Due date cannot be before the bill date", path: ["dueDate"] });

export const paymentSchema = z.object({
  date: isoDate, amount: positiveMoney, method: z.enum(["bank_transfer", "upi", "cheque", "cash", "card", "neft", "rtgs"]),
  bankAccountId: req("Account"), reference: optionalText, notes: optionalText,
});

export const expenseSchema = z.object({
  date: isoDate, categoryId: req("Category"), vendorId: optionalText, description: req("Description").max(120), amount: positiveMoney,
  taxTreatment: z.enum(["inclusive", "exclusive", "none"]), gstRate: z.coerce.number().min(0).max(28), paymentAccountId: req("Payment account"),
  paymentMethod: z.enum(["bank_transfer", "upi", "cheque", "cash", "card", "neft", "rtgs"]), departmentId: optionalText, recurring: z.boolean().optional(), frequency: z.enum(["monthly", "quarterly", "yearly"]).optional(),
});

// ---- tax / banking / budgets / assets / approvals / automation ---------------------------------
export const taxCodeSchema = z.object({
  name: req("Name"), head: z.enum(["CGST", "SGST", "IGST", "GST", "TDS"]), rate: z.coerce.number().min(0).max(100, "Rate must be 0–100"), type: z.enum(["output", "input", "withholding"]),
  accountId: req("Tax account"), section: optionalText, active: z.boolean(),
});
export const bankTxnSchema = z.object({ date: isoDate, description: req("Description"), withdrawal: money, deposit: money })
  .refine((v) => (v.withdrawal > 0) !== (v.deposit > 0), { message: "Enter either a withdrawal or a deposit", path: ["withdrawal"] });
export const bankAccountSchema = z.object({ name: req("Account name"), bankName: req("Bank"), accountNo: req("Account number"), type: z.enum(["bank", "cash", "credit_card"]), ledgerAccountId: req("Ledger account"), openingStatement: z.coerce.number() });
export const budgetSchema = z.object({ name: req("Budget name"), fiscalYear: req("Financial year"), scope: z.enum(["annual", "department", "project"]), dimensionId: optionalText, status: z.enum(["draft", "active", "closed"]) })
  .refine((v) => v.scope === "annual" || !!v.dimensionId, { message: "Select the department or project", path: ["dimensionId"] });
export const assetSchema = z.object({
  name: req("Asset name"), category: z.enum(["Plant & Machinery", "Office Equipment", "Computers & IT", "Furniture & Fixtures", "Vehicles"]), purchaseDate: isoDate, vendorId: optionalText, invoiceRef: optionalText,
  cost: positiveMoney, residual: money, usefulLifeYears: z.coerce.number().int().min(1, "At least 1 year").max(50), method: z.enum(["SLM", "WDV", "DDB"]), location: req("Location"), department: optionalText,
  postAcquisition: z.boolean().optional(), paymentAccountId: optionalText,
}).refine((v) => v.residual < v.cost, { message: "Residual must be lower than cost", path: ["residual"] })
  .refine((v) => !v.postAcquisition || !!v.paymentAccountId, { message: "Select the payment account", path: ["paymentAccountId"] });
export const approvalRuleSchema = z.object({ name: req("Rule name"), docType: z.enum(["journal", "bill", "expense", "payment", "period_close", "adjustment"]), minAmount: money, approverRole: req("Approver"), secondApproverRole: optionalText, enabled: z.boolean() });
export const automationSchema = z.object({
  name: req("Name"), trigger: req("Trigger"), field: req("Condition field"), operator: req("Operator"), value: req("Value"), action: req("Action"), status: z.enum(["active", "paused"]),
});
export const entitySchema = z.object({
  name: req("Display name"), legalName: req("Legal name"), country: req("Country"), state: optionalText, city: optionalText, address: optionalText, baseCurrency: req("Base currency"),
  fyStartMonth: z.coerce.number().int().min(1).max(12), taxRegime: z.enum(["india-gst", "flat-gst"]), gstin: optionalText, pan: optionalText, industry: req("Industry"), role: z.enum(["parent", "subsidiary"]), ownership: z.coerce.number().min(0).max(100),
});
export const fxRateSchema = z.object({ currency: req("Currency"), date: isoDate, rate: positiveMoney });
export const dimensionSchema = z.object({ code: req("Code").max(12), name: req("Name"), owner: req("Owner"), budget: money, status: z.enum(["active", "inactive", "completed"]), startDate: optionalText, endDate: optionalText });
export const creditNoteSchema = z.object({ contactId: req("Contact"), date: isoDate, net: positiveMoney, taxRate: z.coerce.number().min(0).max(28), reason: req("Reason") });
export const writeOffSchema = z.object({ amount: positiveMoney, reason: req("Reason"), date: isoDate });
export const roleSchema = z.object({ name: req("Role name"), description: optionalText });
export const userSchema = z.object({ name: req("Name"), email: z.string().email("Enter a valid email"), roleId: req("Role") });
