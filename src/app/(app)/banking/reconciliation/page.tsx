"use client";

import * as React from "react";
import { CheckCheck, Link2, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/shared/page-header";
import { DateField, SelectField } from "@/components/shared/form-controls";
import { DataTable, type Column } from "@/components/shared/data-table";
import { Panel, StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { EmptyState, TableSkeleton } from "@/components/shared/states";
import { CategorizeDialog } from "@/components/features/banking";
import { useBankAccounts, useBankTxns, useBookLines, useEntityMutation, useReconSummary, useReconciliations } from "@/hooks/use-data";
import { useUrlParams } from "@/hooks/use-misc";
import { useApp, useFormat } from "@/providers/app-provider";
import { services } from "@/services";
import { formatDate } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { useConfirm } from "@/components/shared/confirm";

type Txn = NonNullable<ReturnType<typeof useBankTxns>["data"]>[number];

export default function ReconciliationPage() {
  const f = useFormat(); const { today } = useApp(); const params = useUrlParams(); const confirm = useConfirm();
  const accounts = (useBankAccounts().data ?? []).filter((b) => b.type === "bank");
  const [acct, setAcct] = React.useState(""); const [asOf, setAsOf] = React.useState(today); const [tab, setTab] = React.useState("open"); const [sel, setSel] = React.useState<string | null>(null); const [bookSel, setBookSel] = React.useState<string[]>([]); const [cat, setCat] = React.useState<Txn | null>(null); const [showRec, setShowRec] = React.useState(false);
  React.useEffect(() => { if (!acct && accounts.length) setAcct(params?.get("account") ?? accounts[0].id); }, [accounts, acct, params]);
  const txns = useBankTxns(acct || undefined); const book = useBookLines(acct || undefined); const summary = useReconSummary(acct || undefined, asOf); const history = useReconciliations(acct || undefined);
  const match = useEntityMutation((e, i: { txnId: string; lineIds: string[] }) => services.banking.match(e, i), { success: "Matched", onDone: () => { setSel(null); setBookSel([]); } });
  const auto = useEntityMutation((e, id: string) => services.banking.autoMatch(e, id), { success: (n) => (n ? `Auto-matched ${n} transactions` : "No new automatic matches") });
  const complete = useEntityMutation((e, i: { bankAccountId: string; asOf: string }) => services.banking.completeReconciliation(e, i), { success: "Reconciliation completed" });
  const exclude = useEntityMutation((e, id: string) => services.banking.exclude(e, id), { success: "Line excluded" });
  const s = summary.data;
  const stmt = (txns.data ?? []).filter((t) => t.date <= asOf && (tab === "all" || (tab === "open" ? ["unmatched", "categorized"].includes(t.status) : t.status === "matched"))).sort((a, b) => b.date.localeCompare(a.date));
  const lines = (book.data ?? []).filter((l) => l.date <= asOf && (showRec || !l.reconciled));
  const selTxn = (txns.data ?? []).find((t) => t.id === sel);
  const selAmt = selTxn ? selTxn.deposit - selTxn.withdrawal : 0;
  const bookAmt = lines.filter((l) => bookSel.includes(l.lineId)).reduce((x, l) => x + l.debit - l.credit, 0);
  const diff = Math.round((selAmt - bookAmt) * 100) / 100;

  const bookCols: Column<(typeof lines)[number]>[] = [
    { id: "sel", header: "", cell: (l) => <Checkbox aria-label="Select book entry" disabled={l.reconciled || !selTxn} checked={bookSel.includes(l.lineId)} onCheckedChange={(v) => setBookSel((b) => (v ? [...b, l.lineId] : b.filter((x) => x !== l.lineId)))} />, className: "w-8" },
    { id: "date", header: "Date", accessor: (l) => l.date, cell: (l) => formatDate(l.date, "dd MMM yy") }, { id: "j", header: "Journal", accessor: (l) => l.journalNumber, className: "tnum text-xs" },
    { id: "desc", header: "Book entry", accessor: (l) => l.description, className: "max-w-[200px] truncate" },
    { id: "amt", header: "Amount", align: "right", accessor: (l) => l.debit - l.credit, cell: (l) => <span className={l.credit ? "" : ""}>{l.debit ? "+" : "−"}{f.money(l.debit || l.credit)}</span> },
    { id: "st", header: "", accessor: (l) => (l.reconciled ? "matched" : "outstanding"), cell: (l) => <StatusBadge status={l.reconciled ? "matched" : "unmatched"} label={l.reconciled ? "Matched" : "Not on statement"} /> },
  ];
  const stmtCols: Column<Txn>[] = [
    { id: "sel", header: "", cell: (t) => <Checkbox aria-label="Select statement line" disabled={t.status === "matched" || t.status === "excluded"} checked={sel === t.id} onCheckedChange={(v) => { setSel(v ? t.id : null); setBookSel([]); }} />, className: "w-8" },
    { id: "date", header: "Date", accessor: (t) => t.date, cell: (t) => formatDate(t.date, "dd MMM yy") },
    { id: "desc", header: "Statement narration", accessor: (t) => t.description, cell: (t) => <span className="flex items-center gap-1"><span className="max-w-[210px] truncate">{t.description}</span>{t.duplicateOf && <span className="tone-warning rounded border px-1 text-[10px]">Duplicate?</span>}</span> },
    { id: "amt", header: "Amount", align: "right", accessor: (t) => t.deposit - t.withdrawal, cell: (t) => <span>{t.deposit ? "+" : "−"}{f.money(t.deposit || t.withdrawal)}</span> },
    { id: "st", header: "Status", accessor: (t) => t.status, cell: (t) => <StatusBadge status={t.status} /> },
  ];
  return (
    <>
      <PageHeader title="Bank Reconciliation" description="Match statement lines to book entries. Differences are explained by statement-only items and outstanding book entries."
        actions={<>
          <div className="w-60"><SelectField value={acct} onChange={(v) => { setAcct(v); setSel(null); setBookSel([]); }} options={accounts.map((a) => ({ value: a.id, label: a.name }))} /></div>
          <div className="w-40"><DateField value={asOf} onChange={setAsOf} max={today} /></div>
          <Button variant="outline" size="sm" disabled={!acct || auto.isPending} onClick={() => auto.mutate(acct)}><Wand2 /> Auto-match</Button>
          <Button size="sm" disabled={!s || s.unresolvedCount > 0 || complete.isPending} title={s && s.unresolvedCount > 0 ? `${s.unresolvedCount} statement lines still need action` : ""} onClick={async () => { if (await confirm({ title: `Complete reconciliation to ${formatDate(asOf)}?`, description: `Outstanding book items (${s?.bookOnly.length}) stay open as uncleared entries.`, confirmLabel: "Complete" })) complete.mutate({ bankAccountId: acct, asOf }); }}><CheckCheck /> Complete</Button>
        </>} />
      <div className="mb-3 grid grid-cols-2 gap-3 lg:grid-cols-5">
        <StatCard label="Statement closing" value={s ? f.money(s.statementClosing) : "—"} hint="Opening + imported lines" />
        <StatCard label="Book closing" value={s ? f.money(s.bookClosing) : "—"} hint="Ledger balance" />
        <StatCard label="Difference" value={s ? f.money(s.difference, undefined, { parens: true }) : "—"} valueClassName={s && Math.abs(s.difference) > 0.005 ? "text-[color-mix(in_srgb,var(--s-warning)_50%,black)]" : "text-[color-mix(in_srgb,var(--s-success)_55%,black)]"} hint="Statement − books" />
        <StatCard label="Statement-only items" value={s ? f.money(s.bankOnlyNet, undefined, { parens: true }) : "—"} hint={`${s?.bankOnly.length ?? 0} lines to book`} />
        <StatCard label="Outstanding book items" value={s ? f.money(s.bookOnlyNet, undefined, { parens: true }) : "—"} hint={`${s?.bookOnly.length ?? 0} not on statement`} />
      </div>
      {s && <p className={cn("mb-3 rounded-md border px-3 py-2 text-xs", Math.abs(s.explained - s.difference) < 0.01 ? "tone-info" : "tone-warning")}>
        Reconciling equation: <b className="tnum">{f.money(s.statementClosing)}</b> (statement) − <b className="tnum">{f.money(s.bookClosing)}</b> (books) = <b className="tnum">{f.money(s.difference, undefined, { parens: true })}</b> = statement-only <b className="tnum">{f.money(s.bankOnlyNet, undefined, { parens: true })}</b> − outstanding book items <b className="tnum">{f.money(s.bookOnlyNet, undefined, { parens: true })}</b>. {s.unresolvedCount > 0 ? `${s.unresolvedCount} statement lines still need to be matched, categorised or excluded.` : "All statement lines are resolved — you can complete the reconciliation."}</p>}

      {sel && selTxn && (
        <div className="sticky top-0 z-10 mb-3 flex flex-wrap items-center gap-3 rounded-lg border border-action bg-card px-3 py-2 shadow-md">
          <Link2 className="size-4 text-primary" />
          <div className="min-w-0 text-sm"><p className="truncate font-medium">{selTxn.description}</p><p className="text-xs text-muted-foreground">Statement {selAmt >= 0 ? "+" : "−"}{f.money(Math.abs(selAmt))} · selected book entries {bookAmt >= 0 ? "+" : "−"}{f.money(Math.abs(bookAmt))} · difference <b className={Math.abs(diff) < 0.005 ? "text-[color-mix(in_srgb,var(--s-success)_55%,black)]" : "text-error"}>{f.money(diff, undefined, { parens: true })}</b></p></div>
          <div className="ml-auto flex gap-2">
            <Button size="sm" variant="outline" onClick={() => setCat(selTxn)}>Record as new entry…</Button>
            <Button size="sm" variant="outline" onClick={() => exclude.mutate(selTxn.id, { onSuccess: () => setSel(null) })}>Exclude</Button>
            <Button size="sm" disabled={!bookSel.length || Math.abs(diff) > 0.005 || match.isPending} onClick={() => match.mutate({ txnId: sel, lineIds: bookSel })}>Match {bookSel.length || ""} {bookSel.length === 1 ? "entry" : "entries"}</Button>
          </div>
        </div>)}

      <div className="grid gap-4 xl:grid-cols-2">
        <Panel title="Bank statement" description="Select one unmatched line, then choose book entries on the right" noPad actions={<Tabs value={tab} onValueChange={setTab}><TabsList className="h-7"><TabsTrigger value="open" className="px-2 text-xs">To do</TabsTrigger><TabsTrigger value="matched" className="px-2 text-xs">Matched</TabsTrigger><TabsTrigger value="all" className="px-2 text-xs">All</TabsTrigger></TabsList></Tabs>}>
          {txns.isLoading ? <TableSkeleton /> : <DataTable bare hideSearch columns={stmtCols} data={stmt} rowKey={(t) => t.id} pageSize={10} selectedKey={sel} emptyTitle={tab === "open" ? "Nothing left to reconcile" : "No lines"} rowClassName={(t) => (t.status === "matched" ? "opacity-70" : undefined)} />}
        </Panel>
        <Panel title="Book transactions" description="Ledger entries on this bank account" noPad actions={<label className="flex items-center gap-1.5 text-xs"><Checkbox checked={showRec} onCheckedChange={(v) => setShowRec(!!v)} /> Show matched</label>}>
          {book.isLoading ? <TableSkeleton /> : !acct ? <EmptyState title="Select an account" /> : <DataTable bare hideSearch columns={bookCols} data={lines} rowKey={(l) => l.lineId} pageSize={10} emptyTitle="No outstanding book entries" rowClassName={(l) => (l.reconciled ? "opacity-60" : undefined)} />}
        </Panel>
      </div>
      <h2 className="mb-2 mt-5 text-sm font-semibold">Reconciliation history</h2>
      <DataTable hideSearch pageSize={6} data={history.data ?? []} rowKey={(r) => r.id} columns={[{ id: "p", header: "Period end", accessor: (r) => r.periodEnd, cell: (r) => formatDate(r.periodEnd) }, { id: "s", header: "Statement", align: "right", accessor: (r) => r.statementClosing, cell: (r) => f.money(r.statementClosing) }, { id: "b", header: "Books", align: "right", accessor: (r) => r.bookClosing, cell: (r) => f.money(r.bookClosing) }, { id: "d", header: "Difference", align: "right", accessor: (r) => r.difference, cell: (r) => f.money(r.difference, undefined, { parens: true }) }, { id: "m", header: "Matched", align: "right", accessor: (r) => r.matchedCount }, { id: "by", header: "By", accessor: (r) => r.by, hideBelow: "md" }, { id: "st", header: "Status", accessor: (r) => r.status, cell: (r) => <StatusBadge status={r.status} /> }]} />
      <CategorizeDialog txn={cat} onClose={() => { setCat(null); setSel(null); }} />
    </>
  );
}
