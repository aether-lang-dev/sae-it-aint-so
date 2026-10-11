// Cell addresses on a 10 x 20 sheet: columns A to J, rows 1 to 20. A key is
// the address as written ("B12"); an Addr is where it is (0-based).
export const COLS = 10;
export const ROWS = 20;

export type Key = `${Uppercase<string>}${number}`;

export interface Addr {
  readonly col: number;
  readonly row: number;
}

export const colName = (col: number): string => String.fromCharCode(65 + col);

export const keyOf = ({ col, row }: Addr): Key => `${colName(col)}${row + 1}` as Key;

// "b12" or " B12 " is B12; anything else, or off the sheet, is null.
export function addrOf(s: string): Addr | null {
  const m = /^\s*([A-Za-z])([1-9][0-9]?)\s*$/.exec(s);
  if (!m) return null;
  const col = m[1].toUpperCase().charCodeAt(0) - 65, row = Number(m[2]) - 1;
  return col < COLS && row < ROWS ? { col, row } : null;
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
