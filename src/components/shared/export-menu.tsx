"use client";

import * as React from "react";
import { Download, FileSpreadsheet, FileText, Printer } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuLabel, DropdownMenuSeparator, DropdownMenuTrigger } from "@/components/ui/dropdown-menu";

export function downloadText(filename: string, content: string, mime = "text/csv;charset=utf-8") {
  const blob = new Blob(["﻿" + content], { type: mime });
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a"); a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
export function toCsv(rows: (string | number | null | undefined)[][]) {
  return rows.map((r) => r.map((c) => { const s = c === null || c === undefined ? "" : String(c); return /[",\n]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s; }).join(",")).join("\n");
}

/** Export actions. CSV downloads a real file generated in the browser; Excel/PDF are frontend simulations. */
export function ExportMenu({ filename, getRows, label = "Export", size = "sm", disabled }: { filename: string; getRows: () => (string | number | null | undefined)[][]; label?: string; size?: "sm" | "default"; disabled?: boolean }) {
  const csv = () => { downloadText(`${filename}.csv`, toCsv(getRows())); toast.success(`Exported ${filename}.csv`); };
  const excel = () => { downloadText(`${filename}.xls`, toCsv(getRows()), "application/vnd.ms-excel"); toast.success("Excel export simulated", { description: "Downloaded as a CSV-compatible .xls file — real .xlsx generation needs a backend or library." }); };
  const pdf = () => { toast.info("PDF export simulated", { description: "Opening the print dialog — choose “Save as PDF”." }); setTimeout(() => window.print(), 250); };
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild><Button variant="outline" size={size} disabled={disabled}><Download /> {label}</Button></DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-52">
        <DropdownMenuLabel className="text-xs text-muted-foreground">Export current view</DropdownMenuLabel>
        <DropdownMenuItem onClick={csv}><FileText /> CSV (downloads)</DropdownMenuItem>
        <DropdownMenuItem onClick={excel}><FileSpreadsheet /> Excel (simulated)</DropdownMenuItem>
        <DropdownMenuItem onClick={pdf}><Printer /> PDF (print simulation)</DropdownMenuItem>
        <DropdownMenuSeparator />
        <p className="px-2 py-1 text-[11px] text-muted-foreground">Generated in your browser. Nothing is uploaded.</p>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
