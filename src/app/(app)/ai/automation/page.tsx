"use client";

import * as React from "react";
import { Pencil, Play, Plus, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable, type Column } from "@/components/shared/data-table";
import { DetailDrawer } from "@/components/shared/detail-drawer";
import { FormDialog } from "@/components/shared/form-dialog";
import { KV } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { useConfirm } from "@/components/shared/confirm";
import { AiDisclaimer } from "@/components/features/ai-parts";
import { useAutomations, useEntityMutation } from "@/hooks/use-data";
import { services } from "@/services";
import { automationSchema } from "@/lib/validators";
import { formatDateTime } from "@/lib/formatters";
import type { Automation } from "@/types";

const TRIGGERS = ["Invoice due date passes", "Daily at 06:00", "Bank balance changes", "Last day of month", "Bank transaction imported", "1st of month", "Bill approved", "Expense submitted"];
const FIELDS = ["Outstanding amount", "Days to due", "Total bank balance", "Template status", "Days unmatched", "Amount", "Vendor", "Category"];
const ACTIONS = ["Notify Finance team (in-app)", "Flag bill & add to payment proposal", "Alert Owner & Finance Manager", "Create DRAFT journals from templates", "Notify Accountant", "Generate summary report & notify Owner"];

export default function AutomationPage() {
  const confirm = useConfirm(); const { data, isLoading, error, refetch } = useAutomations(); const [edit, setEdit] = React.useState<Automation | "new" | null>(null); const [sel, setSel] = React.useState<string | null>(null);
  const save = useEntityMutation((e, i: Parameters<typeof services.ai.saveAutomation>[1]) => services.ai.saveAutomation(e, i), { success: "Rule saved" });
  const toggle = useEntityMutation((e, id: string) => services.ai.toggleAutomation(e, id), { success: (a) => `Rule ${a.status === "active" ? "activated" : "paused"}`, optimistic: { key: ["ai", "automations"], update: (old, id) => (old as Automation[] | undefined)?.map((a) => (a.id === id ? { ...a, status: a.status === "active" ? "paused" : "active" } : a)) } });
  const del = useEntityMutation((e, id: string) => services.ai.removeAutomation(e, id), { success: "Rule deleted" });
  const run = useEntityMutation((e, id: string) => services.ai.runAutomation(e, id), { success: "Rule executed (simulated)" });
  const cur = (data ?? []).find((a) => a.id === sel);
  const cols: Column<Automation>[] = [
    { id: "n", header: "Automation", accessor: (a) => a.name, cell: (a) => <span className="font-medium">{a.name}</span>, className: "max-w-[280px]" }, { id: "t", header: "Trigger", accessor: (a) => a.trigger, hideBelow: "md" },
    { id: "c", header: "Conditions", accessor: (a) => a.conditions.map((c) => `${c.field} ${c.operator} ${c.value}`).join("; "), cell: (a) => <span className="text-xs text-muted-foreground">{a.conditions.map((c) => `${c.field} ${c.operator} ${c.value}`).join("; ") || "—"}</span>, hideBelow: "lg" },
    { id: "a", header: "Action", accessor: (a) => a.action, hideBelow: "lg", className: "max-w-[220px] truncate" }, { id: "l", header: "Last executed", accessor: (a) => a.lastExecuted ?? "", cell: (a) => (a.lastExecuted ? formatDateTime(a.lastExecuted) : "Never"), hideBelow: "md" },
    { id: "s", header: "Status", accessor: (a) => a.status, cell: (a) => <span className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}><Switch checked={a.status === "active"} onCheckedChange={() => toggle.mutate(a.id)} aria-label={`${a.name} active`} /><StatusBadge status={a.status} /></span> },
  ];
  return (
    <>
      <PageHeader title="Automation Rules" description="When something happens, do something — notifications and prepared drafts. All execution is simulated." actions={<Button size="sm" onClick={() => setEdit("new")}><Plus /> New rule</Button>} />
      <AiDisclaimer>Rules evaluate sample data on demand. No notifications are delivered and no accounting records are posted by automations.</AiDisclaimer>
      <DataTable columns={cols} data={data ?? []} rowKey={(a) => a.id} isLoading={isLoading} error={error as Error | null} onRetry={() => refetch()} hideSearch onRowClick={(a) => setSel(a.id)} emptyTitle="No automation rules"
        rowActions={(a) => [{ label: "Run now (simulated)", icon: Play, onClick: () => run.mutate(a.id) }, { label: "Edit", icon: Pencil, onClick: () => setEdit(a) }, { label: "Delete", icon: Trash2, destructive: true, separatorBefore: true, onClick: async () => { if (await confirm({ title: `Delete “${a.name}”?`, destructive: true, confirmLabel: "Delete" })) del.mutate(a.id); } }]} />
      <DetailDrawer open={!!cur} onOpenChange={(o) => !o && setSel(null)} wide title={cur?.name ?? ""} description={cur?.trigger} footer={cur && <><Button variant="outline" size="sm" onClick={() => { setEdit(cur); setSel(null); }}><Pencil /> Edit</Button><Button size="sm" disabled={run.isPending} onClick={() => run.mutate(cur.id)}><Play /> Run now (simulated)</Button></>}>
        {cur && <><dl className="grid grid-cols-2 gap-3"><KV label="Status"><StatusBadge status={cur.status} /></KV><KV label="Last executed">{cur.lastExecuted ? formatDateTime(cur.lastExecuted) : "Never"}</KV><KV label="Trigger">{cur.trigger}</KV><KV label="Action">{cur.action}</KV><KV label="Conditions" className="col-span-2">{cur.conditions.length ? cur.conditions.map((c, i) => <span key={i} className="mr-2 inline-block rounded border bg-surface px-2 py-0.5 text-xs">{c.field} {c.operator} {c.value}</span>) : "None — runs every time"}</KV></dl>
          <div><p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Execution history</p>{cur.executions.length === 0 ? <p className="text-xs text-muted-foreground">Not executed yet.</p> : <ol className="space-y-2 border-l pl-3">{cur.executions.map((x) => <li key={x.id} className="relative text-xs"><span className="absolute -left-[17px] top-1 size-2 rounded-full bg-action" /><p className="flex items-center gap-2"><StatusBadge status={x.result} /><span className="text-muted-foreground">{formatDateTime(x.at)}</span></p><p className="mt-0.5">{x.message}</p></li>)}</ol>}</div></>}
      </DetailDrawer>
      <FormDialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)} size="lg" title={edit && edit !== "new" ? "Edit automation rule" : "New automation rule"} description="Trigger → conditions → action. The rule is executed in simulation only." submitLabel="Save rule" schema={automationSchema}
        fields={[{ name: "name", label: "Automation name", required: true, span: 2 }, { name: "trigger", label: "Trigger", type: "select", options: TRIGGERS.map((t) => ({ value: t, label: t })), required: true }, { name: "action", label: "Action", type: "select", options: ACTIONS.map((t) => ({ value: t, label: t })), required: true }, { name: "field", label: "Condition – field", type: "select", options: FIELDS.map((t) => ({ value: t, label: t })) }, { name: "operator", label: "Operator", type: "select", options: [">", "<", ">=", "<=", "=", "≠"].map((o) => ({ value: o, label: o })) }, { name: "value", label: "Value", required: true }, { name: "status", label: "Status", type: "select", options: [{ value: "active", label: "Active" }, { value: "paused", label: "Paused" }] }]}
        defaultValues={edit && edit !== "new" ? { name: edit.name, trigger: edit.trigger, action: edit.action, field: edit.conditions[0]?.field ?? FIELDS[0], operator: edit.conditions[0]?.operator ?? ">", value: edit.conditions[0]?.value ?? "", status: edit.status } : { name: "", trigger: TRIGGERS[0], action: ACTIONS[0], field: FIELDS[0], operator: ">", value: "", status: "active" }}
        onSubmit={async (v: { name: string; trigger: string; action: string; field: string; operator: string; value: string; status: "active" | "paused" }) => { await save.mutateAsync({ id: edit && edit !== "new" ? edit.id : undefined, name: v.name, trigger: v.trigger, action: v.action, status: v.status, conditions: [{ field: v.field, operator: v.operator, value: v.value }] }); }} />
    </>
  );
}
