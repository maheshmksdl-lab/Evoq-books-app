"use client";

import * as React from "react";
import { ArrowDown, ArrowUp, ChevronLeft, ChevronRight, ChevronsUpDown, MoreHorizontal, Search } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableFooter, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { cn } from "@/lib/utils";
import { EmptyState, ErrorState, TableSkeleton } from "./states";
import { ExportMenu } from "./export-menu";

export interface Column<T> {
  id: string;
  header: React.ReactNode;
  /** Plain value used for sorting, searching and CSV export. */
  accessor?: (row: T) => string | number | null | undefined;
  cell?: (row: T) => React.ReactNode;
  align?: "left" | "right" | "center";
  sortable?: boolean;
  className?: string;
  footer?: React.ReactNode;
  hideBelow?: "sm" | "md" | "lg";
}
export interface RowAction<T> { label: string; icon?: React.ComponentType<{ className?: string }>; onClick: (row: T) => void; hidden?: (row: T) => boolean; disabled?: (row: T) => boolean; destructive?: boolean; separatorBefore?: boolean }

interface Props<T> {
  columns: Column<T>[];
  data: T[] | undefined;
  rowKey: (row: T) => string;
  isLoading?: boolean;
  error?: Error | null;
  onRetry?: () => void;
  searchPlaceholder?: string;
  hideSearch?: boolean;
  filters?: React.ReactNode;
  toolbar?: React.ReactNode;
  pageSize?: number;
  rowActions?: RowAction<T>[] | ((row: T) => RowAction<T>[]);
  onRowClick?: (row: T) => void;
  selectedKey?: string | null;
  exportName?: string;
  emptyTitle?: string;
  emptyDescription?: React.ReactNode;
  emptyAction?: React.ReactNode;
  selection?: string[];
  onSelectionChange?: (keys: string[]) => void;
  isSelectable?: (row: T) => boolean;
  defaultSort?: { id: string; dir: "asc" | "desc" };
  rowClassName?: (row: T) => string | undefined;
  footerSummary?: boolean;
  bare?: boolean;
  caption?: string;
}

const cmp = (a: unknown, b: unknown) => {
  if (a == null && b == null) return 0; if (a == null) return 1; if (b == null) return -1;
  if (typeof a === "number" && typeof b === "number") return a - b;
  return String(a).localeCompare(String(b), undefined, { numeric: true, sensitivity: "base" });
};
const HIDE: Record<string, string> = { sm: "hidden sm:table-cell", md: "hidden md:table-cell", lg: "hidden lg:table-cell" };

export function DataTable<T>({ columns, data, rowKey, isLoading, error, onRetry, searchPlaceholder = "Search…", hideSearch, filters, toolbar, pageSize = 15, rowActions, onRowClick, selectedKey, exportName, emptyTitle = "No records found", emptyDescription = "Try adjusting your search or filters.", emptyAction, selection, onSelectionChange, isSelectable, defaultSort, rowClassName, bare, caption }: Props<T>) {
  const [q, setQ] = React.useState("");
  const [sort, setSort] = React.useState<{ id: string; dir: "asc" | "desc" } | null>(defaultSort ?? null);
  const [page, setPage] = React.useState(0);
  const [size, setSize] = React.useState(pageSize);

  const rows = React.useMemo(() => {
    let r = data ?? [];
    const needle = q.trim().toLowerCase();
    if (needle) r = r.filter((row) => columns.some((c) => { const v = c.accessor?.(row); return v != null && String(v).toLowerCase().includes(needle); }));
    if (sort) { const col = columns.find((c) => c.id === sort.id); if (col?.accessor) r = [...r].sort((a, b) => cmp(col.accessor!(a), col.accessor!(b)) * (sort.dir === "asc" ? 1 : -1)); }
    return r;
  }, [data, q, sort, columns]);

  React.useEffect(() => { setPage(0); }, [q, sort, data?.length, size]);
  const pages = Math.max(1, Math.ceil(rows.length / size));
  const pageRows = rows.slice(page * size, page * size + size);
  const selectable = !!onSelectionChange;
  const selSet = new Set(selection ?? []);
  const selectableRows = pageRows.filter((r) => !isSelectable || isSelectable(r));
  const allSel = selectableRows.length > 0 && selectableRows.every((r) => selSet.has(rowKey(r)));
  const hasFooter = columns.some((c) => c.footer !== undefined);

  const toggleSort = (id: string) => setSort((s) => (s?.id !== id ? { id, dir: "asc" } : s.dir === "asc" ? { id, dir: "desc" } : null));
  const exportRows = () => [columns.map((c) => (typeof c.header === "string" ? c.header : c.id)), ...rows.map((r) => columns.map((c) => c.accessor?.(r) ?? ""))];

  const actionsFor = (row: T) => (typeof rowActions === "function" ? rowActions(row) : rowActions ?? []).filter((a) => !a.hidden?.(row));

  return (
    <div className={cn("overflow-hidden", !bare && "rounded-xl border bg-card shadow-[0_1px_2px_rgb(16_24_40/0.04)]")}>
      {(!hideSearch || filters || toolbar || exportName) && (
        <div className="no-print flex flex-wrap items-center gap-2 border-b p-2">
          {!hideSearch && (
            <div className="relative w-full min-w-40 sm:w-64">
              <Search className="pointer-events-none absolute left-2 top-1/2 size-3.5 -translate-y-1/2 text-muted-foreground" />
              <Input value={q} onChange={(e) => setQ(e.target.value)} placeholder={searchPlaceholder} className="h-8 pl-7" aria-label="Search table" />
            </div>
          )}
          {filters}
          <div className="ml-auto flex items-center gap-2">
            {toolbar}
            {exportName && <ExportMenu filename={exportName} getRows={exportRows} disabled={!rows.length} />}
          </div>
        </div>
      )}
      {error ? <ErrorState error={error} onRetry={onRetry} /> : isLoading ? <TableSkeleton cols={Math.min(columns.length, 6)} /> : (
        <div className="scroll-thin overflow-x-auto">
          <Table>
            {caption && <caption className="sr-only">{caption}</caption>}
            <TableHeader className="bg-muted/50">
              <TableRow className="hover:bg-transparent">
                {selectable && <TableHead className="w-8"><Checkbox aria-label="Select all rows" checked={allSel} onCheckedChange={(v) => { const keys = new Set(selSet); selectableRows.forEach((r) => (v ? keys.add(rowKey(r)) : keys.delete(rowKey(r)))); onSelectionChange!([...keys]); }} /></TableHead>}
                {columns.map((c) => {
                  const active = sort?.id === c.id; const sortable = c.sortable !== false && !!c.accessor;
                  return (
                    <TableHead key={c.id} className={cn("h-9 whitespace-nowrap text-[11px] font-semibold uppercase tracking-wide text-muted-foreground", c.align === "right" && "text-right", c.align === "center" && "text-center", c.hideBelow && HIDE[c.hideBelow], c.className)} aria-sort={active ? (sort!.dir === "asc" ? "ascending" : "descending") : undefined}>
                      {sortable ? (
                        <button type="button" onClick={() => toggleSort(c.id)} className={cn("inline-flex items-center gap-1 uppercase hover:text-foreground focus-visible:outline-2 focus-visible:outline-ring", c.align === "right" && "flex-row-reverse")}>
                          {c.header}{active ? (sort!.dir === "asc" ? <ArrowUp className="size-3" /> : <ArrowDown className="size-3" />) : <ChevronsUpDown className="size-3 opacity-40" />}
                        </button>
                      ) : c.header}
                    </TableHead>
                  );
                })}
                {rowActions && <TableHead className="w-9"><span className="sr-only">Actions</span></TableHead>}
              </TableRow>
            </TableHeader>
            <TableBody>
              {pageRows.map((row) => {
                const key = rowKey(row); const acts = rowActions ? actionsFor(row) : [];
                return (
                  <TableRow key={key} data-state={selectedKey === key || selSet.has(key) ? "selected" : undefined} onClick={onRowClick ? () => onRowClick(row) : undefined}
                    onKeyDown={onRowClick ? (e) => { if (e.key === "Enter" && e.target === e.currentTarget) onRowClick(row); } : undefined} tabIndex={onRowClick ? 0 : undefined}
                    className={cn("h-9", onRowClick && "cursor-pointer", (selectedKey === key || selSet.has(key)) && "bg-accent/70", rowClassName?.(row))}>
                    {selectable && <TableCell onClick={(e) => e.stopPropagation()}><Checkbox aria-label="Select row" disabled={isSelectable ? !isSelectable(row) : false} checked={selSet.has(key)} onCheckedChange={(v) => { const keys = new Set(selSet); v ? keys.add(key) : keys.delete(key); onSelectionChange!([...keys]); }} /></TableCell>}
                    {columns.map((c) => (
                      <TableCell key={c.id} className={cn("py-1.5 text-[13px]", c.align === "right" && "num", c.align === "center" && "text-center", c.hideBelow && HIDE[c.hideBelow], c.className)}>
                        {c.cell ? c.cell(row) : (c.accessor?.(row) ?? "—")}
                      </TableCell>
                    ))}
                    {rowActions && (
                      <TableCell className="py-1" onClick={(e) => e.stopPropagation()}>
                        {acts.length > 0 && (
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild><Button variant="ghost" size="icon-sm" aria-label="Row actions"><MoreHorizontal /></Button></DropdownMenuTrigger>
                            <DropdownMenuContent align="end" className="min-w-44">
                              {acts.map((a, i) => (
                                <React.Fragment key={i}>
                                  {a.separatorBefore && <DropdownMenuSeparator />}
                                  <DropdownMenuItem disabled={a.disabled?.(row)} variant={a.destructive ? "destructive" : "default"} onClick={() => a.onClick(row)}>{a.icon && <a.icon className="size-4" />}{a.label}</DropdownMenuItem>
                                </React.Fragment>
                              ))}
                            </DropdownMenuContent>
                          </DropdownMenu>
                        )}
                      </TableCell>
                    )}
                  </TableRow>
                );
              })}
            </TableBody>
            {hasFooter && rows.length > 0 && (
              <TableFooter className="bg-muted/40">
                <TableRow>
                  {selectable && <TableCell />}
                  {columns.map((c) => <TableCell key={c.id} className={cn("py-2 text-[13px] font-semibold", c.align === "right" && "num", c.hideBelow && HIDE[c.hideBelow])}>{c.footer}</TableCell>)}
                  {rowActions && <TableCell />}
                </TableRow>
              </TableFooter>
            )}
          </Table>
          {rows.length === 0 && <EmptyState title={emptyTitle} description={q ? "No rows match your search." : emptyDescription} action={emptyAction} />}
        </div>
      )}
      {!error && !isLoading && rows.length > 0 && (
        <div className="no-print flex flex-wrap items-center justify-between gap-2 border-t px-3 py-1.5 text-xs text-muted-foreground">
          <span>{page * size + 1}–{Math.min(rows.length, page * size + size)} of {rows.length}{q && data && rows.length !== data.length ? ` (filtered from ${data.length})` : ""}{selectable && selSet.size ? ` · ${selSet.size} selected` : ""}</span>
          <div className="flex items-center gap-2">
            <span className="hidden sm:inline">Rows</span>
            <Select value={String(size)} onValueChange={(v) => setSize(Number(v))}><SelectTrigger size="sm" className="w-16" aria-label="Rows per page"><SelectValue /></SelectTrigger><SelectContent>{[10, 15, 25, 50, 100].map((n) => <SelectItem key={n} value={String(n)}>{n}</SelectItem>)}</SelectContent></Select>
            <Button variant="outline" size="icon-sm" disabled={page === 0} onClick={() => setPage((p) => p - 1)} aria-label="Previous page"><ChevronLeft /></Button>
            <span className="tnum min-w-12 text-center">{page + 1} / {pages}</span>
            <Button variant="outline" size="icon-sm" disabled={page >= pages - 1} onClick={() => setPage((p) => p + 1)} aria-label="Next page"><ChevronRight /></Button>
          </div>
        </div>
      )}
    </div>
  );
}
