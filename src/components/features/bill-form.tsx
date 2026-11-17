"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Controller, useFieldArray, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { Paperclip, Plus, Save, Send, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Combobox, DateField, FieldShell, FilePicker, SelectField } from "@/components/shared/form-controls";
import { PageHeader } from "@/components/shared/page-header";
import { Panel } from "@/components/shared/stat-card";
import { SimNotice } from "@/components/shared/states";
import { useContacts, useDocuments, useEntityMutation } from "@/hooks/use-data";
import { useAccountOptions, useContactOptions } from "@/hooks/use-options";
import { useApp, useFormat } from "@/providers/app-provider";
import { services, type BillInput } from "@/services";
import { billSchema } from "@/lib/validators";
import { GST_RATES } from "@/lib/constants";
import { CURRENCIES, formatBytes, round2 } from "@/lib/formatters";
import { gstSplit, TDS_SECTIONS } from "@/lib/accounting/tax";
import { addDaysISO } from "@/lib/accounting/fiscal";
import { sampleRate } from "@/lib/mock/generate";

type Form = { vendorId: string; vendorBillNo: string; date: string; dueDate: string; currency: string; tdsKey: string; notes: string; lines: { description: string; accountId: string; qty: number | string; rate: number | string; taxRate: number | string }[] };

export function BillForm({ initial }: { initial?: Partial<Form> & { id?: string; attachments?: string[] } }) {
  const router = useRouter(); const f = useFormat(); const { today, entity } = useApp(); const india = entity?.taxRegime === "india-gst"; const base = entity?.baseCurrency ?? "INR";
  const vendors = useContactOptions("vendor"); const contacts = useContacts("vendor").data ?? []; const accOpts = useAccountOptions(["expense", "asset"]); const docs = useDocuments().data ?? [];
  const [attachments, setAttachments] = React.useState<string[]>(initial?.attachments ?? []);
  const form = useForm<Form>({ defaultValues: { vendorId: "", vendorBillNo: "", date: today, dueDate: addDaysISO(today, 30), currency: base, tdsKey: "", notes: "", lines: [{ description: "", accountId: "", qty: 1, rate: "", taxRate: india ? 18 : 9 }], ...initial } });
  const { control, register, handleSubmit, setValue, setError, formState: { errors } } = form;
  const { fields, append, remove } = useFieldArray({ control, name: "lines" });
  const w = useWatch({ control }); const vendor = contacts.find((c) => c.id === w.vendorId); const cur = w.currency ?? base; const foreign = cur !== base;
  const lines = (w.lines ?? []).map((l) => ({ amount: round2((Number(l.qty) || 0) * (Number(l.rate) || 0)), taxRate: Number(l.taxRate) || 0 }));
  const subtotal = round2(lines.reduce((s, l) => s + l.amount, 0));
  const tax = lines.reduce((a, l) => { const t = gstSplit(entity ?? { state: "", country: "", taxRegime: "india-gst" }, vendor?.state ?? "", vendor?.country ?? "", l.amount, l.taxRate, foreign); return { cgst: a.cgst + t.cgst, sgst: a.sgst + t.sgst, igst: a.igst + t.igst }; }, { cgst: 0, sgst: 0, igst: 0 });
  const tds = TDS_SECTIONS.find((t) => `${t.section}|${t.rate}` === w.tdsKey); const tdsAmt = tds ? round2((subtotal * tds.rate) / 100) : 0; const total = round2(subtotal + tax.cgst + tax.sgst + tax.igst);
  const fx = foreign ? sampleRate(cur, base, w.date ?? today) : 1;

  React.useEffect(() => { if (vendor) { setValue("dueDate", addDaysISO(w.date ?? today, vendor.creditDays)); if (vendor.tdsSection) { const k = TDS_SECTIONS.find((t) => t.section === vendor.tdsSection && t.rate === vendor.tdsRate); if (k) setValue("tdsKey", `${k.section}|${k.rate}`); } if (vendor.currency !== cur) setValue("currency", vendor.currency); }   }, [w.vendorId]);
  const save = useEntityMutation((e, i: BillInput) => services.payables.saveBill(e, i), { success: (b) => (b.status === "draft" ? `Draft ${b.number} saved` : b.status === "pending_approval" ? `Bill ${b.number} submitted for approval` : `Bill ${b.number} approved & posted`), onDone: (b) => router.replace(`/payables/bills/${b.id}`) });
  const upload = useEntityMutation((e, file: File) => services.org.addDocument(e, { name: file.name, size: file.size, mime: file.type || "application/octet-stream", category: "Invoice", linkedType: "bill", linkedRef: "New bill" }), { success: "Attached (simulated storage)", onDone: (d) => setAttachments((a) => [...a, d.id]) });

  const submit = (mode: "draft" | "submit") => handleSubmit(async (v) => {
    const parsed = billSchema.safeParse({ ...v, tdsSection: tds?.section, tdsRate: tds?.rate });
    if (!parsed.success) { parsed.error.issues.forEach((is) => setError(is.path.join(".") as never, { message: is.message })); toast.error("Please fix the highlighted fields", { description: parsed.error.issues[0].message }); return; }
    await save.mutateAsync({ id: initial?.id, vendorId: v.vendorId, vendorBillNo: v.vendorBillNo, date: v.date, dueDate: v.dueDate, currency: v.currency, lines: v.lines.map((l) => ({ description: l.description, accountId: l.accountId, qty: Number(l.qty), rate: Number(l.rate), taxRate: Number(l.taxRate) })), tdsSection: tds?.section, tdsRate: tds?.rate, notes: v.notes, attachments, mode }).catch(() => {});
  }, () => toast.error("Please fix the highlighted fields"));
  const attached = docs.filter((d) => attachments.includes(d.id));

  return (
    <>
      <PageHeader title={initial?.id ? "Edit bill" : "New vendor bill"} description="Capture a vendor bill. Approved bills post to Accounts Payable, input tax and TDS payable." trail={[{ label: "New" }]} />
      <div className="grid gap-4 xl:grid-cols-[1fr_320px]">
        <div className="space-y-4">
          <Panel title="Bill details"><div className="grid gap-3 sm:grid-cols-3">
            <FieldShell label="Vendor" required error={errors.vendorId?.message} className="sm:col-span-2"><Controller control={control} name="vendorId" render={({ field }) => <Combobox value={field.value} onChange={field.onChange} options={vendors} placeholder="Select vendor" invalid={!!errors.vendorId} />} /></FieldShell>
            <FieldShell label="Vendor bill no." required error={errors.vendorBillNo?.message}><Input aria-invalid={!!errors.vendorBillNo} {...register("vendorBillNo")} /></FieldShell>
            <FieldShell label="Bill date" required error={errors.date?.message}><Controller control={control} name="date" render={({ field }) => <DateField value={field.value} onChange={field.onChange} />} /></FieldShell>
            <FieldShell label="Due date" required error={errors.dueDate?.message}><Controller control={control} name="dueDate" render={({ field }) => <DateField value={field.value} onChange={field.onChange} min={w.date} />} /></FieldShell>
            <FieldShell label="Currency" hint={foreign ? `1 ${cur} = ${fx} ${base} (sample rate)` : undefined}><Controller control={control} name="currency" render={({ field }) => <SelectField value={field.value} onChange={field.onChange} options={CURRENCIES.map((c) => ({ value: c.code, label: c.code }))} />} /></FieldShell>
            {india && <FieldShell label="TDS" hint="Deducted from the vendor payment" className="sm:col-span-3"><Controller control={control} name="tdsKey" render={({ field }) => <SelectField value={field.value} onChange={field.onChange} allowEmpty placeholder="No TDS" options={TDS_SECTIONS.map((t) => ({ value: `${t.section}|${t.rate}`, label: t.label }))} />} /></FieldShell>}
          </div></Panel>
          <Panel title="Line items" noPad actions={<Button type="button" size="xs" variant="outline" onClick={() => append({ description: "", accountId: "", qty: 1, rate: "", taxRate: india ? 18 : 9 })}><Plus /> Add line</Button>}>
            <div className="scroll-thin overflow-x-auto"><table className="w-full min-w-[760px] text-sm"><thead className="bg-muted/50 text-[11px] uppercase text-muted-foreground"><tr><th className="px-2 py-1.5 text-left">Description</th><th className="px-2 py-1.5 text-left">Account</th><th className="w-20 px-2 py-1.5 text-right">Qty</th><th className="w-28 px-2 py-1.5 text-right">Rate</th><th className="w-24 px-2 py-1.5 text-right">GST %</th><th className="w-28 px-2 py-1.5 text-right">Amount</th><th className="w-8" /></tr></thead>
              <tbody>{fields.map((fl, i) => { const le = errors.lines?.[i]; return (
                <tr key={fl.id} className="border-t align-top">
                  <td className="min-w-48 px-2 py-1"><Input placeholder="Item / service" aria-invalid={!!le?.description} {...register(`lines.${i}.description`)} />{le?.description && <p className="text-[11px] text-destructive">{le.description.message}</p>}</td>
                  <td className="min-w-52 px-2 py-1"><Controller control={control} name={`lines.${i}.accountId`} render={({ field }) => <Combobox value={field.value} onChange={field.onChange} options={accOpts} placeholder="Account" invalid={!!le?.accountId} />} />{le?.accountId && <p className="text-[11px] text-destructive">{le.accountId.message}</p>}</td>
                  <td className="px-2 py-1"><Input type="number" step="any" className="tnum text-right" {...register(`lines.${i}.qty`)} /></td><td className="px-2 py-1"><Input type="number" step="0.01" className="tnum text-right" aria-invalid={!!le?.rate} {...register(`lines.${i}.rate`)} /></td>
                  <td className="px-2 py-1"><Controller control={control} name={`lines.${i}.taxRate`} render={({ field }) => <SelectField value={String(field.value)} onChange={(v) => field.onChange(Number(v))} options={(india ? GST_RATES : [0, 9]).map((r) => ({ value: String(r), label: `${r}%` }))} />} /></td>
                  <td className="num px-2 py-2 text-[13px]">{f.money(lines[i]?.amount ?? 0, cur)}</td><td className="px-1 py-1"><Button type="button" variant="ghost" size="icon-sm" aria-label="Remove line" disabled={fields.length === 1} onClick={() => remove(i)}><Trash2 /></Button></td></tr>); })}</tbody></table></div>
            {errors.lines?.message && <p className="px-3 py-1 text-xs text-destructive">{errors.lines.message}</p>}
          </Panel>
          <Panel title="Notes"><Textarea rows={2} placeholder="Internal notes" {...register("notes")} /></Panel>
          <div className="flex flex-wrap justify-end gap-2">
            <Button type="button" variant="outline" onClick={() => router.back()}>Cancel</Button>
            <Button type="button" variant="outline" disabled={save.isPending} onClick={submit("draft")}><Save /> Save draft</Button>
            <Button type="button" disabled={save.isPending} onClick={submit("submit")}><Send /> Submit bill</Button>
          </div>
        </div>
        <aside className="space-y-4">
          <Panel title="Summary"><dl className="space-y-1.5 text-[13px]">
            <div className="flex justify-between"><dt className="text-muted-foreground">Subtotal</dt><dd className="tnum">{f.money(subtotal, cur)}</dd></div>
            {tax.cgst > 0 && <div className="flex justify-between"><dt className="text-muted-foreground">CGST</dt><dd className="tnum">{f.money(tax.cgst, cur)}</dd></div>}{tax.sgst > 0 && <div className="flex justify-between"><dt className="text-muted-foreground">SGST</dt><dd className="tnum">{f.money(tax.sgst, cur)}</dd></div>}{tax.igst > 0 && <div className="flex justify-between"><dt className="text-muted-foreground">{india ? "IGST" : "GST"}</dt><dd className="tnum">{f.money(tax.igst, cur)}</dd></div>}
            <div className="flex justify-between border-t pt-1.5 font-semibold"><dt>Bill total</dt><dd className="tnum">{f.money(total, cur)}</dd></div>
            {tdsAmt > 0 && <div className="flex justify-between text-muted-foreground"><dt>Less TDS ({tds?.section} @ {tds?.rate}%)</dt><dd className="tnum">− {f.money(tdsAmt, cur)}</dd></div>}
            <div className="flex justify-between border-t pt-1.5 text-sm font-semibold"><dt>Net payable to vendor</dt><dd className="tnum">{f.money(total - tdsAmt, cur)}</dd></div>
            {vendor && <p className="pt-1 text-[11px] text-muted-foreground">{tax.igst > 0 && india ? "Inter-state supply → IGST" : tax.cgst > 0 ? "Intra-state supply → CGST + SGST" : "No GST applicable"} · {vendor.state || vendor.country}</p>}</dl></Panel>
          <Panel title="Attachments"><SimNotice className="mb-2">Simulated browser storage — not a cloud bucket.</SimNotice>
            {attached.length > 0 && <ul className="mb-2 space-y-1">{attached.map((d) => <li key={d.id} className="flex items-center gap-2 rounded border px-2 py-1 text-xs"><Paperclip className="size-3" /><span className="min-w-0 flex-1 truncate">{d.name}</span><span className="text-muted-foreground">{formatBytes(d.size)}</span></li>)}</ul>}
            <FilePicker multiple onFiles={(fs) => fs.forEach((x) => upload.mutate(x))} label="Attach invoice" description="Drop the vendor invoice" /></Panel>
        </aside>
      </div>
    </>
  );
}
