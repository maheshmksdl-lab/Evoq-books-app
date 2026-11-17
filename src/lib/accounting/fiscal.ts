import { addDays, addMonths, endOfMonth, format, parseISO, startOfMonth, subDays } from "date-fns";
import type { ISODate } from "@/types";

export interface FiscalYearInfo { label: string; short: string; start: ISODate; end: ISODate; startYear: number }

const f = (d: Date) => format(d, "yyyy-MM-dd");

/** Fiscal year that contains `date` for a company whose FY starts in `fyStartMonth` (1-12). */
export function fiscalYearOf(date: ISODate, fyStartMonth: number): FiscalYearInfo {
  const d = parseISO(date);
  const y = d.getMonth() + 1 >= fyStartMonth ? d.getFullYear() : d.getFullYear() - 1;
  return fiscalYearByStartYear(y, fyStartMonth);
}

export function fiscalYearByStartYear(y: number, fyStartMonth: number): FiscalYearInfo {
  const start = new Date(y, fyStartMonth - 1, 1);
  const end = subDays(addMonths(start, 12), 1);
  const calendar = fyStartMonth === 1;
  return {
    label: calendar ? `FY ${y}` : `FY ${y}-${String((y + 1) % 100).padStart(2, "0")}`,
    short: calendar ? String(y % 100) : `${String(y % 100).padStart(2, "0")}${String((y + 1) % 100).padStart(2, "0")}`,
    start: f(start),
    end: f(end),
    startYear: y,
  };
}

export function monthKey(date: ISODate) { return date.slice(0, 7); }
export function monthStart(date: ISODate) { return f(startOfMonth(parseISO(date))); }
export function monthEnd(date: ISODate) { return f(endOfMonth(parseISO(date))); }
export function addDaysISO(date: ISODate, n: number) { return f(addDays(parseISO(date), n)); }
export function addMonthsISO(date: ISODate, n: number) { return f(addMonths(parseISO(date), n)); }
export function daysBetween(a: ISODate, b: ISODate) {
  return Math.round((parseISO(b).getTime() - parseISO(a).getTime()) / 86400000);
}

/** The 12 month keys (yyyy-MM) of a fiscal year, in fiscal order. */
export function fiscalMonths(fy: FiscalYearInfo): string[] {
  const out: string[] = [];
  let d = parseISO(fy.start);
  for (let i = 0; i < 12; i++) { out.push(format(d, "yyyy-MM")); d = addMonths(d, 1); }
  return out;
}

export function monthLabel(key: string, pattern = "MMM yy") {
  return format(parseISO(`${key}-01`), pattern);
}

export interface RangePreset { id: string; label: string }
export const RANGE_PRESETS: RangePreset[] = [
  { id: "this_month", label: "This month" },
  { id: "last_month", label: "Last month" },
  { id: "this_quarter", label: "This quarter" },
  { id: "this_fy", label: "This financial year" },
  { id: "last_fy", label: "Last financial year" },
  { id: "last_12m", label: "Last 12 months" },
  { id: "custom", label: "Custom range" },
];

export function rangeFromPreset(preset: string, today: ISODate, fyStartMonth: number): { from: ISODate; to: ISODate } {
  const t = parseISO(today);
  switch (preset) {
    case "this_month": return { from: f(startOfMonth(t)), to: today };
    case "last_month": { const lm = addMonths(t, -1); return { from: f(startOfMonth(lm)), to: f(endOfMonth(lm)) }; }
    case "this_quarter": {
      const fy = fiscalYearOf(today, fyStartMonth);
      const mIdx = Math.floor(((t.getMonth() + 1 - fyStartMonth + 12) % 12) / 3);
      const qs = addMonths(parseISO(fy.start), mIdx * 3);
      return { from: f(qs), to: today };
    }
    case "last_fy": { const fy = fiscalYearByStartYear(fiscalYearOf(today, fyStartMonth).startYear - 1, fyStartMonth); return { from: fy.start, to: fy.end }; }
    case "last_12m": return { from: f(addDays(addMonths(t, -12), 1)), to: today };
    case "this_fy":
    default: { const fy = fiscalYearOf(today, fyStartMonth); return { from: fy.start, to: today }; }
  }
}
