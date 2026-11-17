# Zoho Books (India edition) — product walkthrough

Source: live walkthrough of `books.zoho.in` in the browser pane (organisation "Abc", an empty/new organisation, Nov 2026).
Scope: read-only navigation of the main modules. No data was created or changed. Settings, Documents, Payroll, Payments, Projects/Timesheet detail screens and individual report pages were **not** opened, so they are described only from the navigation list.

## 1. Application shell

| Area | What it has |
|---|---|
| Left rail (collapsed, icon + label) | Home, Items, Inventory, Sales, Purchases, Time Tracking, Banking, Accountant, Reports, Documents, then Zoho Payroll and Zoho Payments (sister products) |
| Top bar | Recent-items history, global search ("Search in Customers" — scope follows the active module), plan/trial label with Subscribe link, organisation switcher, global "+" quick-create, users/invite, notifications, settings (gear), profile, Zoho app launcher |
| Right rail | Help/chat, AI-assistant style icon, feature tours, feedback and marketplace shortcuts, floating "Need Assistance?" widget |
| Header strip | Greeting, organisation name, India helpline, language switch (English / हिन्दी) |

Navigation pattern: rail icons open a flyout with the module's lists; every list has a "+" shortcut to the *new* form. Routes are hash-based (`#/invoices`, `#/bills`, `#/accountant/chartofaccounts` …).

## 2. Module map

**Home** — tabs: *Dashboard*, *Getting Started*, *Recent Updates*.
Dashboard widgets: Total Receivables (current vs overdue bar), Total Payables (current vs overdue), Cash Flow (fiscal-year chart with opening cash, incoming, outgoing, closing cash), Income and Expense (accrual/cash toggle, taxes excluded), Top Expenses, Projects watchlist, Bank and Credit Cards, Account Watchlist. Period selector "This Fiscal Year" (Apr–Mar). Footer: mobile apps, related Zoho apps, help links, API docs.

**Items / Inventory** — Items, Inventory Adjustments (items with variants/product creation).

**Sales** — Customers, Quotes, Sales Orders, Invoices, Recurring Invoices, Delivery Challans, Payments Received, Credit Notes.

**Purchases** — Vendors, Expenses, Recurring Expenses, Purchase Orders, Bills, Recurring Bills, Payments Made, Vendor Credits.

**Time Tracking** — Projects, Timesheet.

**Banking** — connect bank/credit card feed or add manually; categorise and match fetched transactions (empty state offers "Skip" for businesses not using banking).

**Accountant** — Manual Journals, Bulk Update (accounts), Currency Adjustments, Chart of Accounts, Budgets, Transaction Locking.

**Reports** — Reports Center with Home / Favorites / Shared / My Reports / Scheduled Reports, "Create New Report", and an upsell to Zoho Analytics.

**Documents** — inbox for uploaded files/receipts.

## 3. Screen details observed

### Invoices (`#/invoices`)
Empty state with "New Invoice", "New Recurring Invoice", "Import Invoices", life-cycle explainer, and feature cards: brand templates, online payment gateway, customer portal (accept quotes, track invoices, pay).

### Expenses (`#/expenses`)
"Receipts Inbox" shortcut, record single/bulk expense, import, mileage-rate based expenses, convert expense to invoice for reimbursement; upsell to Zoho Expense add-on.

### Manual Journals
Create journal, import journals, journal **templates**, customisable layout, role/permission-controlled publishing. Banner promotes Zoho Practice for accounting firms.

### Chart of Accounts (Active/other views, "Find Accountants", New)
Columns: Account Name, Account Code, Account Type, Documents, Parent Account Name. Pre-loaded system accounts grouped by Zoho types:
- Assets: Other Current Asset (Sales to Customers (Cash), TDS Receivable, Prepaid Expenses, Advance Tax, Employee Advance), Cash (Petty Cash, Undeposited Funds), Accounts Receivable, Fixed Asset (Furniture and Equipment)
- Liabilities: Other Current Liability (Tax Payable, Employee Reimbursements, Opening Balance Adjustments, Unearned Revenue, TDS Payable), Accounts Payable, Non-Current Liability (Mortgages, Construction Loans), Other Liability (Dimension Adjustments)
- Equity: Investments, Distributions, Capital Stock, Dividends Paid, Retained Earnings, Drawings, Owner's Equity, Opening Balance Offset
- Income: Shipping Charge, Sales, General Income, Interest Income, Late Fee Income, Discount, Other Charges
- Expense: ~25 accounts incl. Advertising and Marketing, Bad Debt, Depreciation, Salaries and Employee Wages, Travel, Telephone, IT and Internet, Uncategorized, Credit Card Charges, Consultant Expense

### Transaction Locking
Lock dates configured **per module** — Sales, Purchases, Banking, Accountant — or "Lock All Transactions At Once". Locked dates block edit/delete of earlier transactions. A separate "restrict locking with negative stock" setting.

### Budgets
Create budgets by activity and compare against actuals (empty state, "Create Budget").

### Reports Center — 96 system reports in 18 categories
Business Overview (P&L, P&L Schedule III, Horizontal P&L, Cash Flow Statement, Balance Sheet, Horizontal BS, BS Schedule III, Business Performance Ratios, Cash Flow Forecasting, Movement of Equity) · Sales · Inventory · Inventory Valuation (FIFO, ABC, weighted average) · Receivables (AR Aging Summary/Details, Invoice Details, Customer Balance, Receivable Summary/Details …) · Retention · Payments Received · Recurring Invoices · Payables (Vendor Balance, AP Aging, Bill Details, Vendor Credit Details, Payments Made …) · Purchases and Expenses · Taxes · Banking · Projects and Timesheet · Accountant · Budgets · Currency · Activity · Automation.

### Banking
Empty state: "Connect Bank / Credit Card" or "Add Manually" (feeds list at `#/banking/feeds/bankslist`).

## 4. Dashboard KPIs in this organisation
Receivables ₹0.00, Payables ₹0.00, cash flow ₹0.00, no expenses, no bank accounts — the organisation has no transactions, so all charts are empty.

## 5. Observations relevant to EVOQ Books
- Zoho groups ledger tools under **Accountant** and keeps sales/purchase documents as separate flat lists; EVOQ Books groups by workflow area.
- Zoho locks transactions per module with a date; EVOQ Books uses period states (open/closed/locked) per accounting period.
- Zoho ships Schedule III (India) statement formats and a Cash Flow Forecasting report — EVOQ Books has a cash-flow insight screen but no Schedule III layout.
- Zoho offers quote → sales order → challan → invoice flows, inventory and time tracking; these are intentionally outside EVOQ Books' scope (EVOQ Billing / other products).
- Zoho's chart of accounts is a flat list with a "Parent Account Name" column; EVOQ Books shows an expandable hierarchy.

---

# Part 2 — Remaining screens (second pass)

Same method: read-only navigation, no records created or changed. Report pages other than Profit and Loss, the Payroll/Payments sister products and Settings sub-pages not listed below were not opened.

## 6. Sales documents (all empty states in this org)

| Module | Purpose / actions shown |
|---|---|
| Customers (`#/contacts`) | Multiple contact persons, multiple addresses, portal access, multi-currency transactions; create / import file |
| Quotes | Create, import; convert accepted quote to invoice; tracks viewed / accepted / declined |
| Sales Orders | Follow up a quote; convert to purchase order (low stock) or invoice; banner to receive vendor POs via **Bharat Connect** |
| Invoices | Create, import; brand templates; online payment gateway; customer portal |
| Recurring Invoices | Scheduled auto-send; auto or manual card charge; failure email to customer |
| Delivery Challans | Goods-in-transit document; convert to invoice; mark returned / partial returns |
| Payments Received | Record manually, auto-charge cards, payment gateways, send receipts; "Go to unpaid invoices" |
| Credit Notes | Refunds/credits applied to invoices, excess payments as credits; import |

## 7. Purchase documents

| Module | Purpose / actions shown |
|---|---|
| Vendors | Columns: Name, Company, Email, Work Phone, Payables (BCY), Unused Credits (BCY); "Update MSME Details"; one sample vendor |
| Expenses | Receipts Inbox, single/bulk record, mileage-rate expenses, convert expense to invoice; Zoho Expense add-on upsell |
| Recurring Expenses | Profiles that auto-generate expenses; history of generated expenses |
| Purchase Orders | Columns: Date, PO#, Reference#, Vendor, Status, Billed Status, Amount, Delivery Date. One sample PO: ISSUED, "Yet to be billed", flagged "Overdue by 25 days" |
| Bills | Create/import; apply credits; online payments; **landed cost allocation**; banner to receive bills via Bharat Connect |
| Recurring Bills | Auto-generate bills; view generated history |
| Payments Made | Record vendor payments; banner offering direct bank payment initiation with partner banks |
| Vendor Credits | Record vendor credit notes; apply to future bill payments; record refunds |

## 8. Inventory, Items, Time Tracking, Documents

- **Items** — columns Name, SKU, Purchase Description, Purchase Rate, Description, Rate, Stock on Hand, Usage Unit (one sample item).
- **Inventory Adjustments** — filter by type and period; link to FIFO Cost Lot Tracking Report.
- **Projects** — create projects, log time, invite staff and assign tasks, project budgets; Chrome extension timer.
- **Timesheet** — view by period / customer / project / user; log a day or a week; start/stop timer.
- **Documents → Inbox** — "Autoscan Documents": enable to capture data from receipts automatically.

## 9. Accountant tools and banking

- **Currency Adjustments** (Base Currency Adjustments) — Date, Currency, Exchange Rate, Gain or Loss, Notes; filter "This Month"; corrects exchange-rate fluctuations.
- **Bulk Update** — filter Invoices, Credit Notes, POs, Expenses, Bills, Vendor Credits and re-assign their accounts in bulk; warns of significant financial impact and recommends an accountant.
- **Banking → Connect** — partner-bank automatic feeds (PayPal, ICICI, HDFC, SBI, Kotak, Axis, HDFC / SBI / Amex credit cards) or add an account manually and import statements.

## 10. Profit and Loss report (the only report opened)

State lives in the URL (`cash_based`, `filter_by`, `from_date`, `to_date`, `show_rows`, `sort_column`, selected columns). Controls: date range (default This Month), report basis **Accrual / Cash**, account filter ("accounts without zero balance"), advanced filters by project fields, Table / Chart view, Compare With, Customize Report Columns, Export, Run Report. Sections: Operating Income, Cost of Goods Sold, **Gross Profit**, Operating Expense, **Operating Profit**, Non Operating Income / Expense, **Net Profit/Loss**, Other Comprehensive Income. Amounts in base currency (INR); all zero here.

## 11. Settings (`#/settings`)

Opens in its own shell with "Navigate To" (Alt+0), All Settings and Close Settings.

- **Organization** — Profile, Branding, Custom Domain, Locations, Networking, AI Control Center, Manage Subscription.
- **Users & Roles** — Users, Roles, User Preferences.
- **Taxes & Compliance** — Taxes, Direct Taxes, MSME Settings.
- **Setup & Configurations** — General, Currencies, Payment Terms, Opening Balances, Reminders, Customer Portal, Vendor Portal.
- **Customization** — Transaction Number Series, PDF Templates, Email and SMS Notifications, Reporting Tags, Web Tabs, Digital Signature.
- **Automation** — Workflow Rules, Workflow Actions, Workflow Logs, Schedules.
- **Module Settings** — one preferences page per module (Customers and Vendors, Items, Accountant, Banking, Projects, Timesheet, Inventory Adjustments, Customer/Vendor Payments, every sales and purchase module, Custom Modules).
- **Integrations & Marketplace** — Zoho Apps, WhatsApp, SMS, Bharat Connect, Uber for Business, Other Apps, Marketplace.
- **Developer Data** — Widgets, Incoming Webhooks, Connections, API Usage, Signals, Data Management, Deluge Components Usage, Web Forms.

### Settings pages opened

- **Organization Profile** — logo, name, industry, location (India, Keralam), address format, primary contact, email sending (public-domain senders go via the Zoho Books sender), **base currency INR**, **fiscal year April–March**, **report basis Accrual/Cash**, language, time zone IST, date format dd/MM/yyyy, company ID and extra address fields. Shared with Zoho Billing / Inventory when the same org exists there.
- **Tax Settings** — tabs Tax Rates and GST Settings; "Is your business registered for GST?" is **No**.
- **Roles** — Admin (unrestricted), Staff (all except reports, settings, accountant), Staff (Assigned Customers Only), TimesheetStaff; New Role for custom roles.
- **Users** — one Super Admin; Invite User / Invite Accountant.
- **Currencies** — 12 enabled (AED, AUD, BND, CAD, CNY, EUR, GBP, INR base, JPY, SAR, USD, ZAR); New Currency; toggle exchange-rate feeds.
- **Opening Balances** — migration date; Accounts Receivable / Payable and Asset, Expense, Bank, Liability, Equity, Income sections; import; an Opening Balance Adjustments account holds the debit/credit difference; pre-migration checklist (trial balance, bank accounts, items, contacts).
- **Accountant preferences** — tabs: Default Account Tracking, Journal Approvals, Journal Validation Rules, Chart of Accounts Validation Rules, Journal Record Locking, Journal Fields, Chart of Accounts Fields. Options: mandatory unique account codes; default account for exchange gain/loss (one account or separate income/expense); default account for exchange-rounding adjustments.
- **Transaction Number Series** — per-module prefix, start number, restart rule, preview (INV-000001, CN-00001, PO-00002, QT-000001, SO-00001, DC-00001, BOS-000001, CDN-000001, RET-00001, RMA-00001, SUB-00001; journals and payments are unprefixed); options for multiple series and preventing duplicate numbers.
- **Invoice preferences** — tabs Preferences, Approvals, Fields, Validation Rules, Record Locking, Buttons, Related Lists; allow editing sent invoices, receipt in PDF, order-number source, online-payment notifications, invoice QR code, hide zero-value lines, default terms and customer notes.
- **Workflow Rules** — daily usage caps (1000 functions, 1000 webhooks, 500 email alerts), module/status filters, execution order; none configured.
- **AI Control Center** — Zia built in; bring-your-own-key connections for OpenAI and Gemini.

## 12. Additional observations for EVOQ Books

- Zoho configures nearly every module through the same tabs (Preferences, Approvals, Fields, Validation Rules, Record Locking) — a consistent pattern worth mirroring.
- Approvals, validation rules and record locking are per module in Zoho; EVOQ Books has one central approval-rule list and period locking.
- Zoho has an explicit Opening Balances migration wizard with a balancing adjustment account; EVOQ Books seeds opening balances on accounts.
- Foreign currency is split between manual Currency Adjustments and default gain/loss accounts in settings; EVOQ Books previews unrealised gain/loss on one screen.
- Zoho has 96 system reports with accrual/cash basis, compare-with, column customisation, and scheduled / shared / favourite collections — the main feature gaps versus EVOQ Books reports.
- Ecosystem hooks: Bharat Connect, WhatsApp / SMS, Zoho Payments / Payroll, Marketplace, and a developer space (webhooks, Deluge functions, widgets, API usage).
