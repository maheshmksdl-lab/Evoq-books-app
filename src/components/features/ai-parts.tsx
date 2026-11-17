"use client";

import { FlaskConical, Sparkles } from "lucide-react";
import { cn } from "@/lib/utils";

export function ConfidenceBar({ value, className }: { value: number; className?: string }) {
  const pct = Math.round(value * 100); const tone = pct >= 90 ? "var(--s-success)" : pct >= 75 ? "var(--t-action)" : "var(--s-warning)";
  return (
    <div className={cn("flex items-center gap-2", className)} title={`Confidence ${pct}%`}>
      <div className="h-1.5 w-16 overflow-hidden rounded-full bg-muted" role="meter" aria-valuenow={pct} aria-valuemin={0} aria-valuemax={100} aria-label="Confidence"><div className="h-full rounded-full" style={{ width: `${pct}%`, background: tone }} /></div>
      <span className="tnum text-xs font-medium">{pct}%</span>
    </div>
  );
}

export function AiBadge({ children = "AI suggestion" }: { children?: React.ReactNode }) {
  return <span className="inline-flex items-center gap-1 rounded-full border border-dashed border-action/60 bg-accent px-2 py-0.5 text-[10px] font-medium text-primary"><Sparkles className="size-3" />{children}</span>;
}

/** Persistent reminder that nothing on the AI screens is a live model or an automatic ledger action. */
export function AiDisclaimer({ children }: { children?: React.ReactNode }) {
  return (
    <div className="mb-3 flex items-start gap-2 rounded-lg border border-dashed border-soft bg-surface px-3 py-2 text-xs text-muted-foreground">
      <FlaskConical className="mt-0.5 size-3.5 shrink-0 text-primary" />
      <p><span className="font-semibold text-primary">Simulated AI.</span> {children ?? "Responses are prepared logic over the sample data — no live AI model, OCR or agent runtime is connected. Suggestions never post to the ledger automatically."}</p>
    </div>
  );
}
