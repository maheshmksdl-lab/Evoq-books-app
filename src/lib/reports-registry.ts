export type ReportCategory = "financial-statements" | "accounting-reports" | "ageing-reports" | "tax-reports";

export interface ReportDef { slug: string; title: string; description: string; category: ReportCategory }

export const REPORTS: ReportDef[] = [
  { slug: "pnl", title: "Profit and Loss", description: "Income, cost of goods sold, expenses and net profit with comparative periods and drill-down.", category: "financial-statements" },
  { slug: "balance-sheet", title: "Balance Sheet", description: "Assets, liabilities and equity at a point in time, with computed retained earnings.", category: "financial-statements" },
  { slug: "cash-flow", title: "Cash Flow Statement", description: "Indirect-method cash flow reconciled to opening and closing cash.", category: "financial-statements" },
  { slug: "trial-balance", title: "Trial Balance", description: "Debit and credit balances of every account — totals must agree.", category: "accounting-reports" },
  { slug: "general-ledger", title: "General Ledger", description: "Account-wise ledger with running balances, filters and drill-down.", category: "accounting-reports" },
  { slug: "account-summary", title: "Account Summary", description: "Opening balance, movement and closing balance per account.", category: "accounting-reports" },
  { slug: "journal-report", title: "Journal Report", description: "All posted journals in a period, with type filter and line drill-down.", category: "accounting-reports" },
  { slug: "bank-reconciliation", title: "Bank Reconciliation", description: "Statement vs book balances and reconciling items for each bank account.", category: "accounting-reports" },
  { slug: "expense-report", title: "Expense Report", description: "Spending by category, month and payment method.", category: "accounting-reports" },
  { slug: "ar-ageing", title: "Accounts Receivable Ageing", description: "Customer balances bucketed by days past due.", category: "ageing-reports" },
  { slug: "ap-ageing", title: "Accounts Payable Ageing", description: "Vendor balances bucketed by days past due.", category: "ageing-reports" },
  { slug: "tax-summary", title: "Tax Summary", description: "Output and input tax by head with net payable.", category: "tax-reports" },
];

export const CATEGORY_META: Record<ReportCategory, { title: string; description: string }> = {
  "financial-statements": { title: "Financial Statements", description: "Primary statements for management, lenders and auditors." },
  "accounting-reports": { title: "Accounting Reports", description: "Ledger-level reports for review and reconciliation." },
  "ageing-reports": { title: "Ageing Reports", description: "Receivables and payables by age." },
  "tax-reports": { title: "Tax Reports", description: "Tax position derived from the books." },
};
