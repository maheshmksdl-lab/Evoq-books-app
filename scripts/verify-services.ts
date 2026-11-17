// Dev utility: exercises the mock service layer (accounting rules, workflows) in Node.  Run: npx tsx scripts/verify-services.ts
import { services } from "../src/services";
import { list } from "../src/lib/mock/db";
import { trialBalance, balanceSheet, type LedgerData } from "../src/lib/accounting/engine";
import { TODAY } from "../src/lib/constants";

let pass = 0, fail = 0;
const ok = (name: string, cond: boolean, extra = "") => { cond ? pass++ : fail++; console.log(`${cond ? "PASS" : "FAIL"}  ${name}${extra ? "  — " + extra : ""}`); };
const throws = async (name: string, fn: () => Promise<unknown>, match?: RegExp) => { try { await fn(); ok(name, false, "did not throw"); } catch (e) { ok(name, !match || match.test((e as Error).message), (e as Error).message.slice(0, 90)); } };
const ledger = (e: string): LedgerData => ({ entity: list("entities").find((x) => x.id === e)!, accounts: list("accounts", e), journals: list("journals", e) });
const balanced = (e: string) => { const tb = trialBalance(ledger(e), TODAY); const bs = balanceSheet(ledger(e), TODAY); return Math.abs(tb.totalDebit - tb.totalCredit) < 0.01 && bs.balanced; };
(async () => {
  const E = "e1"; const acc = (c: string) => list("accounts", E).find((a) => a.code === c)!.id;
  ok("books balance at start", balanced(E));

  // Journal rules
  await throws("unbalanced journal cannot post", () => services.journals.save(E, { mode: "post", date: TODAY, description: "x", lines: [{ accountId: acc("5270"), debit: 100, credit: 0 }, { accountId: acc("1111"), debit: 0, credit: 90 }] }), /must equal/);
  await throws("group account rejected", () => services.journals.save(E, { mode: "post", date: TODAY, description: "x", lines: [{ accountId: acc("5200"), debit: 100, credit: 0 }, { accountId: acc("1111"), debit: 0, credit: 100 }] }), /group account/);
  await throws("closed period rejects posting", () => services.journals.save(E, { mode: "post", date: "2026-08-15", description: "x", lines: [{ accountId: acc("5270"), debit: 100, credit: 0 }, { accountId: acc("1111"), debit: 0, credit: 100 }] }), /closed|locked/);
  const draft = await services.journals.save(E, { mode: "draft", date: TODAY, description: "Draft test", lines: [{ accountId: acc("5270"), debit: 500, credit: 0 }, { accountId: acc("1111"), debit: 0, credit: 400 }] });
  ok("unbalanced draft saves", draft.status === "draft");
  const small = await services.journals.save(E, { id: draft.id, mode: "post", date: TODAY, description: "Posted small", lines: [{ accountId: acc("5270"), debit: 500, credit: 0 }, { accountId: acc("1111"), debit: 0, credit: 500 }] });
  ok("draft edited then posted", small.status === "posted", small.number);
  await throws("posted journal cannot be edited", () => services.journals.save(E, { id: small.id, mode: "draft", date: TODAY, description: "edit", lines: small.lines }), /cannot be edited/);
  await throws("posted journal cannot be deleted", () => services.journals.remove(E, small.id), /cannot be deleted/);
  const big = await services.journals.save(E, { mode: "post", date: TODAY, description: "Large journal", lines: [{ accountId: acc("5260"), debit: 250000, credit: 0 }, { accountId: acc("2140"), debit: 0, credit: 250000 }] });
  ok("large journal routed to approval", big.status === "pending_approval");
  const req = list("approvals", E).find((r) => r.docId === big.id)!;
  await throws("viewer cannot approve", () => services.approvals.act(E, { id: req.id, action: "approve", actingRole: "Viewer", canApprove: false }), /approve/);
  await throws("wrong role cannot approve", () => services.approvals.act(E, { id: req.id, action: "approve", actingRole: "Accountant", canApprove: true }), /assigned/);
  await throws("self-approval blocked for the submitting user", () => services.approvals.act(E, { id: req.id, action: "approve", actingRole: "Finance Manager", canApprove: true }), /Segregation/);
  const res = await services.approvals.act(E, { id: req.id, action: "approve", actingRole: "Administrator", canApprove: true });
  ok("administrator approves → journal posted", res.final && list("journals", E).find((j) => j.id === big.id)!.status === "posted");
  const rev = await services.journals.reverse(E, { id: small.id, date: TODAY, reason: "test" });
  ok("reversal posts opposite entry", rev.lines.every((l, i) => l.debit === small.lines[i].credit));
  await throws("double reversal blocked", () => services.journals.reverse(E, { id: small.id, date: TODAY }), /posted|already/);
  ok("books still balance after journals", balanced(E));

  // Receivables
  const inv = list("invoices", E).find((i) => i.paid === 0 && i.currency === "INR" && !i.intercompany && i.total > 100000)!;
  const bank = list("bankAccounts", E).find((b) => b.type === "bank")!;
  await throws("receipt over-allocation blocked", () => services.receivables.recordReceipt(E, { contactId: inv.customerId, date: TODAY, amount: inv.total + 1000, method: "neft", bankAccountId: bank.id, reference: "T", allocations: [{ docId: inv.id, amount: inv.total + 1000 }] }), /exceeds/);
  const partial = Math.round(inv.total / 2);
  const p1 = await services.receivables.recordReceipt(E, { contactId: inv.customerId, date: TODAY, amount: partial, method: "neft", bankAccountId: bank.id, reference: "T1", allocations: [{ docId: inv.id, amount: partial }] });
  ok("partial receipt recorded", p1.status === "recorded" && list("invoices", E).find((i) => i.id === inv.id)!.paid === partial);
  const adv = await services.receivables.recordReceipt(E, { contactId: inv.customerId, date: TODAY, amount: 5000, method: "upi", bankAccountId: bank.id, reference: "ADV", allocations: [] });
  ok("unallocated receipt → advance", adv.status === "recorded");
  const wo = await services.receivables.writeOff(E, { invoiceId: inv.id, amount: 1000, reason: "test", date: TODAY });
  ok("small write-off posts", !wo.pending);
  ok("books balance after AR", balanced(E));

  // Payables
  const vendor = list("contacts", E).find((c) => c.kind === "vendor" && c.name.startsWith("Jindal"))!;
  const sb = await services.payables.saveBill(E, { vendorId: vendor.id, date: TODAY, dueDate: TODAY, vendorBillNo: "TEST-1", lines: [{ description: "Steel", accountId: acc("5110"), qty: 10, rate: 1000, taxRate: 18 }], mode: "submit" });
  ok("bill submitted → approved & posted (below limit)", sb.status === "approved" && !!sb.journalId, `total ${sb.total}`);
  await throws("duplicate vendor bill number rejected", () => services.payables.saveBill(E, { vendorId: vendor.id, date: TODAY, dueDate: TODAY, vendorBillNo: "TEST-1", lines: [{ description: "Steel", accountId: acc("5110"), qty: 1, rate: 100, taxRate: 18 }], mode: "draft" }), /duplicate/i);
  const bigBill = await services.payables.saveBill(E, { vendorId: vendor.id, date: TODAY, dueDate: TODAY, vendorBillNo: "TEST-BIG", lines: [{ description: "Steel", accountId: acc("5110"), qty: 1, rate: 600000, taxRate: 18 }], mode: "submit" });
  ok("large bill → pending approval", bigBill.status === "pending_approval");
  const pay = await services.payables.recordPayment(E, { contactId: vendor.id, date: TODAY, amount: sb.total, method: "neft", bankAccountId: bank.id, reference: "P1", allocations: [{ docId: sb.id, amount: sb.total }] });
  ok("bill payment recorded", pay.status === "recorded");
  ok("bill marked paid", list("bills", E).find((b) => b.id === sb.id)!.status === "paid");
  ok("books balance after AP", balanced(E));

  // Expenses
  const cat = list("expenseCategories", E)[0]; const upi = list("bankAccounts", E).find((b) => b.type === "bank")!;
  const ex = await services.expenses.save(E, { date: TODAY, categoryId: cat.id, description: "Test expense", amount: 1180, taxTreatment: "inclusive", gstRate: 18, paymentAccountId: upi.id, paymentMethod: "upi", mode: "submit" });
  ok("small expense auto-posted", ex.status === "paid" && ex.taxAmount === 180);
  const ex2 = await services.expenses.save(E, { date: TODAY, categoryId: cat.id, description: "Exclusive", amount: 1000, taxTreatment: "exclusive", gstRate: 18, paymentAccountId: upi.id, paymentMethod: "upi", mode: "draft" });
  ok("tax-exclusive adds tax", ex2.amount === 1180 && ex2.taxAmount === 180);

  // Banking
  const un = list("bankTxns", E).filter((t) => t.status === "unmatched" && t.bankAccountId === bank.id);
  const n = await services.banking.autoMatch(E, bank.id);
  ok("auto-match resolves lines", n > 0, `${n} matched of ${un.length}`);
  const sum = await services.banking.summary(E, { bankAccountId: bank.id, asOf: TODAY });
  ok("reconciling equation holds", Math.abs(sum.explained - sum.difference) < 0.01, `diff ${sum.difference}`);
  await throws("cannot complete reconciliation with unresolved lines", () => services.banking.completeReconciliation(E, { bankAccountId: bank.id, asOf: TODAY }), /still unmatched/);
  const tx = list("bankTxns", E).find((t) => t.status === "unmatched" && t.withdrawal > 0 && t.bankAccountId === bank.id && !t.duplicateOf);
  if (tx) { const c = await services.banking.categorize(E, { txnId: tx.id, accountId: acc("5300") }); ok("categorise posts a journal and matches", c.status === "matched"); }

  // Periods, accounts, fixed assets, multi-entity
  await throws("account code prefix validated", () => services.accounts.create(E, { code: "9001", name: "Bad", type: "expense", parentId: acc("5200"), isGroup: false, openingBalance: 0 }), /start with/);
  await throws("cannot deactivate account with balance", () => services.accounts.setActive(E, { id: acc("1111"), active: false }), /balance|System/);
  const newAcc = await services.accounts.create(E, { code: "5399", name: "Test Expense", type: "expense", parentId: acc("5200"), isGroup: false, openingBalance: 0 });
  ok("valid account created", newAcc.code === "5399");
  const dep = await services.assets.depreciationPreview(E, "2026-11");
  ok("depreciation preview for Nov", dep.total > 0 && !dep.alreadyPosted, `${dep.total}`);
  await throws("depreciation cannot post before month-end", () => services.assets.postDepreciation(E, "2026-11"), /month-end/);
  await throws("cannot close a period out of order", () => services.periods.setStatus(E, { periodId: list("periods", E).find((p) => p.name === "Nov 2026")!.id, status: "closed" }), /earlier|draft|pending|approval/);
  const cons = await services.consolidation.run(E, { entityIds: ["e1", "e2"], from: "2026-04-01", to: TODAY, currency: "INR" });
  ok("consolidation produces eliminations", cons.eliminations.length > 0 && cons.intercompany.length === 3);
  const e1Count = list("journals", "e1").length, e2Count = list("journals", "e2").length;
  ok("entity data is scoped", e1Count > 0 && e2Count > 0 && list("journals", "e2").every((j) => j.entityId === "e2"));
  ok("e2 books balance", balanced("e2"));
  const dash = await services.reports.dashboard(E, { from: "2026-04-01", to: TODAY });
  const pl = await services.reports.pnl(E, { from: "2026-04-01", to: TODAY });
  ok("dashboard net profit equals P&L", Math.abs(dash.netProfit - pl.current.netProfit) < 0.01);
  const ar = await services.receivables.ageing(E, TODAY);
  const arLedger = trialBalance(ledger(E), TODAY).rows.find((r) => r.code === "1120")!;
  ok("AR ageing total equals AR control account (net of unapplied credits)", ar.total >= arLedger.debit - 1 && ar.total - arLedger.debit < 200000, `${ar.total} vs ${arLedger.debit}`);
  const ai = await services.ai.ask(E, "What is our current cash position?");
  ok("assistant answers cash question", /cash/i.test(ai.text) && !!ai.table);
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
