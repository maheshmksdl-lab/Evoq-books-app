"use client";

import * as React from "react";
import { Check, RotateCcw } from "lucide-react";
import { toast } from "sonner";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { PageHeader } from "@/components/shared/page-header";
import { Panel } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { useConfirm } from "@/components/shared/confirm";
import { PALETTE_ROLES, THEMES, type ProductTheme } from "@/lib/themes/themes";
import { resetDemoData } from "@/lib/mock/db";
import { useTheme } from "@/providers/theme-provider";
import { cn } from "@/lib/utils";

/** Mini application preview painted with a theme's own palette (independent of the active theme). */
function ThemePreview({ t }: { t: ProductTheme }) {
  const p = t.palette; const light = t.chrome === "light";
  return (
    <div className="overflow-hidden rounded-lg border" style={{ background: "#F8FAFC" }} aria-hidden>
      <div className="flex h-28">
        <div className="w-14 shrink-0 space-y-1.5 p-2" style={light ? { background: "#fff", borderRight: "1px solid #E6EAF0" } : { background: p.depth }}>
          <div className="h-2 w-8 rounded" style={{ background: light ? p.primary : p.soft }} />
          {[0, 1, 2, 3].map((i) => <div key={i} className="h-1.5 rounded" style={{ background: i === 1 ? (light ? p.tint : p.action) : light ? "#E6EAF0" : "rgba(255,255,255,0.22)", width: i === 1 ? "100%" : "75%", borderLeft: light && i === 1 ? `2px solid ${p.primary}` : undefined }} />)}
        </div>
        <div className="flex-1 space-y-1.5 p-2">
          <div className="flex items-center justify-between"><div className="h-2 w-16 rounded bg-[#1F2430]/70" /><div className="h-4 w-12 rounded text-[8px] leading-4 text-white" style={{ background: p.primary }}><span className="block text-center">Save</span></div></div>
          <div className="grid grid-cols-3 gap-1">{[0, 1, 2].map((i) => <div key={i} className="rounded border bg-white p-1" style={{ borderColor: "#E6EAF0" }}><div className="h-1 w-6 rounded bg-[#9BA8B7]" /><div className="mt-1 h-2 w-9 rounded" style={{ background: i === 0 ? p.primary : "#1F2430", opacity: i === 0 ? 1 : 0.8 }} /></div>)}</div>
          <div className="rounded border bg-white" style={{ borderColor: "#E6EAF0" }}>{[0, 1, 2].map((i) => <div key={i} className="flex items-center gap-1 border-b px-1.5 py-1 last:border-0" style={{ borderColor: "#E6EAF0", background: i === 1 ? p.tint : undefined }}><div className="h-1 w-8 rounded bg-[#5F6B7A]/60" /><div className="ml-auto h-1 w-6 rounded" style={{ background: i === 1 ? p.action : "#9BA8B7" }} /></div>)}</div>
        </div>
      </div>
    </div>
  );
}

export default function AppearancePage() {
  const { theme, setTheme } = useTheme(); const confirm = useConfirm(); const qc = useQueryClient();
  const [simErr, setSimErr] = React.useState(false);
  React.useEffect(() => { try { setSimErr(localStorage.getItem("evoq-books:simulate-error") === "1"); } catch { /* ignore */ } }, []);
  const toggleErr = (v: boolean) => { setSimErr(v); try { v ? localStorage.setItem("evoq-books:simulate-error", "1") : localStorage.removeItem("evoq-books:simulate-error"); } catch { /* ignore */ } qc.invalidateQueries(); toast.info(v ? "Mock services will now fail — open any list to see the error state" : "Mock services restored"); };
  const reset = async () => { if (!(await confirm({ title: "Reset demo data?", description: "Clears all records you created or changed in this browser and restores the sample dataset.", confirmLabel: "Reset data", destructive: true }))) return; resetDemoData(); qc.clear(); toast.success("Demo data restored"); setTimeout(() => window.location.reload(), 300); };
  const active = THEMES.find((t) => t.id === theme)!;
  return (
    <>
      <PageHeader title="Appearance" description="Choose the product theme. The whole application updates immediately and the choice is remembered in this browser." />
      <div className="mb-4 flex flex-wrap items-center gap-3 rounded-lg border bg-surface px-3 py-2 text-sm"><span className="font-medium">Active theme:</span><span>{active.name}</span><div className="flex overflow-hidden rounded border">{Object.values(active.palette).map((c) => <span key={c} className="size-4" style={{ background: c }} />)}</div><span className="text-xs text-muted-foreground">Saved to localStorage · default is EVOQ Modern Light</span></div>
      <div className="grid gap-4 md:grid-cols-2">
        {THEMES.map((t) => { const on = t.id === theme; return (
          <section key={t.id} className={cn("rounded-xl border bg-card p-3 transition-shadow", on ? "border-action ring-2 ring-action/30" : "hover:shadow-sm")} aria-label={t.name}>
            <div className="mb-2 flex items-start justify-between gap-2"><div><h2 className="text-sm font-semibold">{t.name}</h2><p className="text-xs text-muted-foreground">{t.tagline}</p></div><div className="flex items-center gap-1.5"><span className="rounded-full border px-2 py-0.5 text-[10px] text-muted-foreground">{t.chrome === "light" ? "Light chrome" : "Dark sidebar"}</span>{on && <StatusBadge status="active" label="Selected" />}</div></div>
            <ThemePreview t={t} />
            <ul className="mt-3 grid grid-cols-7 gap-1.5">{PALETTE_ROLES.map((r) => (<li key={r.key} className="min-w-0 text-center" title={`${r.label} — ${r.use}`}><span className="block h-8 rounded-md border" style={{ background: t.palette[r.key] }} /><span className="mt-1 block truncate text-[10px] font-medium">{r.label}</span><span className="tnum block text-[9px] text-muted-foreground">{t.palette[r.key]}</span></li>))}</ul>
            <Button className="mt-3 w-full" variant={on ? "secondary" : "default"} onClick={() => { setTheme(t.id); toast.success(`${t.name} applied`); }} aria-pressed={on}>{on ? <><Check /> Selected</> : "Select theme"}</Button>
          </section>); })}
      </div>
      <Panel className="mt-4" title="How colour is used"><ul className="grid gap-1 text-sm text-muted-foreground sm:grid-cols-2">{PALETTE_ROLES.map((r) => <li key={r.key}><b className="text-foreground">{r.label}</b> — {r.use}</li>)}</ul><p className="mt-2 text-xs text-muted-foreground">Neutrals (#FFFFFF, #F8FAFC, #E6EAF0, #1F2430, #5F6B7A, #9BA8B7) and semantic colours — success #10B981, warning #F59E0B, error #EF4444, neutral #6B7280 — never change with the theme, so Paid / Pending / Overdue / Draft always read the same.</p></Panel>
      <Panel className="mt-4" title="Demo & developer options" description="Frontend-only conveniences">
        <div className="divide-y">
          <div className="flex items-center justify-between gap-3 py-2"><div><p className="text-sm font-medium">Simulate service errors</p><p className="text-xs text-muted-foreground">Makes list queries fail so you can review error states and retry buttons.</p></div><Switch checked={simErr} onCheckedChange={toggleErr} aria-label="Simulate service errors" /></div>
          <div className="flex items-center justify-between gap-3 py-2"><div><p className="text-sm font-medium">Reset demo data</p><p className="text-xs text-muted-foreground">Removes records you created or changed (stored in this browser) and restores the sample dataset.</p></div><Button variant="outline" size="sm" onClick={reset}><RotateCcw /> Reset</Button></div>
        </div>
      </Panel>
    </>
  );
}
