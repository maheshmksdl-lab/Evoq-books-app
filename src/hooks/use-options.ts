"use client";

import * as React from "react";
import type { AccountType, ContactKind } from "@/types";
import type { Opt } from "@/components/shared/form-controls";
import { useAccounts, useBankAccounts, useContacts, useDimensions } from "./use-data";

export function useAccountOptions(types?: AccountType[], opts: { includeInactive?: boolean } = {}): Opt[] {
  const { data } = useAccounts();
  return React.useMemo(() => (data ?? []).filter((a) => !a.isGroup && (opts.includeInactive || a.active) && (!types || types.includes(a.type))).map((a) => ({ value: a.id, label: `${a.code} · ${a.name}`, group: a.group })), [data, types, opts.includeInactive]);
}
export function useGroupOptions(types?: AccountType[]): Opt[] {
  const { data } = useAccounts();
  return React.useMemo(() => (data ?? []).filter((a) => a.isGroup && a.active && (!types || types.includes(a.type))).map((a) => ({ value: a.id, label: `${a.code} · ${a.name}`, hint: a.type })), [data, types]);
}
export function useContactOptions(kind?: ContactKind): Opt[] {
  const { data } = useContacts(kind);
  return React.useMemo(() => (data ?? []).filter((c) => c.status === "active").map((c) => ({ value: c.id, label: c.name, hint: c.city })), [data]);
}
export function useBankOptions(types?: ("bank" | "cash" | "credit_card")[]): Opt[] {
  const { data } = useBankAccounts();
  return React.useMemo(() => (data ?? []).filter((b) => !types || types.includes(b.type)).map((b) => ({ value: b.id, label: b.name, hint: b.accountNo })), [data, types]);
}
export function useDimensionOptions(kind: "department" | "costCenter" | "project"): Opt[] {
  const { data } = useDimensions(kind);
  return React.useMemo(() => (data ?? []).filter((d) => d.status !== "inactive").map((d) => ({ value: d.id, label: `${d.code} · ${d.name}` })), [data]);
}
