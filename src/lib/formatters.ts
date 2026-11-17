import { format, parseISO, isValid } from "date-fns";
import type { Currency } from "@/types";

export const CURRENCIES: Currency[] = [
  { code: "INR", name: "Indian Rupee", symbol: "₹", locale: "en-IN", decimals: 2 },
  { code: "USD", name: "US Dollar", symbol: "$", locale: "en-US", decimals: 2 },
  { code: "EUR", name: "Euro", symbol: "€", locale: "en-IE", decimals: 2 },
  { code: "GBP", name: "Pound Sterling", symbol: "£", locale: "en-GB", decimals: 2 },
  { code: "AED", name: "UAE Dirham", symbol: "AED", locale: "en-AE", decimals: 2 },
  { code: "SGD", name: "Singapore Dollar", symbol: "S$", locale: "en-SG", decimals: 2 },
  { code: "JPY", name: "Japanese Yen", symbol: "¥", locale: "ja-JP", decimals: 0 },
];

const cache = new Map<string, Intl.NumberFormat>();
function nf(currency: string, opts: { compact?: boolean; decimals?: number } = {}) {
  const c = CURRENCIES.find((x) => x.code === currency) ?? CURRENCIES[0];
  const key = `${c.code}|${opts.compact}|${opts.decimals}`;
  let f = cache.get(key);
  if (!f) {
    f = new Intl.NumberFormat(c.locale, {
      style: "currency",
      currency: c.code,
      currencyDisplay: "narrowSymbol",
      notation: opts.compact ? "compact" : "standard",
      minimumFractionDigits: opts.compact ? 0 : (opts.decimals ?? c.decimals),
      maximumFractionDigits: opts.compact ? 1 : (opts.decimals ?? c.decimals),
    });
    cache.set(key, f);
  }
  return f;
}

/** Single rounding rule used across the app: 2 decimals, half away from zero. */
export function round2(n: number): number {
  const s = n < 0 ? -1 : 1;
  return (s * Math.round((Math.abs(n) + Number.EPSILON) * 100)) / 100;
}

export function formatMoney(value: number, currency = "INR", opts: { compact?: boolean; decimals?: number; parens?: boolean } = {}): string {
  if (!Number.isFinite(value)) return "—";
  if (opts.parens && value < 0) return `(${nf(currency, opts).format(Math.abs(value))})`;
  return nf(currency, opts).format(value);
}

/** Compact: lakhs / crores for INR, Intl compact otherwise. */
export function formatCompact(value: number, currency = "INR"): string {
  if (currency !== "INR") return formatMoney(value, currency, { compact: true });
  const a = Math.abs(value), s = value < 0 ? "-" : "";
  const t = (n: number, d = 2) => String(parseFloat(n.toFixed(d)));
  if (a >= 1e7) return `${s}₹${t(a / 1e7)}Cr`;
  if (a >= 1e5) return `${s}₹${t(a / 1e5)}L`;
  if (a >= 1e3) return `${s}₹${t(a / 1e3, 1)}K`;
  return `${s}₹${a.toFixed(0)}`;
}

export function formatNumber(value: number, decimals = 0, locale = "en-IN") {
  return new Intl.NumberFormat(locale, { minimumFractionDigits: decimals, maximumFractionDigits: decimals }).format(value);
}
export function formatPercent(value: number, decimals = 1) {
  if (!Number.isFinite(value)) return "—";
  return `${value.toFixed(decimals)}%`;
}

export function toDate(d: string | Date): Date {
  return typeof d === "string" ? parseISO(d) : d;
}
export function formatDate(d?: string | Date | null, pattern = "dd MMM yyyy"): string {
  if (!d) return "—";
  const dt = toDate(d);
  return isValid(dt) ? format(dt, pattern) : "—";
}
export function formatDateTime(d?: string | Date | null) {
  return formatDate(d, "dd MMM yyyy, HH:mm");
}
export function iso(d: Date): string {
  return format(d, "yyyy-MM-dd");
}
export function formatBytes(n: number) {
  if (n < 1024) return `${n} B`;
  if (n < 1048576) return `${(n / 1024).toFixed(1)} KB`;
  return `${(n / 1048576).toFixed(1)} MB`;
}
export function initials(name: string) {
  return name.split(/\s+/).filter(Boolean).slice(0, 2).map((p) => p[0]!.toUpperCase()).join("");
}
export function titleCase(s: string) {
  return s.replace(/_/g, " ").replace(/\b\w/g, (m) => m.toUpperCase());
}
