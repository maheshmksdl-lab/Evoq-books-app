"use client";

import { FileCheck2, FileJson, Receipt, Truck, Landmark } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { Panel } from "@/components/shared/stat-card";
import { SimNotice } from "@/components/shared/states";
import { StatusBadge } from "@/components/shared/status-badge";
import { useTaxOverview } from "@/hooks/use-data";
import { useApp, useFormat } from "@/providers/app-provider";
import { toast } from "sonner";

const ITEMS = [
  { id: "gstr1", title: "GSTR-1", desc: "Outward supplies return", icon: FileJson, due: "11th of next month" },
  { id: "gstr3b", title: "GSTR-3B", desc: "Summary return and tax payment", icon: FileCheck2, due: "20th of next month" },
  { id: "einv", title: "E-invoice (IRN)", desc: "Invoice registration portal", icon: Receipt, due: "At invoice creation" },
  { id: "eway", title: "E-way bill", desc: "Goods movement document", icon: Truck, due: "Before dispatch" },
  { id: "tds", title: "TDS returns (24Q / 26Q)", desc: "Quarterly TDS statements", icon: Landmark, due: "31 Jul · 31 Oct · 31 Jan · 31 May" },
];

export default function CompliancePage() {
  const f = useFormat(); const { range, entity } = useApp(); const { data } = useTaxOverview(range.from, range.to);
  return (<>
    <PageHeader title="Compliance" description="Placeholders for future statutory workflows. Nothing on this page connects to a government system." />
    <SimNotice className="mb-3" title="No live connectivity">These items are clearly-labelled placeholders. EVOQ Books does not file returns, generate IRNs or e-way bills, or connect to the GST / income-tax portals in this build.</SimNotice>
    {entity?.taxRegime !== "india-gst" && <p className="tone-info mb-3 rounded-md border px-3 py-2 text-xs">The selected entity uses a flat GST regime. Indian compliance items are shown for reference only.</p>}
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {ITEMS.map((i) => (
        <Panel key={i.id} title={<span className="flex items-center gap-2"><i.icon className="size-4 text-primary" />{i.title}</span>} description={i.desc} actions={<StatusBadge status="draft" label="Not connected" />}>
          <p className="text-xs text-muted-foreground">Typical due date: {i.due}</p>
          {i.id === "gstr3b" && data && <dl className="mt-2 space-y-1 rounded-md bg-surface p-2 text-xs"><div className="flex justify-between"><dt>Outward taxable value</dt><dd className="tnum">{f.money(data.period.taxableSales)}</dd></div><div className="flex justify-between"><dt>Output tax</dt><dd className="tnum">{f.money(data.period.outputTotal)}</dd></div><div className="flex justify-between"><dt>ITC available</dt><dd className="tnum">{f.money(data.period.inputTotal)}</dd></div><div className="flex justify-between font-semibold"><dt>Net tax payable</dt><dd className="tnum">{f.money(data.period.netPayable, undefined, { parens: true })}</dd></div><p className="pt-1 text-[10px] text-muted-foreground">Data preview from the books — not a prepared return.</p></dl>}
          <Button className="mt-3" size="sm" variant="outline" onClick={() => toast.info(`${i.title} is a placeholder`, { description: "Statutory filing needs a backend and portal integration, which are out of scope for this frontend build." })}>Prepare (placeholder)</Button>
        </Panel>))}
    </div>
  </>);
}
