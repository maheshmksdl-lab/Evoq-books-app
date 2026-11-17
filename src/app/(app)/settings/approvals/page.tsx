"use client";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { ApprovalRules } from "@/components/features/approvals";
import { Button } from "@/components/ui/button";
export default function Page() {
  return (<><PageHeader title="Approval Settings" description="Rules that decide when a document needs approval, how much, and by whom." actions={<Button size="sm" variant="outline" asChild><Link href="/advanced-finance/approvals">Open approval queue</Link></Button>} /><ApprovalRules /></>);
}
