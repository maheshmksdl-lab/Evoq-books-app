"use client";

import * as React from "react";
import { useQuery } from "@tanstack/react-query";
import type { Entity, PermissionAction, PermissionGroup, Role } from "@/types";
import { services } from "@/services";
import { TODAY, PRIMARY_ENTITY_ID } from "@/lib/constants";
import { rangeFromPreset } from "@/lib/accounting/fiscal";
import { formatCompact, formatMoney } from "@/lib/formatters";

const KEY = "evoq-books:ui:v1";
interface Persisted { entityId: string; preset: string; from?: string; to?: string; collapsed: boolean; roleId: string; dismissed: string[]; expanded: string[] }
const DEFAULTS: Persisted = { entityId: PRIMARY_ENTITY_ID, preset: "this_fy", collapsed: false, roleId: "role-finance", dismissed: [], expanded: [] };

interface AppCtx extends Persisted {
  ready: boolean;
  entity: Entity | undefined;
  entities: Entity[];
  currency: string;
  today: string;
  range: { from: string; to: string };
  roles: Role[];
  actingRole: Role | undefined;
  setEntityId: (id: string) => void;
  setPreset: (preset: string, from?: string, to?: string) => void;
  setCollapsed: (v: boolean) => void;
  setRoleId: (id: string) => void;
  dismiss: (id: string) => void;
  toggleGroup: (id: string) => void;
  can: (group: PermissionGroup, action?: PermissionAction) => boolean;
  mobileNav: boolean;
  setMobileNav: (v: boolean) => void;
}
const Ctx = React.createContext<AppCtx | null>(null);

export function AppProvider({ children }: { children: React.ReactNode }) {
  const [state, setState] = React.useState<Persisted>(DEFAULTS);
  const [ready, setReady] = React.useState(false);
  const [mobileNav, setMobileNav] = React.useState(false);

  React.useEffect(() => {
    try { const raw = localStorage.getItem(KEY); if (raw) setState({ ...DEFAULTS, ...JSON.parse(raw) }); } catch { /* ignore */ }
    setReady(true);
  }, []);
  React.useEffect(() => { if (ready) try { localStorage.setItem(KEY, JSON.stringify(state)); } catch { /* ignore */ } }, [state, ready]);

  const entitiesQ = useQuery({ queryKey: ["entities"], queryFn: () => services.entities.list(), staleTime: Infinity });
  const rolesQ = useQuery({ queryKey: ["roles"], queryFn: () => services.org.roles() });
  const entities = entitiesQ.data ?? [];
  const entity = entities.find((e) => e.id === state.entityId) ?? entities[0];
  const range = React.useMemo(() => (state.preset === "custom" && state.from && state.to ? { from: state.from, to: state.to } : rangeFromPreset(state.preset, TODAY, entity?.fyStartMonth ?? 4)), [state.preset, state.from, state.to, entity?.fyStartMonth]);
  const roles = rolesQ.data ?? [];
  const actingRole = roles.find((r) => r.id === state.roleId);

  const value = React.useMemo<AppCtx>(() => ({
    ...state, ready: ready && !!entity && roles.length > 0, entity, entities, currency: entity?.baseCurrency ?? "INR", today: TODAY, range, roles, actingRole, mobileNav, setMobileNav,
    setEntityId: (id) => setState((s) => ({ ...s, entityId: id })),
    setPreset: (preset, from, to) => setState((s) => ({ ...s, preset, from, to })),
    setCollapsed: (v) => setState((s) => ({ ...s, collapsed: v })),
    setRoleId: (id) => setState((s) => ({ ...s, roleId: id })),
    dismiss: (id) => setState((s) => ({ ...s, dismissed: [...new Set([...s.dismissed, id])] })),
    toggleGroup: (id) => setState((s) => ({ ...s, expanded: s.expanded.includes(id) ? s.expanded.filter((x) => x !== id) : [...s.expanded, id] })),
    can: (g, a = "view") => (roles.length === 0 ? true : !!actingRole?.permissions[g]?.includes(a)),
  }), [state, ready, entity, entities, range, roles, actingRole, mobileNav]);

  return <Ctx.Provider value={value}>{children}</Ctx.Provider>;
}

export function useApp() {
  const c = React.useContext(Ctx);
  if (!c) throw new Error("useApp must be used inside <AppProvider>");
  return c;
}

/** Currency-aware formatting bound to the active entity's base currency. */
export function useFormat() {
  const { currency } = useApp();
  return React.useMemo(() => ({
    currency,
    money: (v: number, cur?: string, opts?: { parens?: boolean; decimals?: number }) => formatMoney(v, cur ?? currency, opts),
    compact: (v: number, cur?: string) => formatCompact(v, cur ?? currency),
  }), [currency]);
}
