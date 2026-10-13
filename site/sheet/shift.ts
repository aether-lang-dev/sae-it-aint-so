// Edits that move references: where a cell, or the two corners of a range,
// go when a formula is copied, or rows or columns are inserted or deleted.
// A language rewrites a formula's references by an edit (Language.rewrite);
// restructured() moves a sheet's cells by one. Null is gone (off the sheet,
// or deleted): the reference becomes #REF!. An edit says which references
// it moves, by their sheet: a copy moves every one; rows inserted on a sheet
// move the references to that sheet, and no others.
import { COLS, ROWS, addrOf, keyOf } from "./address.ts";
import type { Addr } from "./address.ts";
import type { Language, Offset } from "./language.ts";

// Which parts of a reference are $-fixed.
export interface Fixed {
  readonly col: boolean;
  readonly row: boolean;
}

export interface Edit {
  cell(a: Addr, fixed: Fixed): Addr | null;
  range(a: Addr, b: Addr, fa: Fixed, fb: Fixed): [Addr, Addr] | null;
  // A cell this edit deletes (as against one it pushes off the sheet).
  deletes(a: Addr): boolean;
  // Whether it moves a reference on `sheet` (its name in upper case, as a
  // key has it; null for a reference with none).
  moves(sheet: string | null): boolean;
}

// Which references a structural edit moves: unqualified ones, by default.
export type Scope = (sheet: string | null) => boolean;
const LOCAL: Scope = (sheet) => sheet === null;

const onSheet = (a: Addr): Addr | null => (a.col >= 0 && a.row >= 0 && a.col < COLS && a.row < ROWS ? a : null);

// A copy `by` cells: relative parts move, $-fixed ones stay.
export function byOffset(by: Offset): Edit {
  const cell = (a: Addr, f: Fixed) => onSheet({ col: f.col ? a.col : a.col + by.cols, row: f.row ? a.row : a.row + by.rows });
  return {
    cell,
    range: (a, b, fa, fb) => {
      const x = cell(a, fa), y = cell(b, fb);
      return x && y ? [x, y] : null;
    },
    deletes: () => false,
    moves: () => true,
  };
}

// Cells cut from a rectangle and pasted `by` away (a move): a reference to
// a cell in it, $ or not, goes with it, and a range wholly in it too; a
// reference to a cell it lands on (and did not come from) is #REF!, as
// what was there is gone. Everything else stays.
export function blockMoved(from: readonly [Addr, Addr], by: Offset, moves: Scope = LOCAL): Edit {
  const top = Math.min(from[0].row, from[1].row), bottom = Math.max(from[0].row, from[1].row);
  const left = Math.min(from[0].col, from[1].col), right = Math.max(from[0].col, from[1].col);
  const inside = (a: Addr, dr = 0, dc = 0) => a.row >= top + dr && a.row <= bottom + dr && a.col >= left + dc && a.col <= right + dc;
  const covered = (a: Addr) => inside(a, by.rows, by.cols) && !inside(a);
  const cell = (a: Addr) => (inside(a) ? onSheet({ col: a.col + by.cols, row: a.row + by.rows }) : covered(a) ? null : a);
  return {
    cell,
    range: (a, b) => {
      if (inside(a) && inside(b)) {
        const x = cell(a), y = cell(b);
        return x && y ? [x, y] : null;
      }
      return [a, b];
    },
    deletes: covered,
    moves,
  };
}

type Axis = "row" | "col";
const along = (a: Addr, axis: Axis) => (axis === "row" ? a.row : a.col);
const moved = (a: Addr, axis: Axis, to: number): Addr => (axis === "row" ? { col: a.col, row: to } : { col: to, row: a.row });

// `n` rows (or columns) inserted before index `at`: what is at or after it
// moves on, $ or not; a range that spans it grows.
export function inserted(axis: Axis, at: number, n: number, moves: Scope = LOCAL): Edit {
  const cell = (a: Addr) => {
    const i = along(a, axis);
    return onSheet(i >= at ? moved(a, axis, i + n) : a);
  };
  return {
    cell,
    range: (a, b) => {
      const x = cell(a), y = cell(b);
      return x && y ? [x, y] : null;
    },
    deletes: () => false,
    moves,
  };
}

// `n` rows (or columns) from index `at` deleted: what was in them is gone,
// what was after them moves back; a range loses what it had of them, and is
// gone when that was all of it.
export function deleted(axis: Axis, at: number, n: number, moves: Scope = LOCAL): Edit {
  const gone = (i: number) => i >= at && i < at + n;
  return {
    cell: (a) => {
      const i = along(a, axis);
      return gone(i) ? null : i >= at + n ? moved(a, axis, i - n) : a;
    },
    range: (a, b) => {
      const lo = Math.min(along(a, axis), along(b, axis)), hi = Math.max(along(a, axis), along(b, axis));
      const start = lo < at ? lo : gone(lo) ? at : lo - n;
      const end = hi < at ? hi : gone(hi) ? at - 1 : hi - n;
      if (start > end) return null;
      const first = along(a, axis) <= along(b, axis);
      return [moved(a, axis, first ? start : end), moved(b, axis, first ? end : start)];
    },
    deletes: (a) => gone(along(a, axis)),
    moves,
  };
}

// Rows (or columns) `i` and `j` swapped: what was in each is in the other.
// A range that holds both stays as it is; one that holds one of them goes
// where that one goes, stretched or shrunk to keep its other end.
export function swapped(axis: Axis, i: number, j: number, moves: Scope = LOCAL): Edit {
  const swap = (k: number) => (k === i ? j : k === j ? i : k);
  return {
    cell: (a) => moved(a, axis, swap(along(a, axis))),
    range: (a, b) => {
      const lo = Math.min(along(a, axis), along(b, axis)), hi = Math.max(along(a, axis), along(b, axis));
      if (lo <= Math.min(i, j) && hi >= Math.max(i, j)) return [a, b];
      const x = swap(along(a, axis)), y = swap(along(b, axis)), first = along(a, axis) <= along(b, axis);
      return [moved(a, axis, first ? Math.min(x, y) : Math.max(x, y)), moved(b, axis, first ? Math.max(x, y) : Math.min(x, y))];
    },
    deletes: () => false,
    moves,
  };
}

// A copy's rewrite of one input, in a language.
export const movedBy = (language: Language, input: string, by: Offset): string =>
  by.cols === 0 && by.rows === 0 ? input : language.rewrite(input, byOffset(by));

const STILL: Fixed = { col: false, row: false };

// A sheet's inputs after a structural edit, as [key, input] pairs for one
// Sheet.setMany (so one undo): the keys cells moved away from cleared, then
// each cell at its new key with its formula rewritten. A cell the edit
// would push off the sheet is refused.
export function restructured(inputs: readonly (readonly [string, string])[], edit: Edit, language: Language): [string, string][] {
  const clears: [string, string][] = [], sets: [string, string][] = [];
  for (const [key, input] of inputs) {
    const a = addrOf(key)!;
    const to = edit.cell(a, STILL);
    if (!to && !edit.deletes(a)) throw new RangeError(`${key} is not empty: inserting would push it off the sheet`);
    const rewritten = language.rewrite(input, edit);
    const toKey = to ? keyOf(to) : null;
    if (toKey !== key) clears.push([key, ""]);
    if (toKey && (toKey !== key || rewritten !== input)) sets.push([toKey, rewritten]);
  }
  return [...clears, ...sets];
}
