import * as React from "react";
import { ArrowDownRight, ArrowUpRight } from "lucide-react";
import { cn } from "@/lib/utils";

export function StatCard({ label, value, hint, delta, deltaGood, icon, onClick, className, valueClassName }: {
  label: string; value: React.ReactNode; hint?: React.ReactNode; delta?: number; deltaGood?: boolean; icon?: React.ReactNode; onClick?: () => void; className?: string; valueClassName?: string;
}) {
  const Comp = onClick ? "button" : "div";
  return (
    <Comp onClick={onClick} className={cn("group flex min-h-[96px] flex-col rounded-xl border bg-card p-3.5 text-left shadow-[0_1px_2px_rgb(16_24_40/0.04)] transition-all", onClick && "hover:-translate-y-px hover:border-soft hover:shadow-md focus-visible:ring-2 focus-visible:ring-ring", className)}>
      <div className="flex items-center justify-between gap-2">
        <span className="text-[12px] font-medium text-muted-foreground">{label}</span>
        {icon && <span className="flex size-7 items-center justify-center rounded-lg bg-accent text-primary">{icon}</span>}
      </div>
      <div className={cn("tnum mt-1.5 text-[19px] font-semibold leading-tight tracking-tight text-foreground", valueClassName)}>{value}</div>
      <div className="mt-1 flex items-center gap-2 text-[11px] text-muted-foreground">
        {delta !== undefined && Number.isFinite(delta) && (
          <span className={cn("inline-flex items-center gap-0.5 font-medium", deltaGood === undefined ? "text-muted-foreground" : deltaGood ? "text-[color-mix(in_srgb,var(--s-success)_70%,black)]" : "text-[color-mix(in_srgb,var(--s-error)_80%,black)]")}>
            {delta >= 0 ? <ArrowUpRight className="size-3" /> : <ArrowDownRight className="size-3" />}{Math.abs(delta).toFixed(1)}%
          </span>
        )}
        {hint && <span className="truncate">{hint}</span>}
      </div>
    </Comp>
  );
}

export function Panel({ title, description, actions, children, className, bodyClassName, noPad }: { title?: React.ReactNode; description?: React.ReactNode; actions?: React.ReactNode; children: React.ReactNode; className?: string; bodyClassName?: string; noPad?: boolean }) {
  return (
    <section className={cn("rounded-xl border bg-card shadow-[0_1px_2px_rgb(16_24_40/0.04)]", className)}>
      {(title || actions) && (
        <header className="flex items-start justify-between gap-2 border-b px-4 py-3">
          <div className="min-w-0"><h2 className="text-[13.5px] font-semibold text-foreground">{title}</h2>{description && <p className="text-xs text-muted-foreground">{description}</p>}</div>
          {actions && <div className="flex shrink-0 items-center gap-1.5">{actions}</div>}
        </header>
      )}
      <div className={cn(!noPad && "p-4", bodyClassName)}>{children}</div>
    </section>
  );
}

export function KV({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={cn("min-w-0", className)}>
      <dt className="text-[11px] font-medium uppercase tracking-wide text-muted-foreground">{label}</dt>
      <dd className="mt-0.5 break-words text-sm">{children || "—"}</dd>
    </div>
  );
}
