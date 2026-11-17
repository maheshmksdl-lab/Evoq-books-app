import {
  LayoutDashboard, BookOpenText, Landmark, HandCoins, ShoppingCart, ReceiptText, Percent, BarChart3, Layers, Sparkles, Settings,
  type LucideIcon,
} from "lucide-react";
import type { PermissionGroup } from "@/types";

export interface NavItem { label: string; href: string; keywords?: string; perm?: PermissionGroup }
export interface NavGroup { id: string; label: string; icon: LucideIcon; href?: string; items?: NavItem[]; section?: string }

export const NAV: NavGroup[] = [
  { id: "dashboard", label: "Dashboard", icon: LayoutDashboard, href: "/dashboard", section: "Overview" },
  { id: "accounting", label: "Accounting", icon: BookOpenText, section: "Books", items: [
    { label: "Chart of Accounts", href: "/accounting/chart-of-accounts", keywords: "accounts coa ledger accounts", perm: "accounts" },
    { label: "General Ledger", href: "/accounting/general-ledger", keywords: "gl transactions", perm: "accounts" },
    { label: "Journal Entries", href: "/accounting/journals", keywords: "journal voucher", perm: "journals" },
    { label: "Financial Periods", href: "/accounting/periods", keywords: "fiscal year period lock", perm: "accounts" },
    { label: "Closing", href: "/accounting/closing", keywords: "year end close retained earnings", perm: "accounts" },
    { label: "Contacts", href: "/accounting/contacts", keywords: "customers vendors masters", perm: "accounts" },
    { label: "Documents", href: "/accounting/documents", keywords: "attachments files receipts", perm: "accounts" },
    { label: "Audit Trail", href: "/accounting/audit-log", keywords: "history log", perm: "accounts" },
  ] },
  { id: "banking", label: "Banking", icon: Landmark, items: [
    { label: "Bank Accounts", href: "/banking/accounts", perm: "banking" },
    { label: "Transactions", href: "/banking/transactions", keywords: "statement import", perm: "banking" },
    { label: "Reconciliation", href: "/banking/reconciliation", keywords: "match", perm: "banking" },
    { label: "Bank Feeds", href: "/banking/feeds", keywords: "integration sync", perm: "banking" },
  ] },
  { id: "sales", label: "Sales & Receivables", icon: HandCoins, items: [
    { label: "Customers", href: "/receivables/customers", perm: "receivables" },
    { label: "Receivables", href: "/receivables/invoices", keywords: "invoices outstanding", perm: "receivables" },
    { label: "Customer Payments", href: "/receivables/payments", keywords: "receipts", perm: "receivables" },
    { label: "Credit Notes", href: "/receivables/credit-notes", perm: "receivables" },
    { label: "Customer Statements", href: "/receivables/statements", perm: "receivables" },
  ] },
  { id: "purchases", label: "Purchases & Payables", icon: ShoppingCart, items: [
    { label: "Vendors", href: "/payables/vendors", perm: "payables" },
    { label: "Bills", href: "/payables/bills", perm: "payables" },
    { label: "Payments", href: "/payables/payments", perm: "payables" },
    { label: "Vendor Credits", href: "/payables/credits", perm: "payables" },
    { label: "Vendor Statements", href: "/payables/statements", perm: "payables" },
  ] },
  { id: "expenses", label: "Expenses", icon: ReceiptText, items: [
    { label: "Expense List", href: "/expenses/list", perm: "expenses" },
    { label: "Categories", href: "/expenses/categories", perm: "expenses" },
    { label: "Approvals", href: "/expenses/approvals", perm: "expenses" },
    { label: "Expense Reports", href: "/expenses/reports", perm: "expenses" },
  ] },
  { id: "tax", label: "Tax", icon: Percent, items: [
    { label: "Tax Overview", href: "/tax/overview", perm: "tax" },
    { label: "GST", href: "/tax/gst", keywords: "cgst sgst igst", perm: "tax" },
    { label: "Input Tax Credit", href: "/tax/itc", keywords: "itc", perm: "tax" },
    { label: "TDS", href: "/tax/tds", perm: "tax" },
    { label: "Tax Reports", href: "/tax/reports", perm: "tax" },
    { label: "Compliance", href: "/tax/compliance", keywords: "gstr e-invoice e-way", perm: "tax" },
  ] },
  { id: "reports", label: "Reports", icon: BarChart3, section: "Insight", items: [
    { label: "Financial Statements", href: "/reports/financial-statements", keywords: "profit loss balance sheet cash flow", perm: "reports" },
    { label: "Accounting Reports", href: "/reports/accounting-reports", keywords: "trial balance ledger journal", perm: "reports" },
    { label: "Ageing Reports", href: "/reports/ageing-reports", keywords: "aging receivable payable", perm: "reports" },
    { label: "Tax Reports", href: "/reports/tax-reports", perm: "reports" },
    { label: "Custom Reports", href: "/reports/custom", perm: "reports" },
  ] },
  { id: "advanced", label: "Advanced Finance", icon: Layers, items: [
    { label: "Fixed Assets", href: "/advanced-finance/fixed-assets", keywords: "depreciation", perm: "accounts" },
    { label: "Multi-Currency", href: "/advanced-finance/multi-currency", keywords: "fx exchange", perm: "accounts" },
    { label: "Entities", href: "/advanced-finance/entities", keywords: "companies multi entity", perm: "settings" },
    { label: "Consolidation", href: "/advanced-finance/consolidation", keywords: "group", perm: "reports" },
    { label: "Approvals", href: "/advanced-finance/approvals", keywords: "workflow", perm: "approvals" },
    { label: "Budgets", href: "/advanced-finance/budgets", keywords: "forecast variance", perm: "reports" },
    { label: "Cost Centers", href: "/advanced-finance/cost-centers", keywords: "departments allocation", perm: "accounts" },
    { label: "Projects", href: "/advanced-finance/projects", keywords: "profitability", perm: "accounts" },
  ] },
  { id: "ai", label: "AI & Automation", icon: Sparkles, items: [
    { label: "AI Assistant", href: "/ai/assistant", keywords: "ask chat questions" },
    { label: "Insights", href: "/ai/insights", keywords: "cash flow forecast" },
    { label: "Transaction Categorization", href: "/ai/categorization", keywords: "suggested journals matching" },
    { label: "Document Extraction", href: "/ai/extraction", keywords: "ocr invoice" },
    { label: "Anomaly Detection", href: "/ai/anomalies", keywords: "duplicate fraud" },
    { label: "AI Agents", href: "/ai/agents" },
    { label: "Automation Rules", href: "/ai/automation" },
  ] },
  { id: "settings", label: "Settings", icon: Settings, section: "Configure", items: [
    { label: "Company Profile", href: "/settings/company", perm: "settings" },
    { label: "Financial Settings", href: "/settings/financial", perm: "settings" },
    { label: "Chart of Accounts Settings", href: "/settings/coa", perm: "settings" },
    { label: "Tax Settings", href: "/settings/tax", perm: "settings" },
    { label: "Currencies", href: "/settings/currencies", perm: "settings" },
    { label: "Users & Roles", href: "/settings/users", perm: "settings" },
    { label: "Approval Settings", href: "/settings/approvals", perm: "settings" },
    { label: "Integrations", href: "/settings/integrations", perm: "settings" },
    { label: "Appearance", href: "/settings/appearance", keywords: "theme colour" },
  ] },
];

export function findNav(pathname: string): { group?: NavGroup; item?: NavItem } {
  for (const g of NAV) {
    if (g.href && pathname.startsWith(g.href)) return { group: g };
    const item = g.items?.filter((i) => pathname === i.href || pathname.startsWith(i.href + "/")).sort((a, b) => b.href.length - a.href.length)[0];
    if (item) return { group: g, item };
  }
  return {};
}

export const ALL_NAV_ITEMS = NAV.flatMap((g) => (g.items ? g.items.map((i) => ({ ...i, group: g.label })) : [{ label: g.label, href: g.href!, group: g.label, keywords: "", perm: undefined as PermissionGroup | undefined }]));
