"use client";

import * as React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { ChevronDown, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";
import { cn } from "@/lib/utils";
import { NAV, type NavGroup } from "@/lib/nav";
import { useApp } from "@/providers/app-provider";
import { useMediaQuery } from "@/hooks/use-media-query";

/** Brand mark + wordmark. Colours come from --sb-logo tokens so it reads on both light and dark chrome. */
export function Logo({ collapsed, tone = "sidebar" }: { collapsed?: boolean; tone?: "sidebar" | "page" }) {
  return (
    <Link href="/dashboard" className="flex items-center gap-2.5 rounded-md outline-offset-2" aria-label="EVOQ Books home">
      <span className="flex size-9 shrink-0 items-center justify-center rounded-[10px] bg-primary shadow-sm" aria-hidden>
        <svg viewBox="0 0 64 64" className="size-[26px]" aria-hidden><rect x="16.5" y="11.5" width="31" height="41" rx="6.5" fill="#fff" /><rect x="21.5" y="16.5" width="21" height="10" rx="2.8" fill="var(--t-primary)" /><rect x="35" y="19.7" width="5.5" height="3.6" rx="1.2" fill="#fff" /><g fill="var(--t-primary)" opacity=".9"><rect x="21.5" y="31" width="5.5" height="5" rx="1.6" /><rect x="29.2" y="31" width="5.5" height="5" rx="1.6" /><rect x="36.9" y="31" width="5.5" height="5" rx="1.6" /><rect x="21.5" y="38.5" width="5.5" height="5" rx="1.6" /><rect x="29.2" y="38.5" width="5.5" height="5" rx="1.6" /><rect x="21.5" y="46" width="5.5" height="3.8" rx="1.6" /><rect x="29.2" y="46" width="5.5" height="3.8" rx="1.6" /></g><rect x="36.9" y="38.5" width="5.5" height="11.3" rx="1.6" fill="var(--t-action)" /></svg>
      </span>
      {!collapsed && (
        <span className="leading-none">
          <span className="block text-[20px] font-bold tracking-tight" style={{ color: tone === "page" ? "var(--n-text)" : "var(--sb-logo)" }}>Books</span>
        </span>
      )}
    </Link>
  );
}

const rowBase = "group relative flex w-full items-center gap-2.5 rounded-lg text-[13px] outline-offset-2 transition-colors focus-visible:outline-2 focus-visible:outline-ring";
const activeRow = "bg-sb-active font-medium text-sb-active-fg before:absolute before:inset-y-2 before:left-0 before:w-[3px] before:rounded-r-full before:bg-sb-bar";
const idleRow = "text-sb-fg hover:bg-sb-hover hover:text-sb-active-fg";

export function SidebarNav({ collapsed, onNavigate }: { collapsed?: boolean; onNavigate?: () => void }) {
  const pathname = usePathname();
  const { can, expanded, toggleGroup } = useApp();
  const visible = NAV.map((g) => ({ ...g, items: g.items?.filter((i) => !i.perm || can(i.perm, "view")) })).filter((g) => (g.items ? g.items.length > 0 : g.id !== "dashboard" || can("dashboard", "view")));
  return (
    <nav aria-label="Main" className={cn("scroll-thin flex-1 space-y-0.5 overflow-y-auto py-2", collapsed ? "px-2" : "px-3")}>
      {visible.map((g) => (
        <React.Fragment key={g.id}>
          {g.section && (collapsed ? <div className="mx-2 my-2 border-t border-sb-border" /> : <p className="px-2.5 pb-1 pt-4 text-[10.5px] font-semibold uppercase tracking-[0.12em] text-sb-label first:pt-1">{g.section}</p>)}
          <NavGroupView g={g as NavGroup} pathname={pathname} collapsed={collapsed} open={expanded.includes(g.id)} onToggle={() => toggleGroup(g.id)} onNavigate={onNavigate} />
        </React.Fragment>
      ))}
    </nav>
  );
}

function NavGroupView({ g, pathname, collapsed, open, onToggle, onNavigate }: { g: NavGroup; pathname: string; collapsed?: boolean; open: boolean; onToggle: () => void; onNavigate?: () => void }) {
  const Icon = g.icon;
  const active = g.href ? pathname.startsWith(g.href) : !!g.items?.some((i) => pathname === i.href || pathname.startsWith(i.href + "/"));
  const icon = <Icon className={cn("size-[18px] shrink-0 transition-colors", active ? "text-sb-active-icon" : "text-sb-muted group-hover:text-sb-active-icon")} strokeWidth={active ? 2.1 : 1.8} />;

  if (collapsed) {
    const cls = cn(rowBase, "mx-auto size-9 justify-center", active ? activeRow : idleRow);
    const trigger = g.href
      ? <Link href={g.href} onClick={onNavigate} aria-label={g.label} aria-current={active ? "page" : undefined} className={cls}>{icon}</Link>
      : <button type="button" aria-label={g.label} className={cls}>{icon}</button>;
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

  if (g.href) {
    return <Link href={g.href} onClick={onNavigate} aria-current={active ? "page" : undefined} className={cn(rowBase, "h-9 px-2.5", active ? activeRow : idleRow)}>{icon}<span className="truncate">{g.label}</span></Link>;
  }
  const isOpen = open || active;
  return (
    <div>
      <button type="button" onClick={onToggle} aria-expanded={isOpen} className={cn(rowBase, "h-9 px-2.5", active ? "font-semibold text-sb-active-fg" : idleRow)}>
        {icon}<span className="flex-1 truncate text-left">{g.label}</span>
        <ChevronDown className={cn("size-3.5 shrink-0 text-sb-muted transition-transform", isOpen && "rotate-180")} />
      </button>
      {isOpen && (
        <ul className="ml-[18px] mt-0.5 space-y-px border-l border-sb-border pl-2">
          {g.items!.map((i) => {
            const a = pathname === i.href || pathname.startsWith(i.href + "/");
            return (
              <li key={i.href}>
                <Link href={i.href} onClick={onNavigate} aria-current={a ? "page" : undefined} className={cn(rowBase, "h-8 px-2.5 text-[12.5px]", a ? activeRow : "text-sb-muted hover:bg-sb-hover hover:text-sb-active-fg")}><span className="truncate">{i.label}</span></Link>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

/** Desktop (≥1024px): expandable rail. Tablet (768–1023px): icon rail. Phone: drawer from the top bar. */
export function Sidebar() {
  const { collapsed, setCollapsed } = useApp();
  const tablet = useMediaQuery("(min-width: 768px) and (max-width: 1023px)");
  const rail = collapsed || tablet;
  return (
    <aside data-sidebar-root className={cn("no-print hidden shrink-0 flex-col border-r border-sb-border bg-sb-bg transition-[width] duration-200 md:flex", rail ? "w-[64px]" : "w-[256px]")}>
      <div className={cn("flex h-16 items-center border-b border-sb-border", rail ? "justify-center px-2" : "px-4")}><Logo collapsed={rail} /></div>
      <SidebarNav collapsed={rail} />
      <div className="border-t border-sb-border p-2.5">
        {!rail && <p className="mb-2 px-1.5 text-[10.5px] leading-snug text-sb-label">Frontend demo · sample data stored in your browser. No backend connected.</p>}
        {!tablet && (
          <button type="button" onClick={() => setCollapsed(!collapsed)} aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"} className={cn(rowBase, idleRow, "h-9 px-2.5 text-sb-muted", rail && "mx-auto size-9 justify-center px-0")}>
            {collapsed ? <PanelLeftOpen className="size-[18px]" /> : <><PanelLeftClose className="size-[18px]" /> Collapse</>}
          </button>
        )}
      </div>
    </aside>
  );
}
