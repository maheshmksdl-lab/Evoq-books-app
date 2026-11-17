"use client";

import * as React from "react";
import { PersonCell } from "@/components/shared/user-avatar";
import { Eye, FileImage, FileSpreadsheet, FileText, Pencil, Plus, Trash2, Upload } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable, type Column } from "@/components/shared/data-table";
import { FilePicker, SelectField, FieldShell } from "@/components/shared/form-controls";
import { SimNotice } from "@/components/shared/states";
import { DetailDrawer } from "@/components/shared/detail-drawer";
import { KV } from "@/components/shared/stat-card";
import { useConfirm } from "@/components/shared/confirm";
import { useDocuments, useEntityMutation } from "@/hooks/use-data";
import { services } from "@/services";
import { formatBytes, formatDate, formatDateTime } from "@/lib/formatters";
import type { DocumentFile } from "@/types";
import { Input } from "@/components/ui/input";

const CATS: DocumentFile["category"][] = ["Invoice", "Receipt", "Bank Statement", "Contract", "Tax", "Journal Support", "Other"];
const icon = (m: string) => (m.startsWith("image") ? FileImage : m.includes("csv") || m.includes("sheet") ? FileSpreadsheet : FileText);

export default function DocumentsPage() {
  const confirm = useConfirm(); const { data, isLoading, error, refetch } = useDocuments();
  const [cat, setCat] = React.useState("all"); const [view, setView] = React.useState<DocumentFile | null>(null); const [upOpen, setUpOpen] = React.useState(false);
  const [pending, setPending] = React.useState<File[]>([]); const [upCat, setUpCat] = React.useState<DocumentFile["category"]>("Other"); const [ref, setRef] = React.useState("");
  const add = useEntityMutation(async (e, i: { file: File; category: DocumentFile["category"]; ref: string }) => {
    const small = i.file.size < 400_000 && (i.file.type.startsWith("image") || i.file.type.startsWith("text") || i.file.name.endsWith(".csv"));
    const dataUrl = small ? await new Promise<string>((res) => { const r = new FileReader(); r.onload = () => res(String(r.result)); r.readAsDataURL(i.file); }) : undefined;
    const previewText = i.file.type.startsWith("text") || i.file.name.endsWith(".csv") ? (await i.file.text()).slice(0, 1500) : undefined;
    return services.org.addDocument(e, { name: i.file.name, size: i.file.size, mime: i.file.type || "application/octet-stream", category: i.category, linkedType: i.ref ? "reference" : "none", linkedRef: i.ref || undefined, dataUrl, previewText });
  }, { success: "Uploaded to simulated storage" });
  const del = useEntityMutation((e, id: string) => services.org.deleteDocument(e, id), { success: "Document removed" });
  const recat = useEntityMutation((e, i: { id: string; category: DocumentFile["category"] }) => services.org.updateDocument(e, i), { success: "Category updated" });

  const rows = (data ?? []).filter((d) => cat === "all" || d.category === cat);
  const cols: Column<DocumentFile>[] = [
    { id: "name", header: "File", accessor: (d) => d.name, cell: (d) => { const I = icon(d.mime); return <button className="flex items-center gap-2 text-left font-medium text-primary hover:underline" onClick={(e) => { e.stopPropagation(); setView(d); }}><I className="size-4 shrink-0 text-muted-foreground" /><span className="truncate">{d.name}</span></button>; } },
    { id: "cat", header: "Category", accessor: (d) => d.category }, { id: "link", header: "Linked to", accessor: (d) => `${d.linkedType} ${d.linkedRef ?? ""}`, cell: (d) => d.linkedRef ?? <span className="text-muted-foreground">Unlinked</span>, hideBelow: "md" },
    { id: "size", header: "Size", align: "right", accessor: (d) => d.size, cell: (d) => formatBytes(d.size), hideBelow: "md" }, { id: "by", header: "Uploaded by", accessor: (d) => d.uploadedBy, cell: (d) => <PersonCell name={d.uploadedBy} />, hideBelow: "lg" },
    { id: "at", header: "Created", accessor: (d) => d.createdAt, cell: (d) => formatDate(d.createdAt) }, { id: "mod", header: "Modified", accessor: (d) => d.modifiedAt, cell: (d) => <span className="text-xs text-muted-foreground">{formatDate(d.modifiedAt)} · {d.modifiedBy}</span>, hideBelow: "lg" },
  ];
  return (
    <>
      <PageHeader title="Documents" description="Receipts, invoices, statements and supporting files attached to transactions." actions={<Button size="sm" onClick={() => { setPending([]); setRef(""); setUpOpen(true); }}><Upload /> Upload</Button>} />
      <SimNotice className="mb-3" title="Simulated file storage">Files are handled in your browser. Small images/text are kept in local storage for previews; nothing is uploaded to cloud storage, scanned or retained by a server.</SimNotice>
      <DataTable columns={cols} data={rows} rowKey={(d) => d.id} isLoading={isLoading} error={error as Error | null} onRetry={() => refetch()} defaultSort={{ id: "at", dir: "desc" }} onRowClick={setView} searchPlaceholder="Search files, references…"
        filters={<SelectField size="sm" className="w-44" value={cat} onChange={setCat} options={[{ value: "all", label: "All categories" }, ...CATS.map((c) => ({ value: c, label: c }))]} />}
        emptyTitle="No documents" emptyAction={<Button size="sm" onClick={() => setUpOpen(true)}><Plus /> Upload a file</Button>}
        rowActions={[{ label: "Preview", icon: Eye, onClick: setView }, { label: "Mark as Receipt", icon: Pencil, onClick: (d) => recat.mutate({ id: d.id, category: "Receipt" }), hidden: (d) => d.category === "Receipt" }, { label: "Delete", icon: Trash2, destructive: true, separatorBefore: true, onClick: async (d) => { if (await confirm({ title: `Delete ${d.name}?`, description: "Removes the simulated file and its links.", destructive: true, confirmLabel: "Delete" })) del.mutate(d.id); } }]} />
      <DetailDrawer open={!!view} onOpenChange={(o) => !o && setView(null)} wide title={view?.name ?? ""} description={view ? `${view.category} · ${formatBytes(view.size)}` : undefined}>
        {view && <>
          <div className="flex min-h-56 items-center justify-center overflow-hidden rounded-lg border bg-muted/40 p-3">
            {view.dataUrl?.startsWith("data:image") ?   <img src={view.dataUrl} alt={view.name} className="max-h-80 rounded" />
              : view.previewText ? <pre className="max-h-80 w-full overflow-auto whitespace-pre-wrap rounded bg-white p-3 font-mono text-xs leading-relaxed">{view.previewText}</pre>
              : <p className="text-center text-xs text-muted-foreground">No inline preview for {view.mime}.<br />A real build would render the stored file here.</p>}
          </div>
          <dl className="grid grid-cols-2 gap-3"><KV label="Linked to">{view.linkedRef}</KV><KV label="Category">{view.category}</KV><KV label="Created by">{view.uploadedBy} · {formatDateTime(view.createdAt)}</KV><KV label="Modified by">{view.modifiedBy} · {formatDateTime(view.modifiedAt)}</KV></dl>
          <SimNotice>Simulated storage — this is not a cloud bucket and the file cannot be downloaded again after a reset.</SimNotice>
        </>}
      </DetailDrawer>
      <Dialog open={upOpen} onOpenChange={setUpOpen}>
        <DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>Upload documents</DialogTitle><DialogDescription>Choose one or more files, a category and an optional reference such as an invoice number.</DialogDescription></DialogHeader>
          <FilePicker multiple onFiles={(f) => setPending((p) => [...p, ...f])} />
          {pending.length > 0 && <ul className="space-y-1 text-xs">{pending.map((f, i) => <li key={i} className="flex justify-between rounded border px-2 py-1"><span className="truncate">{f.name}</span><span className="text-muted-foreground">{formatBytes(f.size)}</span></li>)}</ul>}
          <div className="grid grid-cols-2 gap-3"><FieldShell label="Category"><SelectField value={upCat} onChange={(v) => setUpCat(v as DocumentFile["category"])} options={CATS.map((c) => ({ value: c, label: c }))} /></FieldShell><FieldShell label="Reference"><Input value={ref} onChange={(e) => setRef(e.target.value)} placeholder="e.g. BILL-2627-0012" /></FieldShell></div>
          <DialogFooter><Button variant="outline" onClick={() => setUpOpen(false)}>Cancel</Button><Button disabled={!pending.length || add.isPending} onClick={async () => { for (const f of pending) await add.mutateAsync({ file: f, category: upCat, ref }); setUpOpen(false); toast.success(`${pending.length} file(s) added`); }}>Upload {pending.length || ""}</Button></DialogFooter></DialogContent>
      </Dialog>
    </>
  );
}
