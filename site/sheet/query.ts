// The Tauri spreadsheet's queries (its RangeQuery, in public/lib/
// spreadsheet-functions.js) with no sheet and no language: a table's rows,
// perhaps under a row of headers, filtered, grouped, plucked and
// aggregated. rexx.ts gives RexxJS formulas RANGE, TABLE, WHERE, PLUCK,
// GROUP_BY, SUM, AVG, COUNT and RESULT over these; WHERE's condition is
// whatever the caller works out for a row (RexxJS there), never eval.
import { colName } from "./address.ts";
import { CellError } from "./values.ts";
import type { Value } from "./values.ts";

export interface Query {
  readonly kind: "query";
  readonly headers: readonly string[] | null;
  readonly rows: readonly (readonly Value[])[];
  readonly firstCol: number;       // the sheet column of the first column, for letters
  readonly groups: readonly (readonly [string, readonly (readonly Value[])[]])[] | null;
}

const isText = (v: Value) => typeof v === "string" && v !== "";

// A grid as a query. `headers` undefined: found as the app finds them (a
// first row all text, numbers below it); null: none; else these names.
export function queryOf(grid: readonly (readonly Value[])[], firstCol: number, headers?: readonly string[] | null): Query {
  let rows = grid, names: readonly string[] | null = headers ?? null;
  if (headers === undefined && grid.length > 1 && grid[0].every(isText) && grid.slice(1).some((r) => r.some((v) => typeof v === "number"))) {
    names = grid[0].map(String);
    rows = grid.slice(1);
  }
  return { kind: "query", headers: names, rows, firstCol, groups: null };
}

// A column by its header (any case), its sheet letter, or its index.
export function columnIndex(q: Query, ref: string | number): number {
  if (typeof ref === "number") return ref;
  const r = String(ref).trim();
  const byName = q.headers?.findIndex((h) => h.toLowerCase() === r.toLowerCase()) ?? -1;
  if (byName >= 0) return byName;
  const width = q.rows[0]?.length ?? q.headers?.length ?? 0;
  for (let i = 0; i < width; i++) if (colName(q.firstCol + i) === r.toUpperCase()) return i;
  throw new Error(`no column ${r}`);
}

// A row's value by a name as a condition says it: a header, or column_C,
// col_C (a letter or a header); undefined for anything else.
export function cellOf(q: Query, row: readonly Value[]): (name: string) => Value | undefined {
  return (name) => {
    const m = /^col(?:umn)?_(\w+)$/i.exec(name);
    try {
      if (m) return row[columnIndex(q, m[1])] ?? null;
      const i = q.headers?.findIndex((h) => h.toLowerCase() === name.toLowerCase()) ?? -1;
      return i >= 0 ? row[i] ?? null : undefined;
    } catch {
      return undefined;
    }
  };
}

// The rows a test keeps; it is given each row's values by name.
export async function where(q: Query, keep: (col: (name: string) => Value | undefined, row: readonly Value[]) => Promise<boolean>): Promise<Query> {
  const rows: (readonly Value[])[] = [];
  for (const row of q.rows) if (await keep(cellOf(q, row), row)) rows.push(row);
  return { ...q, rows, groups: null };
}

export const pluck = (q: Query, ref: string | number): Value[][] => {
  const i = columnIndex(q, ref);
  return q.rows.map((r) => [r[i] ?? null]);
};

const keyText = (v: Value) => (v === null ? "" : v instanceof CellError ? v.code : String(v));

// Groups by a column's value, in the order they first appear.
export function groupBy(q: Query, ref: string | number): Query {
  const i = columnIndex(q, ref), groups = new Map<string, (readonly Value[])[]>();
  for (const row of q.rows) {
    const k = keyText(row[i] ?? null);
    if (!groups.has(k)) groups.set(k, []);
    groups.get(k)!.push(row);
  }
  return { ...q, groups: [...groups] };
}

const numbersIn = (rows: readonly (readonly Value[])[], i: number) =>
  rows.map((r) => (typeof r[i] === "number" ? (r[i] as number) : parseFloat(String(r[i])))).filter((n) => !Number.isNaN(n));

function over(kind: "sum" | "avg" | "count", rows: readonly (readonly Value[])[], i: number): number {
  if (kind === "count") return rows.length;
  const ns = numbersIn(rows, i), total = ns.reduce((s, n) => s + n, 0);
  return kind === "sum" ? total : ns.length ? total / ns.length : 0;
}

// SUM, AVG or COUNT: over every row, or each group's key beside its own.
export function aggregate(q: Query, kind: "sum" | "avg" | "count", ref?: string | number): number | [string, number][] {
  const i = kind === "count" ? 0 : columnIndex(q, ref ?? 0);
  return q.groups ? q.groups.map(([k, rows]) => [k, over(kind, rows, i)]) : over(kind, q.rows, i);
}

// The rows, group by group when grouped.
export const result = (q: Query): Value[][] => (q.groups ? q.groups.flatMap(([, rows]) => rows) : q.rows).map((r) => [...r]);
