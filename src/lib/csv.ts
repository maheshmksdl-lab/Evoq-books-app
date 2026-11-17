/** Minimal CSV parser for bank-statement imports (handles quotes, dd/mm/yyyy and yyyy-mm-dd dates). */
export function parseCsv(text: string): string[][] {
  const rows: string[][] = []; let row: string[] = [], cur = "", q = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (q) { if (c === '"' && text[i + 1] === '"') { cur += '"'; i++; } else if (c === '"') q = false; else cur += c; }
    else if (c === '"') q = true; else if (c === ",") { row.push(cur); cur = ""; }
    else if (c === "\n" || c === "\r") { if (c === "\r" && text[i + 1] === "\n") i++; row.push(cur); cur = ""; if (row.some((x) => x.trim())) rows.push(row); row = []; }
    else cur += c;
  }
  row.push(cur); if (row.some((x) => x.trim())) rows.push(row);
  return rows;
}
const num = (s: string | undefined) => { const n = parseFloat((s ?? "").replace(/[^\d.\-]/g, "")); return Number.isFinite(n) ? Math.abs(n) : 0; };
function toIso(s: string): string | null {
  const t = s.trim(); let m = t.match(/^(\d{4})-(\d{2})-(\d{2})/); if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = t.match(/^(\d{1,2})[/\-.](\d{1,2})[/\-.](\d{4})$/); if (m) return `${m[3]}-${m[2].padStart(2, "0")}-${m[1].padStart(2, "0")}`; return null;
}
export function parseStatement(text: string) {
  const rows = parseCsv(text); if (rows.length < 2) return [];
  const head = rows[0].map((h) => h.trim().toLowerCase());
  const idx = (re: RegExp) => head.findIndex((h) => re.test(h));
  const di = idx(/date/), ni = idx(/narr|desc|particular|detail/), wi = idx(/withdraw|debit|dr\b/), ci = idx(/deposit|credit|cr\b/);
  if (di < 0 || ni < 0 || (wi < 0 && ci < 0)) return [];
  return rows.slice(1).map((r) => ({ date: toIso(r[di] ?? ""), description: (r[ni] ?? "").trim(), withdrawal: wi >= 0 ? num(r[wi]) : 0, deposit: ci >= 0 ? num(r[ci]) : 0 }))
    .filter((r): r is { date: string; description: string; withdrawal: number; deposit: number } => !!r.date && !!r.description && (r.withdrawal > 0 || r.deposit > 0));
}
