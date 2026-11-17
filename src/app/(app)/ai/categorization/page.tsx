"use client";

import * as React from "react";
import Link from "next/link";
import { Check, Pencil, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable, type Column } from "@/components/shared/data-table";
import { FormDialog } from "@/components/shared/form-dialog";
import { StatusBadge } from "@/components/shared/status-badge";
import { AiBadge, AiDisclaimer, ConfidenceBar } from "@/components/features/ai-parts";
import { useCategorization, useEntityMutation, useJournalSuggestions, useMatchSuggestions } from "@/hooks/use-data";
import { useAccountOptions } from "@/hooks/use-options";
import { useFormat } from "@/providers/app-provider";
import { services } from "@/services";
import { formatDate } from "@/lib/formatters";
import { z } from "zod";

export default function CategorizationPage() {
  const f = useFormat(); const accOpts = useAccountOptions(); const cat = useCategorization(); const jv = useJournalSuggestions(); const ms = useMatchSuggestions(); const [change, setChange] = React.useState<string | null>(null);
  const decideCat = useEntityMutation((e, i: { id: string; action: "accept" | "reject" | "change"; accountId?: string }) => services.ai.decideCategorization(e, i), { success: (_, i) => (i.action === "accept" ? "Category applied to the bank line" : i.action === "change" ? "Category changed" : "Suggestion rejected") });
  const decideJv = useEntityMutation((e, i: { id: string; action: "approve" | "reject" }) => services.ai.decideJournal(e, i), { success: (_, i) => (i.action === "approve" ? "Draft journal created — review and post it in Journal Entries" : "Suggestion rejected") });
  const decideMs = useEntityMutation((e, i: { id: string; action: "accept" | "reject" }) => services.ai.decideMatch(e, i), { success: (_, i) => (i.action === "accept" ? "Matched on the bank statement" : "Match rejected") });
  type C = NonNullable<typeof cat.data>[number]; type J = NonNullable<typeof jv.data>[number]; type M = NonNullable<typeof ms.data>[number];
  const pendingC = (cat.data ?? []).filter((x) => x.status === "pending").length, pendingJ = (jv.data ?? []).filter((x) => x.status === "pending").length, pendingM = (ms.data ?? []).filter((x) => x.status === "pending").length;
  const catCols: Column<C>[] = [
    { id: "t", header: "Imported transaction", accessor: (c) => c.description, cell: (c) => <div className="max-w-[260px]"><p className="truncate font-medium">{c.description}</p><p className="text-[11px] text-muted-foreground">{formatDate(c.date)} · {c.direction === "in" ? "Deposit" : "Withdrawal"} {f.money(c.amount)}</p></div> },
    { id: "s", header: "Suggested category", accessor: (c) => c.suggestedCategory, cell: (c) => <div><p>{c.finalAccount ?? c.suggestedAccount}</p><p className="text-[11px] text-muted-foreground">{c.suggestedCategory}</p></div> },
    { id: "conf", header: "Confidence", accessor: (c) => c.confidence, cell: (c) => <ConfidenceBar value={c.confidence} /> }, { id: "why", header: "Why", accessor: (c) => c.explanation, cell: (c) => <span className="line-clamp-2 max-w-[300px] text-xs text-muted-foreground">{c.explanation}</span>, hideBelow: "lg" },
    { id: "st", header: "Status", accessor: (c) => c.status, cell: (c) => <StatusBadge status={c.status} /> },
  ];
  const jvCols: Column<J>[] = [
    { id: "src", header: "Source transaction", accessor: (j) => j.sourceDescription, cell: (j) => <div className="max-w-[240px]"><p className="truncate font-medium">{j.sourceDescription}</p><p className="text-[11px] text-muted-foreground">{formatDate(j.date)} · {j.sourceRef}</p></div> },
    { id: "dr", header: "Suggested debit", accessor: (j) => j.debitAccount }, { id: "cr", header: "Suggested credit", accessor: (j) => j.creditAccount }, { id: "amt", header: "Amount", align: "right", accessor: (j) => j.amount, cell: (j) => f.money(j.amount) },
    { id: "conf", header: "Confidence", accessor: (j) => j.confidence, cell: (j) => <ConfidenceBar value={j.confidence} /> }, { id: "why", header: "Explanation", accessor: (j) => j.explanation, cell: (j) => <span className="line-clamp-2 max-w-[280px] text-xs text-muted-foreground">{j.explanation}</span>, hideBelow: "lg" },
    { id: "st", header: "Status", accessor: (j) => j.status, cell: (j) => (j.createdJournalId ? <Link className="text-primary hover:underline" href={`/accounting/journals/${j.createdJournalId}`}><StatusBadge status="draft" label={`Draft ${j.journalNumber}`} /></Link> : <StatusBadge status={j.status === "pending" ? "pending" : j.status} label={j.status === "pending" ? "AI suggestion" : undefined} />) },
  ];
  const msCols: Column<M>[] = [
    { id: "b", header: "Bank transaction", accessor: (m) => m.txn?.description ?? "", cell: (m) => <div className="max-w-[240px]"><p className="truncate font-medium">{m.txn?.description}</p><p className="text-[11px] text-muted-foreground">{m.txn ? formatDate(m.txn.date) : ""}</p></div> },
    { id: "bk", header: "Suggested book transaction", accessor: (m) => m.bookLabel, cell: (m) => <span className="max-w-[260px] truncate">{m.bookLabel}</span> }, { id: "amt", header: "Amount", align: "right", accessor: (m) => m.bookAmount, cell: (m) => f.money(m.bookAmount) },
    { id: "conf", header: "Match confidence", accessor: (m) => m.confidence, cell: (m) => <ConfidenceBar value={m.confidence} /> }, { id: "why", header: "Explanation", accessor: (m) => m.explanation, cell: (m) => <span className="line-clamp-2 max-w-[300px] text-xs text-muted-foreground">{m.explanation}</span>, hideBelow: "lg" },
    { id: "st", header: "Status", accessor: (m) => (m.matched && m.status === "pending" ? "matched" : m.status), cell: (m) => <StatusBadge status={m.matched && m.status === "pending" ? "matched" : m.status} /> },
  ];
  const cur = (cat.data ?? []).find((x) => x.id === change);
  return (
    <>
      <PageHeader title="Transaction Categorization & Suggestions" description="AI-assisted categorisation, suggested journals and bank matching. Every suggestion needs a human decision." actions={<Button variant="outline" size="sm" asChild><Link href="/banking/reconciliation">Manual reconciliation</Link></Button>} />
      <AiDisclaimer>Suggestions are visually marked and kept separate from posted records. Approving a journal suggestion only creates a <b>draft</b> journal — nothing is posted automatically.</AiDisclaimer>
      <Tabs defaultValue="cat"><TabsList><TabsTrigger value="cat">Categorisation ({pendingC})</TabsTrigger><TabsTrigger value="jv">Suggested journals ({pendingJ})</TabsTrigger><TabsTrigger value="match">Bank matching ({pendingM})</TabsTrigger></TabsList>
        <TabsContent value="cat" className="mt-3"><DataTable columns={catCols} data={cat.data ?? []} rowKey={(c) => c.id} isLoading={cat.isLoading} error={cat.error as Error | null} onRetry={() => cat.refetch()} hideSearch emptyTitle="No categorisation suggestions"
          rowActions={(c) => [{ label: "Accept suggestion", icon: Check, onClick: () => decideCat.mutate({ id: c.id, action: "accept" }), hidden: () => c.status !== "pending" }, { label: "Change category…", icon: Pencil, onClick: () => setChange(c.id), hidden: () => c.status !== "pending" }, { label: "Reject", icon: X, destructive: true, onClick: () => decideCat.mutate({ id: c.id, action: "reject" }), hidden: () => c.status !== "pending" }]} /><p className="mt-2 text-xs"><AiBadge /> <span className="ml-1 text-muted-foreground">Accepting assigns the category on the bank line; use Bank Transactions → “Categorise & record” to post it.</span></p></TabsContent>
        <TabsContent value="jv" className="mt-3"><DataTable columns={jvCols} data={jv.data ?? []} rowKey={(j) => j.id} isLoading={jv.isLoading} hideSearch emptyTitle="No suggested journals"
          rowActions={(j) => [{ label: "Approve → create draft journal", icon: Check, onClick: () => decideJv.mutate({ id: j.id, action: "approve" }), hidden: () => j.status !== "pending" }, { label: "Reject", icon: X, destructive: true, onClick: () => decideJv.mutate({ id: j.id, action: "reject" }), hidden: () => j.status !== "pending" }]} /></TabsContent>
        <TabsContent value="match" className="mt-3"><DataTable columns={msCols} data={ms.data ?? []} rowKey={(m) => m.id} isLoading={ms.isLoading} hideSearch emptyTitle="No matching suggestions"
          rowActions={(m) => [{ label: "Accept match", icon: Check, onClick: () => decideMs.mutate({ id: m.id, action: "accept" }), hidden: () => m.status !== "pending" || m.matched }, { label: "Reject", icon: X, destructive: true, onClick: () => decideMs.mutate({ id: m.id, action: "reject" }), hidden: () => m.status !== "pending" }, { label: "Match manually…", icon: Pencil, onClick: () => { window.location.href = "/banking/reconciliation"; }, hidden: () => m.status !== "pending" }]} /></TabsContent></Tabs>
      <FormDialog open={!!cur} onOpenChange={(o) => !o && setChange(null)} size="sm" title="Change category" description={cur?.description} submitLabel="Apply category" schema={z.object({ accountId: z.string().min(1, "Choose a ledger account") })} fields={[{ name: "accountId", label: "Ledger account", type: "combobox", options: accOpts, required: true, span: 2 }]} defaultValues={{ accountId: cur?.suggestedAccountId ?? "" }} onSubmit={async (v: { accountId: string }) => { await decideCat.mutateAsync({ id: cur!.id, action: "change", accountId: v.accountId }); }} />
    </>
  );
}
