"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { ArrowLeft, Ban, CheckCircle, FileUp, FileText, Pencil, Plus, Printer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable, type Column } from "@/components/shared/data-table";
import { Combobox, FilePicker, SelectField } from "@/components/shared/form-controls";
import { FormDialog, type FieldDef } from "@/components/shared/form-dialog";
import { RangeFilter } from "@/components/shared/range-picker";
import { ErrorState, SimNotice, TableSkeleton } from "@/components/shared/states";
import { KV, Panel, StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { ExportMenu } from "@/components/shared/export-menu";
import { useBills, useContact, useContacts, useDocuments, useEntityMutation, useInvoices, useStatement } from "@/hooks/use-data";
import { useAccountOptions, useContactOptions } from "@/hooks/use-options";
import { useApp, useFormat } from "@/providers/app-provider";
import { services, type ContactInput, type ContactRow } from "@/services";
import { contactSchema } from "@/lib/validators";
import { BOOKS_START, INDIAN_STATES } from "@/lib/constants";
import { CURRENCIES, formatDate, titleCase } from "@/lib/formatters";
import { TDS_SECTIONS } from "@/lib/accounting/tax";
import type { ContactKind } from "@/types";

const KIND_LABEL: Record<string, string> = { customer: "Customer", vendor: "Vendor", other: "Other contact" };
const detailHref = (c: { id: string; kind: ContactKind }) => (c.kind === "customer" ? `/receivables/customers/${c.id}` : c.kind === "vendor" ? `/payables/vendors/${c.id}` : `/accounting/contacts?id=${c.id}`);

export function ContactForm({ open, onOpenChange, contact, kind }: { open: boolean; onOpenChange: (o: boolean) => void; contact?: ContactRow | null; kind: ContactKind }) {
  const { entity, currency } = useApp(); const accOpts = useAccountOptions(["asset", "liability"]);
  const save = useEntityMutation((e, i: ContactInput) => services.contacts.save(e, i), { success: (c) => `${c.name} saved` });
  const india = entity?.taxRegime === "india-gst";
  const fields: FieldDef[] = [
    { name: "kind", label: "Contact type", type: "select", options: [{ value: "customer", label: "Customer" }, { value: "vendor", label: "Vendor" }, { value: "other", label: "Other financial contact" }], required: true, disabled: !!contact },
    { name: "name", label: "Name", required: true }, { name: "email", label: "Email", type: "email" }, { name: "phone", label: "Phone" },
    { name: "address", label: "Address", span: 2 }, { name: "city", label: "City" },
    india ? { name: "state", label: "State", type: "select", options: INDIAN_STATES.map((s) => ({ value: s, label: s })), hint: "Determines CGST+SGST vs IGST" } : { name: "state", label: "State / region" },
    { name: "country", label: "Country", required: true },
    ...(india ? [{ name: "gstin", label: "GSTIN", placeholder: "27AABCA4821K1Z5" }, { name: "pan", label: "PAN", placeholder: "AABCA4821K" }] : [{ name: "taxId", label: "Tax / GST registration no." }]),
    { name: "currency", label: "Currency", type: "select" as const, options: CURRENCIES.map((c) => ({ value: c.code, label: `${c.code} – ${c.name}` })), required: true },
    { name: "ledgerAccountId", label: "Associated ledger account", type: "combobox", options: accOpts, required: true, hint: "Control account for this party" },
    { name: "creditDays", label: "Credit period (days)", type: "number", step: 1, min: 0 }, { name: "paymentTerms", label: "Payment terms", placeholder: "Net 30" },
    { name: "openingBalance", label: "Opening balance", type: "money", hint: contact ? "Opening balance can't change after creation — use a journal" : "Posts an opening journal against Opening Balance Equity", disabled: !!contact },
    ...(india ? [{ name: "tdsSection", label: "Default TDS section", type: "select" as const, allowEmpty: true, options: [...new Set(TDS_SECTIONS.map((t) => t.section))].map((s) => ({ value: s, label: s })), show: (v: Record<string, unknown>) => v.kind === "vendor" }, { name: "tdsRate", label: "TDS rate %", type: "number" as const, step: 0.1, show: (v: Record<string, unknown>) => v.kind === "vendor" && !!v.tdsSection }] : []),
    { name: "status", label: "Status", type: "select", options: [{ value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }] },
  ];
  const defaults = contact ? { ...contact, tdsRate: contact.tdsRate ?? "", tdsSection: contact.tdsSection ?? "" } : { kind, name: "", email: "", phone: "", address: "", city: "", state: india ? "Maharashtra" : "", country: entity?.country ?? "India", taxId: "", gstin: "", pan: "", openingBalance: 0, creditDays: 30, paymentTerms: "Net 30", ledgerAccountId: "", currency, status: "active", tdsSection: "", tdsRate: "" };
  return (
    <FormDialog open={open} onOpenChange={onOpenChange} size="lg" title={contact ? `Edit ${contact.name}` : `New ${KIND_LABEL[kind].toLowerCase()}`} description="Accounting details only — this is not a CRM record." schema={contactSchema} fields={fields} defaultValues={defaults} submitLabel={contact ? "Save changes" : "Create contact"}
      onSubmit={async (v: ContactInput) => { await save.mutateAsync({ ...v, id: contact?.id, openingBalance: Number(v.openingBalance) || 0, creditDays: Number(v.creditDays) || 0, tdsRate: v.tdsRate === undefined || (v.tdsRate as unknown) === "" ? undefined : Number(v.tdsRate) }); }} />
  );
}

export function ContactsList({ kind, title, description }: { kind?: ContactKind; title: string; description: string }) {
  const router = useRouter(); const f = useFormat(); const { data, isLoading, error, refetch } = useContacts(kind);
  const [form, setForm] = React.useState<ContactRow | "new" | null>(null); const [importOpen, setImportOpen] = React.useState(false); const [type, setType] = React.useState("all"); const [status, setStatus] = React.useState("all");
  const setSt = useEntityMutation((e, i: { id: string; status: "active" | "inactive" }) => services.contacts.setStatus(e, i), { success: (c) => `${c.name} marked ${c.status}` });
  const imp = useEntityMutation((e, i: string[]) => services.contacts.importRows(e, kind ?? "customer", i), { success: (n) => `${n} contacts imported` });
  const rows = (data ?? []).filter((c) => (kind || type === "all" || c.kind === type) && (status === "all" || c.status === status));
  const cols: Column<ContactRow>[] = [
    { id: "name", header: "Name", accessor: (c) => c.name, cell: (c) => <Link href={detailHref(c)} className="font-medium text-primary hover:underline" onClick={(e) => e.stopPropagation()}>{c.name}</Link> },
    ...(!kind ? [{ id: "kind", header: "Type", accessor: (c: ContactRow) => c.kind, cell: (c: ContactRow) => KIND_LABEL[c.kind] }] : []),
    { id: "contact", header: "Email / phone", accessor: (c) => `${c.email} ${c.phone}`, hideBelow: "lg", cell: (c) => <span className="text-xs text-muted-foreground">{c.email}<br />{c.phone}</span> },
    { id: "loc", header: "Location", accessor: (c) => `${c.city} ${c.state} ${c.country}`, hideBelow: "md", cell: (c) => `${c.city}${c.state ? `, ${c.state}` : ""}` },
    { id: "tax", header: "GSTIN / Tax ID", accessor: (c) => c.gstin || c.taxId, hideBelow: "lg", className: "tnum text-xs" },
    { id: "terms", header: "Terms", accessor: (c) => c.paymentTerms, hideBelow: "md" },
    { id: "balance", header: kind === "vendor" ? "Payable" : kind === "customer" ? "Receivable" : "Balance", align: "right", accessor: (c) => c.balance, cell: (c) => (c.kind === "other" ? "—" : f.money(c.balance, c.currency, { parens: true })) },
    { id: "status", header: "Status", accessor: (c) => c.status, cell: (c) => <StatusBadge status={c.status} /> },
  ];
  return (
    <>
      <PageHeader title={title} description={description} actions={<><ExportMenu filename={title.toLowerCase().replace(/\W+/g, "-")} getRows={() => [["Name", "Type", "Email", "Phone", "City", "State", "Country", "GSTIN", "PAN", "Credit days", "Balance", "Status"], ...rows.map((c) => [c.name, c.kind, c.email, c.phone, c.city, c.state, c.country, c.gstin, c.pan, c.creditDays, c.balance, c.status])]} /><Button variant="outline" size="sm" onClick={() => setImportOpen(true)}><FileUp /> Import</Button><Button size="sm" onClick={() => setForm("new")}><Plus /> New {kind ? KIND_LABEL[kind].toLowerCase() : "contact"}</Button></>} />
      <DataTable columns={cols} data={rows} rowKey={(c) => c.id} isLoading={isLoading} error={error as Error | null} onRetry={() => refetch()} exportName={undefined} onRowClick={(c) => router.push(detailHref(c))} defaultSort={{ id: "name", dir: "asc" }} searchPlaceholder="Search name, GSTIN, city…"
        filters={<>{!kind && <SelectField size="sm" className="w-40" value={type} onChange={setType} options={[{ value: "all", label: "All types" }, { value: "customer", label: "Customers" }, { value: "vendor", label: "Vendors" }, { value: "other", label: "Other" }]} />}<SelectField size="sm" className="w-32" value={status} onChange={setStatus} options={[{ value: "all", label: "All status" }, { value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }]} /></>}
        rowActions={(c) => [{ label: "View", icon: FileText, onClick: () => router.push(detailHref(c)) }, { label: "Edit", icon: Pencil, onClick: () => setForm(c) }, { label: c.status === "active" ? "Mark inactive" : "Mark active", icon: c.status === "active" ? Ban : CheckCircle, onClick: () => setSt.mutate({ id: c.id, status: c.status === "active" ? "inactive" : "active" }), separatorBefore: true }]} emptyTitle="No contacts yet" />
      {form && <ContactForm open onOpenChange={(o) => !o && setForm(null)} contact={form === "new" ? null : form} kind={kind ?? "customer"} />}
      <Dialog open={importOpen} onOpenChange={setImportOpen}>
        <DialogContent className="sm:max-w-md"><DialogHeader><DialogTitle>Import contacts</DialogTitle><DialogDescription>CSV or Excel</DialogDescription></DialogHeader>
          <SimNotice>The file is not parsed or uploaded. Choosing a file imports three sample contacts so you can see the flow.</SimNotice>
          <FilePicker accept=".csv,.xlsx" onFiles={async (fs) => { toast.info(`Reading ${fs[0].name} (simulated)…`); await imp.mutateAsync(["Sahyadri Castings Pvt Ltd", "Deccan Hydraulics & Pumps", "Konkan Packaging Works"]); setImportOpen(false); }} />
          <DialogFooter><Button variant="outline" onClick={() => setImportOpen(false)}>Close</Button></DialogFooter></DialogContent>
      </Dialog>
    </>
  );
}

export function StatementView({ contactId }: { contactId: string }) {
  const f = useFormat(); const { today, entity } = useApp();
  const [r, setR] = React.useState({ from: BOOKS_START, to: today });
  const { data, isLoading, error, refetch } = useStatement({ contactId, ...r });
  if (error) return <ErrorState error={error as Error} onRetry={() => refetch()} />;
  const c = data?.contact; const cust = c?.kind === "customer";
  const cols: Column<NonNullable<typeof data>["rows"][number]>[] = [
    { id: "date", header: "Date", accessor: (x) => x.date, cell: (x) => formatDate(x.date) }, { id: "ref", header: "Reference", accessor: (x) => x.ref, cell: (x) => <Link className="text-primary hover:underline" href={`/accounting/journals/${x.journalId}`}>{x.ref}</Link> }, { id: "desc", header: "Description", accessor: (x) => x.description },
    { id: "debit", header: cust ? "Invoiced / debit" : "Billed", align: "right", accessor: (x) => x.debit, cell: (x) => (x.debit ? f.money(x.debit, c?.currency === entity?.baseCurrency ? undefined : entity?.baseCurrency) : "") },
    { id: "credit", header: cust ? "Received / credit" : "Paid", align: "right", accessor: (x) => x.credit, cell: (x) => (x.credit ? f.money(x.credit) : "") }, { id: "bal", header: "Balance", align: "right", accessor: (x) => x.balance, cell: (x) => f.money(x.balance, undefined, { parens: true }) },
  ];
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2"><RangeFilter from={r.from} to={r.to} onChange={setR} fyStartMonth={entity?.fyStartMonth} />
        <div className="flex gap-2"><ExportMenu filename={`statement-${c?.name ?? "contact"}`} getRows={() => [["Date", "Reference", "Description", "Debit", "Credit", "Balance"], ...(data?.rows ?? []).map((x) => [x.date, x.ref, x.description, x.debit, x.credit, x.balance])]} /><Button size="sm" variant="outline" onClick={() => window.print()}><Printer /> Print</Button></div></div>
      {isLoading || !data ? <TableSkeleton /> : (<div className="print-area space-y-3 rounded-lg border bg-card p-4">
        <div className="flex flex-wrap items-start justify-between gap-2"><div><p className="text-xs uppercase tracking-wide text-muted-foreground">Statement of account</p><p className="text-lg font-semibold">{data.contact.name}</p><p className="text-xs text-muted-foreground">{data.contact.address}, {data.contact.city} · {data.contact.gstin || data.contact.taxId}</p></div><div className="text-right text-xs text-muted-foreground"><p>{entity?.legalName}</p><p>{formatDate(r.from)} – {formatDate(r.to)}</p></div></div>
        <div className="grid grid-cols-3 gap-3"><StatCard label="Opening balance" value={f.money(data.opening, undefined, { parens: true })} /><StatCard label="Closing balance" value={f.money(data.closing, undefined, { parens: true })} /><StatCard label={cust ? "Amount due from customer" : "Amount payable to vendor"} value={f.money(data.closing)} /></div>
        <DataTable bare hideSearch columns={cols} data={data.rows} rowKey={(x) => x.journalId + x.date + x.debit + x.credit} pageSize={15} emptyTitle="No transactions in this period" /></div>)}
    </div>
  );
}

export function ContactDetail({ id, kind }: { id: string; kind: ContactKind }) {
  const router = useRouter(); const f = useFormat(); const { data: c, isLoading, error, refetch } = useContact(id);
  const invoices = useInvoices().data ?? [], bills = useBills().data ?? [], docs = useDocuments().data ?? [];
  const [edit, setEdit] = React.useState(false);
  if (error) return <ErrorState error={error as Error} onRetry={() => refetch()} />;
  if (isLoading || !c) return <TableSkeleton />;
  const myInv = invoices.filter((i) => i.customerId === id), myBills = bills.filter((b) => b.vendorId === id);
  const billed = kind === "customer" ? myInv.reduce((s, i) => s + i.total * i.fxRate, 0) : myBills.filter((b) => b.journalId).reduce((s, b) => s + b.total * b.fxRate, 0);
  const overdue = kind === "customer" ? myInv.filter((i) => i.displayStatus === "overdue").reduce((s, i) => s + i.outstandingBase, 0) : myBills.filter((b) => b.displayStatus === "overdue").reduce((s, b) => s + b.outstandingBase, 0);
  const invCols: Column<(typeof myInv)[number]>[] = [{ id: "n", header: "Invoice", accessor: (i) => i.number, cell: (i) => <Link className="text-primary hover:underline" href={`/receivables/invoices/${i.id}`}>{i.number}</Link> }, { id: "d", header: "Date", accessor: (i) => i.date, cell: (i) => formatDate(i.date) }, { id: "due", header: "Due", accessor: (i) => i.dueDate, cell: (i) => formatDate(i.dueDate) }, { id: "t", header: "Total", align: "right", accessor: (i) => i.total, cell: (i) => f.money(i.total, i.currency) }, { id: "o", header: "Outstanding", align: "right", accessor: (i) => i.outstanding, cell: (i) => f.money(i.outstanding, i.currency) }, { id: "s", header: "Status", accessor: (i) => i.displayStatus, cell: (i) => <StatusBadge status={i.displayStatus} /> }];
  const billCols: Column<(typeof myBills)[number]>[] = [{ id: "n", header: "Bill", accessor: (b) => b.number, cell: (b) => <Link className="text-primary hover:underline" href={`/payables/bills/${b.id}`}>{b.number}</Link> }, { id: "v", header: "Vendor ref", accessor: (b) => b.vendorBillNo }, { id: "d", header: "Date", accessor: (b) => b.date, cell: (b) => formatDate(b.date) }, { id: "due", header: "Due", accessor: (b) => b.dueDate, cell: (b) => formatDate(b.dueDate) }, { id: "t", header: "Total", align: "right", accessor: (b) => b.total, cell: (b) => f.money(b.total, b.currency) }, { id: "o", header: "Outstanding", align: "right", accessor: (b) => b.outstanding, cell: (b) => f.money(b.outstanding, b.currency) }, { id: "s", header: "Status", accessor: (b) => b.displayStatus, cell: (b) => <StatusBadge status={b.displayStatus} /> }];
  return (
    <>
      <PageHeader title={c.name} badge={<><StatusBadge status={c.status} /><span className="rounded-full border px-2 text-[11px] text-muted-foreground">{KIND_LABEL[c.kind]}</span></>} description={`${c.city}${c.state ? `, ${c.state}` : ""} · ${c.paymentTerms} · ${c.currency}`} trail={[{ label: c.name }]}
        actions={<><Button variant="outline" size="sm" onClick={() => router.back()}><ArrowLeft /> Back</Button><Button variant="outline" size="sm" onClick={() => setEdit(true)}><Pencil /> Edit</Button>{kind === "customer" && <Button size="sm" asChild><Link href={`/receivables/payments?customer=${c.id}`}>Record receipt</Link></Button>}{kind === "vendor" && <Button size="sm" asChild><Link href={`/payables/payments?vendor=${c.id}`}>Record payment</Link></Button>}</>} />
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label={kind === "customer" ? "Receivable balance" : "Payable balance"} value={f.money(c.balance, undefined, { parens: true })} hint="From the ledger sub-ledger" /><StatCard label="Overdue" value={f.money(overdue)} valueClassName={overdue > 0 ? "text-error" : undefined} />
        <StatCard label={kind === "customer" ? "Total invoiced" : "Total billed"} value={f.money(billed)} /><StatCard label="Credit terms" value={`${c.creditDays} days`} hint={c.paymentTerms} />
      </div>
      <Tabs defaultValue="activity">
        <TabsList><TabsTrigger value="activity">{kind === "customer" ? "Invoices" : "Bills"}</TabsTrigger><TabsTrigger value="statement">Statement & history</TabsTrigger><TabsTrigger value="docs">Documents</TabsTrigger><TabsTrigger value="details">Details</TabsTrigger></TabsList>
        <TabsContent value="activity" className="mt-3">{kind === "customer" ? <DataTable columns={invCols} data={myInv} rowKey={(i) => i.id} hideSearch defaultSort={{ id: "d", dir: "desc" }} emptyTitle="No invoices for this customer" /> : <DataTable columns={billCols} data={myBills} rowKey={(b) => b.id} hideSearch defaultSort={{ id: "d", dir: "desc" }} emptyTitle="No bills for this vendor" />}
          {kind === "customer" && myInv.some((i) => i.source) && <SimNotice className="mt-2" title="Integration-generated">Invoices are sample records simulating EVOQ Billing; they are not created or edited here.</SimNotice>}</TabsContent>
        <TabsContent value="statement" className="mt-3"><StatementView contactId={id} /></TabsContent>
        <TabsContent value="docs" className="mt-3"><DataTable hideSearch columns={[{ id: "n", header: "File", accessor: (d) => d.name }, { id: "c", header: "Category", accessor: (d) => d.category }, { id: "r", header: "Linked to", accessor: (d) => d.linkedRef ?? "" }, { id: "d", header: "Uploaded", accessor: (d) => d.createdAt, cell: (d) => formatDate(d.createdAt) }]} data={docs.filter((d) => d.linkedId === id || myBills.some((b) => b.id === d.linkedId))} rowKey={(d) => d.id} emptyTitle="No documents" emptyDescription="Attach documents on bills or from Accounting → Documents." /></TabsContent>
        <TabsContent value="details" className="mt-3"><Panel><dl className="grid grid-cols-2 gap-4 md:grid-cols-4"><KV label="Email">{c.email}</KV><KV label="Phone">{c.phone}</KV><KV label="Address" className="col-span-2">{c.address}, {c.city}, {c.state}, {c.country}</KV><KV label="GSTIN">{c.gstin}</KV><KV label="PAN">{c.pan}</KV><KV label="Tax ID">{c.taxId}</KV><KV label="Ledger account">{c.ledgerAccountId}</KV><KV label="Payment terms">{c.paymentTerms}</KV><KV label="Credit period">{c.creditDays} days</KV>{c.tdsSection && <KV label="Default TDS">{c.tdsSection} @ {c.tdsRate}%</KV>}<KV label="Added">{formatDate(c.createdAt)}</KV>{c.intercompanyEntityId && <KV label="Intercompany">Linked entity {c.intercompanyEntityId}</KV>}</dl></Panel></TabsContent>
      </Tabs>
      {edit && <ContactForm open onOpenChange={setEdit} contact={c} kind={c.kind} />}
    </>
  );
}
void Combobox; void useContactOptions; void titleCase;
