import { services } from "../src/services";
import { TODAY } from "../src/lib/constants";

// Dev utility: accrual vs cash basis checks. Run: npx tsx scripts/verify-basis.ts
(async () => {
  const E = "e1"; const from = "2026-04-01";
  const acc = await services.reports.pnl(E, { from, to: TODAY, basis: "accrual" });
  const cash = await services.reports.pnl(E, { from, to: TODAY, basis: "cash" });
  const dAcc = await services.reports.dashboard(E, { from, to: TODAY, basis: "accrual" });
  const dCash = await services.reports.dashboard(E, { from, to: TODAY, basis: "cash" });
  const ok = cash.current.totalRevenue < acc.current.totalRevenue && cash.current.totalRevenue > 0 && dCash.income !== dAcc.income && Math.abs(dCash.netProfit - cash.current.netProfit) < 0.01;
  console.log(`${ok ? "PASS" : "FAIL"}  cash basis P&L differs from accrual and ties to dashboard — revenue accrual ${acc.current.totalRevenue.toFixed(0)} vs cash ${cash.current.totalRevenue.toFixed(0)}; net ${acc.current.netProfit.toFixed(0)} vs ${cash.current.netProfit.toFixed(0)}`);
  if (!ok) process.exit(1);
})();
