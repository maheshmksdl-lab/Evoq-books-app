"use client";
import { PageHeader } from "@/components/shared/page-header";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ApprovalRules, ApprovalsQueue } from "@/components/features/approvals";
export default function Page() {
  return (<><PageHeader title="Approvals" description="Configurable approval workflows for journals, bills, expenses, payments, period closing and adjustments." />
    <Tabs defaultValue="queue"><TabsList><TabsTrigger value="queue">Requests</TabsTrigger><TabsTrigger value="rules">Approval rules</TabsTrigger></TabsList>
      <TabsContent value="queue" className="mt-3"><ApprovalsQueue /></TabsContent><TabsContent value="rules" className="mt-3"><ApprovalRules /></TabsContent></Tabs></>);
}
