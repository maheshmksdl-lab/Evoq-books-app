"use client";

import * as React from "react";
import { useRouter } from "next/navigation";
import { Command as CommandPrimitive } from "cmdk";
import { Building2, FileText, Landmark, Receipt, Search, Users, X } from "lucide-react";
import { Command, CommandEmpty, CommandGroup, CommandItem, CommandList } from "@/components/ui/command";
import { Button } from "@/components/ui/button";
import { useAccounts, useBills, useContacts, useInvoices } from "@/hooks/use-data";
import { useMediaQuery } from "@/hooks/use-media-query";
import { ALL_NAV_ITEMS } from "@/lib/nav";
import { useApp } from "@/providers/app-provider";
import { cn } from "@/lib/utils";

/** Substring ranking (word-start matches first) — more predictable than cmdk fuzzy matching for names and numbers. */
function substringScore(value: string, search: string): number {
  const v = value.toLowerCase(), q = search.trim().toLowerCase();
  if (!q) return 1;
  const i = v.indexOf(q);
  if (i < 0) return q.split(/s+/).every((t) => v.includes(t)) ? 0.2 : 0;
  return i === 0 || v[i - 1] === " " ? 1 : 0.5;
}

/** Record results are only fetched while the panel is open (the queries are cached by TanStack Query afterwards). */
function RecordGroups({ onGo }: { onGo: (href: string) => void }) {
  const accounts = useAccounts().data ?? [], contacts = useContacts().data ?? [], invoices = useInvoices().data ?? [], bills = useBills().data ?? [];
  const row = (icon: React.ReactNode, id: string, value: string, label: string, hint: string, href: string) => (
    <CommandItem key={id} value={value} onSelect={() => onGo(href)} className="gap-3 py-2">
      <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-accent text-primary">{icon}</span>
      <span className="min-w-0 flex-1 truncate">{label}</span><span className="shrink-0 text-xs text-muted-foreground">{hint}</span>
    </CommandItem>
  );
  return (
    <>
      <CommandGroup heading="Accounts">
        {accounts.filter((a) => !a.isGroup).map((a) => row(<Landmark className="size-3.5" />, a.id, `account ${a.code} ${a.name}`, a.name, a.code, `/accounting/general-ledger?account=${a.id}`))}
      </CommandGroup>
      <CommandGroup heading="Customers & vendors">
        {contacts.map((c) => row(c.kind === "other" ? <Building2 className="size-3.5" /> : <Users className="size-3.5" />, c.id, `contact ${c.kind} ${c.name} ${c.city}`, c.name, c.kind, c.kind === "customer" ? `/receivables/customers/${c.id}` : c.kind === "vendor" ? `/payables/vendors/${c.id}` : "/accounting/contacts"))}
      </CommandGroup>
      <CommandGroup heading="Invoices">
        {invoices.map((i) => row(<Receipt className="size-3.5" />, i.id, `invoice ${i.number} ${i.customerName}`, `${i.number} · ${i.customerName}`, i.displayStatus, `/receivables/invoices/${i.id}`))}
      </CommandGroup>
      <CommandGroup heading="Bills">
        {bills.map((b) => row(<FileText className="size-3.5" />, b.id, `bill ${b.number} ${b.vendorBillNo} ${b.vendorName}`, `${b.number} · ${b.vendorName}`, b.displayStatus, `/payables/bills/${b.id}`))}
      </CommandGroup>
    </>
  );
}

/**
 * Inline global search (combobox + results panel). Behaviour:
 *  – clicking / focusing the input opens the panel; typing filters; the panel stays open while interacting inside it
 *  – ↑ ↓ Enter navigate and select (cmdk); Escape closes; pointer-down outside closes
 *  – Ctrl/Cmd + K focuses the input from anywhere
 *  – below 768px the box collapses to an icon that expands to a full-width bar
 */
export function GlobalSearch() {
  const router = useRouter(); const { can } = useApp();
  const compact = useMediaQuery("(max-width: 767px)");
  const [open, setOpen] = React.useState(false); const [expanded, setExpanded] = React.useState(false); const [q, setQ] = React.useState("");
  const root = React.useRef<HTMLDivElement>(null); const input = React.useRef<HTMLInputElement>(null);

  const close = React.useCallback(() => { setOpen(false); setExpanded(false); setQ(""); input.current?.blur(); }, []);
  const go = (href: string) => { close(); router.push(href); };

  // Ctrl / Cmd + K from anywhere
  React.useEffect(() => {
    const h = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setExpanded(true); setOpen(true); requestAnimationFrame(() => input.current?.focus()); } };
    window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h);
  }, []);
  // Close on pointer-down outside (inside clicks never reach this because they are contained in `root`)
  React.useEffect(() => {
    if (!open) return;
    const h = (e: PointerEvent) => { if (root.current && !root.current.contains(e.target as Node)) close(); };
    document.addEventListener("pointerdown", h); return () => document.removeEventListener("pointerdown", h);
  }, [open, close]);

  if (compact && !expanded) {
    return <Button variant="ghost" size="icon" aria-label="Search" onClick={() => { setExpanded(true); setOpen(true); requestAnimationFrame(() => input.current?.focus()); }}><Search /></Button>;
  }

  return (
    <div ref={root} className={cn("relative", compact ? "fixed inset-x-0 top-0 z-50 flex h-16 items-center bg-card px-3 shadow-sm" : "w-full max-w-[640px] flex-1")}>
      <Command shouldFilter filter={substringScore} label="Global search" onKeyDown={(e) => { if (e.key === "Escape") { e.preventDefault(); close(); } }} className="relative size-auto w-full overflow-visible rounded-none! bg-transparent p-0">
        <div className={cn("flex h-10 items-center gap-2 rounded-lg border bg-muted/40 px-3 transition-colors", "hover:border-soft hover:bg-card focus-within:border-action focus-within:bg-card focus-within:ring-3 focus-within:ring-ring/25", open && "border-action bg-card")}>
          <Search className="size-4 shrink-0 text-muted-foreground" aria-hidden />
          <CommandPrimitive.Input ref={input} value={q} onValueChange={setQ} onFocus={() => setOpen(true)} onClick={() => setOpen(true)} placeholder="Search pages, accounts, customers, invoice numbers…"
            aria-label="Search" className="h-full min-w-0 flex-1 bg-transparent text-sm outline-none placeholder:text-muted-foreground" />
          {q ? <button type="button" aria-label="Clear search" onClick={() => { setQ(""); input.current?.focus(); }} className="flex size-5 items-center justify-center rounded text-muted-foreground hover:bg-muted"><X className="size-3.5" /></button>
            : compact ? <button type="button" aria-label="Close search" onClick={close} className="flex size-6 items-center justify-center rounded text-muted-foreground hover:bg-muted"><X className="size-4" /></button>
            : <kbd className="hidden rounded border bg-card px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground sm:inline">Ctrl K</kbd>}
        </div>
        {open && (
          <div className={cn("absolute z-50 overflow-hidden rounded-xl border bg-popover shadow-[0_12px_40px_rgb(16_24_40/0.14)]", compact ? "inset-x-3 top-[58px]" : "left-0 right-0 top-full mt-2")}>
            <CommandList className="max-h-[min(70vh,440px)] p-1.5">
              <CommandEmpty>No results for “{q}”.</CommandEmpty>
              <CommandGroup heading="Pages">
                {ALL_NAV_ITEMS.filter((i) => !i.perm || can(i.perm, "view")).map((i) => (
                  <CommandItem key={i.href} value={`page ${i.group} ${i.label} ${i.keywords ?? ""}`} onSelect={() => go(i.href)} className="gap-3 py-2">
                    <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-muted text-muted-foreground"><FileText className="size-3.5" /></span>
                    <span className="min-w-0 flex-1 truncate">{i.label}</span><span className="shrink-0 text-xs text-muted-foreground">{i.group}</span>
                  </CommandItem>))}
              </CommandGroup>
              <RecordGroups onGo={go} />
            </CommandList>
            <div className="flex items-center justify-between border-t bg-muted/30 px-3 py-1.5 text-[11px] text-muted-foreground"><span>↑ ↓ to navigate · Enter to open · Esc to close</span><span className="hidden sm:inline">Results grouped by type</span></div>
          </div>
        )}
      </Command>
    </div>
  );
}
