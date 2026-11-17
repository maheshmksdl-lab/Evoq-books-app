"use client";
import { Cloud, FileText, Landmark, Mail, Percent, Plug, Receipt } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { Panel } from "@/components/shared/stat-card";
import { SimNotice } from "@/components/shared/states";
import { StatusBadge } from "@/components/shared/status-badge";
const ITEMS = [
  { name: "EVOQ Billing", desc: "Receives sales invoices and customer payments.", icon: Receipt, status: "connected", label: "Sample data", note: "Simulated — invoices on the Receivables page are generated sample records." },
  { name: "Bank feeds", desc: "Automatic statement import from banks.", icon: Landmark, status: "connected", label: "Sample providers", note: "Placeholder providers; no live bank connectivity." },
  { name: "GST / income-tax portals", desc: "Return filing, e-invoice and e-way bills.", icon: Percent, status: "disconnected", label: "Not connected", note: "Out of scope for this build." },
  { name: "AI services", desc: "Assistant, extraction and agents.", icon: Plug, status: "disconnected", label: "Simulated", note: "All AI features use prepared mock logic." },
  { name: "Email & notifications", desc: "Delivery of alerts and statements.", icon: Mail, status: "disconnected", label: "Not connected", note: "Notifications are in-app only." },
  { name: "Cloud document storage", desc: "Long-term storage for attachments.", icon: Cloud, status: "disconnected", label: "Simulated", note: "Files live in browser storage." },
  { name: "Payment gateway", desc: "Collect and send payments.", icon: FileText, status: "disconnected", label: "Not connected", note: "Payments are recorded, never executed." },
] as const;
export default function Page() {
  return (<>
    <PageHeader title="Integrations" description="External systems EVOQ Books will connect to. In this frontend build every integration is a clearly-labelled placeholder." />
    <SimNotice className="mb-3" title="No live integrations">Services sit behind mock adapters, so a real API can replace them without changing the screens.</SimNotice>
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">{ITEMS.map((i) => <Panel key={i.name} title={<span className="flex items-center gap-2"><i.icon className="size-4 text-primary" />{i.name}</span>} description={i.desc} actions={<StatusBadge status={i.status} label={i.label} tone={i.status === "connected" ? "info" : "neutral"} />}><p className="text-xs text-muted-foreground">{i.note}</p><Button size="sm" variant="outline" className="mt-3" onClick={() => toast.info(`${i.name} can't be configured here`, { description: i.note })}>Configure</Button></Panel>)}</div>
  </>);
}
