"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { NAV, type NavGroup } from "@/lib/nav";
import { useApp } from "@/providers/app-provider";

export function Logo({ collapsed }: { collapsed?: boolean }) {
  return (
    <Link href="/dashboard" className="flex items-center gap-2.5 rounded-md outline-offset-2" aria-label="EVOQ Books home">
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-action text-white shadow-inner" aria-hidden>
        <svg viewBox="0 0 24 24" className="size-[18px]" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M5 4h9a4 4 0 0 1 0 8H5z" /><path d="M5 12h10a4 4 0 0 1 0 8H5z" /></svg>
      </span>
      {!collapsed && <span className="leading-none"><span className="block text-[15px] font-semibold tracking-wide text-white">EVOQ <span className="font-normal text-soft">Books</span></span><span className="mt-0.5 block text-[10px] uppercase tracking-[0.18em] text-white/50">Accounting</span></span>}
    </Link>
  );
}

export function SidebarNav({ collapsed, onNavigate }: { collapsed?: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  const { can, expanded, toggleGroup } = useApp();
  const visible = NAV.map((g) => ({ ...g, items: g.items?.filter((i) => !i.perm || can(i.perm, "view")) })).filter((g) => (g.items ? g.items.length > 0 : g.id !== "dashboard" || can("dashboard", "view")));
  return (
    <nav aria-label="Main" className="scroll-thin flex-1 space-y-0.5 overflow-y-auto px-2 py-2">
      {visible.map((g) => {
        const showSection = !!g.section;
        return (
          <React.Fragment key={g.id}>
            {showSection && (collapsed ? <div className="mx-2 my-2 border-t border-sidebar-border" /> : <p className="px-2 pb-1 pt-3 text-[10px] font-semibold uppercase tracking-[0.14em] text-white/40">{g.section}</p>)}
            <NavGroupView g={g as NavGroup} pathname={pathname} collapsed={collapsed} open={expanded.includes(g.id)} onToggle={() => toggleGroup(g.id)} onNavigate={onNavigate} />
          </React.Fragment>
        );
      })}
    </nav>
  );
}

function NavGroupView({ g, pathname, collapsed, open, onToggle, onNavigate }: { g: NavGroup; pathname: string; collapsed?: boolean; open: boolean; onToggle: () => void; onNavigate?: () => void }) {
  const Icon = g.icon;
  const active = g.href ? pathname.startsWith(g.href) : !!g.items?.some((i) => pathname === i.href || pathname.startsWith(i.href + "/"));
  const base = "group flex w-full items-center gap-2.5 rounded-md px-2 py-1.5 text-[13px] font-medium outline-offset-2 transition-colors";
  const tone = active ? "bg-sidebar-accent text-white" : "text-sidebar-foreground/80 hover:bg-sidebar-accent/70 hover:text-white";

  if (collapsed) {
    const trigger = (
      <Button variant="ghost" size="icon" aria-label={g.label} className={cn("mx-auto size-9 rounded-md text-sidebar-foreground/80 hover:bg-sidebar-accent hover:text-white", active && "bg-sidebar-primary text-white hover:bg-sidebar-primary")} asChild={!!g.href}>
        {g.href ? <Link href={g.href} onClick={onNavigate}><Icon className="size-[18px]" /></Link> : <span role="button"><Icon className="size-[18px]" /></span>}
      </Button>
    );
    if (g.href) return <Tooltip><TooltipTrigger asChild>{trigger}</TooltipTrigger><TooltipContent side="right">{g.label}</TooltipContent></Tooltip>;
    return (
      <DropdownMenu>
        <Tooltip><TooltipTrigger asChild><DropdownMenuTrigger asChild>{trigger}</DropdownMenuTrigger></TooltipTrigger><TooltipContent side="right">{g.label}</TooltipContent></Tooltip>
        <DropdownMenuContent side="right" align="start" className="min-w-52">
          <DropdownMenuLabel className="text-xs text-muted-foreground">{g.label}</DropdownMenuLabel>
          {g.items!.map((i) => <DropdownMenuItem key={i.href} asChild><Link href={i.href} onClick={onNavigate} className={cn(pathname.startsWith(i.href) && "font-semibold text-primary")}>{i.label}</Link></DropdownMenuItem>)}
        </DropdownMenuContent>
      </DropdownMenu>
    );
  }
  if (g.href) return <Link href={g.href} onClick={onNavigate} aria-current={active ? "page" : undefined} className={cn(base, tone)}><Icon className="size-[18px] shrink-0" /><span className="truncate">{g.label}</span></Link>;
  const isOpen = open || active;
  return (
    <div>
      <button type="button" onClick={onToggle} aria-expanded={isOpen} className={cn(base, tone)}>
        <Icon className="size-[18px] shrink-0" /><span className="flex-1 truncate text-left">{g.label}</span>
        <ChevronDown className={cn("size-3.5 shrink-0 opacity-60 transition-transform", isOpen && "rotate-180")} />
      </button>
      {isOpen && (
        <ul className="ml-[17px] mt-0.5 space-y-px border-l border-sidebar-border pl-2.5">
          {g.items!.map((i) => {
            const a = pathname === i.href || pathname.startsWith(i.href + "/");
            return (
              <li key={i.href}>
                <Link href={i.href} onClick={onNavigate} aria-current={a ? "page" : undefined} className={cn("relative block truncate rounded-md px-2 py-1 text-[12.5px] outline-offset-2 transition-colors", a ? "bg-sidebar-primary/90 font-medium text-white" : "text-sidebar-foreground/70 hover:bg-sidebar-accent/70 hover:text-white")}>
                  {i.label}
                </Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

export function Sidebar() {
  const { collapsed, setCollapsed } = useApp();
  return (
    <aside data-sidebar-root className={cn("no-print hidden shrink-0 flex-col bg-sidebar text-sidebar-foreground transition-[width] duration-200 lg:flex", collapsed ? "w-[60px]" : "w-[248px]")}>
      <div className={cn("flex h-14 items-center border-b border-sidebar-border", collapsed ? "justify-center px-2" : "px-4")}><Logo collapsed={collapsed} /></div>
      <SidebarNav collapsed={collapsed} />
      <div className="border-t border-sidebar-border p-2">
        {!collapsed && <p className="mb-1.5 px-2 text-[10px] leading-snug text-white/45">Frontend demo · sample data stored in your browser. No backend connected.</p>}
        <Button variant="ghost" size={collapsed ? "icon" : "sm"} onClick={() => setCollapsed(!collapsed)} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} className="w-full justify-start text-sidebar-foreground/70 hover:bg-sidebar-accent hover:text-white">
          {collapsed ? <PanelLeftOpen className="mx-auto" /> : <><PanelLeftClose /> Collapse</>}
        </Button>
      </div>
    </aside>
  );
}
