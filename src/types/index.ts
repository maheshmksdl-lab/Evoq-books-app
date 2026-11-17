// Shared domain types for EVOQ Books. These describe the contract between the UI and any
// data source (today: in-browser mock services; later: a real API adapter).

export type ID = string;
export type ISODate = string; // yyyy-MM-dd

export type AccountType = "asset" | "liability" | "equity" | "income" | "expense";
export type CashFlowClass = "cash" | "working_capital" | "noncash" | "investing" | "financing" | "equity";

export interface Entity {
  id: ID;
  name: string;
  legalName: string;
  country: string;
  state: string;
  city: string;
  address: string;
  baseCurrency: string;
  fyStartMonth: number; // 1-12
  taxRegime: "india-gst" | "flat-gst";
  gstin?: string;
  pan?: string;
  role: "parent" | "subsidiary";
  ownership: number;
  industry: string;
  accountSettings: { allowBackdated: boolean; requireJournalApproval: boolean; autoNumbering: boolean; decimalPlaces: number };
}

export interface Account {
  id: ID;
  entityId: ID;
  code: string;
  name: string;
  type: AccountType;
  group: string;
  parentId: ID | null;
  isGroup: boolean;
  openingBalance: number; // natural-side balance at books start (positive = normal side)
  currency: string;
  active: boolean;
  system: boolean;
  description?: string;
  cashFlow?: CashFlowClass;
}

export type JournalStatus = "draft" | "pending_approval" | "posted" | "rejected" | "reversed";
export type JournalKind =
  | "manual" | "invoice" | "bill" | "receipt" | "payment" | "expense" | "bank" | "depreciation"
  | "adjustment" | "opening" | "closing" | "reversal" | "recurring" | "tax" | "payroll" | "credit_note" | "loan" | "intercompany";

export interface JournalLine {
  id: ID;
  accountId: ID;
  debit: number;
  credit: number;
  description?: string;
  contactId?: ID;
  departmentId?: ID;
  costCenterId?: ID;
  projectId?: ID;
}

export interface Journal {
  id: ID;
  entityId: ID;
  number: string;
  date: ISODate;
  reference?: string;
  description: string;
  status: JournalStatus;
  kind: JournalKind;
  sourceType: string;
  sourceId?: ID;
  sourceRef: string;
  currency: string;
  fxRate: number;
  lines: JournalLine[];
  attachments: ID[];
  recurringTemplate?: boolean;
  recurrence?: { frequency: "monthly" | "quarterly" | "yearly"; nextDate: ISODate };
  reversalOf?: ID;
  reversedBy?: ID;
  createdBy: string;
  createdAt: string;
  updatedBy: string;
  updatedAt: string;
  postedBy?: string;
  postedAt?: string;
  aiSuggested?: boolean;
}

export type ContactKind = "customer" | "vendor" | "other";
export interface Contact {
  id: ID;
  entityId: ID;
  kind: ContactKind;
  name: string;
  email: string;
  phone: string;
  address: string;
  city: string;
  state: string;
  country: string;
  taxId: string;
  gstin: string;
  pan: string;
  openingBalance: number;
  creditDays: number;
  paymentTerms: string;
  ledgerAccountId: ID;
  status: "active" | "inactive";
  currency: string;
  intercompanyEntityId?: ID;
  tdsSection?: string;
  tdsRate?: number;
  createdAt: string;
}

export interface DocLine { id: ID; description: string; accountId?: ID; qty: number; rate: number; taxRate: number; amount: number }

export type InvoiceStatus = "draft" | "sent" | "partial" | "paid" | "overdue" | "written_off" | "void";
export interface Invoice {
  id: ID;
  entityId: ID;
  number: string;
  customerId: ID;
  date: ISODate;
  dueDate: ISODate;
  currency: string;
  fxRate: number;
  subtotal: number;
  cgst: number;
  sgst: number;
  igst: number;
  total: number;
  paid: number;
  status: InvoiceStatus;
  source: "EVOQ Billing (sample integration)";
  journalId: ID;
  lines: DocLine[];
  placeOfSupply: string;
  intercompany?: boolean;
}

export type BillStatus = "draft" | "pending_approval" | "approved" | "partial" | "paid" | "overdue" | "rejected" | "void";
export interface Bill {
  id: ID;
  entityId: ID;
  number: string;
  vendorBillNo: string;
  vendorId: ID;
  date: ISODate;
  dueDate: ISODate;
  currency: string;
  fxRate: number;
  lines: DocLine[];
  subtotal: number;
  cgst: number;
  sgst: number;
  igst: number;
  tdsSection?: string;
  tdsAmount: number;
  total: number;
  paid: number;
  status: BillStatus;
  journalId?: ID;
  notes?: string;
  attachments: ID[];
  createdBy: string;
  createdAt: string;
  intercompany?: boolean;
}

export interface Payment {
  id: ID;
  entityId: ID;
  number: string;
  kind: "receipt" | "payment";
  contactId: ID;
  date: ISODate;
  amount: number;
  currency: string;
  fxRate: number;
  method: "bank_transfer" | "upi" | "cheque" | "cash" | "card" | "neft" | "rtgs";
  bankAccountId: ID;
  reference: string;
  allocations: { docId: ID; amount: number }[];
  journalId: ID;
  status: "recorded" | "void" | "pending_approval";
  notes?: string;
  realizedFx?: number;
}

export interface CreditNote {
  id: ID;
  entityId: ID;
  kind: "customer" | "vendor";
  number: string;
  contactId: ID;
  date: ISODate;
  amount: number;
  tax: number;
  reason: string;
  status: "open" | "applied" | "void";
  appliedTo?: ID;
  journalId: ID;
}

export interface ExpenseCategory { id: ID; entityId: ID; name: string; accountId: ID; defaultTaxRate: number; active: boolean; budgetMonthly?: number }

export type ExpenseStatus = "draft" | "pending_approval" | "approved" | "rejected" | "paid";
export interface Expense {
  id: ID;
  entityId: ID;
  number: string;
  date: ISODate;
  categoryId: ID;
  vendorId?: ID;
  description: string;
  amount: number; // total paid
  taxAmount: number;
  taxTreatment: "inclusive" | "exclusive" | "none";
  gstRate: number;
  paymentAccountId: ID; // BankAccount id
  paymentMethod: Payment["method"];
  status: ExpenseStatus;
  recurring?: { frequency: "monthly" | "quarterly" | "yearly"; nextDate: ISODate } | null;
  receiptDocId?: ID;
  submittedBy: string;
  journalId?: ID;
  departmentId?: ID;
  projectId?: ID;
  createdAt: string;
}

export interface BankAccount {
  id: ID;
  entityId: ID;
  name: string;
  bankName: string;
  accountNo: string;
  type: "bank" | "cash" | "credit_card";
  currency: string;
  ledgerAccountId: ID;
  ifsc?: string;
  statementBalance: number;
  lastReconciled?: ISODate;
}

export interface BankTxn {
  id: ID;
  entityId: ID;
  bankAccountId: ID;
  date: ISODate;
  description: string;
  reference: string;
  withdrawal: number;
  deposit: number;
  balance: number;
  status: "unmatched" | "matched" | "categorized" | "excluded";
  matchedLineIds: ID[];
  matchedJournalIds: ID[];
  category?: string;
  accountId?: ID;
  duplicateOf?: ID;
  importBatch?: string;
}

export interface Reconciliation {
  id: ID;
  entityId: ID;
  bankAccountId: ID;
  periodEnd: ISODate;
  statementClosing: number;
  bookClosing: number;
  difference: number;
  status: "reconciled" | "in_progress" | "difference";
  by: string;
  completedAt?: string;
  matchedCount: number;
}

export interface TaxCode {
  id: ID;
  entityId: ID;
  name: string;
  head: "CGST" | "SGST" | "IGST" | "GST" | "TDS";
  rate: number;
  type: "output" | "input" | "withholding";
  accountId: ID;
  active: boolean;
  section?: string;
}

export interface TdsRecord {
  id: ID;
  entityId: ID;
  vendorId: ID;
  billId: ID;
  billNo: string;
  section: string;
  baseAmount: number;
  rate: number;
  amount: number;
  date: ISODate;
  status: "deducted" | "deposited";
  challan?: string;
  depositDate?: ISODate;
  quarter: string;
}

export type AssetCategory = "Plant & Machinery" | "Office Equipment" | "Computers & IT" | "Furniture & Fixtures" | "Vehicles";
export interface FixedAsset {
  id: ID;
  entityId: ID;
  tag: string;
  name: string;
  category: AssetCategory;
  purchaseDate: ISODate;
  vendorId?: ID;
  invoiceRef?: string;
  cost: number;
  residual: number;
  usefulLifeYears: number;
  method: "SLM" | "WDV" | "DDB";
  location: string;
  department?: string;
  status: "active" | "disposed" | "transferred";
  assetAccountId: ID;
  disposal?: { date: ISODate; proceeds: number; gainLoss: number };
  transfers: { date: ISODate; from: string; to: string; by: string }[];
}

export interface BudgetLine { accountId: ID; monthly: number[] } // 12 values, fiscal-month order
export interface Budget {
  id: ID;
  entityId: ID;
  name: string;
  fiscalYear: string;
  scope: "annual" | "department" | "project";
  dimensionId?: ID;
  lines: BudgetLine[];
  status: "draft" | "active" | "closed";
  createdAt: string;
}

export interface Currency { code: string; name: string; symbol: string; locale: string; decimals: number }
export interface FxRate { id: ID; entityId: ID; currency: string; date: ISODate; rate: number; source: "manual" | "reference (sample)" }

export type ApprovalDocType = "journal" | "bill" | "expense" | "payment" | "period_close" | "adjustment";
export interface ApprovalRule {
  id: ID; entityId: ID; name: string; docType: ApprovalDocType; minAmount: number;
  approverRole: string; secondApproverRole?: string; enabled: boolean;
}
export interface ApprovalRequest {
  id: ID; entityId: ID; docType: ApprovalDocType; docId: ID; docRef: string; title: string; amount: number;
  requestedBy: string; requestedAt: string; status: "pending" | "approved" | "rejected"; approverRole: string;
  history: { at: string; by: string; action: "submitted" | "approved" | "rejected" | "commented"; comment?: string }[];
}

export type PermissionGroup = "dashboard" | "accounts" | "journals" | "banking" | "receivables" | "payables" | "expenses" | "tax" | "reports" | "settings" | "approvals";
export type PermissionAction = "view" | "create" | "edit" | "delete" | "approve";
export interface Role {
  id: ID; name: string; description: string; system: boolean;
  permissions: Record<PermissionGroup, PermissionAction[]>;
}
export interface AppUser { id: ID; entityId: ID; name: string; email: string; roleId: ID; status: "active" | "invited" | "disabled"; lastActive: string }

export interface FiscalYear { id: ID; entityId: ID; label: string; start: ISODate; end: ISODate; status: "open" | "closed" }
export interface AccountingPeriod { id: ID; entityId: ID; fyId: ID; name: string; start: ISODate; end: ISODate; status: "open" | "closed" | "locked" }

export interface DocumentFile {
  id: ID; entityId: ID; name: string; category: "Invoice" | "Receipt" | "Bank Statement" | "Contract" | "Tax" | "Journal Support" | "Other";
  size: number; mime: string; linkedType: string; linkedId?: ID; linkedRef?: string;
  uploadedBy: string; createdAt: string; modifiedBy: string; modifiedAt: string;
  previewText?: string; dataUrl?: string; simulated: true;
}

export interface AuditEntry {
  id: ID; entityId: ID; at: string; user: string; action: string; objectType: string; objectId: string; ref: string; detail: string;
}

export interface Dimension {
  id: ID; entityId: ID; kind: "department" | "costCenter" | "project"; code: string; name: string; owner: string;
  status: "active" | "inactive" | "completed"; budget: number; customerId?: ID; startDate?: ISODate; endDate?: ISODate;
}
export interface Allocation {
  id: ID; entityId: ID; date: ISODate; description: string; accountId: ID; amount: number; type: "expense" | "revenue";
  splits: { kind: "department" | "costCenter" | "project"; dimensionId: ID; percent: number }[]; createdBy: string;
}

export interface BankFeed {
  id: ID; entityId: ID; provider: string; bankName: string; status: "connected" | "syncing" | "reconnect_required" | "error" | "disconnected";
  accounts: string[]; lastSync?: string; errorMessage?: string;
  history: { id: ID; at: string; result: "success" | "failed" | "partial"; imported: number; message: string }[];
}

// ---- AI & automation (all simulated) ----
export interface CategorizationSuggestion {
  id: ID; entityId: ID; bankTxnId: ID; date: ISODate; description: string; amount: number; direction: "in" | "out";
  suggestedCategory: string; suggestedAccountId: ID; confidence: number; explanation: string;
  status: "pending" | "accepted" | "rejected" | "changed"; finalAccountId?: ID;
}
export interface JournalSuggestion {
  id: ID; entityId: ID; sourceType: string; sourceRef: string; sourceDescription: string; date: ISODate; amount: number;
  debitAccountId: ID; creditAccountId: ID; explanation: string; confidence: number;
  status: "pending" | "approved" | "rejected"; createdJournalId?: ID;
}
export interface MatchSuggestion {
  id: ID; entityId: ID; bankTxnId: ID; lineIds: ID[]; journalIds: ID[]; bookLabel: string; bookAmount: number; confidence: number;
  explanation: string; status: "pending" | "accepted" | "rejected";
}
export interface Anomaly {
  id: ID; entityId: ID; kind: "duplicate" | "unusual_amount" | "unexpected_movement" | "payment_pattern" | "missing_entry" | "reconciliation";
  severity: "high" | "medium" | "low"; title: string; description: string; refType: string; refId: string; refLabel: string; amount?: number;
  explanation: string; nextAction: string; status: "open" | "reviewed"; detectedAt: string;
}
export interface AgentTask {
  id: ID; title: string; description: string; requiresApproval: boolean; status: "proposed" | "approved" | "rejected" | "executed";
  items: { label: string; detail: string; amount?: number }[]; createdAt: string; impact: string;
}
export interface Agent {
  id: ID; entityId: ID; name: string; description: string; status: "idle" | "awaiting_approval" | "paused"; lastActivity: string;
  actions: string[]; tasks: AgentTask[]; history: { id: ID; at: string; text: string; outcome: "approved" | "rejected" | "executed" | "reviewed" | "info" }[];
}
export interface Automation {
  id: ID; entityId: ID; name: string; trigger: string; conditions: { field: string; operator: string; value: string }[]; action: string;
  status: "active" | "paused"; lastExecuted?: string; executions: { id: ID; at: string; result: "success" | "skipped" | "failed"; message: string }[];
}
export interface AppNotification { id: ID; entityId: ID; at: string; title: string; body: string; level: "info" | "warning" | "error" | "success"; href?: string }

export interface ConsolidationAdjustment {
  id: ID; entityId: "group"; description: string; section: "revenue" | "cogs" | "opex" | "other" | "finance"; amount: number; createdAt: string; createdBy: string;
}
