// Dev utility: verifies the mock accounting dataset is internally consistent.  Run: npx tsx scripts/verify-seed.ts
import { buildSeed } from "../src/lib/mock/seed";
import { balanceSheet, cashFlow, profitAndLoss, trialBalance, type LedgerData } from "../src/lib/accounting/engine";
import { TODAY } from "../src/lib/constants";

const t0 = Date.now();
const s = buildSeed();
console.log("seed built in", Date.now() - t0, "ms");
for (const k of Object.keys(s) as (keyof typeof s)[]) console.log(k.padEnd(18), s[k].length);

for (const e of s.entities) {
  const d: LedgerData = { entity: e, accounts: s.accounts.filter((a) => a.entityId === e.id), journals: s.journals.filter((j) => j.entityId === e.id) };
  const unbalanced = d.journals.filter((j) => Math.abs(j.lines.reduce((a, l) => a + l.debit - l.credit, 0)) > 0.01);
  console.log(`\n== ${e.name} (${e.baseCurrency}) ==`);
  console.log("unbalanced journals:", unbalanced.length, unbalanced.slice(0, 3).map((j) => `${j.sourceRef}:${j.description}`));
  const tb = trialBalance(d, TODAY);
  console.log("TB", tb.totalDebit, tb.totalCredit, "diff", (tb.totalDebit - tb.totalCredit).toFixed(2));
  const bs = balanceSheet(d, TODAY);
  console.log("BS assets", bs.totalAssets, "L+E", bs.totalLiabilities + bs.totalEquity, "balanced", bs.balanced);
  const pl = profitAndLoss(d, e.fyStartMonth === 4 ? "2026-04-01" : "2026-01-01", TODAY);
  console.log("P&L FY-to-date revenue", pl.totalRevenue, "gross", pl.grossProfit, "net", pl.netProfit);
  const cf = cashFlow(d, e.fyStartMonth === 4 ? "2026-04-01" : "2026-01-01", TODAY);
  console.log("CF net change", cf.netChange, "opening", cf.openingCash, "closing", cf.closingCash, "diff", cf.difference);
  const arAcc = d.accounts.find((a) => a.code === "1120")!, apAcc = d.accounts.find((a) => a.code === "2110")!;
  const bal = (id: string) => d.journals.filter((j) => j.status === "posted").flatMap((j) => j.lines).filter((l) => l.accountId === id).reduce((x, l) => x + l.debit - l.credit, 0);
  const arSub = s.invoices.filter((i) => i.entityId === e.id && !i.intercompany).reduce((x, i) => x + (i.total - i.paid) * i.fxRate, 0);
  const cnOpen = s.creditNotes.filter((c) => c.entityId === e.id && c.kind === "customer" && c.status === "open").reduce((x, c) => x + c.amount, 0);
  console.log("AR ledger", bal(arAcc.id).toFixed(2), "sub-ledger (invoices - open CN)", (arSub - cnOpen).toFixed(2));
  const apSub = s.bills.filter((b) => b.entityId === e.id && b.journalId && !b.intercompany).reduce((x, b) => x + (b.total - b.tdsAmount - b.paid) * b.fxRate, 0);
  const vcnOpen = s.creditNotes.filter((c) => c.entityId === e.id && c.kind === "vendor" && c.status === "open").reduce((x, c) => x + c.amount, 0);
  console.log("AP ledger", (-bal(apAcc.id)).toFixed(2), "sub-ledger (bills - open VCN)", (apSub - vcnOpen).toFixed(2));
  const banks = s.bankAccounts.filter((b) => b.entityId === e.id && b.type === "bank");
  for (const b of banks) console.log(" bank", b.name, "statement", b.statementBalance, "book (movement)", bal(b.ledgerAccountId).toFixed(2));
}
