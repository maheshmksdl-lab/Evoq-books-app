"use client";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { Panel, StatCard } from "@/components/shared/stat-card";
import { DataTable } from "@/components/shared/data-table";
import { TableSkeleton } from "@/components/shared/states";
import { Button } from "@/components/ui/button";
import { useCurrencyOverview } from "@/hooks/use-data";
import { CURRENCIES } from "@/lib/formatters";
export default function Page() {
  const { data, isLoading } = useCurrencyOverview();
  if (isLoading || !data) return <TableSkeleton />;
  return (<>
    <PageHeader title="Currencies" description="Base currency and enabled foreign currencies. Rates and revaluation previews are in Advanced Finance." actions={<Button size="sm" asChild><Link href="/advanced-finance/multi-currency">Open multi-currency</Link></Button>} />
    <div className="mb-3 grid grid-cols-2 gap-3 lg:grid-cols-3"><StatCard label="Base currency" value={data.base} hint="Cannot change after postings" /><StatCard label="Enabled foreign currencies" value={String(data.currencies.length)} /><StatCard label="Supported in this demo" value={String(CURRENCIES.length)} /></div>
    <Panel title="Enabled currencies" noPad><DataTable bare hideSearch data={data.currencies} rowKey={(c) => c.currency} columns={[{ id: "c", header: "Code", accessor: (c) => c.currency, className: "font-medium" }, { id: "n", header: "Name", accessor: (c) => CURRENCIES.find((x) => x.code === c.currency)?.name ?? "" }, { id: "r", header: `Rate to ${data.base}`, align: "right", accessor: (c) => c.rate, cell: (c) => c.rate.toFixed(4) }, { id: "s", header: "Source", accessor: (c) => (c.manual ? "Manual" : "Reference (sample)") }]} /></Panel>
  </>);
}
