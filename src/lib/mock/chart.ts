import type { Account, AccountType, CashFlowClass, Entity } from "@/types";

type Row = [code: string, name: string, type: AccountType, parent: string | null, isGroup: boolean, cf?: CashFlowClass, desc?: string];

const ROWS: Row[] = [
  ["1000", "Assets", "asset", null, true],
  ["1100", "Current Assets", "asset", "1000", true],
  ["1110", "Cash and Bank", "asset", "1100", true],
  ["1111", "HDFC Bank – Current A/c", "asset", "1110", false, "cash", "Primary operating account"],
  ["1112", "ICICI Bank – Operations A/c", "asset", "1110", false, "cash"],
  ["1113", "SBI – Collections A/c", "asset", "1110", false, "cash"],
  ["1114", "Petty Cash", "asset", "1110", false, "cash"],
  ["1120", "Accounts Receivable", "asset", "1100", false, "working_capital", "Control account — customer sub-ledger"],
  ["1130", "Inventory", "asset", "1100", false, "working_capital", "Periodic inventory (sample)"],
  ["1140", "GST Input Credit", "asset", "1100", true],
  ["1141", "CGST Input", "asset", "1140", false, "working_capital"],
  ["1142", "SGST Input", "asset", "1140", false, "working_capital"],
  ["1143", "IGST Input", "asset", "1140", false, "working_capital"],
  ["1150", "TDS Receivable", "asset", "1100", false, "working_capital"],
  ["1160", "Prepaid Expenses", "asset", "1100", false, "working_capital"],
  ["1170", "Employee Advances", "asset", "1100", false, "working_capital"],
  ["1180", "Intercompany Receivable", "asset", "1100", false, "working_capital"],
  ["1200", "Fixed Assets", "asset", "1000", true],
  ["1210", "Plant & Machinery", "asset", "1200", false, "investing"],
  ["1220", "Office Equipment", "asset", "1200", false, "investing"],
  ["1230", "Computers & IT", "asset", "1200", false, "investing"],
  ["1240", "Furniture & Fixtures", "asset", "1200", false, "investing"],
  ["1250", "Vehicles", "asset", "1200", false, "investing"],
  ["1290", "Accumulated Depreciation", "asset", "1200", false, "noncash", "Contra-asset (credit balance)"],
  ["2000", "Liabilities", "liability", null, true],
  ["2100", "Current Liabilities", "liability", "2000", true],
  ["2110", "Accounts Payable", "liability", "2100", false, "working_capital", "Control account — vendor sub-ledger"],
  ["2120", "GST Payable", "liability", "2100", true],
  ["2121", "CGST Payable", "liability", "2120", false, "working_capital"],
  ["2122", "SGST Payable", "liability", "2120", false, "working_capital"],
  ["2123", "IGST Payable", "liability", "2120", false, "working_capital"],
  ["2130", "TDS Payable", "liability", "2100", false, "working_capital"],
  ["2140", "Accrued Expenses", "liability", "2100", false, "working_capital"],
  ["2150", "HDFC Business Credit Card", "liability", "2100", false, "working_capital"],
  ["2160", "Customer Advances", "liability", "2100", false, "working_capital"],
  ["2170", "Intercompany Payable", "liability", "2100", false, "working_capital"],
  ["2200", "Long-term Liabilities", "liability", "2000", true],
  ["2210", "Term Loan – HDFC", "liability", "2200", false, "financing"],
  ["3000", "Equity", "equity", null, true],
  ["3100", "Share Capital", "equity", "3000", false, "financing"],
  ["3200", "Retained Earnings", "equity", "3000", false, "equity"],
  ["3300", "Opening Balance Equity", "equity", "3000", false, "equity", "System account for opening balances"],
  ["4000", "Income", "income", null, true],
  ["4100", "Operating Revenue", "income", "4000", true],
  ["4110", "Sales – Industrial Products", "income", "4100", false],
  ["4120", "Sales – Services & Installation", "income", "4100", false],
  ["4130", "Export Sales", "income", "4100", false],
  ["4190", "Sales Returns & Discounts", "income", "4100", false, undefined, "Contra-revenue (debit balance)"],
  ["4200", "Other Income", "income", "4000", true],
  ["4210", "Interest Income", "income", "4200", false],
  ["4220", "Foreign Exchange Gain", "income", "4200", false],
  ["4230", "Miscellaneous Income", "income", "4200", false],
  ["4240", "Gain on Asset Disposal", "income", "4200", false],
  ["5000", "Expenses", "expense", null, true],
  ["5100", "Cost of Goods Sold", "expense", "5000", true],
  ["5110", "Purchases – Raw Materials", "expense", "5100", false],
  ["5120", "Freight Inward", "expense", "5100", false],
  ["5130", "Direct Labour", "expense", "5100", false],
  ["5200", "Operating Expenses", "expense", "5000", true],
  ["5210", "Salaries & Wages", "expense", "5200", false],
  ["5220", "Rent", "expense", "5200", false],
  ["5230", "Utilities", "expense", "5200", false],
  ["5240", "Marketing & Advertising", "expense", "5200", false],
  ["5250", "Travel & Conveyance", "expense", "5200", false],
  ["5260", "Professional Fees", "expense", "5200", false],
  ["5270", "Office Supplies", "expense", "5200", false],
  ["5280", "Repairs & Maintenance", "expense", "5200", false],
  ["5290", "Insurance", "expense", "5200", false],
  ["5295", "Software Subscriptions", "expense", "5200", false],
  ["5300", "Bank Charges", "expense", "5200", false],
  ["5310", "Bad Debts", "expense", "5200", false],
  ["5320", "Telephone & Internet", "expense", "5200", false],
  ["5330", "Loss on Asset Disposal", "expense", "5200", false],
  ["5340", "Staff Welfare", "expense", "5200", false],
  ["5400", "Depreciation", "expense", "5000", true],
  ["5410", "Depreciation Expense", "expense", "5400", false],
  ["5500", "Finance Costs", "expense", "5000", true],
  ["5510", "Interest on Term Loan", "expense", "5500", false],
  ["5520", "Foreign Exchange Loss", "expense", "5500", false],
];

export const accId = (entityId: string, code: string) => `${entityId}-${code}`;

export function buildAccounts(entity: Entity, opening: Record<string, number>): Account[] {
  const flat = entity.taxRegime === "flat-gst";
  const rename: Record<string, string> = flat
    ? { "1143": "GST Input (9%)", "2123": "GST Payable (9%)", "1141": "CGST Input (n/a)", "1142": "SGST Input (n/a)", "2121": "CGST Payable (n/a)", "2122": "SGST Payable (n/a)" }
    : {};
  const byCode = new Map(ROWS.map((r) => [r[0], r]));
  const groupName = (code: string | null): string => {
    if (!code) return "";
    const r = byCode.get(code)!;
    return r[4] ? r[1] : groupName(r[3]);
  };
  return ROWS.map(([code, name, type, parent, isGroup, cf, desc]) => ({
    id: accId(entity.id, code),
    entityId: entity.id,
    code,
    name: rename[code] ?? name,
    type,
    group: parent ? groupName(parent) : "",
    parentId: parent ? accId(entity.id, parent) : null,
    isGroup,
    openingBalance: opening[code] ?? 0,
    currency: entity.baseCurrency,
    active: !(flat && ["1141", "1142", "2121", "2122"].includes(code)),
    system: ["1120", "2110", "3200", "3300", "1290", "1180", "2170", "2130"].includes(code) || (isGroup && code.endsWith("000")),
    description: desc,
    cashFlow: cf,
  }));
}
