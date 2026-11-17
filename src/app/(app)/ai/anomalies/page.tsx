"use client";

import * as React from "react";
import Link from "next/link";
import { AlertOctagon, CheckCheck, Copy, Eye, SearchX, TrendingUp, Undo2, Wallet, Waypoints } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { SelectField } from "@/components/shared/form-controls";
import { EmptyState, ErrorState, TableSkeleton } from "@/components/shared/states";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { AiBadge, AiDisclaimer } from "@/components/features/ai-parts";
import { useAnomalies, useEntityMutation } from "@/hooks/use-data";
import { useFormat } from "@/providers/app-provider";
import { services } from "@/services";
import { formatDate, titleCase } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import type { Anomaly } from "@/types";

const ICON = { duplicate: Copy, unusual_amount: TrendingUp, unexpected_movement: Wallet, payment_pattern: Waypoints, missing_entry: SearchX, reconciliation: AlertOctagon } as const;
const HREF = (a: Anomaly) => (a.refType === "bill" ? `/payables/bills/${a.refId}` : a.refType === "expense" ? `/expenses/${a.refId}` : a.refType === "journal" ? `/accounting/journals/${a.refId}` : a.refType === "vendor" ? `/payables/vendors/${a.refId}` : "/banking/reconciliation");
const SEV = { high: "error", medium: "warning", low: "info" } as const;

export default function AnomaliesPage() {
  const f = useFormat(); const { data, isLoading, error, refetch } = useAnomalies(); const [sev, setSev] = React.useState("all"); const [kind, setKind] = React.useState("all"); const [status, setStatus] = React.useState("open");
  const review = useEntityMutation((e, i: { id: string; reviewed: boolean }) => services.ai.markReviewed(e, i), { success: (a) => (a.status === "reviewed" ? "Marked as reviewed" : "Re-opened"), optimistic: { key: ["ai", "anomalies"], update: (old, i) => (old as Anomaly[] | undefined)?.map((a) => (a.id === i.id ? { ...a, status: i.reviewed ? "reviewed" : "open" } : a)) } });
  if (error) return <ErrorState error={error as Error} onRetry={() => refetch()} />;
  const all = data ?? []; const rows = all.filter((a) => (sev === "all" || a.severity === sev) && (kind === "all" || a.kind === kind) && (status === "all" || a.status === status)).sort((a, b) => ["high", "medium", "low"].indexOf(a.severity) - ["high", "medium", "low"].indexOf(b.severity));
  const open = all.filter((a) => a.status === "open");
  return (
    <>
      <PageHeader title="Anomaly & Duplicate Detection" description="Unusual amounts, duplicates, unexpected movements, payment patterns, missing entries and reconciliation discrepancies." />
      <AiDisclaimer>Alerts come from fixed detection rules over the sample data (e.g. repeated bill numbers, outlier amounts). Review each one — nothing is changed automatically.</AiDisclaimer>
      <div className="mb-3 grid grid-cols-2 gap-3 lg:grid-cols-4"><StatCard label="Open alerts" value={String(open.length)} /><StatCard label="High severity" value={String(open.filter((a) => a.severity === "high").length)} valueClassName={open.some((a) => a.severity === "high") ? "text-error" : undefined} /><StatCard label="Potential exposure" value={f.money(open.reduce((s, a) => s + (a.amount ?? 0), 0))} hint="sum of flagged amounts" /><StatCard label="Reviewed" value={String(all.filter((a) => a.status === "reviewed").length)} /></div>
      <div className="mb-3 flex flex-wrap gap-2"><div className="w-36"><SelectField size="sm" value={status} onChange={setStatus} options={[{ value: "open", label: "Open" }, { value: "reviewed", label: "Reviewed" }, { value: "all", label: "All" }]} /></div><div className="w-36"><SelectField size="sm" value={sev} onChange={setSev} options={[{ value: "all", label: "All severities" }, { value: "high", label: "High" }, { value: "medium", label: "Medium" }, { value: "low", label: "Low" }]} /></div><div className="w-52"><SelectField size="sm" value={kind} onChange={setKind} options={[{ value: "all", label: "All types" }, ...Object.keys(ICON).map((k) => ({ value: k, label: titleCase(k) }))]} /></div></div>
      {isLoading ? <TableSkeleton rows={5} /> : rows.length === 0 ? <EmptyState icon={CheckCheck} title="No alerts match" description="Nothing needs attention with these filters." /> : (
        <ul className="space-y-3">{rows.map((a) => { const I = ICON[a.kind]; return (
          <li key={a.id} className={cn("rounded-lg border bg-card p-3", a.status === "reviewed" && "opacity-70")}>
            <div className="flex flex-wrap items-start gap-3">
              <span className={cn(`tone-${SEV[a.severity]}`, "flex size-9 shrink-0 items-center justify-center rounded-lg border")}><I className="size-4" /></span>
              <div className="min-w-0 flex-1">
                <div className="flex flex-wrap items-center gap-2"><p className="font-medium">{a.title}</p><StatusBadge status={a.severity} /><AiBadge>Detected</AiBadge>{a.status === "reviewed" && <StatusBadge status="reviewed" />}</div>
                <p className="mt-0.5 text-[13px] text-muted-foreground">{a.description}</p>
                <dl className="mt-2 grid gap-2 text-xs md:grid-cols-3"><div><dt className="font-semibold uppercase tracking-wide text-muted-foreground">Relevant transaction</dt><dd><Link className="text-primary hover:underline" href={HREF(a)}>{a.refLabel}</Link>{a.amount ? <span className="tnum"> · {f.money(a.amount)}</span> : null}</dd></div><div><dt className="font-semibold uppercase tracking-wide text-muted-foreground">Why flagged</dt><dd>{a.explanation}</dd></div><div><dt className="font-semibold uppercase tracking-wide text-muted-foreground">Suggested next action</dt><dd>{a.nextAction}</dd></div></dl>
                <p className="mt-1.5 text-[11px] text-muted-foreground">Detected {formatDate(a.detectedAt)}</p>
              </div>
              <div className="flex shrink-0 gap-2"><Button size="sm" variant="outline" asChild><Link href={HREF(a)}><Eye /> Open</Link></Button>{a.status === "open" ? <Button size="sm" onClick={() => review.mutate({ id: a.id, reviewed: true })}><CheckCheck /> Mark reviewed</Button> : <Button size="sm" variant="ghost" onClick={() => review.mutate({ id: a.id, reviewed: false })}><Undo2 /> Re-open</Button>}</div>
            </div>
          </li>); })}</ul>)}
    </>
  );
}
