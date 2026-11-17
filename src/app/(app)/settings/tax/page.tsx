"use client";

import * as React from "react";
import { Pencil, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable, type Column } from "@/components/shared/data-table";
import { SelectField } from "@/components/shared/form-controls";
import { FormDialog } from "@/components/shared/form-dialog";
import { SimNotice } from "@/components/shared/states";
import { StatusBadge } from "@/components/shared/status-badge";
import { useAccounts, useEntityMutation, useTaxCodes } from "@/hooks/use-data";
import { useAccountOptions } from "@/hooks/use-options";
import { useApp } from "@/providers/app-provider";
import { services } from "@/services";
import { taxCodeSchema } from "@/lib/validators";
import type { TaxCode } from "@/types";

export default function TaxSettingsPage() {
  const { entity } = useApp(); const { data, isLoading, error, refetch } = useTaxCodes(); const accounts = useAccounts().data ?? []; const accOpts = useAccountOptions(["asset", "liability"]); const [edit, setEdit] = React.useState<TaxCode | "new" | null>(null); const [type, setType] = React.useState("all");
  const save = useEntityMutation((e, i: Parameters<typeof services.tax.saveCode>[1]) => services.tax.saveCode(e, i), { success: "Tax code saved" });
  const toggle = useEntityMutation((e, t: TaxCode) => services.tax.saveCode(e, { ...t, active: !t.active }), { success: "Tax code updated" });
  const cols: Column<TaxCode>[] = [{ id: "n", header: "Tax code", accessor: (t) => t.name, cell: (t) => <span className="font-medium">{t.name}</span> }, { id: "h", header: "Head", accessor: (t) => t.head }, { id: "r", header: "Rate", align: "right", accessor: (t) => t.rate, cell: (t) => `${t.rate}%` }, { id: "ty", header: "Type", accessor: (t) => t.type, cell: (t) => <span className="capitalize">{t.type}</span> }, { id: "s", header: "Section", accessor: (t) => t.section ?? "—", hideBelow: "md" }, { id: "a", header: "Tax account", accessor: (t) => accounts.find((a) => a.id === t.accountId)?.name ?? "", hideBelow: "md" }, { id: "st", header: "Status", accessor: (t) => (t.active ? "active" : "inactive"), cell: (t) => <StatusBadge status={t.active ? "active" : "inactive"} /> }];
  return (<>
    <PageHeader title="Tax Settings" description={entity?.taxRegime === "india-gst" ? "India GST rates, tax accounts and TDS sections. Country-specific configuration is kept separate from the accounting core." : "Flat GST / VAT configuration for this entity."} actions={<Button size="sm" onClick={() => setEdit("new")}><Plus /> New tax code</Button>} />
    <SimNotice className="mb-3" title="Configuration only">Tax codes drive the calculators and reports in this demo. They are not connected to any statutory system.</SimNotice>
    <DataTable columns={cols} data={(data ?? []).filter((t) => type === "all" || t.type === type)} rowKey={(t) => t.id} isLoading={isLoading} error={error as Error | null} onRetry={() => refetch()} pageSize={15} exportName="tax-codes" filters={<SelectField size="sm" className="w-40" value={type} onChange={setType} options={[{ value: "all", label: "All types" }, { value: "output", label: "Output" }, { value: "input", label: "Input" }, { value: "withholding", label: "Withholding (TDS)" }]} />}
      rowActions={(t) => [{ label: "Edit", icon: Pencil, onClick: () => setEdit(t) }, { label: t.active ? "Deactivate" : "Activate", onClick: () => toggle.mutate(t) }]} />
    <FormDialog open={!!edit} onOpenChange={(o) => !o && setEdit(null)} size="sm" title={edit && edit !== "new" ? "Edit tax code" : "New tax code"} schema={taxCodeSchema} submitLabel="Save"
      fields={[{ name: "name", label: "Name", required: true, span: 2 }, { name: "head", label: "Tax head", type: "select", options: ["CGST", "SGST", "IGST", "GST", "TDS"].map((h) => ({ value: h, label: h })) }, { name: "type", label: "Type", type: "select", options: [{ value: "output", label: "Output tax" }, { value: "input", label: "Input tax" }, { value: "withholding", label: "Withholding" }] }, { name: "rate", label: "Rate %", type: "number", step: 0.1, required: true }, { name: "section", label: "Section (TDS)" }, { name: "accountId", label: "Tax ledger account", type: "combobox", options: accOpts, required: true, span: 2 }, { name: "active", label: "Active", type: "switch", span: 2 }]}
      defaultValues={edit && edit !== "new" ? { ...edit, section: edit.section ?? "" } : { name: "", head: "IGST", type: "output", rate: 18, section: "", accountId: "", active: true }} onSubmit={async (v: Omit<TaxCode, "id" | "entityId">) => { await save.mutateAsync({ ...v, rate: Number(v.rate), id: edit && edit !== "new" ? edit.id : undefined, section: v.section || undefined }); }} />
  </>);
}
