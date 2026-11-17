"use client";

import * as React from "react";
import { Bot, Check, ChevronRight, ClipboardCheck, Loader2, RefreshCw, ShieldCheck, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/shared/page-header";
import { ErrorState, TableSkeleton } from "@/components/shared/states";
import { KV, Panel } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { AiBadge, AiDisclaimer } from "@/components/features/ai-parts";
import { useAgents, useEntityMutation } from "@/hooks/use-data";
import { useFormat } from "@/providers/app-provider";
import { services } from "@/services";
import { formatDateTime } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import type { Agent, AgentTask } from "@/types";

const FLOW = ["Agent reviews mock data", "Agent prepares a proposed action", "You review it", "You approve or reject", "Frontend simulates execution", "Activity history records the result"];

export default function AgentsPage() {
  const f = useFormat(); const { data, isLoading, error, refetch } = useAgents(); const [sel, setSel] = React.useState<string | null>(null); const [review, setReview] = React.useState<{ agent: Agent; task: AgentTask } | null>(null);
  const decide = useEntityMutation((e, i: { agentId: string; taskId: string; action: "approve" | "reject" }) => services.ai.decideTask(e, i), { success: (_, i) => (i.action === "approve" ? "Approved — action executed in simulation" : "Proposal rejected"), onDone: () => setReview(null) });
  const run = useEntityMutation((e, id: string) => services.ai.runAgent(e, id), { success: "Agent re-scanned the books (simulated)" });
  if (error) return <ErrorState error={error as Error} onRetry={() => refetch()} />;
  if (isLoading || !data) return <TableSkeleton rows={5} />;
  const agent = data.find((a) => a.id === sel) ?? data[0]; const proposed = (a: Agent) => a.tasks.filter((t) => t.status === "proposed").length;
  return (
    <>
      <PageHeader title="AI Agents" description="Workspace agents that review the books and prepare actions — you decide what happens." />
      <AiDisclaimer>No real agent runtime exists. Each agent prepares a proposal from sample data; <b>nothing executes until you approve</b>, and execution only changes the mock books.</AiDisclaimer>
      <ol className="mb-4 grid gap-2 sm:grid-cols-3 xl:grid-cols-6">{FLOW.map((s, i) => <li key={s} className={cn("flex items-center gap-2 rounded-lg border bg-card px-2.5 py-2 text-xs", (i === 2 || i === 3) && "border-action bg-accent/40")}><span className="flex size-5 shrink-0 items-center justify-center rounded-full bg-primary text-[10px] font-semibold text-white">{i + 1}</span>{s}</li>)}</ol>
      <div className="grid gap-4 xl:grid-cols-[320px_1fr]">
        <ul className="space-y-2">{data.map((a) => (
          <li key={a.id}><button onClick={() => setSel(a.id)} className={cn("w-full rounded-lg border bg-card p-3 text-left transition-colors hover:border-soft hover:bg-surface", agent?.id === a.id && "border-action bg-accent/40")}>
            <div className="flex items-start gap-2"><span className="flex size-8 shrink-0 items-center justify-center rounded-md bg-depth text-white"><Bot className="size-4" /></span><div className="min-w-0 flex-1"><p className="text-sm font-medium">{a.name}</p><p className="line-clamp-2 text-xs text-muted-foreground">{a.description}</p></div><ChevronRight className="mt-1 size-4 text-muted-foreground" /></div>
            <div className="mt-2 flex items-center justify-between text-[11px]"><StatusBadge status={a.status} /><span className="text-muted-foreground">{proposed(a) ? `${proposed(a)} proposal${proposed(a) > 1 ? "s" : ""} awaiting you` : "No open proposals"}</span></div></button></li>))}</ul>
        {agent && (
          <div className="space-y-4">
            <Panel title={<span className="flex items-center gap-2">{agent.name} <AiBadge>Simulated agent</AiBadge></span>} description={agent.description} actions={<Button size="sm" variant="outline" onClick={() => run.mutate(agent.id)} disabled={run.isPending}>{run.isPending ? <Loader2 className="animate-spin" /> : <RefreshCw />} Re-scan</Button>}>
              <dl className="grid gap-3 sm:grid-cols-3"><KV label="Status"><StatusBadge status={agent.status} /></KV><KV label="Last activity">{formatDateTime(agent.lastActivity)}</KV><KV label="Open proposals">{proposed(agent)}</KV></dl>
              <div className="mt-3"><p className="mb-1 text-[11px] font-medium uppercase tracking-wide text-muted-foreground">Available actions</p><div className="flex flex-wrap gap-1.5">{agent.actions.map((x) => <span key={x} className="rounded-full border bg-surface px-2.5 py-0.5 text-xs">{x}</span>)}</div></div>
            </Panel>
            <Tabs defaultValue="tasks"><TabsList><TabsTrigger value="tasks">Suggested tasks ({agent.tasks.length})</TabsTrigger><TabsTrigger value="history">Activity history ({agent.history.length})</TabsTrigger></TabsList>
              <TabsContent value="tasks" className="mt-3 space-y-3">{agent.tasks.map((t) => (
                <div key={t.id} className="rounded-lg border bg-card p-3">
                  <div className="flex flex-wrap items-start gap-2"><div className="min-w-0 flex-1"><p className="flex flex-wrap items-center gap-2 font-medium">{t.title} <StatusBadge status={t.status} />{t.requiresApproval && <span className="inline-flex items-center gap-1 rounded-full border border-warning/40 px-2 text-[10px] text-[color-mix(in_srgb,var(--s-warning)_50%,black)]"><ShieldCheck className="size-3" />Approval required</span>}</p><p className="mt-0.5 text-[13px] text-muted-foreground">{t.description}</p></div>
                    {t.status === "proposed" && <Button size="sm" onClick={() => setReview({ agent, task: t })}><ClipboardCheck /> Review proposal</Button>}</div>
                  <p className="mt-1 text-[11px] text-muted-foreground">{t.items.length} item{t.items.length === 1 ? "" : "s"} · Impact: {t.impact}</p></div>))}</TabsContent>
              <TabsContent value="history" className="mt-3"><Panel noPad><ol className="divide-y">{agent.history.map((h) => <li key={h.id} className="flex items-start gap-3 px-3 py-2 text-[13px]"><StatusBadge status={h.outcome === "info" ? "draft" : h.outcome} label={h.outcome === "info" ? "Info" : undefined} /><span className="min-w-0 flex-1">{h.text}</span><span className="shrink-0 text-xs text-muted-foreground">{formatDateTime(h.at)}</span></li>)}</ol></Panel></TabsContent></Tabs>
          </div>)}
      </div>
      <Dialog open={!!review} onOpenChange={(o) => !o && setReview(null)}>
        <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-2xl">
          <DialogHeader><DialogTitle>Review proposed action</DialogTitle><DialogDescription>{review?.agent.name} prepared this proposal from the sample data.</DialogDescription></DialogHeader>
          {review && <div className="space-y-3">
            <div><p className="font-medium">{review.task.title}</p><p className="text-sm text-muted-foreground">{review.task.description}</p></div>
            <div className="max-h-64 overflow-y-auto rounded-md border"><table className="w-full text-[13px]"><thead className="bg-muted/50 text-[11px] uppercase text-muted-foreground"><tr><th className="px-3 py-1.5 text-left">Item</th><th className="px-3 py-1.5 text-left">Detail</th><th className="px-3 py-1.5 text-right">Amount</th></tr></thead><tbody>{review.task.items.map((it, i) => <tr key={i} className="border-t"><td className="px-3 py-1.5">{it.label}</td><td className="px-3 py-1.5 text-muted-foreground">{it.detail}</td><td className="num px-3 py-1.5">{it.amount ? f.money(it.amount) : ""}</td></tr>)}</tbody></table></div>
            <p className="tone-info rounded-md border px-3 py-2 text-xs"><b>If approved:</b> {review.task.impact}</p>
            {review.task.requiresApproval && <p className="tone-warning flex items-center gap-2 rounded-md border px-3 py-2 text-xs"><ShieldCheck className="size-4" /> This could affect accounting records or payments, so your explicit approval is mandatory. It will not run otherwise.</p>}
          </div>}
          <DialogFooter><Button variant="outline" disabled={decide.isPending} onClick={() => decide.mutate({ agentId: review!.agent.id, taskId: review!.task.id, action: "reject" })}><X /> Reject</Button><Button disabled={decide.isPending} onClick={() => decide.mutate({ agentId: review!.agent.id, taskId: review!.task.id, action: "approve" })}>{decide.isPending ? <Loader2 className="animate-spin" /> : <Check />} Approve & execute (simulated)</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
