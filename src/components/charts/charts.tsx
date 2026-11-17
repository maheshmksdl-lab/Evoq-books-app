"use client";

import * as React from "react";
import { Area, Bar, CartesianGrid, Cell, ComposedChart, Legend, Line, Pie, PieChart, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { formatCompact, formatMoney } from "@/lib/formatters";
import { useApp } from "@/providers/app-provider";

export interface ChartSeries { key: string; label: string; type?: "bar" | "line" | "area"; color?: string; stackId?: string; dashed?: boolean }
export const CHART_COLORS = ["var(--t-action)", "var(--t-depth)", "var(--t-soft)", "var(--n-subtle)", "var(--t-primary)", "var(--t-hover)"];

function MoneyTooltip({ active, payload, label, currency }: { active?: boolean; payload?: { name?: string; value?: number; color?: string; dataKey?: string }[]; label?: string; currency: string }) {
  if (!active || !payload?.length) return null;
  return (
    <div className="rounded-md border bg-popover px-2.5 py-2 text-xs shadow-md">
      <div className="mb-1 font-medium">{label}</div>
      {payload.map((p) => (
        <div key={p.dataKey} className="flex items-center justify-between gap-4">
          <span className="flex items-center gap-1.5 text-muted-foreground"><span className="size-2 rounded-sm" style={{ background: p.color }} />{p.name}</span>
          <span className="tnum font-medium">{formatMoney(Number(p.value ?? 0), currency)}</span>
        </div>
      ))}
    </div>
  );
}

/** Bar / line / area composition with themed colours, currency tooltips and optional click drill-down. */
export function TrendChart({ data, series, xKey = "label", height = 240, currency, onPointClick, refY, ariaLabel, percent }: {
  data: Record<string, string | number>[]; series: ChartSeries[]; xKey?: string; height?: number; currency?: string; onPointClick?: (d: Record<string, string | number>) => void; refY?: number; ariaLabel?: string; percent?: boolean;
}) {
  const { currency: base } = useApp(); const cur = currency ?? base;
  return (
    <div role="img" aria-label={ariaLabel ?? "Chart"} style={{ height }} className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <ComposedChart data={data} margin={{ top: 6, right: 8, left: 0, bottom: 0 }} onClick={(e) => { const p = (e as unknown as { activePayload?: { payload: Record<string, string | number> }[] })?.activePayload?.[0]?.payload; if (p && onPointClick) onPointClick(p); }} style={{ cursor: onPointClick ? "pointer" : undefined }}>
          <CartesianGrid vertical={false} stroke="var(--n-border)" />
          <XAxis dataKey={xKey} tickLine={false} axisLine={false} tick={{ fontSize: 11, fill: "var(--n-muted)" }} interval="preserveStartEnd" />
          <YAxis tickLine={false} axisLine={false} width={60} tick={{ fontSize: 11, fill: "var(--n-muted)" }} tickFormatter={(v) => (percent ? `${v}%` : formatCompact(Number(v), cur).replace("₹", "₹"))} />
          <Tooltip content={<MoneyTooltip currency={cur} />} cursor={{ fill: "var(--t-tint)", opacity: 0.5 }} />
          {series.length > 1 && <Legend iconType="circle" iconSize={8} wrapperStyle={{ fontSize: 11 }} />}
          {refY !== undefined && <ReferenceLine y={refY} stroke="var(--s-warning)" strokeDasharray="4 4" />}
          {series.map((s, i) => {
            const color = s.color ?? CHART_COLORS[i % CHART_COLORS.length];
            if (s.type === "line") return <Line key={s.key} isAnimationActive={false} type="monotone" dataKey={s.key} name={s.label} stroke={color} strokeWidth={2} dot={false} strokeDasharray={s.dashed ? "5 4" : undefined} />;
            if (s.type === "area") return <Area key={s.key} isAnimationActive={false} type="monotone" dataKey={s.key} name={s.label} stroke={color} fill={color} fillOpacity={0.14} strokeWidth={2} />;
            return <Bar key={s.key} isAnimationActive={false} dataKey={s.key} name={s.label} fill={color} radius={[3, 3, 0, 0]} stackId={s.stackId} maxBarSize={28} />;
          })}
        </ComposedChart>
      </ResponsiveContainer>
    </div>
  );
}

export function DonutChart({ data, height = 200, currency, onSliceClick }: { data: { name: string; value: number }[]; height?: number; currency?: string; onSliceClick?: (name: string) => void }) {
  const { currency: base } = useApp(); const cur = currency ?? base;
  return (
    <div style={{ height }} role="img" aria-label="Breakdown chart" className="w-full">
      <ResponsiveContainer width="100%" height="100%">
        <PieChart>
          <Pie data={data} isAnimationActive={false} dataKey="value" nameKey="name" innerRadius="58%" outerRadius="88%" paddingAngle={1} stroke="var(--n-white)" onClick={(d) => onSliceClick?.((d as unknown as { name: string }).name)}>
            {data.map((_, i) => <Cell key={i} fill={CHART_COLORS[i % CHART_COLORS.length]} style={{ cursor: onSliceClick ? "pointer" : undefined }} />)}
          </Pie>
          <Tooltip formatter={(v) => formatMoney(Number(v), cur)} />
        </PieChart>
      </ResponsiveContainer>
    </div>
  );
}

export function Sparkline({ values, color = "var(--t-action)", height = 28 }: { values: number[]; color?: string; height?: number }) {
  const data = values.map((v, i) => ({ i, v }));
  return (<div style={{ height }} className="w-full" aria-hidden><ResponsiveContainer width="100%" height="100%"><ComposedChart data={data}><Area dataKey="v" type="monotone" stroke={color} fill={color} fillOpacity={0.15} strokeWidth={1.5} isAnimationActive={false} /></ComposedChart></ResponsiveContainer></div>);
}
