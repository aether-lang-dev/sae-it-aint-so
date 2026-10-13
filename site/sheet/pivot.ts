// Pivot tables, as the Tauri spreadsheet's CREATEPIVOT makes them: the
// rows of a source range (its first row their fields' names) grouped by
// some fields down the side and others across the top, one field's numbers
// aggregated where they meet. No sheet, no ui: a grid of values in, the
// pivot's cells out (commands.ts writes them, and writes them again on
// pivot.update).
import { CellError } from "./values.ts";
import type { Value } from "./values.ts";

export const AGGREGATES = ["SUM", "COUNT", "AVERAGE", "MIN", "MAX"] as const;
export type Aggregate = (typeof AGGREGATES)[number];

export interface PivotFields {
  readonly rows: readonly string[];       // grouped down the side
  readonly cols: readonly string[];       // grouped across the top
  readonly value: string;                 // aggregated
  readonly agg: Aggregate;
  readonly filters: Readonly<Record<string, string>>;   // a field's value a row must have
}

const text = (v: Value) => (v === null ? "" : v instanceof CellError ? v.code : String(v));

// A field's column in the source, by its name in the first row; a
// RangeError naming the fields there are.
function fieldIndex(headers: readonly string[], field: string): number {
  const i = headers.indexOf(field);
  if (i < 0) throw new RangeError(`no field ${field} (${headers.join(", ")})`);
  return i;
}

function aggregate(agg: Aggregate, ns: readonly number[]): number {
  if (!ns.length) return 0;
  switch (agg) {
    case "SUM": return ns.reduce((a, b) => a + b, 0);
    case "COUNT": return ns.length;
    case "AVERAGE": return ns.reduce((a, b) => a + b, 0) / ns.length;
    case "MIN": return Math.min(...ns);
    case "MAX": return Math.max(...ns);
  }
}

// The pivot as rows of inputs: a header row (the row fields' names, then
// each column group, or "SUM of amount" when there are no column fields),
// then a row per row group (its values, then each aggregate; 0 where no row
// met). Groups in the order they first appear, as the app's.
export function pivoted(grid: readonly (readonly Value[])[], f: PivotFields): string[][] {
  const headers = (grid[0] ?? []).map((v, i) => text(v) || `Column${i + 1}`);
  const rowAt = f.rows.map((r) => fieldIndex(headers, r)), colAt = f.cols.map((c) => fieldIndex(headers, c)), valueAt = fieldIndex(headers, f.value);
  const filters = Object.entries(f.filters).map(([field, want]) => [fieldIndex(headers, field), want] as const);
  const rowKeys = new Map<string, string[]>(), colKeys = new Map<string, string[]>(), cells = new Map<string, number[]>();
  for (const row of grid.slice(1)) {
    if (filters.some(([i, want]) => text(row[i] ?? null) !== want)) continue;
    const rv = rowAt.map((i) => text(row[i] ?? null)), cv = colAt.map((i) => text(row[i] ?? null));
    const rk = JSON.stringify(rv), ck = JSON.stringify(cv);
    if (!rowKeys.has(rk)) rowKeys.set(rk, rv);
    if (!colKeys.has(ck)) colKeys.set(ck, cv);
    const n = parseFloat(text(row[valueAt] ?? null)), at = `${rk}\u0000${ck}`;
    if (!cells.has(at)) cells.set(at, []);
    if (!Number.isNaN(n)) cells.get(at)!.push(n);
  }
  const top = f.cols.length ? [...colKeys.values()].map((cv) => cv.join(" / ") || "(blank)") : [`${f.agg} of ${f.value}`];
  const out: string[][] = [[...f.rows, ...top]];
  for (const [rk, rv] of rowKeys) {
    const at = (ck: string) => cells.get(`${rk}\u0000${ck}`);
    out.push([...rv, ...[...colKeys.keys()].map((ck) => String(at(ck) ? aggregate(f.agg, at(ck)!) : 0))]);
  }
  return out;
}
