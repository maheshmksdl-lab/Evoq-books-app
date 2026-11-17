"use client";
import * as React from "react";
import { PageHeader } from "@/components/shared/page-header";
import { Combobox } from "@/components/shared/form-controls";
import { EmptyState } from "@/components/shared/states";
import { StatementView } from "@/components/features/contacts";
import { useContactOptions } from "@/hooks/use-options";
import { Building2 } from "lucide-react";
export default function Page() {
  const opts = useContactOptions("vendor"); const [id, setId] = React.useState("");
  return (<>
    <PageHeader title="Vendor Statements" description="Statement of account for any vendor — bills, payments and the balance payable." actions={<div className="w-72"><Combobox value={id} onChange={setId} options={opts} placeholder="Select a vendor" /></div>} />
    {id ? <StatementView key={id} contactId={id} /> : <EmptyState icon={Building2} title="Choose a vendor" description="Pick a vendor to generate their statement." />}
  </>);
}
