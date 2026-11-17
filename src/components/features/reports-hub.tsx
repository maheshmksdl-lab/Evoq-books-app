"use client";

import Link from "next/link";
import { BarChart3, ChevronRight, FileSpreadsheet, Scale } from "lucide-react";
import { PageHeader } from "@/components/shared/page-header";
import { CATEGORY_META, REPORTS, type ReportCategory } from "@/lib/reports-registry";

export function ReportsCategory({ category }: { category: ReportCategory }) {
  const meta = CATEGORY_META[category]; const list = REPORTS.filter((r) => r.category === category);
  return (
    <>
      <PageHeader title={meta.title} description={meta.description} />
      <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
        {list.map((r) => (
          <Link key={r.slug} href={`/reports/view/${r.slug}`} className="group flex items-start gap-3 rounded-lg border bg-card p-4 transition-colors hover:border-soft hover:bg-surface focus-visible:ring-2 focus-visible:ring-ring">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-md bg-accent text-primary">{category === "ageing-reports" ? <Scale className="size-4" /> : category === "financial-statements" ? <BarChart3 className="size-4" /> : <FileSpreadsheet className="size-4" />}</span>
            <span className="min-w-0 flex-1"><span className="block text-sm font-medium group-hover:text-primary">{r.title}</span><span className="mt-0.5 block text-xs text-muted-foreground">{r.description}</span></span><ChevronRight className="mt-1 size-4 text-muted-foreground" />
          </Link>))}
      </div>
      <p className="mt-4 text-xs text-muted-foreground">All reports are calculated from the same journal data as the ledger and dashboard. Use Print or Export on any report — PDF and Excel exports are browser simulations.</p>
    </>
  );
}
