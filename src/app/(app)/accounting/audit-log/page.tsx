"use client";
import * as React from "react";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable, type Column } from "@/components/shared/data-table";
import { SelectField } from "@/components/shared/form-controls";
import { SimNotice } from "@/components/shared/states";
import { useAudit } from "@/hooks/use-data";
import { formatDateTime, titleCase } from "@/lib/formatters";
import type { AuditEntry } from "@/types";
export default function Page() {
  const { data, isLoading, error, refetch } = useAudit(); const [type, setType] = React.useState("all");
  const types = [...new Set((data ?? []).map((a) => a.objectType))];
  const cols: Column<AuditEntry>[] = [
    { id: "at", header: "When", accessor: (a) => a.at, cell: (a) => formatDateTime(a.at) }, { id: "user", header: "User", accessor: (a) => a.user },
    { id: "action", header: "Action", accessor: (a) => a.action, cell: (a) => <span className="font-medium">{a.action}</span> }, { id: "type", header: "Object", accessor: (a) => titleCase(a.objectType), hideBelow: "md" },
    { id: "ref", header: "Reference", accessor: (a) => a.ref }, { id: "detail", header: "Detail", accessor: (a) => a.detail, hideBelow: "lg", className: "max-w-[320px] truncate" },
  ];
  return (<>
    <PageHeader title="Audit Trail" description="Who did what and when — journal postings, approvals, edits, period locks and settings changes." />
    <SimNotice className="mb-3" title="Mock audit log">Entries are generated from seeded history and from actions you perform in this demo. There is no server-side, tamper-proof log.</SimNotice>
    <DataTable columns={cols} data={(data ?? []).filter((a) => type === "all" || a.objectType === type)} rowKey={(a) => a.id} isLoading={isLoading} error={error as Error | null} onRetry={() => refetch()} exportName="audit-trail" defaultSort={{ id: "at", dir: "desc" }} searchPlaceholder="Search user, action, reference…" pageSize={20}
      filters={<SelectField size="sm" className="w-44" value={type} onChange={setType} options={[{ value: "all", label: "All objects" }, ...types.map((t) => ({ value: t, label: titleCase(t) }))]} />} />
  </>);
}
