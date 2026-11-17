"use client";

import * as React from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { Panel, StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { TableSkeleton } from "@/components/shared/states";
import { BankTxnTable, ImportStatementDialog } from "@/components/features/banking";
import { useBankAccounts, useReconciliations } from "@/hooks/use-data";
import { useFormat } from "@/providers/app-provider";
import { formatDate } from "@/lib/formatters";

export default function BankAccountDetailPage() {
  const { id } = useParams<{ id: string }>(); const f = useFormat(); const { data } = useBankAccounts(); const recs = useReconciliations(id); const [imp, setImp] = React.useState(false);
  const b = data?.find((x) => x.id === id);
  if (!b) return <TableSkeleton />;
  const diff = b.statementBalance - b.bookBalance;
  return (
    <>
      <PageHeader title={b.name} description={`${b.bankName} · ${b.accountNo}${b.ifsc ? ` · IFSC ${b.ifsc}` : ""}`} trail={[{ label: b.name }]}
        actions={<>{b.type === "bank" && <><Button variant="outline" size="sm" onClick={() => setImp(true)}><Upload /> Import statement</Button><Button size="sm" asChild><Link href={`/banking/reconciliation?account=${b.id}`}>Reconcile</Link></Button></>}<Button variant="outline" size="sm" asChild><Link href={`/accounting/general-ledger?account=${b.ledgerAccountId}`}>Ledger</Link></Button></>} />
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Book balance" value={f.money(b.bookBalance, undefined, { parens: true })} hint="From the ledger" /><StatCard label="Statement balance" value={b.type === "cash" ? "—" : f.money(b.statementBalance, undefined, { parens: true })} hint="Latest import" />
        <StatCard label="Difference" value={b.type === "cash" ? "—" : f.money(diff, undefined, { parens: true })} hint="Statement − books" /><StatCard label="Unmatched lines" value={String(b.unmatched)} hint={f.money(b.unmatchedValue)} />
      </div>
      <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
        {b.type === "bank" ? <BankTxnTable bankAccountId={id} /> : <Panel><p className="text-sm text-muted-foreground">Statement lines are only imported for bank accounts. Open the ledger for this account&apos;s book entries.</p></Panel>}
        <Panel title="Reconciliation history" noPad>
          {(recs.data ?? []).length === 0 ? <p className="p-3 text-xs text-muted-foreground">No reconciliations yet.</p> : (
            <ul className="max-h-[480px] divide-y overflow-y-auto">{(recs.data ?? []).map((r) => <li key={r.id} className="flex items-center justify-between gap-2 px-3 py-2 text-[13px]"><div><p className="font-medium">{formatDate(r.periodEnd, "MMM yyyy")}</p><p className="text-[11px] text-muted-foreground">{r.by} · {r.matchedCount} matched</p></div><div className="text-right"><StatusBadge status={r.status} /><p className="tnum mt-0.5 text-[11px] text-muted-foreground">{f.money(r.statementClosing)}</p></div></li>)}</ul>)}
        </Panel>
      </div>
      <ImportStatementDialog open={imp} onOpenChange={setImp} defaultAccount={id} />
    </>
  );
}
