# EVOQ Books — UI/UX refinement report

Nothing was committed, pushed or deployed. Accounting code, services and mock data were not modified (verified below).

## 1. Theme: EVOQ Modern Light (new default)
Reference review: Billing, Booking and Inventory all use a near-white page (`#f8f9fb`), white panels and sidebar, hairline borders (`#e9eaf0`), a tinted active item with a 3 px brand bar, and brand colour limited to actions, icons and highlights. Modern Light follows that pattern with Books' own violet identity.

| Role | Hex |
|---|---|
| Depth | `#35243F` |
| Primary | `#654477` |
| Action | `#7A5791` |
| Hover | `#533665` |
| Soft | `#C9B4D6` |
| Tint | `#F1E9F5` |
| Surface | `#FAF7FC` |

Neutrals (`#F8FAFC`, `#E6EAF0`, `#1F2430`, `#5F6B7A`, `#9BA8B7`) and semantic colours are unchanged. Brand colour appears only in active states, buttons, icons, chips and chart series.
The four existing themes are untouched and selectable; they keep a dark sidebar. Modern Light is the default for new visitors (saved choices are kept).

## 2. Sidebar and navigation
- Navigation reads new `--sb-*` tokens, so one component renders light chrome (Modern Light) or dark chrome (legacy themes).
- White sidebar, hairline border, tinted active row with left brand bar, brand-coloured active icon, muted idle icons (all Lucide), small uppercase section labels, indented child lists with a guide line.
- Desktop ≥1024 px: expandable 256 px rail with collapse toggle. Tablet 768–1023 px: automatic 64 px icon rail with tooltips and flyout menus. Phone: drawer from the top-bar menu button.
- Fixed a contrast bug found during testing: the "Books" wordmark was dark-on-dark in legacy themes.

## 3. Dashboard
Cleaner cards (rounded-xl, hairline border, soft shadow), tinted icon chips, larger tabular figures, consistent card heights, KPI row switches to 3 columns below 1536 px so hints no longer truncate, legends moved to the top-right of charts, panel headers and spacing unified. All widgets, drill-downs, accrual/cash toggle and widget visibility remain. The same card/panel/table styling applies on every module.

## 4. Login
- URL: `/login` (also `/forgot-password`). Unauthenticated visits to any app route redirect here and return after sign-in.
- **Demo only — not secure authentication.** The check runs in the browser; labelled as such on the page.
- Demo email/username: `demo@evoqbooks.example` (or `demo`)
- Demo password: `EvoqDemo#2026`
- Role: Finance Manager (signs in as the sample user "Meera Iyer"; other roles via the profile menu simulation)
- Features: logo, show/hide password, Remember me (localStorage vs sessionStorage), forgot-password flow (simulated, no email), field validation, invalid-credential error, loading state, "Fill demo credentials" helper, illustration panel (inline SVG), responsive (panel hidden below 1024 px). Sign out is in the profile menu.
- The password is stored only as a SHA-256 digest in source; it is published here and on the login page because it is a demo credential. No real credentials exist.

## 5. Search
**Root cause of the click bug:** shadcn's `CommandDialog` does not wrap its children in cmdk's `<Command>`. The old search put `CommandInput`/`CommandItem` directly inside it, so on first click they ran outside cmdk's context and threw `Cannot read properties of undefined (reading 'subscribe')`, which unmounted the whole route ("This page couldn't load"). It was not CSS, z-index or event bubbling.

Fix: replaced the modal with an inline combobox (`components/layout/global-search.tsx`) built on a real `<Command>`. Width up to 640 px (≈540 px measured at 1440), placeholder "Search pages, accounts, customers, invoice numbers…", hover/focus ring, results panel with groups (Pages, Accounts, Customers & vendors, Invoices, Bills) and a key-hint footer. Substring ranking (word-start first) replaces fuzzy matching. Below 768 px it collapses to an icon that expands to a full-width bar. A route-level error boundary (`(app)/error.tsx`) now prevents any future crash from blanking the app.

Verified in the browser: opens on click; stays open while typing and on inside clicks; ↑/↓ selects; Enter navigates; Esc closes; outside click closes; Ctrl+K opens and focuses; no console errors.

## 6. Profile images
Sixteen 128×128 professional headshots (~4 KB each, ~60 KB total) copied from the EVOQ Booking app's local assets into `public/avatars`. `UserAvatar` / `PersonCell` / `ByLine` give a fixed size, circular crop, lazy loading and an initials fallback; names map to photos deterministically (explicit for the sample team, hashed for others), so photos differ per person. Applied to: profile menu, Users table, approvals (requester + history), journal/bill/expense history timelines and "created/posted by" fields, journals list, audit trail, documents, expenses, department/project owners, AI chat, login page. Customers and vendors are businesses, so they keep initials rather than personal photos. No real user data or photos were replaced.

## 7. Routes updated
All 75 routes (app shell, topbar, cards, tables, dialogs, charts, forms) pick up the new styling through shared components; the login and forgot-password routes are new.

## 8. Theme switching and persistence
All five themes applied immediately (sidebar colour and `--primary` checked per theme); selection stored in `localStorage`; Petrol stayed active after reload and navigation; the init script sets the theme before first paint. Appearance page previews now show a light-chrome preview for Modern Light.

## 9. Responsive
- Overflow check at 1920, 1366, 768, 375 and 320 px on 16 key routes (dashboard, chart of accounts, journal editor, reconciliation, invoices, bill form, P&L, balance sheet, consolidation, budgets, assistant, appearance, users, tax overview, expenses, documents): **0 horizontal overflows**. 1440 px: all 75 routes load with no overflow.
- Login at 320/375/768/1366/1920 px: no overflow; illustration panel appears from 1024 px.
- Dialog sizing and table usability were not re-measured beyond overflow checks.

## 10. Quality gates
| Check | Result |
|---|---|
| TypeScript | clean |
| ESLint | 0 errors, 37 warnings (unused variables etc.) |
| Service tests | 45 / 45 pass |
| Cash-basis check | pass |
| Seed verification | all journals balanced; TB and BS balanced; AR/AP match sub-ledgers (figures identical to before) |
| Production build | passes, 70 static pages |
| Runtime audit | 75 routes, no errors, no error screens, light sidebar on every route |

## 11. Remaining issues and limitations
- **Screenshot gallery not produced as files.** The browser pane cannot save images into the project; before/after screens were only viewed during testing.
- Visual review was limited to the dashboard, chart of accounts, login and the theme previews; other screens were checked programmatically (errors, overflow, sidebar colour), not by eye.
- Light-chrome screens in the legacy themes still show white content on a dark sidebar by design.
- Demo authentication is not secure and the route guard is client-side only.
- Mobile dialogs/tables rely on the existing responsive components; no per-dialog viewport measurements were taken.
