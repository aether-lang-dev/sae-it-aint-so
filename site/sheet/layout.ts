// Where the sheet's cells are drawn: the row-number column, the header row,
// and ten columns whose widths a drag changes. Pure geometry, in the
// scene's units (one a pixel): what is at a point, where a column starts,
// how much of a value fits in a cell.
import { COLS, ROWS } from "./address.ts";
import type { Addr } from "./address.ts";

export const ROW_HEAD = 30;      // the row numbers' column
export const HEAD = 20;          // the column letters' row
export const ROW = 22;           // each row
export const MIN_WIDTH = 24;
export const MAX_WIDTH = 240;
export const START_WIDTH = 70;
export const CHAR = 6.6;         // a character's width at the cells' font size, near enough
export const PAD = 4;            // text inset from a cell's left edge

export class Columns {
  readonly #widths: number[];

  constructor(count = COLS, width = START_WIDTH) {
    this.#widths = Array.from({ length: count }, () => width);
  }

  get count(): number { return this.#widths.length; }
  get widths(): readonly number[] { return this.#widths; }
  width(c: number): number { return this.#widths[c]; }

  // Column c's left edge.
  left(c: number): number {
    return ROW_HEAD + this.#widths.slice(0, c).reduce((s, w) => s + w, 0);
  }

  right(c: number): number { return this.left(c) + this.#widths[c]; }
  get total(): number { return this.left(this.count); }

  // Set column c's width, held to MIN_WIDTH..MAX_WIDTH; returns what it became.
  resize(c: number, width: number): number {
    return (this.#widths[c] = Math.round(Math.min(MAX_WIDTH, Math.max(MIN_WIDTH, width))));
  }

  // The column under x, or null in the row numbers or past the last.
  at(x: number): number | null {
    if (x < ROW_HEAD) return null;
    for (let c = 0; c < this.count; c++) if (x < this.right(c)) return c;
    return null;
  }
}

export const height = HEAD + ROWS * ROW;
export const rowTop = (row: number): number => HEAD + row * ROW;

// The cell under (x, y), or null on a header or off the grid.
export function cellAt(cols: Columns, x: number, y: number): Addr | null {
  const col = cols.at(x);
  if (col === null || y < HEAD || y >= height) return null;
  return { col, row: Math.floor((y - HEAD) / ROW) };
}

// As much of `s` as fits in a cell `width` wide, an ellipsis marking a cut.
export function fit(s: string, width: number): string {
  const room = Math.floor((width - 2 * PAD) / CHAR);
  if (s.length <= room) return s;
  return room <= 1 ? "" : `${s.slice(0, room - 1)}…`;
}
