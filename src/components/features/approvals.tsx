"use client";

import * as React from "react";
import Link from "next/link";
import { CheckCircle2, MessageSquare, Pencil, Plus, ShieldAlert, Trash2, XCircle } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataTable, type Column } from "@/components/shared/data-table";
import { DetailDrawer } from "@/components/shared/detail-drawer";
import { FormDialog } from "@/components/shared/form-dialog";
import { KV, StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { SimNotice } from "@/components/shared/states";
import { useConfirm } from "@/components/shared/confirm";
import { useApprovalRequests, useApprovalRules, useEntityMutation } from "@/hooks/use-data";
import { useApp, useFormat } from "@/providers/app-provider";
import { services } from "@/services";
import { approvalRuleSchema } from "@/lib/validators";
import { formatDate, formatDateTime, titleCase } from "@/lib/formatters";
import type { ApprovalDocType, ApprovalRequest, ApprovalRule } from "@/types";

const DOC_LABEL: Record<ApprovalDocType, string> = { journal: "Journal entry", bill: "Vendor bill", expense: "Expense", payment: "Payment", period_close: "Period closing", adjustment: "Adjustment" };
const docHref = (r: ApprovalRequest) => (r.docType === "journal" || r.docType === "adjustment" ? `/accounting/journals/${r.docId}` : r.docType === "bill" ? `/payables/bills/${r.docId}` : r.docType === "expense" ? `/expenses/${r.docId}` : r.docType === "period_close" ? "/accounting/periods" : "/payables/payments");

export function ApprovalsQueue({ docTypes, title }: { docTypes?: ApprovalDocType[]; title?: string }) {
  const f = useFormat(); const { actingRole, can } = useApp(); const { data, isLoading, error, refetch } = useApprovalRequests();
  const [tab, setTab] = React.useState("pending"); const [sel, setSel] = React.useState<string | null>(null); const [comment, setComment] = React.useState("");
  const act = useEntityMutation((e, i: { id: string; action: "approve" | "reject"; comment?: string }) => services.approvals.act(e, { ...i, actingRole: actingRole?.name ?? "", canApprove: can("approvals", "approve") }), { success: (r) => r.message, onDone: (r) => { if (r.final) setSel(null); setComment(""); } });
  const note = useEntityMutation((e, i: { id: string; text: string }) => services.approvals.comment(e, i), { success: "Comment added", onDone: () => setComment("") });
  const rows = (data ?? []).filter((r) => !docTypes || docTypes.includes(r.docType)).filter((r) => tab === "all" || r.status === tab);
  const all = (data ?? []).filter((r) => !docTypes || docTypes.includes(r.docType));
  const cur = (data ?? []).find((r) => r.id === sel);
  const cols: Column<ApprovalRequest>[] = [
    { id: "ref", header: "Reference", accessor: (r) => r.docRef, cell: (r) => <span className="font-medium">{r.docRef}</span> }, { id: "type", header: "Type", accessor: (r) => DOC_LABEL[r.docType] }, { id: "title", header: "Description", accessor: (r) => r.title, className: "max-w-[280px] truncate" },
    { id: "by", header: "Requested by", accessor: (r) => r.requestedBy, hideBelow: "md" }, { id: "at", header: "Submitted", accessor: (r) => r.requestedAt, cell: (r) => formatDate(r.requestedAt), hideBelow: "md" },
    { id: "role", header: "Approver", accessor: (r) => r.approverRole, hideBelow: "lg" }, { id: "amt", header: "Amount", align: "right", accessor: (r) => r.amount, cell: (r) => (r.amount ? f.money(r.amount) : "—") }, { id: "s", header: "Status", accessor: (r) => r.status, cell: (r) => <StatusBadge status={r.status} /> },
  ];
  return (
    <>
      <div className="mb-3 grid grid-cols-3 gap-3"><StatCard label="Pending" value={String(all.filter((r) => r.status === "pending").length)} /><StatCard label="Approved" value={String(all.filter((r) => r.status === "approved").length)} /><StatCard label="Rejected" value={String(all.filter((r) => r.status === "rejected").length)} /></div>
      <SimNotice className="mb-3" title="Role simulation">You are acting as <b>{actingRole?.name}</b>. Approval buttons obey that role&apos;s permissions — change it from the profile menu. This is a UI simulation, not server-side authorisation.</SimNotice>
      <Tabs value={tab} onValueChange={setTab} className="mb-2"><TabsList><TabsTrigger value="pending">Pending</TabsTrigger><TabsTrigger value="approved">Approved</TabsTrigger><TabsTrigger value="rejected">Rejected</TabsTrigger><TabsTrigger value="all">All</TabsTrigger></TabsList></Tabs>
      <DataTable columns={cols} data={rows} rowKey={(r) => r.id} isLoading={isLoading} error={error as Error | null} onRetry={() => refetch()} onRowClick={(r) => setSel(r.id)} defaultSort={{ id: "at", dir: "desc" }} exportName={title ?? "approvals"} emptyTitle={`No ${tab === "all" ? "" : tab} requests`} emptyDescription="Requests appear here when a document exceeds an approval rule's limit."
        rowActions={(r) => [{ label: "Review…", icon: MessageSquare, onClick: () => setSel(r.id) }, { label: "Approve", icon: CheckCircle2, onClick: () => act.mutate({ id: r.id, action: "approve" }), hidden: () => r.status !== "pending" }, { label: "Reject", icon: XCircle, destructive: true, onClick: () => act.mutate({ id: r.id, action: "reject" }), hidden: () => r.status !== "pending" }]} />
      <DetailDrawer open={!!cur} onOpenChange={(o) => !o && setSel(null)} wide title={cur ? `${DOC_LABEL[cur.docType]} · ${cur.docRef}` : ""} description={cur?.title}
        footer={cur?.status === "pending" && <><Button variant="outline" size="sm" disabled={act.isPending} onClick={() => act.mutate({ id: cur.id, action: "reject", comment })}><XCircle /> Reject</Button><Button size="sm" disabled={act.isPending} onClick={() => act.mutate({ id: cur.id, action: "approve", comment })}><CheckCircle2 /> Approve</Button></>}>
        {cur && <>
          <dl className="grid grid-cols-2 gap-3"><KV label="Amount">{cur.amount ? f.money(cur.amount) : "—"}</KV><KV label="Status"><StatusBadge status={cur.status} /></KV><KV label="Requested by">{cur.requestedBy}</KV><KV label="Awaiting">{cur.status === "pending" ? cur.approverRole : "—"}</KV></dl>
          <Button variant="outline" size="sm" asChild><Link href={docHref(cur)}>Open {DOC_LABEL[cur.docType].toLowerCase()}</Link></Button>
          {cur.status === "pending" && !can("approvals", "approve") && <p className="tone-warning flex items-center gap-1.5 rounded-md border px-2 py-1.5 text-xs"><ShieldAlert className="size-3.5" /> {actingRole?.name} cannot approve. Switch role to simulate an approver.</p>}
          <div><p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Approval history</p>
            <ol className="space-y-2 border-l pl-3">{cur.history.map((h, i) => <li key={i} className="relative text-xs"><span className="absolute -left-[17px] top-1 size-2 rounded-full bg-action" /><p className="font-medium capitalize">{h.action}</p><p className="text-muted-foreground">{h.by} · {formatDateTime(h.at)}</p>{h.comment && <p className="mt-0.5 rounded bg-muted px-2 py-1">{h.comment}</p>}</li>)}</ol></div>
          <div className="space-y-2"><Textarea rows={2} placeholder="Add a comment (optional for approve / reject)…" value={comment} onChange={(e) => setComment(e.target.value)} />{comment && <Button size="xs" variant="outline" onClick={() => note.mutate({ id: cur.id, text: comment })}>Post comment only</Button>}</div>
        </>}
      </DetailDrawer>
    </>
  );
}

export function ApprovalRules() {
  const f = useFormat(); const confirm = useConfirm(); const { data, isLoading, error, refetch } = useApprovalRules(); const [edit, setEdit] = React.useState<ApprovalRule | "new" | null>(null);
  const save = useEntityMutation((e, i: Omit<ApprovalRule, "entityId" | "id"> & { id?: string }) => services.approvals.saveRule(e, i), { success: "Rule saved" });
  const del = useEntityMutation((e, id: string) => services.approvals.removeRule(e, id), { success: "Rule deleted" });
  const toggle = useEntityMutation((e, r: ApprovalRule) => services.approvals.saveRule(e, { ...r, enabled: !r.enabled }), { success: "Rule updated", optimistic: { key: ["approvalRules"], update: (old, r) => (old as ApprovalRule[] | undefined)?.map((x) => (x.id === r.id ? { ...x, enabled: !x.enabled } : x)) } });
  const cols: Column<ApprovalRule>[] = [
    { id: "n", header: "Rule", accessor: (r) => r.name, cell: (r) => <span className="font-medium">{r.name}</span> }, { id: "t", header: "Applies to", accessor: (r) => DOC_LABEL[r.docType] }, { id: "m", header: "Limit (from)", align: "right", accessor: (r) => r.minAmount, cell: (r) => (r.minAmount ? f.money(r.minAmount) : "Any amount") },
    { id: "a", header: "Approver", accessor: (r) => r.approverRole }, { id: "s", header: "Second approver", accessor: (r) => r.secondApproverRole ?? "—", hideBelow: "md" }, { id: "e", header: "Status", accessor: (r) => (r.enabled ? "active" : "paused"), cell: (r) => <StatusBadge status={r.enabled ? "active" : "paused"} /> },
  ];
  const roles = ["Owner", "Administrator", "Finance Manager", "Accountant"];
  return (
    <>
      <div className="mb-2 flex justify-end"><Button size="sm" onClick={() => setEdit("new")}><Plus /> New rule</Button></div>
      <DataTable columns={cols} data={data ?? []} rowKey={(r) => r.id} isLoading={isLoading} error={error as Error | null} onRetry={() => refetch()} hideSearch
        rowActions={(r) => [{ label: "Edit", icon: Pencil, onClick: () => setEdit(r) }, { label: r.enabled ? "Pause rule" : "Enable rule", icon: CheckCircle2, onClick: () => toggle.mutate(r) }, { label: "Delete", icon: Trash2, destructive: true, separatorBefore: true, onClick: async () => { if (await confirm({ title: `Delete “${r.name}”?`, description: "Documents of this type will no longer need approval.", destructive: true, confirmLabel: "Delete" })) del.mutate(r.id); } }]} />
      <FormDialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)} title={edit && edit !== "new" ? "Edit approval rule" : "New approval rule"} description="Documents at or above the limit require the approver before they are posted." schema={approvalRuleSchema} submitLabel="Save rule"
        fields={[{ name: "name", label: "Rule name", required: true, span: 2 }, { name: "docType", label: "Document type", type: "select", options: Object.entries(DOC_LABEL).map(([value, label]) => ({ value, label })) }, { name: "minAmount", label: "Approval limit (from amount)", type: "money", hint: "0 = every document" }, { name: "approverRole", label: "Approver", type: "select", options: roles.map((r) => ({ value: r, label: r })), required: true }, { name: "secondApproverRole", label: "Second approver (optional)", type: "select", options: roles.map((r) => ({ value: r, label: r })), allowEmpty: true }, { name: "enabled", label: "Rule enabled", type: "switch", span: 2 }]}
        defaultValues={edit && edit !== "new" ? { ...edit, secondApproverRole: edit.secondApproverRole ?? "" } : { name: "", docType: "journal", minAmount: 100000, approverRole: "Finance Manager", secondApproverRole: "", enabled: true }}
        onSubmit={async (v: Omit<ApprovalRule, "entityId" | "id">) => { await save.mutateAsync({ ...v, minAmount: Number(v.minAmount) || 0, secondApproverRole: v.secondApproverRole || undefined, id: edit && edit !== "new" ? edit.id : undefined }); }} />
      <span className="hidden">{titleCase("a")}{String(toast)}</span>
    </>
  );
}
