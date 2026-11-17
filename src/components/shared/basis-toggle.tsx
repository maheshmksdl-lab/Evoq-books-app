"use client";

import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { useApp } from "@/providers/app-provider";

/** Accrual / cash reporting basis. Persisted per browser; applies to the dashboard and Profit & Loss. */
export function BasisToggle({ className }: { className?: string }) {
  const { basis, setBasis } = useApp();
  return (
    <Tabs value={basis} onValueChange={(v) => setBasis(v as "accrual" | "cash")} className={className}>
      <TabsList className="h-8" aria-label="Report basis">
        <TabsTrigger value="accrual" className="px-3 text-xs" title="Income and expenses recognised when invoiced or billed">Accrual</TabsTrigger>
        <TabsTrigger value="cash" className="px-3 text-xs" title="Income and expenses recognised when paid or received">Cash</TabsTrigger>
      </TabsList>
    </Tabs>
  );
}

export function BasisNote() {
  const { basis } = useApp();
  if (basis !== "cash") return null;
  return <p className="tone-info mb-3 rounded-md border px-3 py-2 text-xs"><b>Cash basis.</b> Invoices and bills count as income or expense only when paid, in proportion to the payment. Balance sheet, trial balance and cash flow are unaffected and stay on the ledger.</p>;
}
