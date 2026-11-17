# Zoho Books vs EVOQ Books — feature comparison and gaps

Basis: the Zoho walkthrough in `zoho-books-walkthrough.md` (India edition, empty trial org — features were read from screens, not exercised) and the EVOQ Books frontend as built. Zoho screens I did not open (Payroll, Payments, most reports, many settings pages) are marked *unverified*.

Legend: ✅ covered · 🟡 partial / simulated · ❌ not in EVOQ Books · ➖ deliberately out of scope (belongs to another EVOQ product or the brief excludes it)

## 1. Coverage by area

| Area | Zoho Books | EVOQ Books | Status |
|---|---|---|---|
| Dashboard | Receivables/payables, cash flow, income & expense (accrual/cash toggle), top expenses, projects, bank watchlist, account watchlist | KPIs, income vs expense, cash flow, ageing, vendor payments, recent txns, unreconciled, tax, FY, widget show/hide | ✅ (no accrual/cash toggle, no account watchlist, no top-expenses widget) |
| Chart of accounts | Flat list, parent column, ~55 system accounts, bulk update, validation rules | Hierarchy, expand/collapse, validation, import/export, drill-down | ✅ |
| Manual journals | Templates, import, approvals, validation rules, record locking, custom fields | Draft/pending/posted, reversal, recurring templates, attachments, audit | 🟡 no journal import, no custom fields |
| General ledger / reports | 96 system reports | 12 + custom builder | 🟡 see §2 |
| Transaction locking | Per module (Sales/Purchases/Banking/Accountant) or all | Per accounting period (open/closed/locked) | 🟡 different model; no per-module lock |
| Banking | Live feeds (named banks), rules, categorise/match | Simulated feeds, reconciliation workspace, multi-match, duplicates | 🟡 no bank rules, no PayPal/card feeds |
| Customers / vendors | Contact persons, multiple addresses, portal, MSME, multi-currency | Accounting-focused master, GSTIN/PAN, ledger link, statements | 🟡 no contact persons / extra addresses / MSME |
| Invoicing, quotes, sales orders, challans, recurring invoices | Full sales workflow | Receivables only, integration-sourced sample invoices | ➖ (EVOQ Billing) |
| Payments received / credit notes | Yes, gateways, refunds | Receipts with allocation, credit notes, write-off, adjustments | 🟡 no refunds, no gateway |
| Bills / payments made / vendor credits | Yes, landed cost, recurring bills, direct bank payment | Bills, partial payments, TDS, credits, ageing | 🟡 no recurring bills, landed cost, purchase orders, vendor refunds |
| Expenses | Receipts inbox, mileage, recurring, convert to invoice | Categories, tax treatment, receipts, recurring, approvals | 🟡 no mileage, no receipts inbox, no billable expenses |
| Tax (India) | GST settings, tax rates, direct taxes, MSME, filing add-ons | GST/ITC/TDS tracking, calculators, compliance placeholders | 🟡 no GSTR filing/e-invoice/e-way (placeholders by design) |
| Multi-currency | Currencies, feeds, base-currency adjustment journals | Rates, balances, unrealised/realised preview | 🟡 preview only — cannot post a revaluation journal |
| Budgets | Budget vs actual | Annual/dept/project, variance, forecast | ✅ |
| Fixed assets | Not seen in navigation (add-on / unverified) | Register, depreciation, disposal, transfer | ✅ (EVOQ ahead) |
| Multi-entity / consolidation | Separate orgs; consolidation not seen | Entities, consolidation, eliminations | ✅ (EVOQ ahead) |
| Approvals | Per-module approval tabs | Central rules, queue, two-level, role simulation | ✅ |
| Projects / timesheets | Yes | Dimensions (dept, cost center, project) | ➖ time tracking out of scope; 🟡 project accounting only |
| Inventory / items | Items, stock, adjustments, FIFO, valuation reports | None (periodic inventory account only) | ➖ |
| Documents | Inbox with Autoscan | Document list, simulated extraction | 🟡 |
| AI | Zia, bring-your-own OpenAI/Gemini | Simulated assistant, agents, anomalies, insights | ✅ (EVOQ ahead in scope; all simulated) |
| Automation | Workflow rules, actions, logs, schedules, webhooks, Deluge | Automation rules with history | 🟡 no webhooks/custom functions |
| Users & roles | Admin/Staff/custom roles, accountant invite | 5 roles + custom, permission matrix | ✅ UI only |
| Customisation | Number series, PDF templates, email/SMS templates, custom fields, reporting tags, web tabs, digital signature | None | ❌ |
| Portals | Customer and vendor portal | None | ❌ ➖ |
| Integrations / developer | Marketplace, WhatsApp, SMS, API, webhooks | Placeholders | ❌ |
| Opening balances | Guided migration wizard + adjustment account | Opening balances on accounts, read-only list | 🟡 no wizard / import |
| Platform | Mobile apps, Chrome timer, languages (English/हिन्दी), Windows app | Responsive web, English only | ❌ |

## 2. Report gaps (Zoho has 96; EVOQ Books has 12 + custom)

Present in both: Profit & Loss, Balance Sheet, Cash Flow, AR/AP ageing, Trial Balance, Journal/ledger, Tax summary, Expense report, Bank reconciliation.

Missing in EVOQ Books (names from Zoho's list; many *unverified* beyond titles):
- **Statement formats:** P&L / Balance Sheet **Schedule III**, Horizontal P&L, Horizontal Balance Sheet, Movement of Equity.
- **Analysis:** Business Performance Ratios, Cash Flow Forecasting as a report (EVOQ has it only as an AI insight).
- **Sales:** by Customer / Item / Salesperson, Sales Summary, Profit by Item.
- **Receivables detail:** AR Aging *Details*, Invoice Details, Customer Balance Summary, Receivable Summary/Details, Time to Get Paid, Refund History.
- **Payables detail:** Vendor Balance Summary, AP Aging *Details*, Bill Details, Vendor Credit Details, Purchase Order Details.
- **Inventory** (≈12 reports) and **Projects/Timesheet** reports.
- **Report mechanics:** accrual vs cash basis toggle, saved/favourite/shared reports, scheduled report delivery, column customisation, URL-persisted filters, report categories for Retention/Activity/Automation.

## 3. Cross-cutting gaps

1. **Accrual/cash reporting basis** — Zoho sets it org-wide and per report; EVOQ Books is accrual only.
2. **Per-module configuration tabs** — Preferences, Approvals, Fields, Validation Rules, Record Locking, Buttons, Related Lists exist for each Zoho module; EVOQ Books has one global approvals list and a few entity switches.
3. **Custom fields and reporting tags** — none in EVOQ Books (dimensions cover department/cost center/project only).
4. **Document numbering control** — Zoho lets admins edit prefixes, start numbers and multiple series; EVOQ Books auto-numbers with fixed prefixes.
5. **Templates** — PDF, email and SMS templates and digital signature absent.
6. **Recurring transactions** — Zoho covers invoices, bills and expenses; EVOQ Books covers journals and expenses only (no recurring bills).
7. **Import** — Zoho imports for almost every module; EVOQ Books simulates imports for accounts, contacts and bank statements only.
8. **Revaluation posting** — Zoho posts base-currency adjustments; EVOQ Books previews unrealised gain/loss without a posting action.
9. **Bank rules** — no auto-categorisation rules engine (EVOQ Books has simulated AI suggestions instead).
10. **Real backend capabilities** — authentication, real file storage, email/SMS delivery, live bank/GST connectivity, payment gateways: all out of scope in this frontend build but present in Zoho.

## 4. Where EVOQ Books is ahead

- Fixed-asset register with depreciation schedules and disposal journals.
- Multi-entity books with consolidation, intercompany elimination preview and entity switching.
- Central approval engine with two-level approvals and segregation-of-duties simulation.
- Department / cost-center / project allocation and profitability reports.
- AI-assisted categorisation, journal suggestions, bank matching, anomaly detection, cash insights and agents (simulated, with mandatory human approval).
- Theme system (four product themes) and a hierarchical chart of accounts.
- Bank reconciliation workspace with multi-match and an explicit reconciling equation.

## 5. Suggested priorities

| Priority | Gap | Why |
|---|---|---|
| High | Accrual/cash basis toggle on reports | Core Indian accounting expectation; Zoho exposes it everywhere |
| High | Schedule III P&L and Balance Sheet | Statutory presentation for Indian companies |
| High | Revaluation / base-currency adjustment posting | Completes the multi-currency loop |
| Medium | Detail reports (AR/AP aging details, bill/vendor details, customer balance) | Frequently used drill-downs |
| Medium | Recurring bills, purchase orders (if in scope) | Closes purchases lifecycle |
| Medium | Saved, scheduled and shared reports | Reporting workflow parity |
| Medium | Editable number series and per-module settings tabs | Admin configurability |
| Low | Custom fields / reporting tags | Needs data-model support |
| Low | Opening balance wizard / imports | Migration experience |
| Out of scope for now | Inventory, quotes/orders/challans, time tracking, portals, marketplace/webhooks | Belong to other EVOQ products or a backend phase |
