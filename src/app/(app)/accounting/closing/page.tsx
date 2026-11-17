"use client";

import * as React from "react";
import Link from "next/link";
import { CheckCircle2, Circle, Printer } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { PageHeader } from "@/components/shared/page-header";
import { SelectField } from "@/components/shared/form-controls";
import { Panel, StatCard } from "@/components/shared/stat-card";
import { SimNotice } from "@/components/shared/states";
import { StatusBadge } from "@/components/shared/status-badge";
import { useConfirm } from "@/components/shared/confirm";
import { FormDialog } from "@/components/shared/form-dialog";
import { useAccountOptions } from "@/hooks/use-options";
import { useEntityMutation, useEntityQuery, useFiscalYears, useJournals, usePeriods, useReconciliations } from "@/hooks/use-data";
import { useFormat } from "@/providers/app-provider";
import { services } from "@/services";
import { formatDate } from "@/lib/formatters";
import { z } from "zod";

export default function ClosingPage() {
  const f = useFormat(); const confirm = useConfirm(); const fys = useFiscalYears(); const periods = usePeriods(); const journals = useJournals().data ?? []; const recs = useReconciliations().data ?? [];
  const [sel, setSel] = React.useState(""); const [adjOpen, setAdjOpen] = React.useState(false);
  const fyId = sel || fys.data?.find((x) => x.status === "open")?.id || "";
  const fy = fys.data?.find((x) => x.id === fyId);
  const preview = useEntityQuery(["closingPreview", fyId], (e) => services.periods.closingPreview(e, fyId), { enabled: !!fyId });
  const close = useEntityMutation((e, id: string) => services.periods.closeYear(e, id), { success: "Financial year closed (simulated)" });
  const reopen = useEntityMutation((e, id: string) => services.periods.reopenYear(e, id), { success: "Financial year re-opened" });
  const adj = useEntityMutation((e, i: { fyId: string; description: string; debitAccountId: string; creditAccountId: string; amount: number }) => services.periods.yearEndAdjustment(e, i), { success: (j) => `Adjustment ${j.number} posted` });
  const accOpts = useAccountOptions();
  const fyPeriods = (periods.data ?? []).filter((p) => p.fyId === fyId); const pastOpen = fyPeriods.filter((p) => p.status === "open" && p.end <= "2026-11-17");
  const pending = journals.filter((j) => fy && j.date >= fy.start && j.date <= fy.end && (j.status === "draft" || j.status === "pending_approval") && !j.recurringTemplate);
  const unrec = recs.filter((r) => fy && r.periodEnd >= fy.start && r.periodEnd <= fy.end && r.status !== "reconciled");
  const checks = [
    { label: "All elapsed periods are closed", ok: pastOpen.length === 0, detail: pastOpen.length ? `${pastOpen.length} open: ${pastOpen.map((p) => p.name).slice(0, 4).join(", ")}` : "Done", href: "/accounting/periods" },
    { label: "No draft or pending-approval journals", ok: pending.length === 0, detail: pending.length ? `${pending.length} awaiting action` : "Done", href: "/accounting/journals" },
    { label: "Bank reconciliations complete", ok: unrec.length === 0, detail: unrec.length ? `${unrec.length} period(s) with differences` : "Done", href: "/banking/reconciliation" },
    { label: "Year-end adjustments reviewed", ok: true, detail: "Optional — post below", href: "" },
  ];
  const td = preview.data?.lines.reduce((s, l) => s + l.debit, 0) ?? 0, tc = preview.data?.lines.reduce((s, l) => s + l.credit, 0) ?? 0;
  const re = preview.data?.retainedEarnings;
  return (
    <>
      <PageHeader title="Year-end Closing" description="Review the checklist, preview closing entries, and simulate the transfer of the year's result to retained earnings." actions={<><SelectField size="sm" className="w-44" value={fyId} onChange={setSel} options={(fys.data ?? []).map((x) => ({ value: x.id, label: x.label }))} /><Button variant="outline" size="sm" onClick={() => window.print()}><Printer /> Period closing report</Button></>} />
      <SimNotice className="mb-3" title="Simulation only">No closing journals are written to the ledger and the year is not permanently closed. “Close year” only locks periods in this demo.</SimNotice>
      <div className="grid gap-4 lg:grid-cols-[360px_1fr]">
        <div className="space-y-4">
          <Panel title="Closing checklist" description={fy?.label}>
            <ul className="space-y-2">{checks.map((c) => <li key={c.label} className="flex items-start gap-2 text-sm">{c.ok ? <CheckCircle2 className="mt-0.5 size-4 text-success" /> : <Circle className="mt-0.5 size-4 text-warning" />}<div className="min-w-0 flex-1"><p className="font-medium">{c.label}</p><p className="text-xs text-muted-foreground">{c.detail}{!c.ok && c.href && <> · <Link href={c.href} className="text-primary underline">Fix</Link></>}</p></div></li>)}</ul>
            <div className="mt-3 flex flex-wrap gap-2">
              <Button variant="outline" size="sm" onClick={() => setAdjOpen(true)} disabled={fy?.status === "closed"}>Year-end adjustment</Button>
              {fy?.status === "open" ? <Button size="sm" disabled={!checks.slice(0, 3).every((c) => c.ok)} onClick={async () => { if (await confirm({ title: `Close ${fy.label}?`, description: "All periods will be locked (simulated) and retained earnings transfer is shown as complete.", confirmLabel: "Close year" })) close.mutate(fy.id); }}>Close year</Button> : fy && <Button size="sm" variant="outline" onClick={() => reopen.mutate(fy.id)}>Re-open year</Button>}
            </div>
            {fy?.status === "open" && !checks.slice(0, 3).every((c) => c.ok) && <p className="mt-2 text-[11px] text-muted-foreground">Resolve the open checklist items to enable closing.</p>}
          </Panel>
          <div className="grid grid-cols-2 gap-3"><StatCard label="Net profit (year)" value={f.money(preview.data?.netProfit ?? 0)} /><StatCard label="Status" value={fy ? <StatusBadge status={fy.status} /> : "—"} /></div>
        </div>
        <Panel title="Closing journal preview" description="Income and expense accounts are closed to retained earnings" noPad>
          <Table><TableHeader className="bg-muted/50"><TableRow><TableHead className="w-20">Code</TableHead><TableHead>Account</TableHead><TableHead className="text-right">Debit</TableHead><TableHead className="text-right">Credit</TableHead></TableRow></TableHeader>
            <TableBody>{(preview.data?.lines ?? []).map((l) => <TableRow key={l.accountId}><TableCell className="tnum py-1.5 text-muted-foreground">{l.code}</TableCell><TableCell className="py-1.5">{l.name}</TableCell><TableCell className="num py-1.5">{l.debit ? f.money(l.debit) : ""}</TableCell><TableCell className="num py-1.5">{l.credit ? f.money(l.credit) : ""}</TableCell></TableRow>)}
              {re && <TableRow className="bg-accent/50 font-medium"><TableCell className="tnum py-1.5">3200</TableCell><TableCell className="py-1.5">Retained Earnings (transfer)</TableCell><TableCell className="num py-1.5">{re.debit ? f.money(re.debit) : ""}</TableCell><TableCell className="num py-1.5">{re.credit ? f.money(re.credit) : ""}</TableCell></TableRow>}</TableBody>
            <TableFooter><TableRow><TableCell colSpan={2}>Total</TableCell><TableCell className="num">{f.money(td + (re?.debit ?? 0))}</TableCell><TableCell className="num">{f.money(tc + (re?.credit ?? 0))}</TableCell></TableRow></TableFooter></Table>
        </Panel>
      </div>
      <FormDialog open={adjOpen} onOpenChange={setAdjOpen} title="Year-end adjustment entry" description={`Posts a journal dated ${fy ? formatDate(fy.end) : ""}. The period must still be open.`} submitLabel="Post adjustment"
        schema={z.object({ description: z.string().min(1, "Describe the adjustment"), debitAccountId: z.string().min(1, "Select a debit account"), creditAccountId: z.string().min(1, "Select a credit account"), amount: z.coerce.number().gt(0, "Must be greater than zero") }).refine((v) => v.debitAccountId !== v.creditAccountId, { message: "Debit and credit accounts must differ", path: ["creditAccountId"] })}
        fields={[{ name: "description", label: "Description", span: 2, required: true }, { name: "debitAccountId", label: "Debit account", type: "combobox", options: accOpts, required: true }, { name: "creditAccountId", label: "Credit account", type: "combobox", options: accOpts, required: true }, { name: "amount", label: "Amount", type: "money", required: true }]} defaultValues={{ description: "", debitAccountId: "", creditAccountId: "", amount: "" }}
        onSubmit={async (v: { description: string; debitAccountId: string; creditAccountId: string; amount: number }) => { await adj.mutateAsync({ fyId, ...v, amount: Number(v.amount) }); }} />
    </>
  );
}
