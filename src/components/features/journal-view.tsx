"use client";

import * as React from "react";
import Link from "next/link";
import { ExternalLink, FlaskConical } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { DetailDrawer } from "@/components/shared/detail-drawer";
import { KV } from "@/components/shared/stat-card";
import { StatusBadge } from "@/components/shared/status-badge";
import { TableSkeleton } from "@/components/shared/states";
import { useAccounts, useContacts, useJournal } from "@/hooks/use-data";
import { useFormat } from "@/providers/app-provider";
import { formatDate, formatDateTime, titleCase } from "@/lib/formatters";
import type { Journal } from "@/types";

export function sourceHref(j: Pick<Journal, "sourceType" | "sourceId" | "kind">): string | undefined {
  if (!j.sourceId) return undefined;
  switch (j.sourceType) {
    case "invoice": return `/receivables/invoices/${j.sourceId}`;
    case "bill": return `/payables/bills/${j.sourceId}`;
    case "expense": return `/expenses/${j.sourceId}`;
    case "asset": return `/advanced-finance/fixed-assets/${j.sourceId}`;
    case "payment": return j.kind === "receipt" ? "/receivables/payments" : "/payables/payments";
    case "credit_note": return "/receivables/credit-notes";
    case "bank_txn": return "/banking/transactions";
    default: return undefined;
  }
}

export function JournalLinesTable({ journal }: { journal: Journal }) {
  const f = useFormat(); const accounts = useAccounts().data ?? []; const contacts = useContacts().data ?? [];
  const acc = new Map(accounts.map((a) => [a.id, a])); const con = new Map(contacts.map((c) => [c.id, c.name]));
  const td = journal.lines.reduce((s, l) => s + l.debit, 0), tc = journal.lines.reduce((s, l) => s + l.credit, 0);
  return (
    <div className="scroll-thin overflow-x-auto rounded-md border">
      <Table>
        <TableHeader className="bg-muted/50"><TableRow><TableHead className="text-[11px] uppercase">Account</TableHead><TableHead className="text-[11px] uppercase">Narration</TableHead><TableHead className="text-right text-[11px] uppercase">Debit</TableHead><TableHead className="text-right text-[11px] uppercase">Credit</TableHead></TableRow></TableHeader>
        <TableBody>
          {journal.lines.map((l) => (
            <TableRow key={l.id}>
              <TableCell className="py-1.5 text-[13px]"><Link href={`/accounting/general-ledger?account=${l.accountId}`} className="hover:underline"><span className="tnum text-muted-foreground">{acc.get(l.accountId)?.code}</span> {acc.get(l.accountId)?.name ?? l.accountId}</Link></TableCell>
              <TableCell className="py-1.5 text-xs text-muted-foreground">{[l.description, l.contactId ? con.get(l.contactId) : ""].filter(Boolean).join(" · ") || "—"}</TableCell>
              <TableCell className="num py-1.5 text-[13px]">{l.debit ? f.money(l.debit) : ""}</TableCell><TableCell className="num py-1.5 text-[13px]">{l.credit ? f.money(l.credit) : ""}</TableCell>
            </TableRow>))}
        </TableBody>
        <TableFooter><TableRow><TableCell colSpan={2} className="text-xs">Total</TableCell><TableCell className="num text-[13px] font-semibold">{f.money(td)}</TableCell><TableCell className="num text-[13px] font-semibold">{f.money(tc)}</TableCell></TableRow></TableFooter>
      </Table>
    </div>
  );
}

/** Drawer used for ledger drill-down: journal summary, lines, and a path to the source document. */
export function JournalDrawer({ journalId, onClose }: { journalId: string | null; onClose: () => void }) {
  const { data: j, isLoading } = useJournal(journalId ?? "");
  const href = j ? sourceHref(j) : undefined;
  return (
    <DetailDrawer open={!!journalId} onOpenChange={(o) => !o && onClose()} wide title={j ? `${j.number}` : "Journal"} description={j?.description}
      footer={j && <>{href && <Button variant="outline" size="sm" asChild><Link href={href}><ExternalLink /> Source: {j.sourceRef}</Link></Button>}<Button size="sm" asChild><Link href={`/accounting/journals/${j.id}`}>Open journal</Link></Button></>}>
      {isLoading || !j ? <TableSkeleton rows={4} cols={3} /> : <>
        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          <KV label="Date">{formatDate(j.date)}</KV><KV label="Status"><StatusBadge status={j.status} /></KV><KV label="Type">{titleCase(j.kind)}</KV>
          <KV label="Source">{j.sourceRef}</KV><KV label="Reference">{j.reference}</KV><KV label="Currency">{j.currency}{j.fxRate !== 1 ? ` @ ${j.fxRate}` : ""}</KV>
          <KV label="Created">{j.createdBy} · {formatDateTime(j.createdAt)}</KV>{j.postedAt && <KV label="Posted">{j.postedBy} · {formatDateTime(j.postedAt)}</KV>}
        </dl>
        {j.aiSuggested && <p className="flex items-center gap-1.5 rounded-md border border-dashed border-soft bg-surface px-2 py-1 text-xs"><FlaskConical className="size-3.5 text-primary" /> Originated from a simulated AI suggestion and reviewed by a person.</p>}
        <JournalLinesTable journal={j} />
      </>}
    </DetailDrawer>
  );
}
