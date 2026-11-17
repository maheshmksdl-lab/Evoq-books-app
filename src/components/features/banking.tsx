"use client";

import * as React from "react";
import { toast } from "sonner";
import { Ban, Landmark, Link2Off, PiggyBank, Receipt, Tag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DataTable, type Column } from "@/components/shared/data-table";
import { FilePicker, SelectField } from "@/components/shared/form-controls";
import { FormDialog } from "@/components/shared/form-dialog";
import { SimNotice } from "@/components/shared/states";
import { StatusBadge } from "@/components/shared/status-badge";
import { useConfirm } from "@/components/shared/confirm";
import { useBankTxns, useEntityMutation } from "@/hooks/use-data";
import { useAccountOptions, useBankOptions } from "@/hooks/use-options";
import { useFormat } from "@/providers/app-provider";
import { services } from "@/services";
import { parseStatement } from "@/lib/csv";
import { formatDate } from "@/lib/formatters";
import { z } from "zod";

type Txn = NonNullable<ReturnType<typeof useBankTxns>["data"]>[number];

export function ImportStatementDialog({ open, onOpenChange, defaultAccount }: { open: boolean; onOpenChange: (o: boolean) => void; defaultAccount?: string }) {
  const banks = useBankOptions(["bank"]); const [acct, setAcct] = React.useState(defaultAccount ?? ""); const [file, setFile] = React.useState<File | null>(null);
  const [rows, setRows] = React.useState<ReturnType<typeof parseStatement>>([]); const [result, setResult] = React.useState<{ imported: number; dupes: number } | null>(null);
  React.useEffect(() => { if (open) { setFile(null); setRows([]); setResult(null); setAcct(defaultAccount ?? banks[0]?.value ?? ""); }   }, [open]);
  const imp = useEntityMutation((e, i: { bankAccountId: string; fileName: string; rows?: ReturnType<typeof parseStatement> }) => services.banking.importStatement(e, i), { success: (r) => `Imported ${r.imported} lines${r.dupes ? ` · ${r.dupes} flagged as duplicates` : ""}` });
  const pick = async (f: File) => {
    setFile(f);
    if (/\.csv$/i.test(f.name)) { const parsed = parseStatement(await f.text()); setRows(parsed); if (!parsed.length) toast.warning("Couldn't find date / narration / debit / credit columns — sample lines will be imported instead."); }
    else { setRows([]); toast.info("Excel files aren't parsed in the browser demo — sample lines will be imported."); }
  };
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-lg"><DialogHeader><DialogTitle>Import bank statement</DialogTitle><DialogDescription>CSV is parsed in your browser (columns: date, narration, withdrawal, deposit). Excel is simulated with sample lines.</DialogDescription></DialogHeader>
        <SimNotice>No bank connection is used. Imported lines are marked <b>unmatched</b> and duplicates (same date, amount and narration) are flagged.</SimNotice>
        <div className="space-y-3">
          <SelectField value={acct} onChange={setAcct} options={banks} placeholder="Bank account" />
          {!file ? <FilePicker accept=".csv,.xlsx,.xls" onFiles={(f) => pick(f[0])} label="Choose CSV / Excel statement" /> : <div className="flex items-center justify-between rounded-md border px-3 py-2 text-sm"><span className="truncate">{file.name}</span><Button variant="ghost" size="xs" onClick={() => { setFile(null); setRows([]); }}>Change</Button></div>}
          {file && <p className="text-xs text-muted-foreground">{rows.length ? `${rows.length} lines detected in the file.` : "Sample statement lines will be imported (5 lines)."}</p>}
          {result && <p className="tone-success rounded-md border px-3 py-2 text-sm">Imported {result.imported} new lines, {result.dupes} possible duplicates flagged.</p>}
        </div>
        <DialogFooter><Button variant="outline" onClick={() => onOpenChange(false)}>{result ? "Close" : "Cancel"}</Button>{!result && <Button disabled={!acct || !file || imp.isPending} onClick={async () => setResult(await imp.mutateAsync({ bankAccountId: acct, fileName: file!.name, rows }))}>Import</Button>}</DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

export function CategorizeDialog({ txn, onClose, preset }: { txn: Txn | null; onClose: () => void; preset?: string }) {
  const accOpts = useAccountOptions(); const f = useFormat();
  const cat = useEntityMutation((e, i: { txnId: string; accountId: string; description?: string }) => services.banking.categorize(e, i), { success: "Recorded in the books and matched" });
  const code = (c: string) => accOpts.find((o) => o.label.startsWith(c))?.value ?? "";
  return (
    <FormDialog open={!!txn} onOpenChange={(o) => !o && onClose()} size="sm" title="Categorise & record" description={txn ? `${txn.description} · ${txn.deposit ? "+" : "−"}${f.money(txn.deposit || txn.withdrawal)}` : undefined} submitLabel="Post & match"
      notice={<SimNotice>This posts a real journal in the mock books (Dr/Cr {txn?.deposit ? "bank / account" : "account / bank"}) and matches it to the statement line.</SimNotice>}
      schema={z.object({ accountId: z.string().min(1, "Choose a ledger account"), description: z.string().optional() })} fields={[{ name: "accountId", label: "Ledger account", type: "combobox", options: accOpts, required: true, span: 2 }, { name: "description", label: "Narration", span: 2 }]}
      defaultValues={{ accountId: preset ? code(preset) : "", description: txn?.description ?? "" }} onSubmit={async (v: { accountId: string; description?: string }) => { await cat.mutateAsync({ txnId: txn!.id, ...v }); }} />
  );
}

export function BankTxnTable({ bankAccountId, pageSize = 15 }: { bankAccountId?: string; pageSize?: number }) {
  const f = useFormat(); const confirm = useConfirm(); const { data, isLoading, error, refetch } = useBankTxns(bankAccountId);
  const [status, setStatus] = React.useState("all"); const [cat, setCat] = React.useState<{ t: Txn; preset?: string } | null>(null);
  const exclude = useEntityMutation((e, id: string) => services.banking.exclude(e, id), { success: "Line excluded from reconciliation" });
  const unmatch = useEntityMutation((e, id: string) => services.banking.unmatch(e, id), { success: "Transaction unmatched" });
  const rows = (data ?? []).filter((t) => status === "all" || t.status === status || (status === "duplicate" && !!t.duplicateOf));
  const cols: Column<Txn>[] = [
    { id: "date", header: "Date", accessor: (t) => t.date, cell: (t) => formatDate(t.date) },
    ...(!bankAccountId ? [{ id: "bank", header: "Account", accessor: (t: Txn) => t.bankName, hideBelow: "lg" as const }] : []),
    { id: "desc", header: "Narration", accessor: (t) => t.description, cell: (t) => <span className="flex items-center gap-1.5"><span className="max-w-[300px] truncate">{t.description}</span>{t.duplicateOf && <span className="tone-warning rounded border px-1 text-[10px]">Possible duplicate</span>}</span> },
    { id: "ref", header: "Reference", accessor: (t) => t.reference, hideBelow: "lg", className: "tnum text-xs text-muted-foreground" },
    { id: "w", header: "Withdrawal", align: "right", accessor: (t) => t.withdrawal, cell: (t) => (t.withdrawal ? f.money(t.withdrawal) : "") }, { id: "d", header: "Deposit", align: "right", accessor: (t) => t.deposit, cell: (t) => (t.deposit ? f.money(t.deposit) : "") },
    { id: "bal", header: "Balance", align: "right", accessor: (t) => t.balance, cell: (t) => f.money(t.balance), hideBelow: "md" },
    { id: "cat", header: "Category / match", accessor: (t) => t.accountName ?? t.matchedRefs.join(" "), hideBelow: "md", cell: (t) => <span className="text-xs text-muted-foreground">{t.matchedRefs.join(", ") || t.accountName || "—"}</span> },
    { id: "status", header: "Status", accessor: (t) => t.status, cell: (t) => <StatusBadge status={t.status} /> },
  ];
  return (
    <>
      <DataTable columns={cols} data={rows} rowKey={(t) => t.id} isLoading={isLoading} error={error as Error | null} onRetry={() => refetch()} exportName="bank-transactions" pageSize={pageSize} defaultSort={{ id: "date", dir: "desc" }} searchPlaceholder="Search narration, reference…"
        filters={<SelectField size="sm" className="w-40" value={status} onChange={setStatus} options={[{ value: "all", label: "All statuses" }, { value: "unmatched", label: "Unmatched" }, { value: "matched", label: "Matched" }, { value: "categorized", label: "Categorised" }, { value: "excluded", label: "Excluded" }, { value: "duplicate", label: "Possible duplicates" }]} />}
        rowActions={(t) => [
          { label: "Categorise & record…", icon: Tag, onClick: () => setCat({ t }), hidden: () => t.status === "matched" || t.status === "excluded" },
          { label: "Record as bank charge", icon: Receipt, onClick: () => setCat({ t, preset: "5300" }), hidden: () => t.status === "matched" || t.status === "excluded" || t.withdrawal === 0 },
          { label: "Record as interest", icon: PiggyBank, onClick: () => setCat({ t, preset: "4210" }), hidden: () => t.status === "matched" || t.status === "excluded" || t.deposit === 0 },
          { label: "Unmatch", icon: Link2Off, onClick: () => unmatch.mutate(t.id), hidden: () => t.status !== "matched" && t.status !== "categorized" },
          { label: "Exclude (duplicate / bank error)", icon: Ban, destructive: true, separatorBefore: true, hidden: () => t.status === "excluded", onClick: async () => { if (await confirm({ title: "Exclude this statement line?", description: "It will be ignored when matching but stays visible as a reconciling item.", confirmLabel: "Exclude" })) exclude.mutate(t.id); } },
        ]} />
      <CategorizeDialog txn={cat?.t ?? null} preset={cat?.preset} onClose={() => setCat(null)} />
    </>
  );
}
void Landmark; void Table; void TableBody; void TableCell; void TableHead; void TableHeader; void TableRow;
