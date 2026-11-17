"use client";

import * as React from "react";
import Link from "next/link";
import { Landmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable, type Column } from "@/components/shared/data-table";
import { SelectField } from "@/components/shared/form-controls";
import { SimNotice } from "@/components/shared/states";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { useConfirm } from "@/components/shared/confirm";
import { useEntityMutation, useTds } from "@/hooks/use-data";
import { useFormat } from "@/providers/app-provider";
import { services } from "@/services";
import { formatDate } from "@/lib/formatters";

export default function TdsPage() {
  const f = useFormat(); const confirm = useConfirm(); const { data, isLoading, error, refetch } = useTds(); const [sel, setSel] = React.useState<string[]>([]); const [sec, setSec] = React.useState("all"); const [st, setSt] = React.useState("all");
  const deposit = useEntityMutation((e, ids: string[]) => services.tax.depositTds(e, ids), { success: (r) => `Challan ${r.challan} recorded (simulated)`, onDone: () => setSel([]) });
  const all = data ?? []; const rows = all.filter((t) => (sec === "all" || t.section === sec) && (st === "all" || t.status === st));
  const sections = [...new Set(all.map((t) => t.section))]; const total = (s: string) => all.filter((t) => t.status === s).reduce((x, t) => x + t.amount, 0);
  type T = (typeof all)[number];
  const cols: Column<T>[] = [
    { id: "d", header: "Deducted on", accessor: (t) => t.date, cell: (t) => formatDate(t.date) }, { id: "v", header: "Vendor", accessor: (t) => t.vendorName, className: "max-w-[220px] truncate" }, { id: "b", header: "Bill", accessor: (t) => t.billNo, cell: (t) => <Link href={`/payables/bills/${t.billId}`} className="text-primary hover:underline">{t.billNo}</Link>, hideBelow: "md" },
    { id: "s", header: "Section", accessor: (t) => t.section }, { id: "q", header: "Quarter", accessor: (t) => t.quarter, hideBelow: "lg" }, { id: "base", header: "Base amount", align: "right", accessor: (t) => t.baseAmount, cell: (t) => f.money(t.baseAmount), hideBelow: "md" },
    { id: "r", header: "Rate", align: "right", accessor: (t) => t.rate, cell: (t) => `${t.rate}%`, hideBelow: "lg" }, { id: "a", header: "TDS", align: "right", accessor: (t) => t.amount, cell: (t) => f.money(t.amount) },
    { id: "st", header: "Status", accessor: (t) => t.status, cell: (t) => <StatusBadge status={t.status} /> }, { id: "ch", header: "Challan", accessor: (t) => t.challan ?? "", hideBelow: "lg", className: "tnum text-xs" },
  ];
  return (<>
    <PageHeader title="TDS" description="Tax deducted at source on vendor payments. Track deductions and record deposits." actions={<Button size="sm" disabled={!sel.length || deposit.isPending} onClick={async () => { if (await confirm({ title: `Deposit ${sel.length} TDS records?`, description: "Posts Dr TDS Payable / Cr Bank with a simulated challan reference. Nothing is paid to the tax authority.", confirmLabel: "Record deposit" })) deposit.mutate(sel); }}><Landmark /> Record deposit ({sel.length})</Button>} />
    <SimNotice className="mb-3" title="Simulated">Challans and deposits are recorded in the mock books only. TDS returns (24Q/26Q) are not generated.</SimNotice>
    <div className="mb-3 grid grid-cols-2 gap-3 lg:grid-cols-4"><StatCard label="Deducted, not deposited" value={f.money(total("deducted"))} valueClassName={total("deducted") ? "text-[color-mix(in_srgb,var(--s-warning)_50%,black)]" : undefined} /><StatCard label="Deposited" value={f.money(total("deposited"))} /><StatCard label="Records" value={String(all.length)} /><StatCard label="Sections" value={sections.join(" · ") || "—"} /></div>
    <DataTable columns={cols} data={rows} rowKey={(t) => t.id} isLoading={isLoading} error={error as Error | null} onRetry={() => refetch()} exportName="tds-records" defaultSort={{ id: "d", dir: "desc" }} selection={sel} onSelectionChange={setSel} isSelectable={(t) => t.status === "deducted"} pageSize={15} searchPlaceholder="Search vendor, bill, section…"
      filters={<><SelectField size="sm" className="w-32" value={sec} onChange={setSec} options={[{ value: "all", label: "All sections" }, ...sections.map((s) => ({ value: s, label: s }))]} /><SelectField size="sm" className="w-36" value={st} onChange={setSt} options={[{ value: "all", label: "All status" }, { value: "deducted", label: "Deducted" }, { value: "deposited", label: "Deposited" }]} /></>} />
  </>);
}
