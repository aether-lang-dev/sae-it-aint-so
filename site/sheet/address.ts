// Cell addresses on a 26 x 100 sheet, as the Tauri app's: columns A to Z,
// rows 1 to 100. A key is the address as written ("B12"); an Addr is where
// it is (0-based). Columns past Z are AA, AB and on, as a spreadsheet's, so
// the sheet grows by these two numbers alone.
export const COLS = 26;
export const ROWS = 100;

export type Key = `${Uppercase<string>}${number}`;

export interface Addr {
  readonly col: number;
  readonly row: number;
}

// A column's letters: 0 is A, 25 Z, 26 AA.
export function colName(col: number): string {
  let name = "";
  for (let n = col + 1; n > 0; n = Math.floor((n - 1) / 26)) name = String.fromCharCode(65 + ((n - 1) % 26)) + name;
  return name;
}

// A column by its letters (any case), or null when there are none or it is
// off the sheet.
export function colOf(letters: string): number | null {
  const t = letters.trim().toUpperCase();
  if (!/^[A-Z]{1,3}$/.test(t)) return null;
  let n = 0;
  for (const ch of t) n = n * 26 + ch.charCodeAt(0) - 64;
  return n - 1 < COLS ? n - 1 : null;
}

export const keyOf = ({ col, row }: Addr): Key => `${colName(col)}${row + 1}` as Key;

// "b12" or " B12 " is B12; anything else, or off the sheet, is null.
export function addrOf(s: string): Addr | null {
  const m = /^\s*([A-Za-z]{1,3})([1-9][0-9]{0,6})\s*$/.exec(s);
  if (!m) return null;
  const col = colOf(m[1]), row = Number(m[2]) - 1;
  return col !== null && row < ROWS ? { col, row } : null;
}

// A key can name a cell on another sheet: "COSTS!B2" (the sheet's name in
// upper case, as formulas are). Its parts: the sheet (null for this one) and
// the cell.
export function splitKey(key: string): { sheet: string | null; cell: string } {
  const i = key.lastIndexOf("!");
  return i < 0 ? { sheet: null, cell: key } : { sheet: key.slice(0, i), cell: key.slice(i + 1) };
}

export const qualified = (sheet: string, cell: string): string => `${sheet.toUpperCase()}!${cell}`;

// A key's cell, wherever its sheet: "COSTS!B2" and "B2" are both B2.
// A sheet's name as a reference written in a formula starts with it:
// Costs!, 'My Costs'!.
export const sheetPrefix = (name: string): string => (/^[A-Za-z_]\w*$/.test(name) ? `${name}!` : `'${name}'!`);
export const cellAddr = (key: string): Addr | null => addrOf(splitKey(key).cell);

// The keys from one corner to another (`to` on `from`'s sheet), and how
// many columns wide; null when either is off the sheet.
export function span(from: string, to: string): { keys: string[]; cols: number } | null {
  const { sheet } = splitKey(from);
  const a = cellAddr(from), b = cellAddr(to);
  if (!a || !b) return null;
  return { keys: [...range(a, b)].map((k) => (sheet === null ? k : `${sheet}!${k}`)), cols: Math.abs(a.col - b.col) + 1 };
}

// "B2:C4", "c4:b2" or "B2" (a range of one) as its two corners, or null.
export function parseRange(s: string): [Addr, Addr] | null {
  const [from, to = from, extra] = String(s).split(":");
  if (extra !== undefined) return null;
  const a = addrOf(from), b = addrOf(to);
  return a && b ? [a, b] : null;
}

// Row-major order, so a list of cells reads the way the sheet does.
export const order = (a: Addr): number => a.row * COLS + a.col;

// Every key in the rectangle two corners make, either way round.
export function* range(a: Addr, b: Addr): Generator<Key, void, undefined> {
  for (let row = Math.min(a.row, b.row); row <= Math.max(a.row, b.row); row++) {
    for (let col = Math.min(a.col, b.col); col <= Math.max(a.col, b.col); col++) yield keyOf({ col, row });
  }
}

export const allKeys = (): Generator<Key, void, undefined> => range({ col: 0, row: 0 }, { col: COLS - 1, row: ROWS - 1 });
