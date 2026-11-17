"use client";
import * as React from "react";
import Link from "next/link";
import { Banknote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable, type Column } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { PaymentDialog } from "@/components/features/payment-dialog";
import { useEntityQuery } from "@/hooks/use-data";
import { useUrlParams } from "@/hooks/use-misc";
import { useFormat } from "@/providers/app-provider";
import { services } from "@/services";
import { formatDate } from "@/lib/formatters";
export default function Page() {
  const f = useFormat(); const params = useUrlParams(); const { data, isLoading, error, refetch } = useEntityQuery(["payments"], (e) => services.payables.payments(e));
  const [open, setOpen] = React.useState(false); const [preset, setPreset] = React.useState<string | undefined>();
  React.useEffect(() => { const c = params?.get("vendor"); if (c) { setPreset(c); setOpen(true); } }, [params]);
  type R = NonNullable<typeof data>[number];
  const cols: Column<R>[] = [
    { id: "n", header: "Payment", accessor: (p) => p.number, cell: (p) => p.journalId ? <Link className="font-medium text-primary hover:underline" href={`/accounting/journals/${p.journalId}`}>{p.number}</Link> : <span className="font-medium">{p.number}</span> }, { id: "d", header: "Date", accessor: (p) => p.date, cell: (p) => formatDate(p.date) },
    { id: "c", header: "Vendor", accessor: (p) => p.contactName }, { id: "m", header: "Method", accessor: (p) => p.method.toUpperCase(), hideBelow: "md" }, { id: "b", header: "Paid from", accessor: (p) => p.bankName, hideBelow: "lg" }, { id: "r", header: "Reference", accessor: (p) => p.reference, hideBelow: "lg", className: "tnum text-xs" },
    { id: "a", header: "Amount", align: "right", accessor: (p) => p.amount, cell: (p) => f.money(p.amount, p.currency) }, { id: "s", header: "Status", accessor: (p) => p.status, cell: (p) => <StatusBadge status={p.status} /> },
  ];
  return (<>
    <PageHeader title="Vendor Payments" description="Payment history and payment recording. Payments above the approval limit are routed for approval." actions={<Button size="sm" onClick={() => { setPreset(undefined); setOpen(true); }}><Banknote /> Record payment</Button>} />
    <DataTable columns={cols} data={data ?? []} rowKey={(p) => p.id} isLoading={isLoading} error={error as Error | null} onRetry={() => refetch()} exportName="vendor-payments" defaultSort={{ id: "d", dir: "desc" }} pageSize={20} />
    {open && <PaymentDialog kind="payment" open onOpenChange={setOpen} contactId={preset} />}
  </>);
}
