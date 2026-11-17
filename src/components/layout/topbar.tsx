"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Bell, Building2, Check, ChevronsUpDown, CircleHelp, FlaskConical, Menu, Palette, RotateCcw, Search, UserCog, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { CommandDialog, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { ALL_NAV_ITEMS } from "@/lib/nav";
import { THEMES } from "@/lib/themes/themes";
import { formatDate, initials } from "@/lib/formatters";
import { SIMULATED_USER } from "@/lib/constants";
import { resetDemoData } from "@/lib/mock/db";
import { useAccounts, useBills, useContacts, useInvoices, useNotifications } from "@/hooks/use-data";
import { useApp } from "@/providers/app-provider";
import { useTheme } from "@/providers/theme-provider";
import { useConfirm } from "@/components/shared/confirm";
import { PeriodPicker } from "@/components/shared/range-picker";
import { Logo, SidebarNav } from "./sidebar";

function SearchResults({ onGo }: { onGo: (href: string) => void }) {
  const accounts = useAccounts().data ?? [], contacts = useContacts().data ?? [], invoices = useInvoices().data ?? [], bills = useBills().data ?? [];
  return (
    <>
      <CommandGroup heading="Accounts">
        {accounts.filter((a) => !a.isGroup).slice(0, 80).map((a) => <CommandItem key={a.id} value={`account ${a.code} ${a.name}`} onSelect={() => onGo(`/accounting/general-ledger?account=${a.id}`)}><span className="tnum w-12 text-muted-foreground">{a.code}</span>{a.name}</CommandItem>)}
      </CommandGroup>
      <CommandGroup heading="Customers & vendors">
        {contacts.map((c) => <CommandItem key={c.id} value={`contact ${c.kind} ${c.name}`} onSelect={() => onGo(c.kind === "customer" ? `/receivables/customers/${c.id}` : c.kind === "vendor" ? `/payables/vendors/${c.id}` : `/accounting/contacts`)}><span className="w-16 text-[11px] uppercase text-muted-foreground">{c.kind}</span>{c.name}</CommandItem>)}
      </CommandGroup>
      <CommandGroup heading="Invoices & bills">
        {invoices.slice(0, 60).map((i) => <CommandItem key={i.id} value={`invoice ${i.number} ${i.customerName}`} onSelect={() => onGo(`/receivables/invoices/${i.id}`)}><span className="w-24 text-muted-foreground">{i.number}</span>{i.customerName}</CommandItem>)}
        {bills.slice(0, 60).map((b) => <CommandItem key={b.id} value={`bill ${b.number} ${b.vendorBillNo} ${b.vendorName}`} onSelect={() => onGo(`/payables/bills/${b.id}`)}><span className="w-24 text-muted-foreground">{b.number}</span>{b.vendorName}</CommandItem>)}
      </CommandGroup>
    </>
  );
}

function GlobalSearch({ open, setOpen }: { open: boolean; setOpen: (o: boolean) => void }) {
  const router = useRouter(); const { can } = useApp();
  const go = (href: string) => { setOpen(false); router.push(href); };
  return (
    <CommandDialog open={open} onOpenChange={setOpen} title="Search" description="Search pages, accounts, contacts and documents">
      <CommandInput placeholder="Search pages, accounts, customers, invoice numbers…" />
      <CommandList className="max-h-[420px]">
        <CommandEmpty>No results found.</CommandEmpty>
        <CommandGroup heading="Pages">
          {ALL_NAV_ITEMS.filter((i) => !i.perm || can(i.perm, "view")).map((i) => <CommandItem key={i.href} value={`page ${i.group} ${i.label} ${i.keywords ?? ""}`} onSelect={() => go(i.href)}><span className="w-36 truncate text-[11px] uppercase text-muted-foreground">{i.group}</span>{i.label}</CommandItem>)}
        </CommandGroup>
        {open && <SearchResults onGo={go} />}
      </CommandList>
    </CommandDialog>
  );
}

function Notifications() {
  const { data = [] } = useNotifications(); const { dismissed, dismiss } = useApp();
  const items = data.filter((n) => !dismissed.includes(n.id));
  const color = { info: "tone-info", warning: "tone-warning", error: "tone-error", success: "tone-success" } as const;
  return (
    <Popover>
      <PopoverTrigger asChild><Button variant="ghost" size="icon" aria-label={`Notifications (${items.length})`} className="relative"><Bell />{items.length > 0 && <span className="absolute right-1.5 top-1.5 flex size-4 items-center justify-center rounded-full bg-primary text-[9px] font-semibold text-white">{items.length}</span>}</Button></PopoverTrigger>
      <PopoverContent align="end" className="w-[340px] p-0">
        <div className="flex items-center justify-between border-b px-3 py-2"><span className="text-sm font-semibold">Notifications</span>{items.length > 0 && <Button variant="ghost" size="xs" onClick={() => items.forEach((n) => dismiss(n.id))}>Dismiss all</Button>}</div>
        <div className="max-h-80 overflow-y-auto">
          {items.length === 0 ? <p className="px-3 py-8 text-center text-xs text-muted-foreground">You&apos;re all caught up.</p> : items.map((n) => (
            <div key={n.id} className="flex gap-2 border-b px-3 py-2 last:border-0">
              <span className={`${color[n.level]} mt-0.5 size-2 shrink-0 rounded-full border`} />
              <div className="min-w-0 flex-1"><p className="text-[13px] font-medium leading-snug">{n.href ? <Link href={n.href} className="hover:underline">{n.title}</Link> : n.title}</p><p className="text-xs text-muted-foreground">{n.body}</p><p className="mt-0.5 text-[10px] text-muted-foreground">{formatDate(n.at, "dd MMM, HH:mm")} · simulated notification</p></div>
              <Button variant="ghost" size="icon-xs" aria-label="Dismiss" onClick={() => dismiss(n.id)}><X /></Button>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}

export function Topbar() {
  const { entity, entities, setEntityId, roles, actingRole, setRoleId, mobileNav, setMobileNav } = useApp();
  const { theme, setTheme } = useTheme(); const qc = useQueryClient(); const confirm = useConfirm();
  const [searchOpen, setSearchOpen] = React.useState(false);
  React.useEffect(() => { const h = (e: KeyboardEvent) => { if ((e.metaKey || e.ctrlKey) && e.key.toLowerCase() === "k") { e.preventDefault(); setSearchOpen((o) => !o); } }; window.addEventListener("keydown", h); return () => window.removeEventListener("keydown", h); }, []);

  const reset = async () => {
    if (!(await confirm({ title: "Reset demo data?", description: "This clears every record you created or changed in this browser and restores the original sample dataset. Theme and layout preferences are kept.", confirmLabel: "Reset data", destructive: true }))) return;
    resetDemoData(); qc.clear(); toast.success("Demo data restored"); setTimeout(() => window.location.reload(), 300);
  };

  return (
    <header data-topbar className="no-print flex h-14 shrink-0 items-center gap-2 border-b bg-card px-3 lg:px-5">
      <Button variant="ghost" size="icon" className="lg:hidden" aria-label="Open navigation" onClick={() => setMobileNav(true)}><Menu /></Button>
      <Sheet open={mobileNav} onOpenChange={setMobileNav}>
        <SheetContent side="left" className="w-[280px] gap-0 border-0 bg-sidebar p-0 text-sidebar-foreground [&>button]:text-white">
          <SheetHeader className="h-14 justify-center border-b border-sidebar-border px-4"><SheetTitle className="sr-only">Navigation</SheetTitle><Logo /></SheetHeader>
          <SidebarNav onNavigate={() => setMobileNav(false)} />
        </SheetContent>
      </Sheet>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="h-9 max-w-[220px] gap-2 px-2.5" aria-label="Switch company">
            <span className="flex size-6 shrink-0 items-center justify-center rounded bg-accent text-primary"><Building2 className="size-3.5" /></span>
            <span className="hidden min-w-0 text-left sm:block"><span className="block truncate text-[13px] font-medium leading-tight">{entity?.name ?? "Loading…"}</span><span className="block text-[10px] leading-tight text-muted-foreground">{entity?.baseCurrency} · {entity?.country}</span></span>
            <ChevronsUpDown className="size-3.5 opacity-50" />
          </Button>
        </DropdownMenuTrigger>
        <DropdownMenuContent align="start" className="w-72">
          <DropdownMenuLabel className="text-xs text-muted-foreground">Company / entity (sample data)</DropdownMenuLabel>
          {entities.map((e) => (
            <DropdownMenuItem key={e.id} onClick={() => { setEntityId(e.id); toast.success(`Switched to ${e.name}`, { description: "Data is scoped to this entity." }); }} className="items-start gap-2">
              <Check className={`mt-0.5 size-4 ${e.id === entity?.id ? "opacity-100" : "opacity-0"}`} />
              <span className="min-w-0"><span className="block text-sm font-medium">{e.name}</span><span className="block text-xs text-muted-foreground">{e.legalName} · {e.baseCurrency} · {e.role === "parent" ? "Parent" : "Subsidiary"}</span></span>
            </DropdownMenuItem>
          ))}
          <DropdownMenuSeparator />
          <DropdownMenuItem asChild><Link href="/advanced-finance/entities">Manage entities…</Link></DropdownMenuItem>
        </DropdownMenuContent>
      </DropdownMenu>

      <Button variant="outline" className="ml-1 hidden h-9 w-64 justify-start gap-2 px-2.5 font-normal text-muted-foreground md:flex" onClick={() => setSearchOpen(true)} aria-label="Search">
        <Search className="size-4" /><span className="flex-1 text-left text-[13px]">Search…</span><kbd className="rounded border bg-muted px-1.5 text-[10px]">Ctrl K</kbd>
      </Button>
      <Button variant="ghost" size="icon" className="md:hidden" aria-label="Search" onClick={() => setSearchOpen(true)}><Search /></Button>
      <GlobalSearch open={searchOpen} setOpen={setSearchOpen} />

      <div className="ml-auto flex items-center gap-1">
        <div className="mr-1 hidden xl:block"><PeriodPicker compact /></div>
        <Notifications />
        <Popover>
          <PopoverTrigger asChild><Button variant="ghost" size="icon" aria-label="Help"><CircleHelp /></Button></PopoverTrigger>
          <PopoverContent align="end" className="w-72 space-y-2 text-sm">
            <p className="font-semibold">Help & shortcuts</p>
            <ul className="space-y-1 text-xs text-muted-foreground"><li><kbd className="rounded border bg-muted px-1">Ctrl K</kbd> Search pages & records</li><li>Click any table row to open details</li><li>Switch company from the top-left selector</li><li>Change themes in Settings → Appearance</li></ul>
            <div className="rounded-md border border-dashed border-soft bg-surface p-2 text-[11px] text-muted-foreground"><FlaskConical className="mr-1 inline size-3 text-primary" />This is a frontend demonstration. All data is sample data held in your browser; no backend, bank, tax portal or AI model is connected.</div>
          </PopoverContent>
        </Popover>
        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <Button variant="ghost" className="h-9 gap-2 px-1.5" aria-label="Profile menu">
              <Avatar className="size-7"><AvatarFallback className="bg-primary text-[11px] font-semibold text-white">{initials(SIMULATED_USER)}</AvatarFallback></Avatar>
              <span className="hidden text-left lg:block"><span className="block text-[12px] font-medium leading-tight">{SIMULATED_USER}</span><span className="block text-[10px] leading-tight text-muted-foreground">{actingRole?.name}</span></span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <DropdownMenuLabel><span className="block text-sm">{SIMULATED_USER}</span><span className="block text-xs font-normal text-muted-foreground">Simulated session · no sign-in</span></DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="flex items-center gap-1.5 text-xs text-muted-foreground"><UserCog className="size-3.5" /> Act as role (UI simulation)</DropdownMenuLabel>
            <DropdownMenuRadioGroup value={actingRole?.id} onValueChange={(v) => { setRoleId(v); toast.info(`Now acting as ${roles.find((r) => r.id === v)?.name}`, { description: "Navigation and approvals follow this role's permissions — a UI simulation, not security." }); }}>
              {roles.map((r) => <DropdownMenuRadioItem key={r.id} value={r.id}>{r.name}</DropdownMenuRadioItem>)}
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
            <DropdownMenuLabel className="flex items-center gap-1.5 text-xs text-muted-foreground"><Palette className="size-3.5" /> Theme</DropdownMenuLabel>
            <DropdownMenuRadioGroup value={theme} onValueChange={(v) => setTheme(v as typeof theme)}>
              {THEMES.map((t) => <DropdownMenuRadioItem key={t.id} value={t.id}><span className="mr-2 inline-flex overflow-hidden rounded-sm border">{[t.palette.depth, t.palette.primary, t.palette.soft].map((c) => <span key={c} className="size-3" style={{ background: c }} />)}</span>{t.name}</DropdownMenuRadioItem>)}
            </DropdownMenuRadioGroup>
            <DropdownMenuSeparator />
            <DropdownMenuItem onClick={reset}><RotateCcw /> Reset demo data</DropdownMenuItem>
            <Badge variant="outline" className="mx-2 my-1.5 border-dashed text-[10px] font-normal">Frontend demo build</Badge>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
