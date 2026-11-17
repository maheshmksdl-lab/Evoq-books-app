"use client";

import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { PeriodPicker } from "@/components/shared/range-picker";
import { Panel, StatCard } from "@/components/shared/stat-card";
import { ErrorState, SimNotice, TableSkeleton } from "@/components/shared/states";
import { TrendChart } from "@/components/charts/charts";
import { DataTable } from "@/components/shared/data-table";
import { useTaxOverview } from "@/hooks/use-data";
import { useApp, useFormat } from "@/providers/app-provider";

export default function TaxOverviewPage() {
  const f = useFormat(); const { range, entity } = useApp(); const { data, isLoading, error, refetch } = useTaxOverview(range.from, range.to);
  const india = entity?.taxRegime === "india-gst";
  if (error) return <ErrorState error={error as Error} onRetry={() => refetch()} />;
  return (
    <>
      <PageHeader title="Tax Overview" description={india ? "GST, input tax credit and TDS position derived from your invoices, bills and expenses." : "GST position derived from your sales and purchases."} actions={<PeriodPicker />} />
      <SimNotice className="mb-3" title="Not a statutory filing">Figures are calculated from sample books. No return is filed and there is no connection to any tax portal.</SimNotice>
      {isLoading || !data ? <TableSkeleton rows={6} /> : (
        <div className="space-y-4">
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-5">
            <StatCard label="Output tax (period)" value={f.money(data.period.outputTotal)} hint={`on ${f.compact(data.period.taxableSales)} taxable sales`} /><StatCard label="Input tax (period)" value={f.money(data.period.inputTotal)} hint={`on ${f.compact(data.period.taxablePurchases)} purchases`} />
            <StatCard label="Net tax for period" value={f.money(data.period.netPayable, undefined, { parens: true })} valueClassName={data.period.netPayable > 0 ? undefined : "text-[color-mix(in_srgb,var(--s-success)_55%,black)]"} hint="Output − input" />
            <StatCard label="GST payable now" value={f.money(data.netGstLiability, undefined, { parens: true })} hint="Ledger balance net of ITC" onClick={undefined} /><StatCard label="TDS payable" value={f.money(data.tdsPayable)} hint={`${f.money(data.unpaidTds)} not yet deposited`} />
          </div>
          <div className="grid gap-4 lg:grid-cols-[1.5fr_1fr]">
            <Panel title="Output vs input tax" description="Last 8 months"><TrendChart data={data.months} height={240} series={[{ key: "output", label: "Output tax" }, { key: "input", label: "Input tax", color: "var(--t-soft)" }, { key: "net", label: "Net", type: "line", color: "var(--t-depth)" }]} /></Panel>
            <Panel title="Tax liability summary" noPad>
              <dl className="divide-y text-[13px]">
                {[["CGST output", data.period.outputCgst], ["SGST output", data.period.outputSgst], [india ? "IGST output" : "GST output", data.period.outputIgst], ["CGST input", -data.period.inputCgst], ["SGST input", -data.period.inputSgst], [india ? "IGST input" : "GST input", -data.period.inputIgst]].filter(([, v]) => v !== 0).map(([k, v]) => <div key={String(k)} className="flex justify-between px-3 py-1.5"><dt className="text-muted-foreground">{k}</dt><dd className="tnum">{f.money(Number(v), undefined, { parens: true })}</dd></div>)}
                <div className="flex justify-between bg-muted/40 px-3 py-2 font-semibold"><dt>Net for period</dt><dd className="tnum">{f.money(data.period.netPayable, undefined, { parens: true })}</dd></div>
              </dl>
            </Panel>
          </div>
          <DataTable hideSearch data={data.months} rowKey={(m) => m.month} pageSize={8} columns={[{ id: "m", header: "Tax period", accessor: (m) => m.label }, { id: "o", header: "Output tax", align: "right", accessor: (m) => m.output, cell: (m) => f.money(m.output) }, { id: "i", header: "Input tax", align: "right", accessor: (m) => m.input, cell: (m) => f.money(m.input) }, { id: "n", header: "Net payable / (credit)", align: "right", accessor: (m) => m.net, cell: (m) => f.money(m.net, undefined, { parens: true }) }]} exportName="tax-period-summary" />
          <div className="flex flex-wrap gap-3 text-sm"><Link className="text-primary hover:underline" href="/tax/gst">GST summary & transactions →</Link><Link className="text-primary hover:underline" href="/tax/itc">Input tax credit →</Link>{india && <Link className="text-primary hover:underline" href="/tax/tds">TDS records →</Link>}<Link className="text-primary hover:underline" href="/tax/compliance">Compliance →</Link></div>
        </div>)}
    </>
  );
}
