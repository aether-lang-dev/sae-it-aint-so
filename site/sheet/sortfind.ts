// Sorting a range's rows by one of its columns, and finding and replacing,
// as the Tauri spreadsheet does (its sortRange, find and replace). Each
// reads a sheet's inputs and values and gives [key, input] pairs for one
// Sheet.setMany, so one undo.
import { keyOf } from "./address.ts";
import type { Addr } from "./address.ts";
import { show } from "./format.ts";
import type { Language } from "./language.ts";
import { movedBy } from "./shift.ts";
import { CellError } from "./values.ts";
import type { Value } from "./values.ts";

export interface Cells {
  keys(): string[];   // the cells holding something, in sheet order
  input(key: string): string;
  value(key: string): Value;
}

// Numbers first (by size), then text (without case), then empty cells.
export function sortOrder(x: Value, y: Value): number {
  const rank = (v: Value) => (typeof v === "number" ? 0 : v === null || v === "" ? 2 : 1);
  const rx = rank(x), ry = rank(y);
  if (rx !== ry) return rx - ry;
  if (rx === 0) return (x as number) - (y as number);
  if (rx === 2) return 0;
  const sx = (x instanceof CellError ? x.code : String(x)).toLowerCase(), sy = (y instanceof CellError ? y.code : String(y)).toLowerCase();
  return sx < sy ? -1 : sx > sy ? 1 : 0;
}

// The rectangle's rows in order of the values in its column `col` (counted
// from its left edge), ascending or not, equal ones keeping their order: the
// row each place takes its cells from.
export function sortedRows(cells: Cells, a: Addr, b: Addr, col: number, ascending: boolean): number[] {
  const top = Math.min(a.row, b.row), bottom = Math.max(a.row, b.row);
  const left = Math.min(a.col, b.col);
  const rows = [];
  for (let row = top; row <= bottom; row++) rows.push(row);
  const key = (row: number) => cells.value(keyOf({ col: left + col, row }));
  return rows.map((row, i) => ({ row, i })).sort((p, q) => {
    const c = sortOrder(key(p.row), key(q.row));
    return c !== 0 ? (ascending ? c : -c) : p.i - q.i;
  }).map(({ row }) => row);
}

// Where each cell went in that sort (cells outside the rectangle stay), for
// what a cell carries besides its input (notes.ts) to follow its row.
export const sortMoves = (cells: Cells, a: Addr, b: Addr, col: number, ascending: boolean): (at: Addr) => Addr =>
  rearrangedMoves(a, b, sortedRows(cells, a, b, col, ascending));

// Where each cell went in that rearrangement.
export function rearrangedMoves(a: Addr, b: Addr, rows: readonly number[]): (at: Addr) => Addr {
  const top = Math.min(a.row, b.row);
  const left = Math.min(a.col, b.col), right = Math.max(a.col, b.col);
  const placeOf = new Map(rows.map((from, i) => [from, top + i]));
  return (at) => (at.col >= left && at.col <= right && placeOf.has(at.row) ? { col: at.col, row: placeOf.get(at.row)! } : at);
}

// The rectangle sorted so: a row moves whole, its formulas rewritten as a
// copy by the rows it moved.
export const sorted = (cells: Cells, a: Addr, b: Addr, col: number, ascending: boolean, language: Language): [string, string][] =>
  rearranged(cells, a, b, sortedRows(cells, a, b, col, ascending), language);

// The rectangle's rows put in an order (the row each place takes its cells
// from), as a sort puts them.
export function rearranged(cells: Cells, a: Addr, b: Addr, rows: readonly number[], language: Language): [string, string][] {
  const top = Math.min(a.row, b.row);
  const left = Math.min(a.col, b.col), right = Math.max(a.col, b.col);
  const out: [string, string][] = [];
  rows.forEach((from, i) => {
    const to = top + i;
    for (let c = left; c <= right; c++) {
      out.push([keyOf({ col: c, row: to }), movedBy(language, cells.input(keyOf({ col: c, row: from })), { cols: 0, rows: to - from })]);
    }
  });
  return out;
}

export interface FindOptions {
  readonly matchCase?: boolean;
  readonly wholeCell?: boolean;
  readonly inFormulas?: boolean;   // a formula's text, not what it comes to
}

const escaped = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const pattern = (text: string, o: FindOptions) =>
  new RegExp(o.wholeCell ? `^${escaped(text)}$` : escaped(text), o.matchCase ? "g" : "gi");

// What a search looks at in a cell: a formula's text when asked, else what
// the cell shows.
const searched = (cells: Cells, key: string, o: FindOptions) => {
  const input = cells.input(key);
  return input.startsWith("=") && !o.inFormulas ? show(cells.value(key)) : input;
};

// The cells holding `text`, in sheet order.
export function found(cells: Cells, text: string, o: FindOptions): string[] {
  if (!text) return [];
  const p = pattern(text, o);
  return cells.keys().filter((k) => {
    p.lastIndex = 0;
    return p.test(searched(cells, k, o));
  });
}

// Every match replaced: in constants, and in formulas' text when asked.
export function replaced(cells: Cells, text: string, by: string, o: FindOptions): [string, string][] {
  if (!text) return [];
  const p = pattern(text, o);
  return cells.keys().flatMap((k): [string, string][] => {
    const input = cells.input(k);
    if (input.startsWith("=") && !o.inFormulas) return [];
    const next = input.replace(p, () => by);
    return next === input ? [] : [[k, next]];
  });
}
