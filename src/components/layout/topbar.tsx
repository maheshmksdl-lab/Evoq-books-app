"use client";

import * as React from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { Bell, Building2, Check, ChevronsUpDown, CircleHelp, FlaskConical, LogOut, Menu, Palette, RotateCcw, UserCog, X } from "lucide-react";
import { useQueryClient } from "@tanstack/react-query";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuRadioGroup, DropdownMenuRadioItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Sheet, SheetContent, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { THEMES } from "@/lib/themes/themes";
import { formatDate } from "@/lib/formatters";
import { resetDemoData } from "@/lib/mock/db";
import { useNotifications } from "@/hooks/use-data";
import { useApp } from "@/providers/app-provider";
import { useAuth } from "@/providers/auth-provider";
import { useTheme } from "@/providers/theme-provider";
import { useConfirm } from "@/components/shared/confirm";
import { PeriodPicker } from "@/components/shared/range-picker";
import { UserAvatar } from "@/components/shared/user-avatar";
import { GlobalSearch } from "./global-search";
import { Logo, SidebarNav } from "./sidebar";

function Notifications() {
  const { data = [] } = useNotifications(); const { dismissed, dismiss } = useApp();
  const items = data.filter((n) => !dismissed.includes(n.id));
  const color = { info: "tone-info", warning: "tone-warning", error: "tone-error", success: "tone-success" } as const;
  return (
    <Popover>
      <PopoverTrigger asChild><Button variant="ghost" size="icon" aria-label={`Notifications (${items.length})`} className="relative"><Bell />{items.length > 0 && <span className="absolute right-1 top-1 flex size-4 items-center justify-center rounded-full bg-primary text-[9px] font-semibold text-white">{items.length}</span>}</Button></PopoverTrigger>
      <PopoverContent align="end" className="w-[min(340px,calc(100vw-24px))] p-0">
        <div className="flex items-center justify-between border-b px-3 py-2"><span className="text-sm font-semibold">Notifications</span>{items.length > 0 && <Button variant="ghost" size="xs" onClick={() => items.forEach((n) => dismiss(n.id))}>Dismiss all</Button>}</div>
        <div className="max-h-80 overflow-y-auto">
          {items.length === 0 ? <p className="px-3 py-8 text-center text-xs text-muted-foreground">You&apos;re all caught up.</p> : items.map((n) => (
            <div key={n.id} className="flex gap-2 border-b px-3 py-2 last:border-0">
              <span className={`${color[n.level]} mt-1 size-2 shrink-0 rounded-full border`} />
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
  const router = useRouter();
  const { entity, entities, setEntityId, roles, actingRole, setRoleId, mobileNav, setMobileNav } = useApp();
  const { session, signOut } = useAuth();
  const { theme, setTheme } = useTheme(); const qc = useQueryClient(); const confirm = useConfirm();
  const userName = session?.name ?? "Meera Iyer";

  const reset = async () => {
    if (!(await confirm({ title: "Reset demo data?", description: "This clears every record you created or changed in this browser and restores the original sample dataset. Theme and layout preferences are kept.", confirmLabel: "Reset data", destructive: true }))) return;
    resetDemoData(); qc.clear(); toast.success("Demo data restored"); setTimeout(() => window.location.reload(), 300);
  };
  const logout = () => { signOut(); qc.clear(); router.replace("/login"); };

  return (
    <header data-topbar className="no-print relative z-30 flex h-16 shrink-0 items-center gap-3 border-b bg-card px-3 sm:px-4 lg:px-6">
      <Button variant="ghost" size="icon" className="md:hidden" aria-label="Open navigation" onClick={() => setMobileNav(true)}><Menu /></Button>
      <Sheet open={mobileNav} onOpenChange={setMobileNav}>
        <SheetContent side="left" className="w-[290px] max-w-[85vw] gap-0 border-r border-sb-border bg-sb-bg p-0 text-sb-fg">
          <SheetHeader className="h-16 justify-center border-b border-sb-border px-4"><SheetTitle className="sr-only">Navigation</SheetTitle><Logo /></SheetHeader>
          <SidebarNav onNavigate={() => setMobileNav(false)} />
        </SheetContent>
      </Sheet>

      <DropdownMenu>
        <DropdownMenuTrigger asChild>
          <Button variant="outline" className="h-10 max-w-[230px] shrink-0 gap-2 px-2.5" aria-label="Switch company">
            <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-accent text-primary"><Building2 className="size-3.5" /></span>
            <span className="hidden min-w-0 text-left lg:block"><span className="block truncate text-[13px] font-medium leading-tight">{entity?.name ?? "Loading…"}</span><span className="block text-[10px] leading-tight text-muted-foreground">{entity?.baseCurrency} · {entity?.country}</span></span>
            <ChevronsUpDown className="hidden size-3.5 opacity-50 lg:block" />
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

      <GlobalSearch />

      <div className="ml-auto flex shrink-0 items-center gap-1">
        <div className="mr-1 hidden 2xl:block"><PeriodPicker compact /></div>
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
            <Button variant="ghost" className="h-10 gap-2 px-1.5" aria-label="Profile menu">
              <UserAvatar name={userName} size={32} />
              <span className="hidden text-left xl:block"><span className="block text-[13px] font-medium leading-tight">{userName}</span><span className="block text-[11px] leading-tight text-muted-foreground">{actingRole?.name}</span></span>
            </Button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" className="w-64">
            <div className="flex items-center gap-3 px-2 py-2"><UserAvatar name={userName} size={40} /><div className="min-w-0"><p className="truncate text-sm font-medium">{userName}</p><p className="truncate text-xs text-muted-foreground">{session?.email ?? "Simulated session"}</p></div></div>
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
            <DropdownMenuItem onClick={logout}><LogOut /> Sign out</DropdownMenuItem>
            <Badge variant="outline" className="mx-2 my-1.5 border-dashed text-[10px] font-normal">Demo sign-in · not secure</Badge>
          </DropdownMenuContent>
        </DropdownMenu>
      </div>
    </header>
  );
}
