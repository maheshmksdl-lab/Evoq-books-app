"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { toast } from "sonner";
import { AlertTriangle, CheckCircle2, Lock, Paperclip, Plus, RotateCcw, Save, Send, Trash2, Wand2, Repeat, Copy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Combobox, DateField, FieldShell, FilePicker, SelectField } from "@/components/shared/form-controls";
import { FormDialog } from "@/components/shared/form-dialog";
import { PageHeader } from "@/components/shared/page-header";
import { ErrorState, SimNotice, TableSkeleton } from "@/components/shared/states";
import { KV, Panel } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { useConfirm } from "@/components/shared/confirm";
import { useDocuments, useEntityMutation, useJournal, useJournalHistory } from "@/hooks/use-data";
import { useAccountOptions, useContactOptions, useDimensionOptions } from "@/hooks/use-options";
import { useApp, useFormat } from "@/providers/app-provider";
import { services, type JournalSave } from "@/services";
import { journalSchema } from "@/lib/validators";
import { journalTotals } from "@/lib/accounting/engine";
import { formatBytes, formatDate, formatDateTime, titleCase } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import { z } from "zod";
import { JournalLinesTable, sourceHref } from "./journal-view";

type FormShape = { date: string; reference: string; description: string; lines: { accountId: string; debit: number | string; credit: number | string; description: string; contactId: string; departmentId: string; projectId: string }[] };
const emptyLine = { accountId: "", debit: "", credit: "", description: "", contactId: "", departmentId: "", projectId: "" };

export function JournalWorkspace({ id, copyFrom }: { id?: string; copyFrom?: string | null }) {
  const router = useRouter(); const f = useFormat(); const { today, entity, can } = useApp(); const confirm = useConfirm();
  const { data: src, isLoading, error, refetch } = useJournal(id ?? copyFrom ?? "__new");
  const isCopy = !id && !!copyFrom; const j = isCopy ? undefined : src; const template = isCopy ? src : undefined;
  const loading = (!!id || isCopy) && isLoading;
  if (error && id) return <ErrorState error={error as Error} onRetry={() => refetch()} />;
  if (loading) return <TableSkeleton rows={6} cols={4} />;
  const editable = !id || j?.status === "draft" || j?.status === "rejected";
  return <Workspace key={j?.id ?? (template ? "copy" : "new")} journal={j} template={template} editable={editable} router={router} money={f.money} today={today} requireApproval={!!entity?.accountSettings.requireJournalApproval} canEdit={can("journals", "create")} confirm={confirm} />;
}

function Workspace({ journal: j, template, editable, router, money, today, requireApproval, canEdit, confirm }: { journal?: NonNullable<ReturnType<typeof useJournal>["data"]>; template?: NonNullable<ReturnType<typeof useJournal>["data"]>; editable: boolean; router: ReturnType<typeof useRouter>; money: (n: number) => string; today: string; requireApproval: boolean; canEdit: boolean; confirm: ReturnType<typeof useConfirm> }) {
  const accountOpts = useAccountOptions(); const partyOpts = useContactOptions(); const deptOpts = useDimensionOptions("department"); const projOpts = useDimensionOptions("project");
  const [showDims, setShowDims] = React.useState(false); const [recurring, setRecurring] = React.useState<{ on: boolean; frequency: string; nextDate: string }>({ on: !!j?.recurrence, frequency: j?.recurrence?.frequency ?? "monthly", nextDate: j?.recurrence?.nextDate ?? today });
  const [attachments, setAttachments] = React.useState<string[]>(j?.attachments ?? []); const [reverseOpen, setReverseOpen] = React.useState(false);
  const docs = useDocuments().data ?? []; const history = useJournalHistory(j?.id ?? "");
  const form = useForm<FormShape>({ defaultValues: { date: j?.date ?? today, reference: j?.reference ?? "", description: j?.description ?? (template ? `Adjustment of ${template.number}: ` : ""), lines: (j ?? template)?.lines.map((l) => ({ accountId: l.accountId, debit: l.debit || "", credit: l.credit || "", description: l.description ?? "", contactId: l.contactId ?? "", departmentId: l.departmentId ?? "", projectId: l.projectId ?? "" })) ?? [{ ...emptyLine }, { ...emptyLine }] } });
  const { control, register, handleSubmit, setValue, getValues, setError, clearErrors, formState: { errors } } = form;
  const { fields, append, remove } = useFieldArray({ control, name: "lines" });
  const lines = useWatch({ control, name: "lines" });
  const t = journalTotals((lines ?? []).map((l) => ({ debit: Number(l.debit) || 0, credit: Number(l.credit) || 0 })));

  const save = useEntityMutation((e, i: JournalSave) => services.journals.save(e, i), { success: (r) => (r.status === "posted" ? `Journal ${r.number} posted` : r.status === "pending_approval" ? `Journal ${r.number} submitted for approval` : `Draft ${r.number} saved`), onDone: (r) => router.replace(`/accounting/journals/${r.id}`) });
  const del = useEntityMutation((e, id: string) => services.journals.remove(e, id), { success: "Draft deleted", onDone: () => router.replace("/accounting/journals") });
  const reverse = useEntityMutation((e, i: { id: string; date: string; reason?: string }) => services.journals.reverse(e, i), { success: (r) => `Reversal ${r.number} posted`, onDone: (r) => router.push(`/accounting/journals/${r.id}`) });
  const approvalsNote = requireApproval;

  const submit = (mode: "draft" | "post") => handleSubmit(async (v) => {
    const payload = { ...v, lines: v.lines.filter((l) => l.accountId || Number(l.debit) || Number(l.credit)) };
    if (mode === "post") {
      const parsed = journalSchema.safeParse(payload);
      if (!parsed.success) { parsed.error.issues.forEach((is) => { const p = is.path.join("."); if (p === "lines") setError("root", { message: is.message }); else setError(p as never, { message: is.message }); }); toast.error("Please fix the highlighted fields", { description: parsed.error.issues[0].message }); return; }
    } else if (!payload.description.trim()) { setError("description", { message: "Description is required" }); return; }
    const mapped = payload.lines.map((l) => ({ accountId: l.accountId, debit: Number(l.debit) || 0, credit: Number(l.credit) || 0, description: l.description || undefined, contactId: l.contactId || undefined, departmentId: l.departmentId || undefined, projectId: l.projectId || undefined }));
    await save.mutateAsync({ id: j?.id, mode: recurring.on ? "draft" : mode, date: payload.date, reference: payload.reference || undefined, description: payload.description, lines: mapped, attachments, template: recurring.on || undefined, recurring: recurring.on ? { frequency: recurring.frequency as "monthly", nextDate: recurring.nextDate } : undefined, kind: recurring.on ? "recurring" : "manual" }).catch(() => {});
  }, () => toast.error("Please fix the highlighted fields"));

  const upload = useEntityMutation((e, f: File) => services.org.addDocument(e, { name: f.name, size: f.size, mime: f.type || "application/octet-stream", category: "Journal Support", linkedType: "journal", linkedRef: j?.number ?? "New journal" }), { success: "Attachment added (simulated storage)", onDone: (d) => setAttachments((a) => [...a, d.id]) });
  const attached = docs.filter((d) => attachments.includes(d.id));

  const balanceFix = () => {
    const idx = (getValues("lines") ?? []).findIndex((l) => !l.accountId && !Number(l.debit) && !Number(l.credit)); const diff = t.difference; if (!diff) return;
    const target = idx >= 0 ? idx : fields.length; if (idx < 0) append({ ...emptyLine });
    setTimeout(() => { setValue(`lines.${target}.debit`, diff < 0 ? Math.abs(diff) : ""); setValue(`lines.${target}.credit`, diff > 0 ? diff : ""); }, 0);
  };
  const dupToDraft = () => { router.push(`/accounting/journals/new?copy=${j?.id}`); };
  const reverseDialog = (
    <FormDialog open={reverseOpen} onOpenChange={setReverseOpen} title={`Reverse ${j?.number}`} description="Posted journals are never edited or deleted. A reversal posts an equal and opposite entry." submitLabel="Post reversal" size="sm" schema={z.object({ date: z.string().min(1, "Choose a date"), reason: z.string().optional() })}
      fields={[{ name: "date", label: "Reversal date", type: "date", required: true }, { name: "reason", label: "Reason", type: "textarea" }]} defaultValues={{ date: today, reason: "" }} onSubmit={async (v: { date: string; reason?: string }) => { await reverse.mutateAsync({ id: j!.id, ...v }); }} />
  );

  return (
    <>
      <PageHeader title={j ? <span className="flex items-center gap-2">{j.number} <StatusBadge status={j.status} /></span> : "New journal entry"} description={j ? j.description : "Record a manual journal with balanced debit and credit lines."} trail={[{ label: j ? j.number : "New" }]}
        actions={<>
          {j && j.status === "posted" && !j.reversedBy && <Button variant="outline" size="sm" onClick={() => setReverseOpen(true)}><RotateCcw /> Reverse</Button>}
          {j && !editable && <Button variant="outline" size="sm" onClick={dupToDraft}><Copy /> Copy as draft</Button>}
          {j && editable && <Button variant="outline" size="sm" onClick={async () => { if (await confirm({ title: "Delete this draft?", description: "Drafts can be deleted. Posted journals never can.", destructive: true, confirmLabel: "Delete" })) del.mutate(j.id); }}><Trash2 /> Delete draft</Button>}
        </>} />
      {reverseDialog}
      {!editable && j && (
        <div className="mb-3 flex items-start gap-2 rounded-lg border bg-surface px-3 py-2 text-sm"><Lock className="mt-0.5 size-4 text-primary" />
          <div><p className="font-medium">{j.status === "pending_approval" ? "Awaiting approval" : j.status === "reversed" ? "Reversed — no further changes allowed" : "Posted journals can't be edited or deleted"}</p>
            <p className="text-xs text-muted-foreground">{j.status === "pending_approval" ? "An approver must approve this journal in Advanced Finance → Approvals before it posts." : "To correct this entry, post a reversal or create an adjustment entry — the audit trail stays intact."}{j.reversedBy && <> See <Link className="text-primary underline" href={`/accounting/journals/${j.reversedBy}`}>the reversal</Link>.</>}{j.reversalOf && <> This reverses <Link className="text-primary underline" href={`/accounting/journals/${j.reversalOf}`}>the original</Link>.</>}</p></div></div>
      )}
      <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
        <div className="space-y-3">
          <Panel title="Journal details">
            {editable ? (
              <div className="grid gap-3 sm:grid-cols-3">
                <FieldShell label="Journal date" required error={errors.date?.message} htmlFor="j-date"><Controller control={control} name="date" render={({ field }) => <DateField id="j-date" value={field.value} onChange={field.onChange} />}/></FieldShell>
                <FieldShell label="Reference no." htmlFor="j-ref" hint="Optional external reference"><Input id="j-ref" {...register("reference")} /></FieldShell>
                <FieldShell label="Number" hint="Generated sequentially on save"><Input disabled value={j?.number ?? "Auto-generated"} /></FieldShell>
                <FieldShell label="Description" required error={errors.description?.message} className="sm:col-span-3" htmlFor="j-desc"><Textarea id="j-desc" rows={2} placeholder="What is this entry for?" aria-invalid={!!errors.description} {...register("description")} /></FieldShell>
              </div>
            ) : j && <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4"><KV label="Date">{formatDate(j.date)}</KV><KV label="Reference">{j.reference}</KV><KV label="Type">{titleCase(j.kind)}</KV><KV label="Source">{sourceHref(j) ? <Link className="text-primary hover:underline" href={sourceHref(j)!}>{j.sourceRef}</Link> : j.sourceRef}</KV><KV label="Description" className="col-span-full">{j.description}</KV></dl>}
          </Panel>

          <Panel title="Lines" noPad actions={editable && <><Button variant="ghost" size="xs" onClick={() => setShowDims((s) => !s)}>{showDims ? "Hide" : "Show"} party & dimensions</Button><Button variant="outline" size="xs" onClick={() => append({ ...emptyLine })}><Plus /> Add line</Button></>}>
            {editable ? (
              <div className="scroll-thin overflow-x-auto">
                <table className="w-full min-w-[720px] text-sm">
                  <thead className="bg-muted/50 text-[11px] uppercase text-muted-foreground"><tr><th className="w-8 px-2 py-1.5 text-left">#</th><th className="px-2 py-1.5 text-left">Account</th><th className="px-2 py-1.5 text-left">Narration</th>{showDims && <><th className="px-2 py-1.5 text-left">Party</th><th className="px-2 py-1.5 text-left">Dept</th><th className="px-2 py-1.5 text-left">Project</th></>}<th className="w-32 px-2 py-1.5 text-right">Debit</th><th className="w-32 px-2 py-1.5 text-right">Credit</th><th className="w-8" /></tr></thead>
                  <tbody>
                    {fields.map((fl, i) => {
                      const le = errors.lines?.[i];
                      return (
                        <tr key={fl.id} className="border-t align-top">
                          <td className="px-2 py-1.5 text-xs text-muted-foreground">{i + 1}</td>
                          <td className="min-w-56 px-2 py-1"><Controller control={control} name={`lines.${i}.accountId`} render={({ field }) => <Combobox value={field.value} onChange={field.onChange} options={accountOpts} placeholder="Select account" searchPlaceholder="Code or name…" invalid={!!le?.accountId} />} />{le?.accountId && <p className="mt-0.5 text-[11px] text-destructive">{le.accountId.message}</p>}</td>
                          <td className="min-w-40 px-2 py-1"><Input placeholder="Line narration" {...register(`lines.${i}.description`)} /></td>
                          {showDims && <>
                            <td className="min-w-40 px-2 py-1"><Controller control={control} name={`lines.${i}.contactId`} render={({ field }) => <Combobox value={field.value} onChange={field.onChange} options={partyOpts} placeholder="—" />} /></td>
                            <td className="min-w-32 px-2 py-1"><Controller control={control} name={`lines.${i}.departmentId`} render={({ field }) => <SelectField value={field.value} onChange={field.onChange} options={deptOpts} placeholder="—" allowEmpty />} /></td>
                            <td className="min-w-32 px-2 py-1"><Controller control={control} name={`lines.${i}.projectId`} render={({ field }) => <SelectField value={field.value} onChange={field.onChange} options={projOpts} placeholder="—" allowEmpty />} /></td></>}
                          <td className="px-2 py-1"><Input type="number" step="0.01" min="0" className="tnum text-right" aria-label={`Debit line ${i + 1}`} aria-invalid={!!le?.debit} {...register(`lines.${i}.debit`, { onChange: (e) => { if (Number(e.target.value) > 0) setValue(`lines.${i}.credit`, ""); clearErrors("root"); } })} /></td>
                          <td className="px-2 py-1"><Input type="number" step="0.01" min="0" className="tnum text-right" aria-label={`Credit line ${i + 1}`} {...register(`lines.${i}.credit`, { onChange: (e) => { if (Number(e.target.value) > 0) setValue(`lines.${i}.debit`, ""); clearErrors("root"); } })} /></td>
                          <td className="px-1 py-1"><Button type="button" variant="ghost" size="icon-sm" aria-label={`Remove line ${i + 1}`} disabled={fields.length <= 2} onClick={() => remove(i)}><Trash2 /></Button></td>
                        </tr>);
                    })}
                  </tbody>
                </table>
              </div>
            ) : j && <div className="p-3"><JournalLinesTable journal={j} /></div>}
            {/* Debit / credit balancing summary */}
            <div className={cn("flex flex-wrap items-center gap-x-6 gap-y-1 border-t px-3 py-2 text-sm", t.balanced ? "bg-[color-mix(in_srgb,var(--s-success)_7%,white)]" : t.debit || t.credit ? "bg-[color-mix(in_srgb,var(--s-warning)_9%,white)]" : "bg-muted/30")} role="status" aria-live="polite">
              <span className="font-medium">Balancing summary</span>
              <span>Debits <b className="tnum">{money(editable ? t.debit : j?.lines.reduce((s, l) => s + l.debit, 0) ?? 0)}</b></span>
              <span>Credits <b className="tnum">{money(editable ? t.credit : j?.lines.reduce((s, l) => s + l.credit, 0) ?? 0)}</b></span>
              {editable ? (t.balanced ? <span className="flex items-center gap-1 text-[color-mix(in_srgb,var(--s-success)_60%,black)]"><CheckCircle2 className="size-4" /> Balanced — ready to post</span> : <span className="flex items-center gap-1 text-[color-mix(in_srgb,var(--s-warning)_55%,black)]"><AlertTriangle className="size-4" /> {t.debit || t.credit ? `Out of balance by ${money(Math.abs(t.difference))}` : "Enter debits and credits"}</span>) : <span className="flex items-center gap-1 text-[color-mix(in_srgb,var(--s-success)_60%,black)]"><CheckCircle2 className="size-4" /> Balanced</span>}
              {editable && !t.balanced && (t.debit > 0 || t.credit > 0) && <Button type="button" size="xs" variant="outline" className="ml-auto" onClick={balanceFix}><Wand2 /> Balance with {t.difference > 0 ? "credit" : "debit"} line</Button>}
            </div>
            {errors.root?.message && <p role="alert" className="border-t px-3 py-1.5 text-xs text-destructive">{errors.root.message}</p>}
          </Panel>

          {editable && (
            <div className="sticky bottom-0 z-10 -mx-1 flex flex-wrap items-center justify-between gap-2 rounded-lg border bg-card/95 p-2 shadow-md backdrop-blur">
              <p className="text-xs text-muted-foreground">{recurring.on ? "Recurring templates are saved as drafts and never post automatically." : approvalsNote ? "Journals above the approval limit are routed to an approver before posting." : "Posting writes to the ledger immediately (simulated)."}</p>
              <div className="flex gap-2">
                <Button type="button" variant="outline" disabled={save.isPending || !canEdit} onClick={submit("draft")}><Save /> Save draft</Button>
                {!recurring.on && <Button type="button" disabled={save.isPending || !t.balanced || !canEdit} onClick={submit("post")}><Send /> {approvalsNote ? "Post / submit" : "Post journal"}</Button>}
              </div>
            </div>)}
        </div>

        <aside className="space-y-3">
          <Panel title="Status & audit">
            <dl className="space-y-2">
              <KV label="Status">{j ? <StatusBadge status={j.status} /> : <StatusBadge status="draft" label="New" />}</KV>
              <KV label="Created by">{j ? `${j.createdBy} · ${formatDateTime(j.createdAt)}` : "—"}</KV>
              <KV label="Last modified">{j ? `${j.updatedBy} · ${formatDateTime(j.updatedAt)}` : "—"}</KV>
              {j?.postedAt && <KV label="Posted by">{`${j.postedBy} · ${formatDateTime(j.postedAt)}`}</KV>}
              {j?.aiSuggested && <KV label="Origin"><Badge variant="outline" className="border-dashed">AI-suggested · human reviewed</Badge></KV>}
            </dl>
          </Panel>
          {editable && (
            <Panel title="Recurring template" description="Save as a template instead of posting.">
              <div className="space-y-2"><div className="flex items-center justify-between"><label htmlFor="rec" className="flex items-center gap-1.5 text-sm"><Repeat className="size-3.5" /> Make recurring</label><Switch id="rec" checked={recurring.on} onCheckedChange={(on) => setRecurring((r) => ({ ...r, on }))} /></div>
                {recurring.on && <div className="grid grid-cols-2 gap-2"><SelectField value={recurring.frequency} onChange={(v) => setRecurring((r) => ({ ...r, frequency: v }))} options={[{ value: "monthly", label: "Monthly" }, { value: "quarterly", label: "Quarterly" }, { value: "yearly", label: "Yearly" }]} /><DateField value={recurring.nextDate} onChange={(v) => setRecurring((r) => ({ ...r, nextDate: v }))} /></div>}</div>
            </Panel>)}
          <Panel title="Attachments" description="Supporting documents">
            <SimNotice className="mb-2">Files are held in this browser as simulated storage — not real cloud storage.</SimNotice>
            {attached.length > 0 && <ul className="mb-2 space-y-1">{attached.map((d) => <li key={d.id} className="flex items-center gap-2 rounded border px-2 py-1 text-xs"><Paperclip className="size-3 text-muted-foreground" /><span className="min-w-0 flex-1 truncate">{d.name}</span><span className="text-muted-foreground">{formatBytes(d.size)}</span>{editable && <Button type="button" variant="ghost" size="icon-xs" aria-label="Remove attachment" onClick={() => setAttachments((a) => a.filter((x) => x !== d.id))}><Trash2 /></Button>}</li>)}</ul>}
            {editable && <FilePicker onFiles={(fs) => fs.forEach((f) => upload.mutate(f))} multiple label="Attach file" description="Drop receipts or workings" />}
          </Panel>
          {j && <Panel title="History">
            {history.isLoading ? <TableSkeleton rows={3} cols={2} /> : <ol className="space-y-2 border-l pl-3">{(history.data ?? []).map((h, i) => <li key={i} className="relative text-xs"><span className="absolute -left-[17px] top-1 size-2 rounded-full bg-action" /><p className="font-medium">{h.action}</p><p className="text-muted-foreground">{h.user} · {formatDateTime(h.at)}</p>{h.detail && <p className="text-muted-foreground">{h.detail}</p>}</li>)}</ol>}
          </Panel>}
        </aside>
      </div>
    </>
  );
}
void Tabs; void TabsContent; void TabsList; void TabsTrigger;
