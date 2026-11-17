"use client";

import Link from "next/link";
import { BarChart3, FileText, Receipt, Scale } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { Panel } from "@/components/shared/stat-card";

const REPORTS = [
  { slug: "tax-summary", title: "Tax Summary", desc: "Output vs input tax by head with net payable for any period.", icon: Receipt },
  { slug: "pnl", title: "Profit & Loss (tax impact)", desc: "Income and expenses before tax context.", icon: BarChart3 },
  { slug: "ar-ageing", title: "Receivables Ageing", desc: "Outstanding output tax exposure by customer age.", icon: Scale },
];
export default function TaxReportsPage() {
  return (<>
    <PageHeader title="Tax Reports" description="Run, print and export tax reports from the shared accounting dataset." />
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {REPORTS.map((r) => <Link key={r.slug} href={`/reports/view/${r.slug}`} className="group rounded-lg border bg-card p-4 transition-colors hover:border-soft hover:bg-surface"><r.icon className="mb-2 size-5 text-primary" /><p className="font-medium group-hover:text-primary">{r.title}</p><p className="mt-0.5 text-xs text-muted-foreground">{r.desc}</p></Link>)}
      <Link href="/tax/gst" className="group rounded-lg border bg-card p-4 transition-colors hover:border-soft hover:bg-surface"><FileText className="mb-2 size-5 text-primary" /><p className="font-medium group-hover:text-primary">GST transaction register</p><p className="mt-0.5 text-xs text-muted-foreground">Every output and input tax transaction with CGST / SGST / IGST.</p></Link>
      <Link href="/tax/itc" className="group rounded-lg border bg-card p-4 transition-colors hover:border-soft hover:bg-surface"><FileText className="mb-2 size-5 text-primary" /><p className="font-medium group-hover:text-primary">Input tax credit register</p><p className="mt-0.5 text-xs text-muted-foreground">Credit availed, utilised and closing balance.</p></Link>
      <Link href="/tax/tds" className="group rounded-lg border bg-card p-4 transition-colors hover:border-soft hover:bg-surface"><FileText className="mb-2 size-5 text-primary" /><p className="font-medium group-hover:text-primary">TDS register</p><p className="mt-0.5 text-xs text-muted-foreground">Deductions by section, quarter and deposit status.</p></Link>
    </div>
    <Panel className="mt-4" title="Tax code configuration"><p className="text-sm text-muted-foreground">Rates, tax accounts and withholding sections are configured in <Link className="text-primary hover:underline" href="/settings/tax">Settings → Tax Settings</Link>. Country-specific tax setup is kept separate from the accounting core.</p></Panel>
  </>);
}
