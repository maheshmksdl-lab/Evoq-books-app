"use client";

import * as React from "react";
import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { Pencil } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/shared/page-header";
import { FormDialog } from "@/components/shared/form-dialog";
import { KV, Panel, StatCard } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { TableSkeleton } from "@/components/shared/states";
import { ENTITY_FIELDS } from "@/components/features/entity-fields";
import { useEntityMutation } from "@/hooks/use-data";
import { useApp, useFormat } from "@/providers/app-provider";
import { services } from "@/services";
import { entitySchema } from "@/lib/validators";
import { list } from "@/lib/mock/db";
import { formatMoney } from "@/lib/formatters";

export default function EntityDetailPage() {
  const { id } = useParams<{ id: string }>(); const router = useRouter(); const qc = useQueryClient(); const f = useFormat(); const { entities, setEntityId, entityId } = useApp(); const e = entities.find((x) => x.id === id); const [edit, setEdit] = React.useState(false);
  const update = useEntityMutation((_e, i: Parameters<typeof services.entities.update>[1]) => services.entities.update(_e, i), { success: "Entity updated", onDone: () => qc.invalidateQueries({ queryKey: ["entities"] }) });
  if (!e) return <TableSkeleton />;
  const accounts = list("accounts", id).filter((a) => !a.isGroup).length, contacts = list("contacts", id).length, journals = list("journals", id).filter((j) => j.status === "posted").length, banks = list("bankAccounts", id).length;
  const open = (path: string) => { setEntityId(id); router.push(path); };
  const toggle = (k: keyof typeof e.accountSettings, v: boolean) => update.mutate({ id, accountSettings: { ...e.accountSettings, [k]: v } });
  return (
    <>
      <PageHeader title={e.name} badge={<StatusBadge status={e.role} tone={e.role === "parent" ? "info" : "neutral"} label={e.role === "parent" ? "Parent" : "Subsidiary"} />} description={`${e.legalName} · ${e.city}, ${e.country}`} trail={[{ label: e.name }]} actions={<><Button variant="outline" size="sm" onClick={() => setEdit(true)}><Pencil /> Edit</Button>{id !== entityId && <Button size="sm" onClick={() => setEntityId(id)}>Switch to this entity</Button>}</>} />
      <div className="mb-4 grid grid-cols-2 gap-3 lg:grid-cols-4"><StatCard label="Base currency" value={e.baseCurrency} /><StatCard label="Financial year" value={e.fyStartMonth === 1 ? "Jan – Dec" : "Apr – Mar"} /><StatCard label="Ledger accounts" value={String(accounts)} hint={`${banks} bank accounts`} /><StatCard label="Posted journals" value={String(journals)} hint={`${contacts} contacts`} /></div>
      <Tabs defaultValue="overview"><TabsList><TabsTrigger value="overview">Overview</TabsTrigger><TabsTrigger value="settings">Account settings</TabsTrigger><TabsTrigger value="reports">Entity reports</TabsTrigger></TabsList>
        <TabsContent value="overview" className="mt-3"><Panel><dl className="grid grid-cols-2 gap-4 md:grid-cols-4"><KV label="Legal name">{e.legalName}</KV><KV label="Industry">{e.industry}</KV><KV label="Country">{e.country}</KV><KV label="State">{e.state}</KV><KV label="Address" className="col-span-2">{e.address}</KV><KV label="Tax regime">{e.taxRegime === "india-gst" ? "India GST" : "Flat GST / VAT"}</KV><KV label="Registration no.">{e.gstin}</KV><KV label="PAN">{e.pan}</KV><KV label="Ownership">{e.ownership}%</KV></dl></Panel></TabsContent>
        <TabsContent value="settings" className="mt-3"><Panel title="Entity account settings" description="Applied to this entity's books only">
          <div className="space-y-2 divide-y">{([["requireJournalApproval", "Require approval for large manual journals", "Applies the entity's approval rules to manual journals"], ["allowBackdated", "Allow back-dated postings", "Entries can be dated in earlier open periods"], ["autoNumbering", "Automatic document numbering", "Sequential numbers per financial year"]] as const).map(([k, l, d]) => <div key={k} className="flex items-center justify-between py-2"><div><p className="text-sm font-medium">{l}</p><p className="text-xs text-muted-foreground">{d}</p></div><Switch checked={e.accountSettings[k]} onCheckedChange={(v) => toggle(k, v)} aria-label={l} /></div>)}</div>
          <p className="mt-2 text-xs text-muted-foreground">Base currency {e.baseCurrency} and financial-year start cannot change once transactions are posted. Chart of accounts: <Link className="text-primary hover:underline" href="/settings/coa">manage</Link> (switch to this entity first).</p></Panel></TabsContent>
        <TabsContent value="reports" className="mt-3"><Panel title="Open entity-level reports" description={`Opens the report with ${e.name} selected as the active entity`}><div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">{[["Profit and Loss", "/reports/view/pnl"], ["Balance Sheet", "/reports/view/balance-sheet"], ["Trial Balance", "/reports/view/trial-balance"], ["Cash Flow", "/reports/view/cash-flow"], ["Receivables Ageing", "/reports/view/ar-ageing"], ["Dashboard", "/dashboard"]].map(([l, p]) => <Button key={p} variant="outline" className="justify-start" onClick={() => open(p)}>{l}</Button>)}</div></Panel></TabsContent></Tabs>
      <FormDialog open={edit} onOpenChange={setEdit} size="lg" title={`Edit ${e.name}`} schema={entitySchema} fields={ENTITY_FIELDS.map((x) => (["baseCurrency", "fyStartMonth", "taxRegime"].includes(x.name) && journals > 0 ? { ...x, disabled: true } : x))} defaultValues={{ ...e, fyStartMonth: String(e.fyStartMonth), gstin: e.gstin ?? "", pan: e.pan ?? "" }} submitLabel="Save changes"
        onSubmit={async (v: never) => { const x = v as Record<string, string | number>; await update.mutateAsync({ ...(x as object), id, fyStartMonth: Number(x.fyStartMonth), ownership: Number(x.ownership) } as never); }} />
      <span className="hidden">{formatMoney(0)}{f.currency}</span>
    </>
  );
}
