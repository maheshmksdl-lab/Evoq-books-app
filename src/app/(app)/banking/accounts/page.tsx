"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Banknote, CreditCard, Landmark, Plus, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable, type Column } from "@/components/shared/data-table";
import { FormDialog } from "@/components/shared/form-dialog";
import { StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { ImportStatementDialog } from "@/components/features/banking";
import { useBankAccounts, useEntityMutation } from "@/hooks/use-data";
import { useAccountOptions } from "@/hooks/use-options";
import { useFormat } from "@/providers/app-provider";
import { services, type BankAccountRowT } from "@/services";
import { bankAccountSchema } from "@/lib/validators";
import { formatDate } from "@/lib/formatters";

const TYPE_ICON = { bank: Landmark, cash: Banknote, credit_card: CreditCard } as const;

export default function BankAccountsPage() {
  const router = useRouter(); const f = useFormat(); const { data, isLoading, error, refetch } = useBankAccounts();
  const [add, setAdd] = React.useState(false); const [imp, setImp] = React.useState(false);
  const ledgerOpts = useAccountOptions(["asset", "liability"]);
  const create = useEntityMutation((e, i: Parameters<typeof services.banking.createAccount>[1]) => services.banking.createAccount(e, i), { success: "Bank account added" });
  const rows = data ?? [];
  const banks = rows.filter((b) => b.type !== "credit_card");
  const cols: Column<BankAccountRowT>[] = [
    { id: "name", header: "Account", accessor: (b) => b.name, cell: (b) => { const I = TYPE_ICON[b.type]; return <Link href={`/banking/accounts/${b.id}`} onClick={(e) => e.stopPropagation()} className="flex items-center gap-2 font-medium text-primary hover:underline"><I className="size-4 text-muted-foreground" />{b.name}</Link>; } },
    { id: "bank", header: "Bank", accessor: (b) => b.bankName, hideBelow: "md" }, { id: "no", header: "Account no.", accessor: (b) => b.accountNo, hideBelow: "md", className: "tnum" },
    { id: "type", header: "Type", accessor: (b) => b.type, cell: (b) => <span className="capitalize">{b.type.replace("_", " ")}</span>, hideBelow: "lg" },
    { id: "book", header: "Book balance", align: "right", accessor: (b) => b.bookBalance, cell: (b) => f.money(b.bookBalance, undefined, { parens: true }) },
    { id: "stmt", header: "Statement balance", align: "right", accessor: (b) => b.statementBalance, cell: (b) => (b.type === "cash" ? "—" : f.money(b.statementBalance, undefined, { parens: true })), hideBelow: "md" },
    { id: "un", header: "Unmatched", align: "right", accessor: (b) => b.unmatched, cell: (b) => (b.unmatched ? <span className="font-medium text-[color-mix(in_srgb,var(--s-warning)_55%,black)]">{b.unmatched}</span> : "—") },
    { id: "rec", header: "Last reconciled", accessor: (b) => b.lastReconciled ?? "", cell: (b) => (b.lastReconciled ? formatDate(b.lastReconciled) : <StatusBadge status="pending" label="Never" />), hideBelow: "lg" },
  ];
  return (
    <>
      <PageHeader title="Bank Accounts" description="Bank, cash and credit-card accounts with book and statement balances." actions={<><Button variant="outline" size="sm" onClick={() => setImp(true)}><Upload /> Import statement</Button><Button size="sm" onClick={() => setAdd(true)}><Plus /> Add account</Button></>} />
      <div className="mb-3 grid grid-cols-2 gap-3 lg:grid-cols-4">
        <StatCard label="Total cash & bank" value={f.money(banks.reduce((s, b) => s + b.bookBalance, 0))} hint={`${banks.length} accounts`} />
        <StatCard label="Statement balance" value={f.money(banks.filter((b) => b.type === "bank").reduce((s, b) => s + b.statementBalance, 0))} hint="Per latest imports" />
        <StatCard label="Unmatched lines" value={String(rows.reduce((s, b) => s + b.unmatched, 0))} hint={f.money(rows.reduce((s, b) => s + b.unmatchedValue, 0))} />
        <StatCard label="Credit card outstanding" value={f.money(Math.abs(rows.filter((b) => b.type === "credit_card").reduce((s, b) => s + b.bookBalance, 0)))} />
      </div>
      <DataTable columns={cols} data={rows} rowKey={(b) => b.id} isLoading={isLoading} error={error as Error | null} onRetry={() => refetch()} hideSearch exportName="bank-accounts" onRowClick={(b) => router.push(`/banking/accounts/${b.id}`)} />
      <FormDialog open={add} onOpenChange={setAdd} title="Add bank account" description="Links a bank or cash account to a ledger account." schema={bankAccountSchema} submitLabel="Add account"
        fields={[{ name: "name", label: "Account name", required: true, span: 2 }, { name: "bankName", label: "Bank", required: true }, { name: "accountNo", label: "Account number (masked)", required: true }, { name: "type", label: "Type", type: "select", options: [{ value: "bank", label: "Bank account" }, { value: "cash", label: "Cash" }, { value: "credit_card", label: "Credit card" }], required: true }, { name: "ledgerAccountId", label: "Ledger account", type: "combobox", options: ledgerOpts, required: true }, { name: "openingStatement", label: "Opening statement balance", type: "money" }]}
        defaultValues={{ name: "", bankName: "", accountNo: "••••", type: "bank", ledgerAccountId: "", openingStatement: 0 }} onSubmit={async (v: Parameters<typeof services.banking.createAccount>[1]) => { await create.mutateAsync({ ...v, openingStatement: Number(v.openingStatement) || 0 }); }} />
      <ImportStatementDialog open={imp} onOpenChange={setImp} />
    </>
  );
}
