"use client";

import * as React from "react";
import { Controller, useForm, type FieldValues } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import type { ZodType } from "zod";
import { Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { cn } from "@/lib/utils";
import { Combobox, DateField, FieldShell, SelectField, type Opt } from "./form-controls";

export interface FieldDef {
  name: string; label: string; type?: "text" | "email" | "number" | "money" | "date" | "select" | "combobox" | "textarea" | "switch" | "readonly";
  options?: Opt[]; placeholder?: string; hint?: React.ReactNode; span?: 1 | 2; disabled?: boolean; required?: boolean; min?: number; max?: number; step?: number; allowEmpty?: boolean;
  show?: (values: FieldValues) => boolean;
}

interface Props {
  open: boolean; onOpenChange: (o: boolean) => void; title: string; description?: React.ReactNode; schema: ZodType<unknown>;
  fields: FieldDef[]; defaultValues: FieldValues; onSubmit: (values: never) => Promise<unknown> | unknown; submitLabel?: string; size?: "sm" | "md" | "lg";
  notice?: React.ReactNode; footerExtra?: React.ReactNode; secondary?: { label: string; onSubmit: (values: never) => Promise<unknown> | unknown };
}

/** Config-driven form dialog: React Hook Form + Zod. Entered data is preserved on validation or service errors. */
export function FormDialog({ open, onOpenChange, title, description, schema, fields, defaultValues, onSubmit, submitLabel = "Save", size = "md", notice, footerExtra, secondary }: Props) {
  const form = useForm<FieldValues>({ resolver: zodResolver(schema as never) as never, defaultValues, mode: "onTouched" });
  const [serverError, setServerError] = React.useState<string | null>(null);
  const { control, register, handleSubmit, reset, watch, formState: { errors, isSubmitting } } = form;

  React.useEffect(() => { if (open) { reset(defaultValues); setServerError(null); }   }, [open]);
  const values = watch();
  const submit = handleSubmit(async (v) => {
    setServerError(null);
    try { await onSubmit(v as never); onOpenChange(false); } catch (e) { setServerError((e as Error).message); }
  });
  const submitSecondary = handleSubmit(async (v) => { setServerError(null); try { await secondary!.onSubmit(v as never); onOpenChange(false); } catch (e) { setServerError((e as Error).message); } });
  const err = (n: string) => (errors[n]?.message as string | undefined);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className={cn("max-h-[90vh] gap-3 overflow-y-auto", size === "sm" ? "sm:max-w-md" : size === "lg" ? "sm:max-w-3xl" : "sm:max-w-xl")}>
        <DialogHeader><DialogTitle>{title}</DialogTitle>{description && <DialogDescription>{description}</DialogDescription>}</DialogHeader>
        <form onSubmit={submit} noValidate className="space-y-3">
          {notice}
          <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
            {fields.filter((f) => !f.show || f.show(values)).map((f) => (
              <FieldShell key={f.name} label={f.type === "switch" ? undefined : f.label} error={err(f.name)} hint={f.hint} required={f.required} htmlFor={f.name} className={cn(f.span === 2 && "sm:col-span-2", f.type === "textarea" && "sm:col-span-2")}>
                {f.type === "switch" ? (
                  <Controller control={control} name={f.name} render={({ field }) => (<div className="flex items-center justify-between rounded-md border px-3 py-2"><label htmlFor={f.name} className="text-sm">{f.label}{f.hint && <span className="block text-[11px] text-muted-foreground">{f.hint}</span>}</label><Switch id={f.name} checked={!!field.value} onCheckedChange={field.onChange} disabled={f.disabled} /></div>)} />
                ) : f.type === "select" ? (
                  <Controller control={control} name={f.name} render={({ field }) => <SelectField id={f.name} value={field.value} onChange={field.onChange} options={f.options ?? []} placeholder={f.placeholder} disabled={f.disabled} allowEmpty={f.allowEmpty} invalid={!!err(f.name)} />} />
                ) : f.type === "combobox" ? (
                  <Controller control={control} name={f.name} render={({ field }) => <Combobox id={f.name} value={field.value} onChange={field.onChange} options={f.options ?? []} placeholder={f.placeholder} disabled={f.disabled} invalid={!!err(f.name)} />} />
                ) : f.type === "date" ? (
                  <Controller control={control} name={f.name} render={({ field }) => <DateField id={f.name} value={field.value} onChange={field.onChange} disabled={f.disabled} invalid={!!err(f.name)} />} />
                ) : f.type === "textarea" ? (
                  <Textarea id={f.name} rows={3} placeholder={f.placeholder} disabled={f.disabled} aria-invalid={!!err(f.name)} {...register(f.name)} />
                ) : f.type === "readonly" ? (
                  <Input id={f.name} readOnly disabled className="bg-muted/50" {...register(f.name)} />
                ) : (
                  <Input id={f.name} type={f.type === "money" || f.type === "number" ? "number" : f.type ?? "text"} step={f.step ?? (f.type === "money" ? "0.01" : f.type === "number" ? "any" : undefined)} min={f.min} max={f.max} placeholder={f.placeholder} disabled={f.disabled} aria-invalid={!!err(f.name)} className={cn((f.type === "money" || f.type === "number") && "tnum text-right")} {...register(f.name)} />
                )}
              </FieldShell>
            ))}
          </div>
          {serverError && <p role="alert" className="tone-error rounded-md border px-3 py-2 text-xs">{serverError}</p>}
          <DialogFooter className="gap-2 sm:justify-between">
            <div>{footerExtra}</div>
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>Cancel</Button>
              {secondary && <Button type="button" variant="outline" disabled={isSubmitting} onClick={submitSecondary}>{secondary.label}</Button>}
              <Button type="submit" disabled={isSubmitting}>{isSubmitting && <Loader2 className="animate-spin" />}{submitLabel}</Button>
            </div>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
