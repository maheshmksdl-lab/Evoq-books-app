"use client";
import { useParams } from "next/navigation";
import GeneralLedgerPage from "@/app/(app)/accounting/general-ledger/page";
import ExpenseReportsPage from "@/app/(app)/expenses/reports/page";
import { EmptyState } from "@/components/shared/states";
import { AccountSummaryView, AgeingView, BalanceSheetView, BankReconView, CashFlowView, JournalReportView, PnlView, TaxSummaryView, TrialBalanceView } from "@/components/features/report-views";
export default function ReportPage() {
  const { slug } = useParams<{ slug: string }>();
  switch (slug) {
    case "pnl": return <PnlView />;
    case "balance-sheet": return <BalanceSheetView />;
    case "cash-flow": return <CashFlowView />;
    case "trial-balance": return <TrialBalanceView />;
    case "general-ledger": return <GeneralLedgerPage />;
    case "account-summary": return <AccountSummaryView />;
    case "journal-report": return <JournalReportView />;
    case "bank-reconciliation": return <BankReconView />;
    case "expense-report": return <ExpenseReportsPage />;
    case "ar-ageing": return <AgeingView kind="ar" />;
    case "ap-ageing": return <AgeingView kind="ap" />;
    case "tax-summary": return <TaxSummaryView />;
    default: return <EmptyState title="Report not found" description={`No report named “${slug}”.`} />;
  }
}
