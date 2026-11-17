"use client";

import * as React from "react";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable, type Column } from "@/components/shared/data-table";
import { Combobox, SelectField } from "@/components/shared/form-controls";
import { RangeFilter } from "@/components/shared/range-picker";
import { StatCard } from "@/components/shared/stat-card";
import { JournalDrawer } from "@/components/features/journal-view";
import { useLedger } from "@/hooks/use-data";
import { useUrlParams } from "@/hooks/use-misc";
import { useAccountOptions } from "@/hooks/use-options";
import { useApp, useFormat } from "@/providers/app-provider";
import { formatDate, titleCase } from "@/lib/formatters";
import type { LedgerEntry } from "@/lib/accounting/engine";

const KINDS = ["all", "invoice", "bill", "receipt", "payment", "expense", "manual", "bank", "depreciation", "payroll", "tax", "credit_note", "adjustment", "reversal", "loan", "intercompany", "recurring"];

export default function GeneralLedgerPage() {
  const f = useFormat(); const { range, entity } = useApp(); const params = useUrlParams();
  const accountOpts = useAccountOptions(undefined, { includeInactive: true });
  const [accountId, setAccountId] = React.useState<string>(""); const [kind, setKind] = React.useState("all");
  const [r, setR] = React.useState<{ from: string; to: string } | null>(null);
  React.useEffect(() => { const a = params?.get("account"); if (a) setAccountId(a); const fr = params?.get("from"), t = params?.get("to"); if (fr && t) setR({ from: fr, to: t }); }, [params]);
  const from = r?.from ?? range.from, to = r?.to ?? range.to;
  const { data, isLoading, error, refetch } = useLedger({ accountId: accountId || undefined, from, to });
  const [open, setOpen] = React.useState<string | null>(null);
  const entries = (data?.entries ?? []).filter((e) => kind === "all" || e.kind === kind);
  const single = !!accountId;
  const td = entries.reduce((s, e) => s + e.debit, 0), tc = entries.reduce((s, e) => s + e.credit, 0);

  const cols: Column<LedgerEntry>[] = [
    { id: "date", header: "Date", accessor: (e) => e.date, cell: (e) => formatDate(e.date) },
    { id: "journal", header: "Journal", accessor: (e) => e.journalNumber, cell: (e) => <Link href={`/accounting/journals/${e.journalId}`} onClick={(ev) => ev.stopPropagation()} className="text-primary hover:underline">{e.journalNumber}</Link> },
    { id: "source", header: "Source", accessor: (e) => e.sourceRef, hideBelow: "md" },
    ...(!single ? [{ id: "account", header: "Account", accessor: (e: LedgerEntry) => `${e.accountCode} ${e.accountName}`, cell: (e: LedgerEntry) => <span><span className="tnum text-muted-foreground">{e.accountCode}</span> {e.accountName}</span> }] : []),
    { id: "desc", header: "Description", accessor: (e) => e.description, className: "max-w-[260px] truncate" },
    { id: "type", header: "Type", accessor: (e) => titleCase(e.kind), hideBelow: "lg" },
    { id: "debit", header: "Debit", align: "right", accessor: (e) => e.debit, cell: (e) => (e.debit ? f.money(e.debit) : ""), footer: f.money(td) },
    { id: "credit", header: "Credit", align: "right", accessor: (e) => e.credit, cell: (e) => (e.credit ? f.money(e.credit) : ""), footer: f.money(tc) },
    ...(single ? [{ id: "balance", header: "Running balance", align: "right" as const, accessor: (e: LedgerEntry) => e.balance, cell: (e: LedgerEntry) => f.money(e.balance, undefined, { parens: true }) }] : []),
  ];

  return (
    <>
      <PageHeader title="General Ledger" description="Every posted line. Pick an account for an account-wise ledger with running balance; click a row to inspect the journal and jump to its source." />
      <div className="mb-3 grid gap-3 sm:grid-cols-4">
        <StatCard label={single ? "Opening balance" : "Entries"} value={single ? f.money(data?.opening ?? 0, undefined, { parens: true }) : entries.length.toLocaleString("en-IN")} />
        <StatCard label="Total debits" value={f.money(td)} /><StatCard label="Total credits" value={f.money(tc)} />
        <StatCard label={single ? "Closing balance" : "Difference"} value={single ? f.money(entries.at(-1)?.balance ?? data?.opening ?? 0, undefined, { parens: true }) : f.money(td - tc)} hint={single ? undefined : "Debits − credits (must be zero)"} />
      </div>
      <DataTable columns={cols} data={entries} rowKey={(e) => e.key} isLoading={isLoading} error={error as Error | null} onRetry={() => refetch()} pageSize={25} exportName={`general-ledger-${entity?.id}`} searchPlaceholder="Search description, journal, source…"
        onRowClick={(e) => setOpen(e.journalId)} defaultSort={single ? undefined : { id: "date", dir: "desc" }} emptyTitle="No ledger entries" emptyDescription="Try a wider date range or a different account."
        filters={<>
          <div className="w-64"><Combobox value={accountId} onChange={setAccountId} options={[{ value: "", label: "All accounts" }, ...accountOpts]} placeholder="All accounts" searchPlaceholder="Search accounts…" /></div>
          <RangeFilter from={from} to={to} onChange={setR} fyStartMonth={entity?.fyStartMonth} />
          <SelectField size="sm" className="w-36" value={kind} onChange={setKind} options={KINDS.map((k) => ({ value: k, label: k === "all" ? "All types" : titleCase(k) }))} />
        </>} />
      <JournalDrawer journalId={open} onClose={() => setOpen(null)} />
    </>
  );
}
