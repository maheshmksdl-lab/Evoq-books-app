"use client";

import * as React from "react";
import { AlertTriangle, CheckCircle2, Link2Off, Loader2, PlugZap, RefreshCw, WifiOff } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { Panel } from "@/components/shared/stat-card";
import { ErrorState, SimNotice, TableSkeleton } from "@/components/shared/states";
import { StatusBadge } from "@/components/shared/status-badge";
import { useBankFeeds, useEntityMutation } from "@/hooks/use-data";
import { services } from "@/services";
import { formatDateTime } from "@/lib/formatters";

const STATUS_ICON = { connected: CheckCircle2, syncing: Loader2, reconnect_required: PlugZap, error: AlertTriangle, disconnected: WifiOff } as const;

export default function BankFeedsPage() {
  const { data, isLoading, error, refetch } = useBankFeeds(); const [busy, setBusy] = React.useState<string | null>(null);
  const sync = useEntityMutation((e, id: string) => { setBusy(id); return services.banking.syncFeed(e, id).finally(() => setBusy(null)); }, { success: (n) => `Sync complete — ${n} new line${n === 1 ? "" : "s"} (sample data)` });
  const reconnect = useEntityMutation((e, id: string) => { setBusy(id); return services.banking.reconnectFeed(e, id).finally(() => setBusy(null)); }, { success: "Re-authorised (simulated)" });
  const disconnect = useEntityMutation((e, id: string) => services.banking.disconnectFeed(e, id), { success: "Feed disconnected" });
  return (
    <>
      <PageHeader title="Bank Feeds" description="Automatic statement import status for connected banks. Providers shown here are sample integrations." />
      <SimNotice className="mb-3" title="Sample providers">“SampleBank Connect” and “OpenLedger Aggregator” are placeholder providers. No real bank connectivity exists — sync, reconnect and errors are simulated.</SimNotice>
      {error ? <ErrorState error={error as Error} onRetry={() => refetch()} /> : isLoading ? <TableSkeleton rows={4} /> : (
        <div className="grid gap-4 lg:grid-cols-2">
          {(data ?? []).map((fd) => { const I = STATUS_ICON[fd.status]; const working = busy === fd.id; return (
            <Panel key={fd.id} title={<span className="flex items-center gap-2"><I className={`size-4 ${fd.status === "syncing" || working ? "animate-spin" : ""}`} />{fd.bankName}</span>} description={fd.provider} actions={<StatusBadge status={working ? "syncing" : fd.status} />} noPad>
              <div className="space-y-2 p-3">
                <dl className="grid grid-cols-2 gap-2 text-[13px]"><div><dt className="text-[11px] uppercase text-muted-foreground">Linked accounts</dt><dd>{fd.accounts.join(", ")}</dd></div><div><dt className="text-[11px] uppercase text-muted-foreground">Last synchronisation</dt><dd>{fd.lastSync ? formatDateTime(fd.lastSync) : "Never"}</dd></div></dl>
                {fd.errorMessage && <p className={`${fd.status === "error" ? "tone-error" : "tone-warning"} rounded-md border px-2 py-1.5 text-xs`}>{fd.errorMessage}</p>}
                <div className="flex flex-wrap gap-2">
                  {(fd.status === "reconnect_required" || fd.status === "disconnected") ? <Button size="sm" disabled={working} onClick={() => reconnect.mutate(fd.id)}><PlugZap /> {fd.status === "disconnected" ? "Connect" : "Reconnect"}</Button> : <Button size="sm" disabled={working} onClick={() => sync.mutate(fd.id)}>{working ? <Loader2 className="animate-spin" /> : <RefreshCw />} Sync now</Button>}
                  {fd.status !== "disconnected" && <Button size="sm" variant="outline" onClick={() => disconnect.mutate(fd.id)}><Link2Off /> Disconnect</Button>}
                </div>
              </div>
              <div className="border-t"><p className="px-3 pt-2 text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Sync history</p>
                <ul className="divide-y">{fd.history.slice(0, 5).map((h) => <li key={h.id} className="flex items-center gap-2 px-3 py-1.5 text-xs"><StatusBadge status={h.result} /><span className="min-w-0 flex-1 truncate text-muted-foreground">{h.message}</span><span className="tnum text-muted-foreground">{h.imported} lines · {formatDateTime(h.at)}</span></li>)}{fd.history.length === 0 && <li className="px-3 py-3 text-xs text-muted-foreground">No syncs yet.</li>}</ul></div>
            </Panel>); })}
        </div>)}
    </>
  );
}
