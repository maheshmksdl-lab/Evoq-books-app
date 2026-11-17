"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Copy, Eye, Pencil, Play, Plus, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable, type Column } from "@/components/shared/data-table";
import { SelectField } from "@/components/shared/form-controls";
import { StatusBadge } from "@/components/shared/status-badge";
import { useConfirm } from "@/components/shared/confirm";
import { FormDialog } from "@/components/shared/form-dialog";
import { useEntityMutation, useJournals } from "@/hooks/use-data";
import { useApp, useFormat } from "@/providers/app-provider";
import { services, type JournalRow } from "@/services";
import { formatDate, titleCase } from "@/lib/formatters";
import { z } from "zod";

export default function JournalsPage() {
  const router = useRouter(); const f = useFormat(); const confirm = useConfirm(); const { today } = useApp();
  const { data, isLoading, error, refetch } = useJournals();
  const [tab, setTab] = React.useState("all"); const [kind, setKind] = React.useState("all"); const [rev, setRev] = React.useState<JournalRow | null>(null);
  const del = useEntityMutation((e, id: string) => services.journals.remove(e, id), { success: "Draft deleted" });
  const reverse = useEntityMutation((e, i: { id: string; date: string; reason?: string }) => services.journals.reverse(e, i), { success: (r) => `Reversal ${r.number} posted` });
  const runRec = useEntityMutation((e, id: string) => services.journals.runRecurring(e, id), { success: (d) => `Draft ${d.number} created from template` });

  const all = data ?? [];
  const counts = { all: all.filter((j) => !j.recurringTemplate).length, draft: all.filter((j) => j.status === "draft" && !j.recurringTemplate).length, pending: all.filter((j) => j.status === "pending_approval").length, posted: all.filter((j) => j.status === "posted" || j.status === "reversed").length, recurring: all.filter((j) => j.recurringTemplate).length };
  const rows = all.filter((j) => (tab === "recurring" ? j.recurringTemplate : !j.recurringTemplate && (tab === "all" || (tab === "draft" && j.status === "draft") || (tab === "pending" && j.status === "pending_approval") || (tab === "posted" && (j.status === "posted" || j.status === "reversed"))))).filter((j) => kind === "all" || j.kind === kind);

  const cols: Column<JournalRow>[] = [
    { id: "number", header: "Journal #", accessor: (j) => j.number, cell: (j) => <Link href={`/accounting/journals/${j.id}`} className="font-medium text-primary hover:underline" onClick={(e) => e.stopPropagation()}>{j.number}</Link> },
    { id: "date", header: "Date", accessor: (j) => j.date, cell: (j) => formatDate(j.date) },
    { id: "desc", header: "Description", accessor: (j) => j.description, className: "max-w-[320px] truncate" },
    { id: "type", header: "Type", accessor: (j) => titleCase(j.kind), hideBelow: "md" },
    { id: "source", header: "Source", accessor: (j) => j.sourceRef, hideBelow: "lg" },
    { id: "by", header: "Created by", accessor: (j) => j.createdBy, hideBelow: "lg" },
    { id: "amount", header: "Amount", align: "right", accessor: (j) => j.amount, cell: (j) => f.money(j.amount) },
    { id: "status", header: "Status", accessor: (j) => j.status, cell: (j) => <StatusBadge status={j.status} /> },
  ];
  return (
    <>
      <PageHeader title="Journal Entries" description="Manual and system-generated journals. Posted entries are immutable — correct them with a reversal or adjustment." actions={<Button size="sm" asChild><Link href="/accounting/journals/new"><Plus /> New journal</Link></Button>} />
      <Tabs value={tab} onValueChange={setTab} className="mb-2">
        <TabsList className="h-auto flex-wrap">
          <TabsTrigger value="all">All ({counts.all})</TabsTrigger><TabsTrigger value="draft">Drafts ({counts.draft})</TabsTrigger><TabsTrigger value="pending">Pending approval ({counts.pending})</TabsTrigger><TabsTrigger value="posted">Posted ({counts.posted})</TabsTrigger><TabsTrigger value="recurring">Recurring templates ({counts.recurring})</TabsTrigger>
        </TabsList>
      </Tabs>
      <DataTable columns={cols} data={rows} rowKey={(j) => j.id} isLoading={isLoading} error={error as Error | null} onRetry={() => refetch()} exportName="journal-entries" onRowClick={(j) => router.push(`/accounting/journals/${j.id}`)} defaultSort={{ id: "date", dir: "desc" }} searchPlaceholder="Search number, description, source…"
        emptyTitle="No journals in this view" emptyAction={<Button size="sm" asChild><Link href="/accounting/journals/new"><Plus /> New journal</Link></Button>}
        filters={<SelectField size="sm" className="w-40" value={kind} onChange={setKind} options={["all", "manual", "invoice", "bill", "receipt", "payment", "expense", "bank", "depreciation", "payroll", "tax", "adjustment", "reversal"].map((k) => ({ value: k, label: k === "all" ? "All types" : titleCase(k) }))} />}
        rowActions={(j) => [
          { label: "View", icon: Eye, onClick: () => router.push(`/accounting/journals/${j.id}`) },
          { label: "Edit draft", icon: Pencil, onClick: () => router.push(`/accounting/journals/${j.id}`), hidden: () => !(j.status === "draft" || j.status === "rejected") },
          { label: "Run template now", icon: Play, onClick: () => runRec.mutate(j.id), hidden: () => !j.recurringTemplate },
          { label: "Copy as new draft", icon: Copy, onClick: () => router.push(`/accounting/journals/new?copy=${j.id}`) },
          { label: "Reverse…", icon: RotateCcw, onClick: () => setRev(j), hidden: () => j.status !== "posted" || !!j.reversedBy, separatorBefore: true },
          { label: "Delete draft", icon: Trash2, destructive: true, hidden: () => !(j.status === "draft" || j.status === "rejected"), onClick: async () => { if (await confirm({ title: `Delete ${j.number}?`, description: "Only drafts can be deleted.", destructive: true, confirmLabel: "Delete" })) del.mutate(j.id); } },
        ]} />
      <FormDialog open={!!rev} onOpenChange={(o) => !o && setRev(null)} title={`Reverse ${rev?.number}`} description="Posts an equal and opposite journal. The original is marked reversed and stays in the ledger." size="sm" submitLabel="Post reversal"
        schema={z.object({ date: z.string().min(1, "Choose a date"), reason: z.string().optional() })} fields={[{ name: "date", label: "Reversal date", type: "date", required: true }, { name: "reason", label: "Reason", type: "textarea" }]} defaultValues={{ date: today, reason: "" }}
        onSubmit={async (v: { date: string; reason?: string }) => { await reverse.mutateAsync({ id: rev!.id, ...v }); }} />
    </>
  );
}
