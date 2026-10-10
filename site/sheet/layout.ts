// Where the sheet's cells are drawn: the row-number column, the header row,
// and ten columns whose widths a drag changes. Pure geometry, in the
// scene's units (one a pixel): what is at a point, where a column starts,
// how wide a column must be for its text. Measuring and cutting text is the
// toolkit's (vg.measure, vg.ellipsize); this only adds the padding.
import { COLS, ROWS } from "./address.ts";
import type { Addr } from "./address.ts";

export const ROW_HEAD = 30;      // the row numbers' column
export const HEAD = 20;          // the column letters' row
export const ROW = 22;           // each row
export const MIN_WIDTH = 24;
export const MAX_WIDTH = 240;
export const START_WIDTH = 70;
export const FONT = 11;          // the cells' text size
export const PAD = 4;            // text inset from each side of a cell

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

// The room for text in a cell `width` wide.
export const room = (width: number): number => Math.max(0, width - 2 * PAD);

// The width a column needs for texts this wide (measured), padding and all;
// Columns.resize holds it to the limits.
export const fitted = (textWidths: readonly number[]): number =>
  Math.ceil(Math.max(0, ...textWidths)) + 2 * PAD;
