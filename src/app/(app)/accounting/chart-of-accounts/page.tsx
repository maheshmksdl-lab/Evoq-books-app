"use client";

import * as React from "react";
import Link from "next/link";
import { ChevronDown, ChevronRight, ChevronsDownUp, ChevronsUpDown, FileUp, Pencil, Plus, Power, History, Search } from "lucide-react";
import { toast } from "sonner";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { SelectField, FilePicker } from "@/components/shared/form-controls";
import { PageHeader } from "@/components/shared/page-header";
import { ExportMenu } from "@/components/shared/export-menu";
import { FormDialog, type FieldDef } from "@/components/shared/form-dialog";
import { DetailDrawer } from "@/components/shared/detail-drawer";
import { EmptyState, ErrorState, SimNotice, TableSkeleton } from "@/components/shared/states";
import { KV } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { useConfirm } from "@/components/shared/confirm";
import { useAccounts, useEntityMutation, useLedger } from "@/hooks/use-data";
import { useGroupOptions } from "@/hooks/use-options";
import { useFormat } from "@/providers/app-provider";
import { services, type AccountRow, type AccountInput } from "@/services";
import { accountSchema } from "@/lib/validators";
import { formatDate, titleCase } from "@/lib/formatters";
import { cn } from "@/lib/utils";
import type { AccountType } from "@/types";

const TYPES: { value: AccountType; label: string }[] = [{ value: "asset", label: "Asset" }, { value: "liability", label: "Liability" }, { value: "equity", label: "Equity" }, { value: "income", label: "Income" }, { value: "expense", label: "Expense" }];
const SAMPLE_IMPORT = [
  { code: "5345", name: "Training & Development", type: "expense" as const, parentCode: "5200", openingBalance: 0 },
  { code: "5346", name: "Recruitment Costs", type: "expense" as const, parentCode: "5200", openingBalance: 0 },
  { code: "1175", name: "Security Deposits", type: "asset" as const, parentCode: "1100", openingBalance: 0 },
  { code: "5200", name: "Duplicate code (will be rejected)", type: "expense" as const, parentCode: "5200", openingBalance: 0 },
  { code: "9100", name: "Bad code prefix (rejected)", type: "expense" as const, parentCode: "5200", openingBalance: 0 },
];

export default function ChartOfAccountsPage() {
  const f = useFormat(); const confirm = useConfirm();
  const { data, isLoading, error, refetch } = useAccounts();
  const groupOpts = useGroupOptions();
  const [collapsed, setCollapsed] = React.useState<Set<string>>(new Set());
  const [q, setQ] = React.useState(""); const [type, setType] = React.useState("all"); const [status, setStatus] = React.useState("all");
  const [edit, setEdit] = React.useState<AccountRow | "new" | null>(null); const [detail, setDetail] = React.useState<AccountRow | null>(null); const [importOpen, setImportOpen] = React.useState(false);

  const create = useEntityMutation((e, i: AccountInput) => services.accounts.create(e, i), { success: "Account created" });
  const update = useEntityMutation((e, i: AccountInput & { id: string }) => services.accounts.update(e, i), { success: "Account updated" });
  const toggle = useEntityMutation((e, i: { id: string; active: boolean }) => services.accounts.setActive(e, i), { success: (_, i) => (i.active ? "Account activated" : "Account deactivated"), optimistic: { key: ["accounts"], update: (old, i) => (old as AccountRow[] | undefined)?.map((a) => (a.id === i.id ? { ...a, active: i.active } : a)) } });
  const imp = useEntityMutation((e, rows: typeof SAMPLE_IMPORT) => services.accounts.importRows(e, rows));
  const [importResult, setImportResult] = React.useState<{ row: number; code: string; ok: boolean; message: string }[] | null>(null);

  const accounts = data ?? [];
  const byParent = React.useMemo(() => { const m = new Map<string | null, AccountRow[]>(); accounts.forEach((a) => m.set(a.parentId, [...(m.get(a.parentId) ?? []), a])); return m; }, [accounts]);
  const filtering = !!q || type !== "all" || status !== "all";
  const matches = (a: AccountRow) => (!q || `${a.code} ${a.name}`.toLowerCase().includes(q.toLowerCase())) && (type === "all" || a.type === type) && (status === "all" || (status === "active") === a.active);
  const visibleIds = React.useMemo(() => {
    if (!filtering) return null; const keep = new Set<string>();
    accounts.filter(matches).forEach((a) => { let cur: AccountRow | undefined = a; while (cur) { keep.add(cur.id); cur = accounts.find((x) => x.id === cur!.parentId); } });
    return keep;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [accounts, q, type, status]);

  const rows: AccountRow[] = [];
  const walk = (parent: string | null) => (byParent.get(parent) ?? []).forEach((a) => { if (visibleIds && !visibleIds.has(a.id)) return; rows.push(a); if (a.isGroup && (filtering || !collapsed.has(a.id))) walk(a.id); });
  walk(null);
  const toggleOpen = (id: string) => setCollapsed((s) => { const n = new Set(s); n.has(id) ? n.delete(id) : n.add(id); return n; });

  const fields: FieldDef[] = [
    { name: "type", label: "Account type", type: "select", options: TYPES, required: true },
    { name: "parentId", label: "Parent group", type: "combobox", options: groupOpts, required: true, hint: "Only group accounts can have children" },
    { name: "code", label: "Account code", required: true, placeholder: "e.g. 5345", hint: "Starts with 1 asset · 2 liability · 3 equity · 4 income · 5 expense" },
    { name: "name", label: "Account name", required: true },
    { name: "isGroup", label: "This is a group (header) account", type: "switch", hint: "Groups organise accounts and cannot hold transactions", span: 2 },
    { name: "openingBalance", label: "Opening balance", type: "money", show: (v) => !v.isGroup, hint: "On the account's normal side (debit for assets/expenses, credit otherwise)" },
    { name: "description", label: "Description", type: "textarea" },
  ];
  const editing = edit && edit !== "new" ? edit : null;
  const defaults = editing ? { type: editing.type, parentId: editing.parentId ?? "", code: editing.code, name: editing.name, isGroup: editing.isGroup, openingBalance: editing.openingBalance, description: editing.description ?? "" } : { type: "expense", parentId: "", code: "", name: "", isGroup: false, openingBalance: 0, description: "" };

  const deactivate = async (a: AccountRow) => {
    if (a.active && !(await confirm({ title: `Deactivate “${a.name}”?`, description: a.isGroup ? "All accounts inside this group will be deactivated too. Accounts with a balance cannot be deactivated." : "Inactive accounts can't be selected in new transactions. History is kept.", confirmLabel: "Deactivate", destructive: true }))) return;
    toggle.mutate({ id: a.id, active: !a.active });
  };

  return (
    <>
      <PageHeader title="Chart of Accounts" description="Hierarchical ledger structure. Expand groups, filter by type, and open any account to see its transactions."
        actions={<>
          <ExportMenu filename="chart-of-accounts" getRows={() => [["Code", "Name", "Type", "Group", "Opening balance", "Balance", "Status"], ...accounts.map((a) => [a.code, a.name, a.type, a.group, a.openingBalance, a.balance, a.active ? "Active" : "Inactive"])]} />
          <Button variant="outline" size="sm" onClick={() => { setImportResult(null); setImportOpen(true); }}><FileUp /> Import</Button>
          <Button size="sm" onClick={() => setEdit("new")}><Plus /> New account</Button>
        </>} />
      <div className="rounded-lg border bg-card">
        <div className="flex flex-wrap items-center gap-2 border-b p-2">
          <div className="relative w-full sm:w-64"><Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" /><Input value={q} onChange={(e) => setQ(e.target.value)} placeholder="Search code or name…" className="h-8 pl-7" aria-label="Search accounts" /></div>
          <SelectField size="sm" className="w-36" value={type} onChange={setType} options={[{ value: "all", label: "All types" }, ...TYPES]} />
          <SelectField size="sm" className="w-32" value={status} onChange={setStatus} options={[{ value: "all", label: "All status" }, { value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }]} />
          <div className="ml-auto flex gap-1"><Button variant="ghost" size="sm" onClick={() => setCollapsed(new Set())}><ChevronsUpDown /> Expand all</Button><Button variant="ghost" size="sm" onClick={() => setCollapsed(new Set(accounts.filter((a) => a.isGroup).map((a) => a.id)))}><ChevronsDownUp /> Collapse all</Button></div>
        </div>
        {error ? <ErrorState error={error as Error} onRetry={() => refetch()} /> : isLoading ? <TableSkeleton /> : rows.length === 0 ? <EmptyState title="No accounts match" description="Clear the filters to see the full chart." /> : (
          <div className="scroll-thin overflow-x-auto">
            <Table>
              <TableHeader className="bg-muted/50"><TableRow>
                <TableHead className="text-[11px] uppercase">Account</TableHead><TableHead className="w-20 text-[11px] uppercase">Code</TableHead><TableHead className="hidden w-24 text-[11px] uppercase md:table-cell">Type</TableHead>
                <TableHead className="hidden text-right text-[11px] uppercase lg:table-cell">Opening</TableHead><TableHead className="text-right text-[11px] uppercase">Balance</TableHead><TableHead className="w-24 text-[11px] uppercase">Status</TableHead><TableHead className="w-28" />
              </TableRow></TableHeader>
              <TableBody>
                {rows.map((a) => (
                  <TableRow key={a.id} className={cn("h-9 cursor-pointer", !a.active && "opacity-60", a.isGroup && "bg-muted/25 font-medium")} onClick={() => (a.isGroup ? toggleOpen(a.id) : setDetail(a))}>
                    <TableCell className="py-1.5"><span className="flex items-center gap-1" style={{ paddingLeft: a.level * 18 }}>
                      {a.isGroup ? (collapsed.has(a.id) && !filtering ? <ChevronRight className="size-3.5 text-muted-foreground" /> : <ChevronDown className="size-3.5 text-muted-foreground" />) : <span className="w-3.5" />}
                      <span className={cn(a.isGroup ? "text-[13px] font-semibold" : "text-[13px]")}>{a.name}</span>{a.system && <Badge variant="outline" className="ml-1 h-4 px-1 text-[9px] font-normal">System</Badge>}
                    </span></TableCell>
                    <TableCell className="tnum py-1.5 text-[13px] text-muted-foreground">{a.code}</TableCell>
                    <TableCell className="hidden py-1.5 text-[13px] capitalize md:table-cell">{a.type}</TableCell>
                    <TableCell className="num hidden py-1.5 text-[13px] lg:table-cell">{!a.isGroup && a.openingBalance ? f.money(a.openingBalance, undefined, { parens: true }) : "—"}</TableCell>
                    <TableCell className="num py-1.5 text-[13px]">{f.money(a.balance, undefined, { parens: true })}</TableCell>
                    <TableCell className="py-1.5"><StatusBadge status={a.active ? "active" : "inactive"} /></TableCell>
                    <TableCell className="py-1 text-right" onClick={(e) => e.stopPropagation()}>
                      <Button variant="ghost" size="icon-sm" aria-label={`Edit ${a.name}`} onClick={() => setEdit(a)}><Pencil /></Button>
                      <Button variant="ghost" size="icon-sm" aria-label={a.active ? "Deactivate" : "Activate"} onClick={() => deactivate(a)} disabled={a.system}><Power /></Button>
                    </TableCell>
                  </TableRow>))}
              </TableBody>
            </Table>
          </div>)}
      </div>

      <FormDialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)} title={editing ? `Edit account ${editing.code}` : "New account"} description={editing ? (editing.hasActivity ? "This account has postings: type and group status can no longer change." : undefined) : "Accounts are created inside a group of the same type."}
        schema={accountSchema} fields={fields.map((x) => (editing?.hasActivity && (x.name === "type" || x.name === "isGroup") ? { ...x, disabled: true } : x))} defaultValues={defaults} submitLabel={editing ? "Save changes" : "Create account"}
        onSubmit={async (v: AccountInput) => { const input = { ...v, parentId: v.parentId || null, openingBalance: Number(v.openingBalance) || 0 }; editing ? await update.mutateAsync({ ...input, id: editing.id }) : await create.mutateAsync(input); }} />

      <AccountDrawer account={detail} onClose={() => setDetail(null)} onEdit={(a) => { setDetail(null); setEdit(a); }} />

      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="sm:max-w-lg">
          <DialogHeader><DialogTitle>Import accounts</DialogTitle><DialogDescription>Choose a CSV/Excel file. The file is read in your browser; this demo imports a sample set so you can see validation.</DialogDescription></DialogHeader>
          <SimNotice>No file is uploaded or parsed server-side. Your chosen file name is shown, and a sample of 5 rows (including 2 invalid) is validated with the real account rules.</SimNotice>
          {!importResult ? <FilePicker accept=".csv,.xlsx,.xls" label="Choose CSV / Excel file" onFiles={async (files) => { toast.info(`Reading ${files[0].name} (simulated)…`); setImportResult(await imp.mutateAsync(SAMPLE_IMPORT)); }} description="Drag & drop a file, or" />
            : <div className="scroll-thin max-h-64 overflow-y-auto rounded-md border"><Table><TableHeader><TableRow><TableHead>Row</TableHead><TableHead>Code</TableHead><TableHead>Result</TableHead></TableRow></TableHeader><TableBody>{importResult.map((r) => <TableRow key={r.row}><TableCell>{r.row}</TableCell><TableCell className="tnum">{r.code}</TableCell><TableCell className={r.ok ? "text-[color-mix(in_srgb,var(--s-success)_60%,black)]" : "text-error"}>{r.message}</TableCell></TableRow>)}</TableBody></Table></div>}
          <DialogFooter><Button variant="outline" onClick={() => setImportOpen(false)}>Close</Button></DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}

function AccountDrawer({ account, onClose, onEdit }: { account: AccountRow | null; onClose: () => void; onEdit: (a: AccountRow) => void }) {
  const f = useFormat(); const { data, isLoading } = useLedger({ accountId: account?.id });
  return (
    <DetailDrawer open={!!account} onOpenChange={(o) => !o && onClose()} wide title={account ? `${account.code} · ${account.name}` : ""} description={account ? `${titleCase(account.type)} · ${account.group}` : undefined}
      footer={account && <><Button variant="outline" size="sm" onClick={() => onEdit(account)}><Pencil /> Edit</Button><Button size="sm" asChild><Link href={`/accounting/general-ledger?account=${account.id}`}><History /> Open in ledger</Link></Button></>}>
      {account && <>
        <dl className="grid grid-cols-3 gap-3"><KV label="Balance"><span className="tnum font-semibold">{f.money(account.balance, undefined, { parens: true })}</span></KV><KV label="Opening"><span className="tnum">{f.money(account.openingBalance, undefined, { parens: true })}</span></KV><KV label="Status"><StatusBadge status={account.active ? "active" : "inactive"} /></KV></dl>
        {account.description && <p className="text-sm text-muted-foreground">{account.description}</p>}
        <div><p className="mb-1 text-xs font-semibold uppercase tracking-wide text-muted-foreground">Latest transactions</p>
          {isLoading ? <TableSkeleton rows={5} cols={4} /> : !data?.entries.length ? <EmptyState title="No transactions yet" /> : (
            <div className="rounded-md border"><Table><TableHeader><TableRow><TableHead>Date</TableHead><TableHead>Journal</TableHead><TableHead className="text-right">Debit</TableHead><TableHead className="text-right">Credit</TableHead><TableHead className="text-right">Balance</TableHead></TableRow></TableHeader>
              <TableBody>{[...data.entries].reverse().slice(0, 12).map((e) => <TableRow key={e.key}><TableCell className="py-1 text-xs">{formatDate(e.date, "dd MMM yy")}</TableCell><TableCell className="py-1 text-xs"><Link className="text-primary hover:underline" href={`/accounting/journals/${e.journalId}`}>{e.journalNumber}</Link></TableCell><TableCell className="num py-1 text-xs">{e.debit ? f.money(e.debit) : ""}</TableCell><TableCell className="num py-1 text-xs">{e.credit ? f.money(e.credit) : ""}</TableCell><TableCell className="num py-1 text-xs">{f.money(e.balance, undefined, { parens: true })}</TableCell></TableRow>)}</TableBody></Table></div>)}
        </div>
      </>}
    </DetailDrawer>
  );
}
