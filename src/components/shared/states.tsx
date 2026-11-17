"use client";

import * as React from "react";
import { AlertTriangle, Inbox, RefreshCw, FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";

export function EmptyState({ title = "Nothing here yet", description, action, icon: Icon = Inbox, className }: { title?: string; description?: React.ReactNode; action?: React.ReactNode; icon?: React.ComponentType<{ className?: string }>; className?: string }) {
  return (
    <div className={cn("flex flex-col items-center justify-center gap-2 px-6 py-12 text-center", className)}>
      <div className="flex size-10 items-center justify-center rounded-full bg-accent text-accent-foreground"><Icon className="size-5" /></div>
      <p className="text-sm font-medium">{title}</p>
      {description && <p className="max-w-sm text-xs text-muted-foreground">{description}</p>}
      {action && <div className="mt-1">{action}</div>}
    </div>
  );
}

export function ErrorState({ error, onRetry, className }: { error?: Error | null; onRetry?: () => void; className?: string }) {
  return (
    <div role="alert" className={cn("flex flex-col items-center justify-center gap-2 px-6 py-10 text-center", className)}>
      <div className="tone-error flex size-10 items-center justify-center rounded-full border"><AlertTriangle className="size-5" /></div>
      <p className="text-sm font-medium">We couldn&apos;t load this data</p>
      <p className="max-w-md text-xs text-muted-foreground">{error?.message ?? "An unexpected error occurred in the mock service."}</p>
      {onRetry && <Button size="sm" variant="outline" onClick={onRetry}><RefreshCw /> Try again</Button>}
    </div>
  );
}

export function TableSkeleton({ rows = 8, cols = 5 }: { rows?: number; cols?: number }) {
  return (
    <div className="space-y-2 p-3" aria-busy="true" aria-label="Loading">
      {Array.from({ length: rows }).map((_, i) => (
        <div key={i} className="flex gap-3">{Array.from({ length: cols }).map((_, j) => <Skeleton key={j} className={cn("h-5", j === 0 ? "w-28" : "flex-1")} />)}</div>
      ))}
    </div>
  );
}

export function CardSkeleton({ height = 220 }: { height?: number }) {
  return <Skeleton className="w-full rounded-lg" style={{ height }} />;
}

/** Marks screens/actions that only simulate behaviour that would need a backend or external service. */
export function SimNotice({ children, className, title = "Simulated" }: { children: React.ReactNode; className?: string; title?: string }) {
  return (
    <div className={cn("flex items-start gap-2 rounded-lg border border-dashed border-soft bg-surface px-3 py-2 text-xs text-muted-foreground", className)}>
      <FlaskConical className="mt-0.5 size-3.5 shrink-0 text-primary" />
      <p><span className="font-semibold text-primary">{title}.</span> {children}</p>
    </div>
  );
}

export function SimTag({ children = "Simulated" }: { children?: React.ReactNode }) {
  return <span className="inline-flex items-center gap-1 rounded-full border border-dashed border-soft bg-surface px-1.5 py-0.5 text-[10px] font-medium text-primary"><FlaskConical className="size-2.5" />{children}</span>;
}
