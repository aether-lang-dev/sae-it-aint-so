// Copying cells: the clipboard's tab-separated text, paste, and fill down
// and right. What a formula becomes in another cell is its language's
// (Language.moved). Nothing here touches a Sheet: these take inputs and give
// back [key, input] pairs for Sheet.setMany.
import { addrOf, keyOf } from "./address.ts";
import type { Addr } from "./address.ts";
import type { Language } from "./language.ts";

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
    .map(([a, input]) => [keyOf(a), source ? source.language.moved(input, by) : input]);
}

// Fill down: each column's top cell copied into the cells below it in the
// rectangle; fill right, each row's left cell across. A rectangle one row
// tall (one column wide, for right) fills from the row above (the column to
// its left), as a spreadsheet's Ctrl+D (Ctrl+R) does.
export function filled(input: (key: string) => string, a: Addr, b: Addr, way: "down" | "right", language: Language): [string, string][] {
  const { top, bottom, left, right } = corners(a, b);
  const down = way === "down";
  const first = down ? (top === bottom ? top - 1 : top) : (left === right ? left - 1 : left);
  if (first < 0) return [];
  const out: [string, string][] = [];
  for (let row = down ? first + 1 : top; row <= bottom; row++) {
    for (let col = down ? left : first + 1; col <= right; col++) {
      const src = down ? { col, row: first } : { col: first, row };
      out.push([keyOf({ col, row }), language.moved(input(keyOf(src)), { cols: col - src.col, rows: row - src.row })]);
    }
  }
  return out;
}
