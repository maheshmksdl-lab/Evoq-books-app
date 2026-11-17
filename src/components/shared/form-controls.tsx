"use client";

import * as React from "react";
import { format, parseISO, isValid } from "date-fns";
import { CalendarIcon, Check, ChevronsUpDown, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Calendar } from "@/components/ui/calendar";
import { Command, CommandEmpty, CommandGroup, CommandInput, CommandItem, CommandList } from "@/components/ui/command";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";

export interface Opt { value: string; label: string; hint?: string; group?: string }

export function FieldShell({ label, error, hint, required, children, className, htmlFor }: { label?: React.ReactNode; error?: string; hint?: React.ReactNode; required?: boolean; children: React.ReactNode; className?: string; htmlFor?: string }) {
  return (
    <div className={cn("space-y-1", className)}>
      {label && <Label htmlFor={htmlFor} className="text-xs font-medium text-foreground/80">{label}{required && <span className="text-destructive"> *</span>}</Label>}
      {children}
      {error ? <p role="alert" className="text-xs text-destructive">{error}</p> : hint ? <p className="text-[11px] text-muted-foreground">{hint}</p> : null}
    </div>
  );
}

export function DateField({ value, onChange, min, max, disabled, placeholder = "Pick a date", className, id, invalid }: { value?: string; onChange: (v: string) => void; min?: string; max?: string; disabled?: boolean; placeholder?: string; className?: string; id?: string; invalid?: boolean }) {
  const [open, setOpen] = React.useState(false);
  const d = value && isValid(parseISO(value)) ? parseISO(value) : undefined;
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button id={id} type="button" variant="outline" disabled={disabled} aria-invalid={invalid} className={cn("w-full justify-start gap-2 px-2.5 font-normal", !d && "text-muted-foreground", className)}>
          <CalendarIcon className="size-3.5 opacity-60" />{d ? format(d, "dd MMM yyyy") : placeholder}
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-auto p-0" align="start">
        <Calendar mode="single" selected={d} defaultMonth={d} captionLayout="dropdown" startMonth={new Date(2024, 0)} endMonth={new Date(2028, 11)} disabled={(day) => (!!min && format(day, "yyyy-MM-dd") < min) || (!!max && format(day, "yyyy-MM-dd") > max)}
          onSelect={(x) => { if (x) { onChange(format(x, "yyyy-MM-dd")); setOpen(false); } }} />
      </PopoverContent>
    </Popover>
  );
}

export function SelectField({ value, onChange, options, placeholder = "Select…", disabled, className, id, size, allowEmpty, invalid }: { value?: string; onChange: (v: string) => void; options: Opt[]; placeholder?: string; disabled?: boolean; className?: string; id?: string; size?: "sm" | "default"; allowEmpty?: boolean; invalid?: boolean }) {
  return (
    <Select value={value || undefined} onValueChange={(v) => onChange(v === "__none" ? "" : v)} disabled={disabled}>
      <SelectTrigger id={id} size={size} aria-invalid={invalid} className={cn("w-full", className)}><SelectValue placeholder={placeholder} /></SelectTrigger>
      <SelectContent>
        {allowEmpty && <SelectItem value="__none">— None —</SelectItem>}
        {options.map((o) => <SelectItem key={o.value} value={o.value}>{o.label}</SelectItem>)}
      </SelectContent>
    </Select>
  );
}

/** Searchable select (accounts, vendors, customers…). */
export function Combobox({ value, onChange, options, placeholder = "Select…", searchPlaceholder = "Search…", emptyText = "No match", disabled, className, id, invalid }: { value?: string; onChange: (v: string) => void; options: Opt[]; placeholder?: string; searchPlaceholder?: string; emptyText?: string; disabled?: boolean; className?: string; id?: string; invalid?: boolean }) {
  const [open, setOpen] = React.useState(false);
  const sel = options.find((o) => o.value === value);
  const groups = React.useMemo(() => { const g = new Map<string, Opt[]>(); options.forEach((o) => { const k = o.group ?? ""; g.set(k, [...(g.get(k) ?? []), o]); }); return [...g.entries()]; }, [options]);
  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <Button id={id} type="button" variant="outline" role="combobox" aria-expanded={open} aria-invalid={invalid} disabled={disabled} className={cn("w-full justify-between gap-2 px-2.5 font-normal", !sel && "text-muted-foreground", className)}>
          <span className="truncate">{sel?.label ?? placeholder}</span><ChevronsUpDown className="size-3.5 shrink-0 opacity-50" />
        </Button>
      </PopoverTrigger>
      <PopoverContent className="w-[--radix-popover-trigger-width] min-w-64 p-0" align="start">
        <Command>
          <CommandInput placeholder={searchPlaceholder} />
          <CommandList>
            <CommandEmpty>{emptyText}</CommandEmpty>
            {groups.map(([g, opts]) => (
              <CommandGroup key={g} heading={g || undefined}>
                {opts.map((o) => (
                  <CommandItem key={o.value} value={`${o.label} ${o.hint ?? ""}`} onSelect={() => { onChange(o.value); setOpen(false); }}>
                    <Check className={cn("size-3.5", value === o.value ? "opacity-100" : "opacity-0")} />
                    <span className="truncate">{o.label}</span>{o.hint && <span className="ml-auto text-[11px] text-muted-foreground">{o.hint}</span>}
                  </CommandItem>
                ))}
              </CommandGroup>
            ))}
          </CommandList>
        </Command>
      </PopoverContent>
    </Popover>
  );
}

/** Browser-side file picker. Files are read locally and never uploaded anywhere. */
export function FilePicker({ onFiles, accept, multiple, label = "Choose file", description, disabled }: { onFiles: (files: File[]) => void; accept?: string; multiple?: boolean; label?: string; description?: React.ReactNode; disabled?: boolean }) {
  const ref = React.useRef<HTMLInputElement>(null);
  const [over, setOver] = React.useState(false);
  return (
    <div
      onDragOver={(e) => { e.preventDefault(); setOver(true); }} onDragLeave={() => setOver(false)}
      onDrop={(e) => { e.preventDefault(); setOver(false); if (!disabled) onFiles([...e.dataTransfer.files]); }}
      className={cn("flex flex-col items-center gap-2 rounded-lg border border-dashed px-4 py-6 text-center transition-colors", over ? "border-action bg-accent" : "bg-surface/60")}
    >
      <Upload className="size-5 text-primary" />
      <div className="text-xs text-muted-foreground">{description ?? "Drag & drop here, or"}</div>
      <Button type="button" size="sm" variant="outline" disabled={disabled} onClick={() => ref.current?.click()}>{label}</Button>
      <input ref={ref} type="file" hidden accept={accept} multiple={multiple} onChange={(e) => { const f = [...(e.target.files ?? [])]; if (f.length) onFiles(f); e.target.value = ""; }} />
    </div>
  );
}
