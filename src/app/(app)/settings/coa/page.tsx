"use client";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { Panel } from "@/components/shared/stat-card";
import { DataTable } from "@/components/shared/data-table";
import { StatusBadge } from "@/components/shared/status-badge";
import { useAccounts } from "@/hooks/use-data";
import { Button } from "@/components/ui/button";
export default function Page() {
  const { data, isLoading } = useAccounts(); const sys = (data ?? []).filter((a) => a.system && !a.isGroup); const active = (data ?? []).filter((a) => !a.isGroup && a.active).length;
  return (<>
    <PageHeader title="Chart of Accounts Settings" description="System accounts and structure rules. Day-to-day account maintenance lives under Accounting." actions={<Button size="sm" asChild><Link href="/accounting/chart-of-accounts">Open chart of accounts</Link></Button>} />
    <div className="grid gap-4 lg:grid-cols-[1fr_340px]">
      <div><p className="mb-2 text-sm font-medium">System & control accounts</p><DataTable hideSearch data={sys} rowKey={(a) => a.id} isLoading={isLoading} pageSize={10} columns={[{ id: "c", header: "Code", accessor: (a) => a.code, className: "tnum" }, { id: "n", header: "Account", accessor: (a) => a.name }, { id: "t", header: "Type", accessor: (a) => a.type, cell: (a) => <span className="capitalize">{a.type}</span> }, { id: "d", header: "Purpose", accessor: (a) => a.description ?? "", hideBelow: "md" }, { id: "s", header: "Protection", accessor: () => "System", cell: () => <StatusBadge status="draft" label="Cannot deactivate" /> }]} /></div>
      <Panel title="Structure rules"><ul className="space-y-2 text-sm text-muted-foreground"><li>• Codes are 4–6 digits and start with 1 asset, 2 liability, 3 equity, 4 income, 5 expense.</li><li>• Postings are only allowed on leaf accounts; groups organise the hierarchy.</li><li>• A child must share its parent&apos;s type.</li><li>• Accounts with a balance or postings can&apos;t be deactivated or change type.</li><li>• Active postable accounts: <b className="text-foreground">{active}</b></li></ul></Panel>
    </div></>);
}
