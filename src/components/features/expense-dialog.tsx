"use client";

import * as React from "react";
import { FormDialog, type FieldDef } from "@/components/shared/form-dialog";
import { SimNotice } from "@/components/shared/states";
import { useEntityMutation, useExpenseCategories } from "@/hooks/use-data";
import { useBankOptions, useContactOptions, useDimensionOptions } from "@/hooks/use-options";
import { useApp } from "@/providers/app-provider";
import { services, type ExpenseInput } from "@/services";
import { expenseSchema } from "@/lib/validators";
import { GST_RATES, PAYMENT_METHODS } from "@/lib/constants";
import type { Expense } from "@/types";

/** Create / edit an expense. “Save draft” keeps it editable; “Submit” applies the approval rules and posts if allowed. */
export function ExpenseDialog({ open, onOpenChange, expense }: { open: boolean; onOpenChange: (o: boolean) => void; expense?: Expense | null }) {
  const { today, entity } = useApp(); const india = entity?.taxRegime === "india-gst";
  const cats = useExpenseCategories().data ?? []; const vendors = useContactOptions("vendor"); const banks = useBankOptions(); const depts = useDimensionOptions("department");
  const modeRef = React.useRef<"draft" | "submit">("submit");
  const save = useEntityMutation((e, i: ExpenseInput) => services.expenses.save(e, i), { success: (x) => (x.status === "draft" ? `Draft ${x.number} saved` : x.status === "pending_approval" ? `${x.number} submitted for approval` : `${x.number} approved & posted`) });
  const fields: FieldDef[] = [
    { name: "date", label: "Expense date", type: "date", required: true }, { name: "categoryId", label: "Category", type: "select", options: cats.filter((c) => c.active).map((c) => ({ value: c.id, label: c.name })), required: true },
    { name: "description", label: "Description", required: true, span: 2 }, { name: "vendorId", label: "Vendor (optional)", type: "combobox", options: vendors },
    { name: "amount", label: "Amount", type: "money", required: true, hint: "Enter the amount shown on the receipt" },
    { name: "taxTreatment", label: "Tax treatment", type: "select", options: [{ value: "inclusive", label: "Tax-inclusive (amount includes GST)" }, { value: "exclusive", label: "Tax-exclusive (GST added on top)" }, { value: "none", label: "No tax / exempt" }] },
    { name: "gstRate", label: "GST rate %", type: "select", options: (india ? GST_RATES : [0, 9]).map((r) => ({ value: String(r), label: `${r}%` })), show: (v) => v.taxTreatment !== "none" },
    { name: "paymentAccountId", label: "Payment account", type: "select", options: banks, required: true }, { name: "paymentMethod", label: "Payment method", type: "select", options: PAYMENT_METHODS.map((m) => ({ value: m.value, label: m.label })) },
    { name: "departmentId", label: "Department", type: "select", options: depts, allowEmpty: true },
    { name: "recurring", label: "Recurring expense", type: "switch", span: 2, hint: "Creates a template you can run each period" }, { name: "frequency", label: "Frequency", type: "select", options: [{ value: "monthly", label: "Monthly" }, { value: "quarterly", label: "Quarterly" }, { value: "yearly", label: "Yearly" }], show: (v) => !!v.recurring },
  ];
  const e = expense;
  const defaults = { date: e?.date ?? today, categoryId: e?.categoryId ?? "", vendorId: e?.vendorId ?? "", description: e?.description ?? "", amount: e ? (e.taxTreatment === "exclusive" ? e.amount - e.taxAmount : e.amount) : "", taxTreatment: e?.taxTreatment ?? "inclusive", gstRate: String(e?.gstRate ?? (india ? 18 : 9)), paymentAccountId: e?.paymentAccountId ?? "", paymentMethod: e?.paymentMethod ?? "upi", departmentId: e?.departmentId ?? "", recurring: !!e?.recurring, frequency: e?.recurring?.frequency ?? "monthly" };
  const toInput = (v: never): ExpenseInput => { const x = v as Record<string, unknown>; return { id: expense?.id, date: x.date as string, categoryId: x.categoryId as string, vendorId: (x.vendorId as string) || undefined, description: x.description as string, amount: Number(x.amount), taxTreatment: x.taxTreatment as ExpenseInput["taxTreatment"], gstRate: Number(x.gstRate), paymentAccountId: x.paymentAccountId as string, paymentMethod: x.paymentMethod as ExpenseInput["paymentMethod"], departmentId: (x.departmentId as string) || undefined, recurring: x.recurring ? { frequency: x.frequency as "monthly", nextDate: x.date as string } : null, mode: modeRef.current }; };
  return (
    <FormDialog open={open} onOpenChange={onOpenChange} size="lg" title={expense ? `Edit ${expense.number}` : "New expense"} description="Receipts can be attached on the expense detail page." submitLabel="Submit expense" schema={expenseSchema} fields={fields} defaultValues={defaults}
      notice={<SimNotice>Submitting applies your approval rules. Approved expenses post to the ledger (Dr expense + input GST, Cr payment account).</SimNotice>}
      secondary={{ label: "Save draft", onSubmit: async (v: never) => { modeRef.current = "draft"; await save.mutateAsync(toInput(v)); } }}
      onSubmit={async (v: never) => { modeRef.current = "submit"; await save.mutateAsync(toInput(v)); }} />
  );
}
