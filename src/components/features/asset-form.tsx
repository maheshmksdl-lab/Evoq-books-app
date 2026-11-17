"use client";

import { FormDialog, type FieldDef } from "@/components/shared/form-dialog";
import { useEntityMutation } from "@/hooks/use-data";
import { useBankOptions, useContactOptions } from "@/hooks/use-options";
import { useApp } from "@/providers/app-provider";
import { services, type AssetInput, type AssetRow } from "@/services";
import { assetSchema } from "@/lib/validators";

export const ASSET_CATEGORIES = ["Plant & Machinery", "Office Equipment", "Computers & IT", "Furniture & Fixtures", "Vehicles"] as const;

export function AssetFormDialog({ open, onOpenChange, asset }: { open: boolean; onOpenChange: (o: boolean) => void; asset?: AssetRow | null }) {
  const { today } = useApp(); const vendors = useContactOptions("vendor"); const banks = useBankOptions(["bank", "cash"]);
  const save = useEntityMutation((e, i: AssetInput) => services.assets.save(e, i), { success: (a) => `${a.tag} saved` });
  const fields: FieldDef[] = [
    { name: "name", label: "Asset name", required: true, span: 2 }, { name: "category", label: "Category", type: "select", options: ASSET_CATEGORIES.map((c) => ({ value: c, label: c })), required: true }, { name: "location", label: "Location", required: true },
    { name: "purchaseDate", label: "Acquisition date", type: "date", required: true }, { name: "cost", label: "Acquisition cost", type: "money", required: true }, { name: "vendorId", label: "Vendor", type: "combobox", options: vendors }, { name: "invoiceRef", label: "Invoice / PO reference" },
    { name: "residual", label: "Residual value", type: "money", hint: "Must be below cost" }, { name: "usefulLifeYears", label: "Useful life (years)", type: "number", step: 1, min: 1 },
    { name: "method", label: "Depreciation method", type: "select", options: [{ value: "SLM", label: "Straight-line (SLM)" }, { value: "WDV", label: "Written-down value (WDV)" }, { value: "DDB", label: "Double-declining balance" }] }, { name: "department", label: "Department" },
    ...(!asset ? [{ name: "postAcquisition", label: "Post acquisition journal", type: "switch" as const, span: 2 as const, hint: "Dr asset / Cr payment account" }, { name: "paymentAccountId", label: "Paid from", type: "select" as const, options: banks, show: (v: Record<string, unknown>) => !!v.postAcquisition }] : []),
  ];
  const defaults = asset ? { ...asset, vendorId: asset.vendorId ?? "", invoiceRef: asset.invoiceRef ?? "", department: asset.department ?? "", postAcquisition: false, paymentAccountId: "" } : { name: "", category: "Computers & IT", purchaseDate: today, vendorId: "", invoiceRef: "", cost: "", residual: 0, usefulLifeYears: 5, method: "SLM", location: "", department: "", postAcquisition: false, paymentAccountId: "" };
  return <FormDialog open={open} onOpenChange={onOpenChange} size="lg" title={asset ? `Edit ${asset.tag}` : "New fixed asset"} description="Depreciation starts the month after acquisition." schema={assetSchema} fields={fields} defaultValues={defaults} submitLabel={asset ? "Save changes" : "Create asset"}
    onSubmit={async (v: AssetInput) => { await save.mutateAsync({ ...v, id: asset?.id, cost: Number(v.cost), residual: Number(v.residual) || 0, usefulLifeYears: Number(v.usefulLifeYears) }); }} />;
}

