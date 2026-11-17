"use client";

import * as React from "react";
import { useQueryClient } from "@tanstack/react-query";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Pencil } from "lucide-react";
import { FormDialog } from "@/components/shared/form-dialog";
import { KV, Panel } from "@/components/shared/stat-card";
import { TableSkeleton } from "@/components/shared/states";
import { ENTITY_FIELDS } from "@/components/features/entity-fields";
import { useEntityMutation } from "@/hooks/use-data";
import { useApp } from "@/providers/app-provider";
import { services } from "@/services";
import { entitySchema } from "@/lib/validators";
import { list } from "@/lib/mock/db";

export default function CompanyProfilePage() {
  const { entity } = useApp(); const qc = useQueryClient(); const [edit, setEdit] = React.useState(false);
  const update = useEntityMutation((e, i: Parameters<typeof services.entities.update>[1]) => services.entities.update(e, i), { success: "Company profile saved", onDone: () => qc.invalidateQueries({ queryKey: ["entities"] }) });
  if (!entity) return <TableSkeleton />;
  const posted = list("journals", entity.id).some((j) => j.status === "posted");
  return (
    <>
      <PageHeader title="Company Profile" description="Legal and registration details for the active entity." actions={<Button size="sm" onClick={() => setEdit(true)}><Pencil /> Edit profile</Button>} />
      <Panel><dl className="grid grid-cols-2 gap-4 md:grid-cols-4"><KV label="Display name">{entity.name}</KV><KV label="Legal name">{entity.legalName}</KV><KV label="Industry">{entity.industry}</KV><KV label="Country">{entity.country}</KV><KV label="Address" className="col-span-2">{entity.address}, {entity.city}, {entity.state}</KV><KV label="Registration no.">{entity.gstin}</KV><KV label="PAN">{entity.pan}</KV><KV label="Base currency">{entity.baseCurrency}</KV><KV label="Tax regime">{entity.taxRegime === "india-gst" ? "India GST" : "Flat GST / VAT"}</KV><KV label="Group role">{entity.role} · {entity.ownership}%</KV></dl></Panel>
      <FormDialog open={edit} onOpenChange={setEdit} size="lg" title="Edit company profile" schema={entitySchema} fields={ENTITY_FIELDS.map((x) => (["baseCurrency", "fyStartMonth", "taxRegime"].includes(x.name) && posted ? { ...x, disabled: true } : x))} defaultValues={{ ...entity, fyStartMonth: String(entity.fyStartMonth), gstin: entity.gstin ?? "", pan: entity.pan ?? "" }} submitLabel="Save"
        onSubmit={async (v: never) => { const x = v as Record<string, string | number>; await update.mutateAsync({ ...(x as object), id: entity.id, fyStartMonth: Number(x.fyStartMonth), ownership: Number(x.ownership) } as never); }} />
    </>
  );
}
