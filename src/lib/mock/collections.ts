import type {
  Account, AccountingPeriod, Agent, Allocation, Anomaly, AppNotification, AppUser, ApprovalRequest, ApprovalRule, AuditEntry,
  Automation, BankAccount, BankFeed, BankTxn, Bill, Budget, CategorizationSuggestion, Contact, CreditNote, Dimension, DocumentFile,
  Entity, Expense, ExpenseCategory, FiscalYear, FixedAsset, FxRate, Invoice, Journal, JournalSuggestion, MatchSuggestion, Payment,
  Reconciliation, Role, TaxCode, TdsRecord, ConsolidationAdjustment,
} from "@/types";

export interface Collections {
  entities: Entity[];
  accounts: Account[];
  journals: Journal[];
  contacts: Contact[];
  invoices: Invoice[];
  bills: Bill[];
  payments: Payment[];
  creditNotes: CreditNote[];
  expenseCategories: ExpenseCategory[];
  expenses: Expense[];
  bankAccounts: BankAccount[];
  bankTxns: BankTxn[];
  reconciliations: Reconciliation[];
  taxCodes: TaxCode[];
  tdsRecords: TdsRecord[];
  assets: FixedAsset[];
  budgets: Budget[];
  fxRates: FxRate[];
  approvalRules: ApprovalRule[];
  approvals: ApprovalRequest[];
  roles: Role[];
  users: AppUser[];
  fiscalYears: FiscalYear[];
  periods: AccountingPeriod[];
  documents: DocumentFile[];
  audit: AuditEntry[];
  dimensions: Dimension[];
  allocations: Allocation[];
  bankFeeds: BankFeed[];
  catSuggestions: CategorizationSuggestion[];
  jvSuggestions: JournalSuggestion[];
  matchSuggestions: MatchSuggestion[];
  anomalies: Anomaly[];
  agents: Agent[];
  automations: Automation[];
  notifications: AppNotification[];
  consolidationAdjustments: ConsolidationAdjustment[];
}
export type CollectionName = keyof Collections;

export function emptyCollections(): Collections {
  const keys: CollectionName[] = [
    "entities", "accounts", "journals", "contacts", "invoices", "bills", "payments", "creditNotes", "expenseCategories", "expenses",
    "bankAccounts", "bankTxns", "reconciliations", "taxCodes", "tdsRecords", "assets", "budgets", "fxRates", "approvalRules", "approvals",
    "roles", "users", "fiscalYears", "periods", "documents", "audit", "dimensions", "allocations", "bankFeeds", "catSuggestions",
    "jvSuggestions", "matchSuggestions", "anomalies", "agents", "automations", "notifications", "consolidationAdjustments",
  ];
  return Object.fromEntries(keys.map((k) => [k, []])) as unknown as Collections;
}
