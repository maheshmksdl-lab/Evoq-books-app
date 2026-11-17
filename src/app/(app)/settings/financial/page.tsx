"use client";

import { useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { BasisToggle } from "@/components/shared/basis-toggle";
import { PageHeader } from "@/components/shared/page-header";
import { Switch } from "@/components/ui/switch";
import { KV, Panel } from "@/components/shared/stat-card";
import { SelectField } from "@/components/shared/form-controls";
import { TableSkeleton } from "@/components/shared/states";
import { useEntityMutation, useFiscalYears } from "@/hooks/use-data";
import { useApp } from "@/providers/app-provider";
import { services } from "@/services";
import { StatusBadge } from "@/components/shared/status-badge";
import { formatDate } from "@/lib/formatters";
import type { Entity } from "@/types";

export default function FinancialSettingsPage() {
  const { entity } = useApp(); const qc = useQueryClient(); const fys = useFiscalYears();
  const update = useEntityMutation((e, i: { id: string; accountSettings: Entity["accountSettings"] }) => services.entities.update(e, i), { success: "Setting saved", onDone: () => qc.invalidateQueries({ queryKey: ["entities"] }) });
  if (!entity) return <TableSkeleton />; const s = entity.accountSettings;
  const set = (patch: Partial<Entity["accountSettings"]>) => update.mutate({ id: entity.id, accountSettings: { ...s, ...patch } });
  const rows = [["requireJournalApproval", "Require approval for manual journals", "Journals at or above the approval-rule limit go to an approver instead of posting directly."], ["allowBackdated", "Allow back-dated postings", "Permit dates in earlier periods that are still open."], ["autoNumbering", "Automatic document numbering", "Sequential numbers per financial year, e.g. INV-2627-0042."]] as const;
  return (<>
    <PageHeader title="Financial Settings" description="Financial year, precision and posting controls for the active entity." />
    <div className="grid gap-4 lg:grid-cols-2">
      <Panel title="Financial year"><dl className="grid grid-cols-2 gap-3"><KV label="Starts in">{new Date(2000, entity.fyStartMonth - 1).toLocaleString("en", { month: "long" })}</KV><KV label="Base currency">{entity.baseCurrency}</KV></dl>
        <ul className="mt-3 space-y-1">{(fys.data ?? []).map((f) => <li key={f.id} className="flex items-center justify-between rounded border px-2 py-1 text-sm"><span>{f.label} <span className="text-xs text-muted-foreground">{formatDate(f.start)} – {formatDate(f.end)}</span></span><StatusBadge status={f.status} /></li>)}</ul><Link href="/accounting/periods" className="mt-2 inline-block text-xs text-primary hover:underline">Manage periods →</Link></Panel>
      <Panel title="Report basis" description="Default for the dashboard and Profit & Loss (can be switched on each screen)"><BasisToggle /><p className="mt-2 text-xs text-muted-foreground"><b>Accrual</b> — you owe tax and earn income as of the invoice date. <b>Cash</b> — income and expenses count when payment is received or made.</p></Panel>
      <Panel title="Precision & rounding"><div className="space-y-3"><div><p className="mb-1 text-xs font-medium">Decimal places</p><div className="w-32"><SelectField value={String(s.decimalPlaces)} onChange={(v) => set({ decimalPlaces: Number(v) })} options={[{ value: "0", label: "0" }, { value: "2", label: "2" }, { value: "3", label: "3" }]} /></div><p className="mt-1 text-[11px] text-muted-foreground">Display preference. All calculations round half away from zero to 2 decimals.</p></div></div></Panel>
    </div>
    <Panel className="mt-4" title="Posting controls"><div className="divide-y">{rows.map(([k, l, d]) => <div key={k} className="flex items-center justify-between gap-3 py-2"><div><p className="text-sm font-medium">{l}</p><p className="text-xs text-muted-foreground">{d}</p></div><Switch checked={s[k]} onCheckedChange={(v) => set({ [k]: v } as Partial<Entity["accountSettings"]>)} aria-label={l} /></div>)}</div></Panel>
  </>);
}
