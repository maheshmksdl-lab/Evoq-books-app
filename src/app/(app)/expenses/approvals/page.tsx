"use client";
import { PageHeader } from "@/components/shared/page-header";
import { ApprovalsQueue } from "@/components/features/approvals";
export default function Page() {
  return (<><PageHeader title="Expense Approvals" description="Expense claims waiting for review. Approving posts the expense to the ledger." /><ApprovalsQueue docTypes={["expense"]} title="expense-approvals" /></>);
}
