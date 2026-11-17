import { cn } from "@/lib/utils";
import { titleCase } from "@/lib/formatters";

type Tone = "success" | "warning" | "error" | "neutral" | "info";

/** Financial statuses always use fixed semantic colours — never the product theme. */
const TONES: Record<string, Tone> = {
  paid: "success", posted: "success", approved: "success", reconciled: "success", matched: "success", active: "success", connected: "success", recorded: "success", accepted: "success", executed: "success", closed: "neutral", locked: "neutral", deposited: "success", reviewed: "success", success: "success", applied: "success", completed: "success", open_ok: "success",
  pending: "warning", pending_approval: "warning", partial: "warning", sent: "info", proposed: "warning", awaiting_approval: "warning", syncing: "info", in_progress: "warning", invited: "warning", deducted: "warning", reconnect_required: "warning", skipped: "neutral", changed: "info", medium: "warning", low: "info", open: "info", unmatched: "warning", categorized: "info", difference: "warning",
  overdue: "error", rejected: "error", error: "error", failed: "error", high: "error", void: "neutral", written_off: "error", disabled: "error", disposed: "neutral",
  draft: "neutral", inactive: "neutral", disconnected: "neutral", paused: "neutral", idle: "neutral", excluded: "neutral", reversed: "neutral", transferred: "info", pending_review: "warning",
};

export function StatusBadge({ status, label, className, tone }: { status: string; label?: string; className?: string; tone?: Tone }) {
  const t = tone ?? TONES[status] ?? "neutral";
  return (
    <span className={cn(`tone-${t} inline-flex h-5 shrink-0 items-center gap-1 whitespace-nowrap rounded-full border px-2 text-[11px] font-medium leading-none`, className)}>
      <span className="size-1.5 rounded-full bg-current opacity-70" aria-hidden />
      {label ?? titleCase(status)}
    </span>
  );
}
