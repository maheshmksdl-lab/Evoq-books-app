"use client";
import * as React from "react";
import { HandCoins } from "lucide-react";
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
import Link from "next/link";
export default function Page() {
  const f = useFormat(); const params = useUrlParams(); const { data, isLoading, error, refetch } = useEntityQuery(["receipts"], (e) => services.receivables.receipts(e));
  const [open, setOpen] = React.useState(false); const [preset, setPreset] = React.useState<string | undefined>();
  React.useEffect(() => { const c = params?.get("customer"); if (c) { setPreset(c); setOpen(true); } }, [params]);
  type R = NonNullable<typeof data>[number];
  const cols: Column<R>[] = [
    { id: "n", header: "Receipt", accessor: (p) => p.number, cell: (p) => <Link className="font-medium text-primary hover:underline" href={`/accounting/journals/${p.journalId}`}>{p.number}</Link> }, { id: "d", header: "Date", accessor: (p) => p.date, cell: (p) => formatDate(p.date) },
    { id: "c", header: "Customer", accessor: (p) => p.contactName }, { id: "m", header: "Method", accessor: (p) => p.method.toUpperCase(), hideBelow: "md" }, { id: "b", header: "Deposited to", accessor: (p) => p.bankName, hideBelow: "lg" }, { id: "r", header: "Reference", accessor: (p) => p.reference, hideBelow: "lg", className: "tnum text-xs" },
    { id: "a", header: "Amount", align: "right", accessor: (p) => p.amount, cell: (p) => f.money(p.amount, p.currency) }, { id: "fx", header: "FX gain/loss", align: "right", accessor: (p) => p.realizedFx ?? 0, cell: (p) => (p.realizedFx ? f.money(p.realizedFx, undefined, { parens: true }) : "—"), hideBelow: "lg" },
    { id: "s", header: "Status", accessor: (p) => p.status, cell: (p) => <StatusBadge status={p.status} /> },
  ];
  return (<>
    <PageHeader title="Customer Payments" description="Receipts recorded against customer invoices. Allocations update invoice balances and post to the ledger." actions={<Button size="sm" onClick={() => { setPreset(undefined); setOpen(true); }}><HandCoins /> Record receipt</Button>} />
    <DataTable columns={cols} data={data ?? []} rowKey={(p) => p.id} isLoading={isLoading} error={error as Error | null} onRetry={() => refetch()} exportName="customer-receipts" defaultSort={{ id: "d", dir: "desc" }} pageSize={20} />
    {open && <PaymentDialog kind="receipt" open onOpenChange={setOpen} contactId={preset} />}
  </>);
}
