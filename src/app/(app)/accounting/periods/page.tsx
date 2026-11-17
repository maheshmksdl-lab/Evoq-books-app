"use client";

import * as React from "react";
import Link from "next/link";
import { CalendarPlus, Lock, LockOpen, Unlock } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable, type Column } from "@/components/shared/data-table";
import { Panel } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { SimNotice } from "@/components/shared/states";
import { useConfirm } from "@/components/shared/confirm";
import { FormDialog } from "@/components/shared/form-dialog";
import { useAccounts, useEntityMutation, useFiscalYears, usePeriods } from "@/hooks/use-data";
import { useApp, useFormat } from "@/providers/app-provider";
import { services } from "@/services";
import { formatDate } from "@/lib/formatters";
import type { AccountingPeriod } from "@/types";
import { z } from "zod";

export default function PeriodsPage() {
  const f = useFormat(); const confirm = useConfirm(); const { entity } = useApp();
  const fys = useFiscalYears(); const periods = usePeriods(); const accounts = useAccounts().data ?? [];
  const [fyId, setFyId] = React.useState<string>(""); const [newFy, setNewFy] = React.useState(false);
  const selected = fyId || fys.data?.find((x) => x.status === "open")?.id || fys.data?.[0]?.id || "";
  const setStatus = useEntityMutation((e, i: { periodId: string; status: AccountingPeriod["status"] }) => services.periods.setStatus(e, i), { success: (p) => `${p.name} is now ${p.status}` });
  const createFy = useEntityMutation((e, i: { startYear: number }) => services.periods.createFiscalYear(e, i), { success: (fy) => `${fy.label} created` });
  const rows = (periods.data ?? []).filter((p) => p.fyId === selected);
  const fy = fys.data?.find((x) => x.id === selected);
  const opening = accounts.filter((a) => !a.isGroup && a.openingBalance !== 0);
  const dr = opening.filter((a) => a.type === "asset" || a.type === "expense").reduce((s, a) => s + a.openingBalance, 0), cr = opening.filter((a) => !(a.type === "asset" || a.type === "expense")).reduce((s, a) => s + a.openingBalance, 0);

  const act = async (p: AccountingPeriod, status: AccountingPeriod["status"]) => {
    if (status !== "open" && !(await confirm({ title: `${status === "closed" ? "Close" : "Lock"} ${p.name}?`, description: "No journals can be posted or backdated into this period while it is closed or locked. This is a frontend simulation of period locking, not a permanent ledger close.", confirmLabel: status === "closed" ? "Close period" : "Lock period" }))) return;
    setStatus.mutate({ periodId: p.id, status });
  };
  const cols: Column<AccountingPeriod>[] = [
    { id: "name", header: "Period", accessor: (p) => p.name, cell: (p) => <span className="font-medium">{p.name}</span> },
    { id: "start", header: "Starts", accessor: (p) => p.start, cell: (p) => formatDate(p.start) }, { id: "end", header: "Ends", accessor: (p) => p.end, cell: (p) => formatDate(p.end) },
    { id: "status", header: "State", accessor: (p) => p.status, cell: (p) => <StatusBadge status={p.status} /> },
  ];
  return (
    <>
      <PageHeader title="Financial Periods" description="Configure financial years, view accounting periods, and lock them to stop new postings." actions={<><Button variant="outline" size="sm" asChild><Link href="/accounting/closing">Year-end closing</Link></Button><Button size="sm" onClick={() => setNewFy(true)}><CalendarPlus /> New financial year</Button></>} />
      <SimNotice className="mb-3" title="Simulated locking">Closing or locking a period is enforced by this frontend only — nothing is permanently closed in a real ledger.</SimNotice>
      <div className="mb-3 flex flex-wrap gap-2">{(fys.data ?? []).map((x) => <Button key={x.id} size="sm" variant={x.id === selected ? "default" : "outline"} onClick={() => setFyId(x.id)}>{x.label} <StatusBadge status={x.status} className="ml-1 bg-white/90" /></Button>)}</div>
      <div className="grid gap-4 xl:grid-cols-[1fr_360px]">
        <DataTable columns={cols} data={rows} rowKey={(p) => p.id} isLoading={periods.isLoading || fys.isLoading} hideSearch pageSize={12} caption={`Accounting periods for ${fy?.label}`}
          rowActions={(p) => [
            { label: "Close period", icon: Lock, onClick: () => act(p, "closed"), hidden: () => p.status !== "open" },
            { label: "Lock period", icon: Lock, onClick: () => act(p, "locked"), hidden: () => p.status !== "closed" },
            { label: "Re-open period", icon: LockOpen, onClick: () => act(p, "open"), hidden: () => p.status === "open" || fy?.status === "closed" },
          ]}
          toolbar={fy && <span className="text-xs text-muted-foreground">{formatDate(fy.start)} – {formatDate(fy.end)}</span>} />
        <Panel title="Opening balances" description="Balances brought forward at the start of the books" noPad>
          <div className="max-h-[420px] overflow-y-auto"><table className="w-full text-[13px]"><tbody>{opening.map((a) => <tr key={a.id} className="border-b last:border-0"><td className="tnum px-3 py-1 text-muted-foreground">{a.code}</td><td className="py-1">{a.name}</td><td className="num px-3 py-1">{f.money(a.openingBalance, undefined, { parens: true })}</td></tr>)}</tbody></table></div>
          <div className="border-t px-3 py-2 text-xs"><div className="flex justify-between"><span className="text-muted-foreground">Debit-side (net of contra)</span><span className="tnum">{f.money(dr)}</span></div><div className="flex justify-between"><span className="text-muted-foreground">Credit-side</span><span className="tnum">{f.money(cr)}</span></div><div className="mt-1 flex justify-between font-semibold"><span>Difference</span><span className="tnum">{f.money(dr - cr)}</span></div></div>
        </Panel>
      </div>
      <FormDialog open={newFy} onOpenChange={setNewFy} title="New financial year" size="sm" description={`Months start from ${entity ? new Date(2000, entity.fyStartMonth - 1, 1).toLocaleString("en", { month: "long" }) : "the configured month"}.`} submitLabel="Create year"
        schema={z.object({ startYear: z.coerce.number().int().min(2024, "Year must be 2024 or later").max(2035) })} fields={[{ name: "startYear", label: "Starting calendar year", type: "number", required: true, step: 1 }]} defaultValues={{ startYear: 2027 }} onSubmit={async (v: { startYear: number }) => { await createFy.mutateAsync({ startYear: Number(v.startYear) }); }} />
      <span className="hidden"><Unlock /></span>
    </>
  );
}
