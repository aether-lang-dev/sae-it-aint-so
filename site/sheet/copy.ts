// Copying cells: the clipboard's tab-separated text, paste, and fill down
// and right. What a formula becomes in another cell is its language's
// rewrite by the distance (shift.ts's movedBy). Nothing here touches a Sheet: these take inputs and give
// back [key, input] pairs for Sheet.setMany.
import { COLS, ROWS, addrOf, keyOf } from "./address.ts";
import type { Addr } from "./address.ts";
import type { Language } from "./language.ts";
import { movedBy } from "./shift.ts";

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
// the sheet is dropped. Text copied from the sheet (`source`: where, and in
// which language) has its formulas moved by the distance; text from
// elsewhere is taken as written.
export function pasted(tsv: string, at: Addr, source?: { readonly from: Addr; readonly language: Language }): [string, string][] {
  const by = source ? { cols: at.col - source.from.col, rows: at.row - source.from.row } : { cols: 0, rows: 0 };
  return tsv.replace(/\r/g, "").replace(/\n+$/, "").split("\n").flatMap((line, r) =>
    line.split("\t").map((input, c): [Addr, string] => [{ col: at.col + c, row: at.row + r }, input.trim()]))
    .filter(([a]) => addrOf(keyOf(a)) !== null)
    .map(([a, input]) => [keyOf(a), source ? movedBy(source.language, input, by) : input]);
}

// Fill down copies the top row of a rectangle into the rest of it, each
// formula moved; fill right, the left column across; fill up, the bottom
// row; fill left, the right column. A rectangle one line thick fills from
// the line beyond it (the row above, for down), as a spreadsheet's Ctrl+D
// (Ctrl+R) does. With `lines` > 1 the source is that many lines, repeated
// (the Tauri app's FILLDOWN of "A1:A2" into "A3:A10").
export type FillWay = "down" | "right" | "up" | "left";
export function filled(input: (key: string) => string, a: Addr, b: Addr, way: FillWay, language: Language, lines = 1): [string, string][] {
  const { top, bottom, left, right } = corners(a, b);
  const rows = way === "down" || way === "up", back = way === "up" || way === "left";
  const [lo, hi, limit] = rows ? [top, bottom, ROWS] : [left, right, COLS];
  const n = Math.max(1, Math.min(lines, hi - lo + 1));
  const beyond = lo === hi && n === 1;
  const source = (line: number) => (back ? (beyond ? hi + 1 : hi - ((hi - line) % n)) : (beyond ? lo - 1 : lo + ((line - lo) % n)));
  if (source(back ? lo : hi) < 0 || source(back ? lo : hi) >= limit) return [];
  const out: [string, string][] = [];
  for (let row = top; row <= bottom; row++) {
    for (let col = left; col <= right; col++) {
      const line = rows ? row : col, from = source(line);
      if (from === line) continue;
      const src = rows ? { col, row: from } : { col: from, row };
      out.push([keyOf({ col, row }), movedBy(language, input(keyOf(src)), { cols: col - src.col, rows: row - src.row })]);
    }
  }
  return out;
}
