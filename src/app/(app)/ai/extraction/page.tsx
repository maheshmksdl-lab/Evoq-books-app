"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { CheckCircle2, FileSearch, Loader2, Plus, RotateCcw, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/shared/page-header";
import { Combobox, DateField, FieldShell, FilePicker, SelectField } from "@/components/shared/form-controls";
import { Panel } from "@/components/shared/stat-card";
import { AiBadge, AiDisclaimer, ConfidenceBar } from "@/components/features/ai-parts";
import { useEntityMutation } from "@/hooks/use-data";
import { useContactOptions } from "@/hooks/use-options";
import { useApp, useFormat } from "@/providers/app-provider";
import { services } from "@/services";
import { GST_RATES } from "@/lib/constants";
import { formatBytes, round2 } from "@/lib/formatters";
import { cn } from "@/lib/utils";

type Ext = Awaited<ReturnType<typeof services.ai.extract>>;
interface Line { description: string; qty: string; rate: string }

function Field({ label, c, children }: { label: string; c?: number; children: React.ReactNode }) {
  return <FieldShell label={<span className="flex items-center gap-2">{label}{c !== undefined && <ConfidenceBar value={c} />}</span>}>{children}</FieldShell>;
}

export default function ExtractionPage() {
  const router = useRouter(); const f = useFormat(); const { entity } = useApp(); const vendors = useContactOptions("vendor");
  const [file, setFile] = React.useState<File | null>(null); const [step, setStep] = React.useState<"upload" | "review" | "done">("upload"); const [ext, setExt] = React.useState<Ext | null>(null);
  const [vendorId, setVendorId] = React.useState(""); const [no, setNo] = React.useState(""); const [date, setDate] = React.useState(""); const [due, setDue] = React.useState(""); const [gst, setGst] = React.useState("18"); const [lines, setLines] = React.useState<Line[]>([]); const [confirmed, setConfirmed] = React.useState(false); const [err, setErr] = React.useState<string | null>(null); const [previewUrl, setPreviewUrl] = React.useState<string | null>(null); const [billId, setBillId] = React.useState<string | null>(null);
  const extract = useEntityMutation((e, i: { fileName: string; size: number }) => services.ai.extract(e, i), { success: "Fields extracted (simulated) — please review" });
  const accept = useEntityMutation((e, i: Parameters<typeof services.ai.acceptExtraction>[1]) => services.ai.acceptExtraction(e, i), { success: (b) => `Draft bill ${b.number} created from the document` });
  const onFile = async (fl: File) => {
    setFile(fl); setErr(null); setPreviewUrl(fl.type.startsWith("image") ? URL.createObjectURL(fl) : null);
    const x = await extract.mutateAsync({ fileName: fl.name, size: fl.size }); setExt(x); setVendorId(x.vendorId); setNo(x.invoiceNo); setDate(x.invoiceDate); setDue(x.dueDate); setGst(String(x.gstRate)); setLines(x.lines.map((l) => ({ description: l.description, qty: String(l.qty), rate: String(l.rate) }))); setConfirmed(false); setStep("review");
  };
  const reset = () => { setFile(null); setExt(null); setStep("upload"); setPreviewUrl(null); setErr(null); setBillId(null); };
  const sub = round2(lines.reduce((s, l) => s + (Number(l.qty) || 0) * (Number(l.rate) || 0), 0)); const tax = round2((sub * Number(gst)) / 100);
  const conf = (k: keyof Ext["confidence"]) => ext?.confidence[k] ?? 0;
  const submit = async () => {
    setErr(null); if (!vendorId) return setErr("Select the vendor."); if (!no.trim()) return setErr("Invoice number is required."); if (!date || !due || due < date) return setErr("Check the invoice and due dates."); if (!lines.length || lines.some((l) => !l.description || !(Number(l.qty) > 0) || !(Number(l.rate) >= 0))) return setErr("Every line needs a description, quantity and rate."); if (!confirmed) return setErr("Confirm that you have reviewed the extracted values.");
    try { const b = await accept.mutateAsync({ vendorId, invoiceNo: no, invoiceDate: date, dueDate: due, gstRate: Number(gst), lines: lines.map((l) => ({ description: l.description, qty: Number(l.qty), rate: Number(l.rate) })), fileName: file!.name, size: file!.size }); setBillId(b.id); setStep("done"); } catch (e) { setErr((e as Error).message); }
  };
  return (
    <>
      <PageHeader title="Document Data Extraction" description="Upload an invoice and review the extracted fields before creating a draft bill." />
      <AiDisclaimer>This is a browser-side simulation. No OCR or document intelligence runs — plausible fields are generated from the file name so you can experience the review-before-accept workflow.</AiDisclaimer>
      {step === "upload" && <div className="mx-auto max-w-xl"><Panel title="1 · Upload an invoice" description="PDF, PNG or JPG — the file stays in your browser"><FilePicker accept=".pdf,image/*" label="Choose invoice" onFiles={(fs) => onFile(fs[0])} disabled={extract.isPending} description={extract.isPending ? "Analysing document…" : "Drag & drop an invoice, or"} />{extract.isPending && <p className="mt-3 flex items-center justify-center gap-2 text-sm text-muted-foreground"><Loader2 className="size-4 animate-spin" /> Extracting fields (simulated)…</p>}</Panel></div>}
      {step === "review" && ext && file && (
        <div className="grid gap-4 xl:grid-cols-[1fr_1.2fr]">
          <Panel title="Source document" actions={<AiBadge>Simulated extraction</AiBadge>}><div className="flex min-h-72 items-center justify-center rounded-lg border bg-muted/40 p-3">{previewUrl ?   <img src={previewUrl} alt={file.name} className="max-h-96 rounded" /> : <div className="text-center text-xs text-muted-foreground"><FileSearch className="mx-auto mb-2 size-8 text-primary" />{file.name}<br />{formatBytes(file.size)}<br /><span className="mt-1 block">PDF preview isn&apos;t rendered in this demo.</span></div>}</div></Panel>
          <Panel title="2 · Review extracted fields" description="Edit anything that looks wrong. Low-confidence fields are flagged.">
            <div className="grid gap-3 sm:grid-cols-2">
              <Field label="Vendor name" c={conf("vendor")}><Combobox value={vendorId} onChange={setVendorId} options={vendors} placeholder="Select vendor" /></Field>
              <Field label="Invoice number" c={conf("invoiceNo")}><Input value={no} onChange={(e) => setNo(e.target.value)} /></Field>
              <Field label="Invoice date" c={conf("dates")}><DateField value={date} onChange={setDate} /></Field><Field label="Due date" c={conf("dates")}><DateField value={due} onChange={setDue} min={date} /></Field>
              <Field label="Tax rate (GST %)" c={conf("tax")}><SelectField value={gst} onChange={setGst} options={(entity?.taxRegime === "india-gst" ? GST_RATES : [0, 9]).map((r) => ({ value: String(r), label: `${r}%` }))} /></Field>
              <div className="flex items-end"><p className="text-xs text-muted-foreground">Total extracted: <b className="tnum text-foreground">{f.money(ext.total)}</b> <ConfidenceBar value={conf("total")} className="inline-flex" /></p></div>
            </div>
            <div className="mt-3"><div className="mb-1 flex items-center justify-between"><p className="flex items-center gap-2 text-xs font-semibold">Line items <ConfidenceBar value={conf("lines")} /></p><Button size="xs" variant="outline" onClick={() => setLines([...lines, { description: "", qty: "1", rate: "" }])}><Plus /> Add</Button></div>
              <div className="space-y-1.5">{lines.map((l, i) => <div key={i} className="flex gap-1.5"><Input className="min-w-0 flex-1" value={l.description} onChange={(e) => setLines(lines.map((x, k) => (k === i ? { ...x, description: e.target.value } : x)))} aria-label={`Line ${i + 1} description`} /><Input className="w-20 tnum text-right" type="number" value={l.qty} onChange={(e) => setLines(lines.map((x, k) => (k === i ? { ...x, qty: e.target.value } : x)))} aria-label="Quantity" /><Input className="w-28 tnum text-right" type="number" value={l.rate} onChange={(e) => setLines(lines.map((x, k) => (k === i ? { ...x, rate: e.target.value } : x)))} aria-label="Rate" /><Button variant="ghost" size="icon-sm" aria-label="Remove line" disabled={lines.length <= 1} onClick={() => setLines(lines.filter((_, k) => k !== i))}><Trash2 /></Button></div>)}</div>
              <dl className="mt-2 space-y-0.5 rounded-md bg-surface p-2 text-[13px]"><div className="flex justify-between"><dt className="text-muted-foreground">Subtotal</dt><dd className="tnum">{f.money(sub)}</dd></div><div className="flex justify-between"><dt className="text-muted-foreground">Tax ({gst}%)</dt><dd className="tnum">{f.money(tax)}</dd></div><div className="flex justify-between border-t pt-0.5 font-semibold"><dt>Total</dt><dd className="tnum">{f.money(sub + tax)}</dd></div></dl></div>
            <label className={cn("mt-3 flex items-start gap-2 rounded-md border px-3 py-2 text-sm", confirmed && "border-action bg-accent/50")}><input type="checkbox" className="mt-1" checked={confirmed} onChange={(e) => setConfirmed(e.target.checked)} /><span>I have reviewed the extracted values against the document. <span className="block text-xs text-muted-foreground">Accepting creates a <b>draft</b> bill only — you still submit and approve it.</span></span></label>
            {err && <p role="alert" className="tone-error mt-2 rounded-md border px-3 py-2 text-xs">{err}</p>}
            <div className="mt-3 flex justify-end gap-2"><Button variant="outline" onClick={reset}><RotateCcw /> Start over</Button><Button onClick={submit} disabled={accept.isPending}>{accept.isPending && <Loader2 className="animate-spin" />}3 · Accept & create draft bill</Button></div>
          </Panel>
        </div>)}
      {step === "done" && <div className="mx-auto max-w-md"><Panel><div className="py-4 text-center"><CheckCircle2 className="mx-auto mb-2 size-10 text-success" /><p className="font-medium">Draft bill created</p><p className="mt-1 text-xs text-muted-foreground">The extracted data was saved as a draft. Nothing has been posted.</p><div className="mt-4 flex justify-center gap-2"><Button variant="outline" onClick={reset}>Extract another</Button><Button onClick={() => router.push(`/payables/bills/${billId}`)}>Open draft bill</Button></div></div></Panel></div>}
      <span className="hidden"><Link href="/" /></span>
    </>
  );
}
