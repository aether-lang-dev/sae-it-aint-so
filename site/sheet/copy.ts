// Copying cells: what a formula becomes in another cell, the clipboard's
// tab-separated text, and fill down and right. A relative reference moves
// with the formula, a $-fixed column or row stays, and a reference moved off
// the sheet becomes #REF!. Only references change; the rest of a formula is
// kept as typed. Nothing here touches a Sheet: these take inputs and give
// back [key, input] pairs for Sheet.setMany.
import { COLS, ROWS, addrOf, colName, keyOf } from "./address.ts";
import type { Addr } from "./address.ts";
import { FormulaError, tokens } from "./lexer.ts";
import type { Token } from "./lexer.ts";

export interface Offset {
  readonly cols: number;
  readonly rows: number;
}

type Ref = Extract<Token, { kind: "ref" }>;

// Where a reference lands, written as it was, or null off the sheet.
function shifted(t: Ref, by: Offset): string | null {
  const a = addrOf(t.name);
  if (!a) return null;
  const col = t.fixCol ? a.col : a.col + by.cols, row = t.fixRow ? a.row : a.row + by.rows;
  if (col < 0 || row < 0 || col >= COLS || row >= ROWS) return null;
  if (col === a.col && row === a.row) return t.text;
  return `${t.fixCol ? "$" : ""}${colName(col)}${t.fixRow ? "$" : ""}${row + 1}`;
}

// A cell's input as it reads moved `by` (a constant, or a formula that does
// not lex, is unchanged).
export function moved(input: string, by: Offset): string {
  if (!input.startsWith("=") || (by.cols === 0 && by.rows === 0)) return input;
  let toks: Token[];
  try {
    toks = [...tokens(input.slice(1), 1)];
  } catch (e) {
    if (e instanceof FormulaError) return input;
    throw e;
  }
  let out = "", from = 0;
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    if (t.kind !== "ref") continue;
    const end = toks[i + 2];
    const range = toks[i + 1]?.kind === ":" && end?.kind === "ref" ? end : null;
    const a = shifted(t, by), b = range ? shifted(range, by) : "";
    out += input.slice(from, t.at);
    out += a === null || b === null ? "#REF!" : range ? a + input.slice(t.at + t.text.length, range.at) + b : a;
    const last = range ?? t;
    from = last.at + last.text.length;
    if (range) i += 2;
  }
  return out + input.slice(from);
}

const corners = (a: Addr, b: Addr) => ({
  top: Math.min(a.row, b.row), bottom: Math.max(a.row, b.row),
  left: Math.min(a.col, b.col), right: Math.max(a.col, b.col),
});

// The inputs in the rectangle two corners make, as a clipboard holds them:
// a row a line, its cells tab-separated.
export function copied(input: (key: string) => string, a: Addr, b: Addr): string {
  const { top, bottom, left, right } = corners(a, b);
  const lines: string[] = [];
  for (let row = top; row <= bottom; row++) {
    const cells: string[] = [];
    for (let col = left; col <= right; col++) cells.push(input(keyOf({ col, row })));
    lines.push(cells.join("\t"));
  }
  return lines.join("\n");
}

// Tab-separated rows placed with their first cell at `at`; what falls off
// the sheet is dropped. Text copied from the sheet at `from` has its
// formulas moved by the distance; text from elsewhere is taken as written.
export function pasted(tsv: string, at: Addr, from?: Addr): [string, string][] {
  const by = from ? { cols: at.col - from.col, rows: at.row - from.row } : { cols: 0, rows: 0 };
  return tsv.replace(/\r/g, "").replace(/\n+$/, "").split("\n").flatMap((line, r) =>
    line.split("\t").map((input, c): [Addr, string] => [{ col: at.col + c, row: at.row + r }, input.trim()]))
    .filter(([a]) => addrOf(keyOf(a)) !== null)
    .map(([a, input]) => [keyOf(a), moved(input, by)]);
}

// Fill down: each column's top cell copied into the cells below it in the
// rectangle; fill right, each row's left cell across. A rectangle one row
// tall (one column wide, for right) fills from the row above (the column to
// its left), as a spreadsheet's Ctrl+D (Ctrl+R) does.
export function filled(input: (key: string) => string, a: Addr, b: Addr, way: "down" | "right"): [string, string][] {
  const { top, bottom, left, right } = corners(a, b);
  const down = way === "down";
  const first = down ? (top === bottom ? top - 1 : top) : (left === right ? left - 1 : left);
  if (first < 0) return [];
  const out: [string, string][] = [];
  for (let row = down ? first + 1 : top; row <= bottom; row++) {
    for (let col = down ? left : first + 1; col <= right; col++) {
      const src = down ? { col, row: first } : { col: first, row };
      out.push([keyOf({ col, row }), moved(input(keyOf(src)), { cols: col - src.col, rows: row - src.row })]);
    }
  }
  return out;
}
