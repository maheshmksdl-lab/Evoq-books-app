"use client";
import * as React from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Combobox } from "@/components/shared/form-controls";
import { EmptyState } from "@/components/shared/states";
import { StatementView } from "@/components/features/contacts";
import { useContactOptions } from "@/hooks/use-options";
import { Users } from "lucide-react";
export default function Page() {
  const opts = useContactOptions("customer"); const [id, setId] = React.useState("");
  return (<>
    <PageHeader title="Customer Statements" description="Statement of account for any customer — transactions, running balance and amount due." actions={<div className="w-72"><Combobox value={id} onChange={setId} options={opts} placeholder="Select a customer" /></div>} />
    {id ? <StatementView key={id} contactId={id} /> : <EmptyState icon={Users} title="Choose a customer" description="Pick a customer to generate their statement." />}
  </>);
}
