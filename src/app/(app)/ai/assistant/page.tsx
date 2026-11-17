"use client";

import * as React from "react";
import Link from "next/link";
import { ArrowUp, Bot, Loader2, MessageSquarePlus, Sparkles, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/shared/page-header";
import { DataTable, type Column } from "@/components/shared/data-table";
import { RangeFilter } from "@/components/shared/range-picker";
import { Panel } from "@/components/shared/stat-card";
import { StatCard } from "@/components/shared/stat-card";
import { TrendChart, DonutChart } from "@/components/charts/charts";
import { AiBadge, AiDisclaimer } from "@/components/features/ai-parts";
import { useEntityMutation } from "@/hooks/use-data";
import { useApp, useFormat } from "@/providers/app-provider";
import { services, SUGGESTED_QUESTIONS, type AiAnswer } from "@/services";
import { cn } from "@/lib/utils";
import { addDaysISO, monthEnd } from "@/lib/accounting/fiscal";
import { format, addMonths, parseISO } from "date-fns";

interface Msg { id: number; role: "user" | "assistant"; text: string; answer?: AiAnswer }

function Rich({ text }: { text: string }) {
  const parts = text.split(/(\*\*[^*]+\*\*)/g);
  return <p className="text-[13px] leading-relaxed">{parts.map((p, i) => (p.startsWith("**") ? <strong key={i} className="font-semibold">{p.slice(2, -2)}</strong> : <React.Fragment key={i}>{p}</React.Fragment>))}</p>;
}

function AnswerBlocks({ a, ask }: { a: AiAnswer; ask: (q: string) => void }) {
  const f = useFormat();
  return (
    <div className="mt-2 space-y-2">
      {a.kpis && <div className="grid grid-cols-3 gap-2">{a.kpis.map((k) => <div key={k.label} className="rounded-md border bg-card px-2 py-1.5"><p className="text-[10px] uppercase text-muted-foreground">{k.label}</p><p className={cn("tnum text-sm font-semibold", k.tone === "bad" && "text-error")}>{k.money ? f.money(k.value, undefined, { parens: true }) : k.value}</p></div>)}</div>}
      {a.chart && <div className="rounded-md border bg-card p-2"><TrendChart data={a.chart.data} series={a.chart.series.map((s, i) => ({ key: s.key, label: s.label, type: a.chart!.kind === "line" ? "line" : "bar", color: i === 1 ? "var(--t-depth)" : undefined }))} height={170} percent={false} /></div>}
      {a.table && <div className="overflow-hidden rounded-md border bg-card"><table className="w-full text-xs"><thead className="bg-muted/50 text-[10px] uppercase text-muted-foreground"><tr>{a.table.columns.map((c) => <th key={c.key} className={cn("px-2 py-1", c.align === "right" ? "text-right" : "text-left")}>{c.label}</th>)}</tr></thead><tbody>{a.table.rows.map((r, i) => <tr key={i} className="border-t">{a.table!.columns.map((c) => <td key={c.key} className={cn("px-2 py-1", c.align === "right" && "num")}>{c.money ? f.money(Number(r[c.key]), undefined, { parens: true }) : r[c.key]}</td>)}</tr>)}</tbody></table></div>}
      {a.links && <div className="flex flex-wrap gap-2">{a.links.map((l) => <Link key={l.href} href={l.href} className="rounded-full border px-2.5 py-0.5 text-xs text-primary hover:bg-accent">{l.label} →</Link>)}</div>}
      {a.followUps.length > 0 && <div className="flex flex-wrap gap-1.5 pt-1">{a.followUps.map((q) => <button key={q} onClick={() => ask(q)} className="rounded-full bg-accent px-2.5 py-1 text-[11px] text-accent-foreground hover:bg-soft/50">{q}</button>)}</div>}
    </div>
  );
}

function Chat() {
  const [msgs, setMsgs] = React.useState<Msg[]>([]); const [input, setInput] = React.useState(""); const endRef = React.useRef<HTMLDivElement>(null); const id = React.useRef(0);
  const ask = useEntityMutation((e, q: string) => services.ai.ask(e, q), {});
  const send = async (q: string) => {
    const text = q.trim(); if (!text || ask.isPending) return; setInput("");
    setMsgs((m) => [...m, { id: ++id.current, role: "user", text }]);
    try { const a = await ask.mutateAsync(text); setMsgs((m) => [...m, { id: ++id.current, role: "assistant", text: a.text, answer: a }]); } catch { setMsgs((m) => [...m, { id: ++id.current, role: "assistant", text: "Sorry — the simulated assistant hit an error. Try again." }]); }
  };
  React.useEffect(() => { endRef.current?.scrollIntoView({ behavior: "smooth", block: "end" }); }, [msgs, ask.isPending]);
  return (
    <div className="grid gap-4 lg:grid-cols-[1fr_280px]">
      <div className="flex h-[calc(100dvh-270px)] min-h-[480px] flex-col rounded-lg border bg-card">
        <div className="flex-1 space-y-4 overflow-y-auto p-4" aria-live="polite">
          {msgs.length === 0 && (
            <div className="mx-auto max-w-md py-10 text-center"><div className="mx-auto mb-3 flex size-12 items-center justify-center rounded-full bg-accent text-primary"><Sparkles className="size-6" /></div><p className="font-medium">Ask about your books</p><p className="mt-1 text-xs text-muted-foreground">I can summarise cash, receivables, expenses, profit trends and reconciliation differences using the sample data in this app.</p>
              <div className="mt-4 flex flex-wrap justify-center gap-2">{SUGGESTED_QUESTIONS.slice(0, 4).map((q) => <button key={q} onClick={() => send(q)} className="rounded-full border px-3 py-1 text-xs hover:bg-accent">{q}</button>)}</div></div>)}
          {msgs.map((m) => (
            <div key={m.id} className={cn("flex gap-2", m.role === "user" && "flex-row-reverse")}>
              <div className={cn("flex size-7 shrink-0 items-center justify-center rounded-full text-white", m.role === "user" ? "bg-primary" : "bg-depth")}>{m.role === "user" ? <User className="size-3.5" /> : <Bot className="size-3.5" />}</div>
              <div className={cn("max-w-[86%] rounded-lg px-3 py-2", m.role === "user" ? "bg-primary text-primary-foreground" : "border bg-surface")}>
                {m.role === "assistant" && <div className="mb-1"><AiBadge>Simulated answer</AiBadge></div>}
                {m.role === "user" ? <p className="text-[13px]">{m.text}</p> : <Rich text={m.text} />}
                {m.answer && <AnswerBlocks a={m.answer} ask={send} />}
              </div>
            </div>))}
          {ask.isPending && <div className="flex items-center gap-2 text-xs text-muted-foreground"><Loader2 className="size-3.5 animate-spin" /> Reading the ledger…</div>}
          <div ref={endRef} />
        </div>
        <form className="flex gap-2 border-t p-3" onSubmit={(e) => { e.preventDefault(); send(input); }}>
          <Input value={input} onChange={(e) => setInput(e.target.value)} placeholder="Ask a question, e.g. “Which customers have overdue balances?”" aria-label="Ask the assistant" disabled={ask.isPending} />
          <Button type="submit" size="icon" disabled={!input.trim() || ask.isPending} aria-label="Send"><ArrowUp /></Button>
        </form>
      </div>
      <div className="space-y-3">
        <Panel title="Try asking" noPad><ul className="divide-y">{SUGGESTED_QUESTIONS.map((q) => <li key={q}><button onClick={() => send(q)} disabled={ask.isPending} className="w-full px-3 py-2 text-left text-xs hover:bg-surface disabled:opacity-50">{q}</button></li>)}</ul></Panel>
        {msgs.length > 0 && <Button variant="outline" size="sm" className="w-full" onClick={() => setMsgs([])}><MessageSquarePlus /> New conversation</Button>}
      </div>
    </div>
  );
}

function Analysis() {
  const f = useFormat(); const { today, entity } = useApp(); const fyS = entity?.fyStartMonth === 4 ? "2026-04-01" : `${today.slice(0, 4)}-01-01`;
  const lastStart = format(addMonths(parseISO(`${today.slice(0, 7)}-01`), -1), "yyyy-MM-dd");
  const [cur, setCur] = React.useState({ from: lastStart, to: monthEnd(lastStart) }); const [prev, setPrev] = React.useState({ from: format(addMonths(parseISO(lastStart), -1), "yyyy-MM-dd"), to: monthEnd(format(addMonths(parseISO(lastStart), -1), "yyyy-MM-dd")) });
  const run = useEntityMutation((e, i: { from: string; to: string; compareFrom: string; compareTo: string }) => services.ai.analyze(e, i), { success: "Analysis ready" });
  const d = run.data; type R = NonNullable<typeof d>["rows"][number];
  const cols: Column<R>[] = [{ id: "l", header: "Line", accessor: (r) => r.label, cell: (r) => <span className={["Gross profit", "Net profit"].includes(r.label) ? "font-semibold" : ""}>{r.label}</span> }, { id: "c", header: "Current", align: "right", accessor: (r) => r.current, cell: (r) => f.money(r.current, undefined, { parens: true }) }, { id: "p", header: "Comparison", align: "right", accessor: (r) => r.previous, cell: (r) => f.money(r.previous, undefined, { parens: true }) }, { id: "d", header: "Change", align: "right", accessor: (r) => r.change, cell: (r) => <span className={r.good ? "text-[color-mix(in_srgb,var(--s-success)_55%,black)]" : "text-error"}>{f.money(r.change, undefined, { parens: true })}</span> }, { id: "pc", header: "%", align: "right", accessor: (r) => r.pct, cell: (r) => `${r.pct > 0 ? "+" : ""}${r.pct.toFixed(1)}%` }];
  return (
    <div className="space-y-4">
      <Panel title="Financial question answering" description="Compare periods, investigate profitability and explore expense categories">
        <div className="flex flex-wrap items-end gap-4"><div><p className="mb-1 text-[11px] font-medium text-muted-foreground">Analyse</p><RangeFilter from={cur.from} to={cur.to} onChange={setCur} fyStartMonth={entity?.fyStartMonth} /></div><div><p className="mb-1 text-[11px] font-medium text-muted-foreground">Compare with</p><RangeFilter from={prev.from} to={prev.to} onChange={setPrev} fyStartMonth={entity?.fyStartMonth} /></div><Button onClick={() => run.mutate({ ...cur, compareFrom: prev.from, compareTo: prev.to })} disabled={run.isPending}>{run.isPending ? <Loader2 className="animate-spin" /> : <Sparkles />} Generate analysis</Button>
          <Button variant="outline" onClick={() => { setCur({ from: fyS, to: today }); setPrev({ from: addDaysISO(fyS, -365), to: addDaysISO(today, -365) }); }}>FY to date vs last year</Button></div>
      </Panel>
      {d && (<>
        <div className="grid gap-3 md:grid-cols-3">{d.insights.map((t, i) => <div key={i} className="rounded-lg border bg-surface p-3 text-[13px]"><AiBadge>Insight {i + 1}</AiBadge><p className="mt-1.5 leading-relaxed">{t}</p></div>)}</div>
        <div className="grid gap-4 lg:grid-cols-[1.4fr_1fr]"><DataTable columns={cols} data={d.rows} rowKey={(r) => r.label} hideSearch bare exportName="financial-analysis" /><Panel title="What drove costs?" noPad><ul className="divide-y">{d.drivers.map((x) => <li key={x.label} className="flex justify-between px-3 py-1.5 text-[13px]"><span>{x.label}</span><span className={cn("tnum", x.delta > 0 ? "text-error" : "text-[color-mix(in_srgb,var(--s-success)_55%,black)]")}>{x.delta > 0 ? "+" : "−"}{f.money(Math.abs(x.delta))}</span></li>)}</ul></Panel></div>
        <Panel title="Expense categories in the analysed period" description="Click a slice name to open the expense report"><div className="grid items-center gap-4 md:grid-cols-[220px_1fr]"><DonutChart data={d.expenseCategories.map((c) => ({ name: c.name, value: c.amount }))} height={190} /><ul className="grid gap-1 sm:grid-cols-2">{d.expenseCategories.map((c) => <li key={c.name} className="flex justify-between rounded border px-2 py-1 text-[13px]"><span>{c.name}</span><span className="tnum">{f.money(c.amount)}</span></li>)}</ul></div></Panel></>)}
      {!d && <StatCard label="No analysis yet" value="—" hint="Choose two periods and generate an analysis." />}
    </div>
  );
}

export default function AssistantPage() {
  return (
    <>
      <PageHeader title="AI Accounting Assistant" description="Ask questions about your books and compare financial periods." />
      <AiDisclaimer />
      <Tabs defaultValue="chat"><TabsList><TabsTrigger value="chat">Assistant</TabsTrigger><TabsTrigger value="analysis">Financial analysis</TabsTrigger></TabsList><TabsContent value="chat" className="mt-3"><Chat /></TabsContent><TabsContent value="analysis" className="mt-3"><Analysis /></TabsContent></Tabs>
    </>
  );
}
