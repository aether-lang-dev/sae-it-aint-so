// What-if and data tools' arithmetic, with no sheet: the secant method
// Goal Seek runs over the sheet, text split for Text to Columns, and the
// rows Remove Duplicates keeps.
import { fromCsv } from "./csv.ts";

// A root of f near x0, by the secant method: x, or null when it does not
// settle (no root, or f not a number on the way).
export async function secant(f: (x: number) => Promise<number>, x0: number): Promise<{ x: number } | null> {
  let a = x0, b = x0 === 0 ? 0.01 : x0 * 1.01;
  let fa = await f(a), fb = await f(b);
  for (let i = 0; i < 100; i++) {
    if (!Number.isFinite(fa) || !Number.isFinite(fb)) return null;
    if (Math.abs(fb) < 1e-9) return { x: b };
    if (fb === fa) return null;
    const c = b - (fb * (b - a)) / (fb - fa);
    if (!Number.isFinite(c)) return null;
    [a, fa, b] = [b, fb, c];
    fb = await f(b);
  }
  return null;
}

// One line of text split at a delimiter, a quoted field kept whole.
export const splitText = (text: string, delimiter: string): string[] => fromCsv(text.replace(/[\r\n]+/g, " "), delimiter)[0] ?? [""];

// The rows to keep: each whose values in `cols` (any case) no earlier row has.
export function distinctRows(rows: readonly (readonly string[])[], cols: readonly number[]): number[] {
  const seen = new Set<string>();
  return rows.flatMap((row, i) => {
    const key = JSON.stringify(cols.map((c) => (row[c] ?? "").toUpperCase()));
    if (seen.has(key)) return [];
    seen.add(key);
    return [i];
  });
}
