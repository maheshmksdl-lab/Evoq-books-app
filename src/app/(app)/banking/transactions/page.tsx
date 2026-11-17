"use client";

import * as React from "react";
import Link from "next/link";
import { Sparkles, Upload, Wand2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { PageHeader } from "@/components/shared/page-header";
import { SelectField } from "@/components/shared/form-controls";
import { BankTxnTable, ImportStatementDialog } from "@/components/features/banking";
import { useEntityMutation } from "@/hooks/use-data";
import { useBankOptions } from "@/hooks/use-options";
import { services } from "@/services";

export default function BankTransactionsPage() {
  const [imp, setImp] = React.useState(false); const [acct, setAcct] = React.useState(""); const banks = useBankOptions(["bank"]);
  const auto = useEntityMutation((e, id: string) => services.banking.autoMatch(e, id), { success: (n) => (n ? `Auto-matched ${n} transactions` : "No new automatic matches found") });
  return (
    <>
      <PageHeader title="Bank Transactions" description="Imported statement lines. Categorise them, match them to book entries, or exclude duplicates."
        actions={<>
          <div className="w-56"><SelectField value={acct} onChange={setAcct} options={banks} allowEmpty placeholder="All bank accounts" /></div>
          <Button variant="outline" size="sm" disabled={!acct || auto.isPending} onClick={() => auto.mutate(acct)} title={acct ? "Match by amount and date" : "Choose an account first"}><Wand2 /> Auto-match</Button>
          <Button variant="outline" size="sm" asChild><Link href="/ai/categorization"><Sparkles /> AI suggestions</Link></Button>
          <Button size="sm" onClick={() => setImp(true)}><Upload /> Import statement</Button>
        </>} />
      <BankTxnTable key={acct} bankAccountId={acct || undefined} pageSize={20} />
      <ImportStatementDialog open={imp} onOpenChange={setImp} defaultAccount={acct} />
    </>
  );
}
