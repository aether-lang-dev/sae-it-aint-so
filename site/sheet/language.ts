// A formula language: the sheet's major setting, "Excel formulas"
// (excel.ts) or "RexxJS formulas" (rexx.ts). The Sheet keeps inputs, the
// graph of who reads whom and the order of recalculation; a language says
// what a formula (what follows its '=') reads and what it comes to, and how
// it reads when its references move (a copy, rows or columns inserted or
// deleted). Evaluation may be asynchronous (RexxJS's
// is), so `run` may give a promise; the Sheet awaits each in turn.
import type { ArrayValue, CellError, Result, Value } from "./values.ts";
import type { Edit } from "./shift.ts";
import type { Addr } from "./address.ts";

// The sheet's named ranges: a name (upper case) to its two corners, or null.
// A named range as a formula reads it: its corners, and its sheet's name
// (upper case, as a key has it) when it is on another sheet than the one
// the formula is on (a workbook's name for a range of another sheet).
export interface Named {
  readonly range: [Addr, Addr];
  readonly sheet: string | null;
}
export type Names = (name: string) => Named | null;
// The sheet's named formulas (the Name Manager's "refers to" a formula, not
// a range): a named LAMBDA, =LAMBDA(n, IF(n<2, 1, n*FACT(n-1))), by its
// name; null for none. Its text is what follows the '='.
export type Formulas = (name: string) => string | null;

// A table on a sheet (the Tauri app's table metadata): its name as given, its
// range, whether its first row names its columns, or the names it was given.
export interface TableDef {
  readonly name: string;
  readonly range: [Addr, Addr];
  readonly headers: boolean;
  readonly columns: readonly string[] | null;
  // The Tauri app's table metadata: a column's type and description, by its
  // name; and how the table was last sorted by the sort cycle (table.sort).
  readonly types?: Readonly<Record<string, string>>;
  readonly descriptions?: Readonly<Record<string, string>>;
  readonly sort?: TableSort;
}

// A table sorted by a column, ascending or descending, and the row each of
// its data rows came from before the first sort (to put them back).
export interface TableSort {
  readonly column: number;
  readonly direction: "asc" | "desc";
  readonly origin: readonly number[];
}

// The sheet's tables, by name (upper case), or null.
export type Tables = (name: string) => TableDef | null;

export interface Env {
  get(key: string): Value;
  // What a cell spills (A1#), or null.
  spill?(key: string): ArrayValue | null;
}

export interface Offset {
  readonly cols: number;
  readonly rows: number;
}

export type Formula =
  | { readonly kind: "formula"; readonly reads: readonly string[]; run(env: Env): Result | Promise<Result> }
  | { readonly kind: "broken"; readonly error: CellError };

export interface Language {
  readonly name: "Excel" | "RexxJS";
  // `names` reads the sheet's named ranges; a name it does not know is
  // #NAME?. A read of a cell on another sheet is its key qualified:
  // "COSTS!B2".
  compile(formula: string, names?: Names, tables?: Tables, formulas?: Formulas): Formula;
  // A cell's input (a formula or a constant) with its references moved by
  // an edit (a copy, rows or columns inserted or deleted: shift.ts); one
  // whose cell is gone is #REF!.
  rewrite(input: string, edit: Edit): string;
  // A cell's input with its references to sheet `from` (upper case, as a
  // key has it) naming sheet `to` instead; null when one cannot be written
  // so (RexxJS's Costs_B2 for a name with a space).
  renamed(input: string, from: string, to: string): string | null;
  // The names of the functions a formula can call, for the page to list.
  functions(): readonly string[];
  // The cells and ranges a formula (what follows its '=') names, as written
  // ("B1:B3", "C2", "COSTS!A1"), in order, once each: what a formula being
  // typed colours. One not yet whole gives what it has so far.
  references(formula: string): string[];
}
