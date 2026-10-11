// A formula language: the sheet's major setting, "Excel formulas"
// (excel.ts) or "RexxJS formulas" (rexx.ts). The Sheet keeps inputs, the
// graph of who reads whom and the order of recalculation; a language says
// what a formula (what follows its '=') reads and what it comes to, and how
// it reads when its references move (a copy, rows or columns inserted or
// deleted). Evaluation may be asynchronous (RexxJS's
// is), so `run` may give a promise; the Sheet awaits each in turn.
import type { CellError, Value } from "./values.ts";
import type { Edit } from "./shift.ts";

export interface Env {
  get(key: string): Value;
}

export interface Offset {
  readonly cols: number;
  readonly rows: number;
}

export type Formula =
  | { readonly kind: "formula"; readonly reads: readonly string[]; run(env: Env): Value | Promise<Value> }
  | { readonly kind: "broken"; readonly error: CellError };

export interface Language {
  readonly name: "Excel" | "RexxJS";
  compile(formula: string): Formula;
  // A cell's input (a formula or a constant) with its references moved by
  // an edit (a copy, rows or columns inserted or deleted: shift.ts); one
  // whose cell is gone is #REF!.
  rewrite(input: string, edit: Edit): string;
  // The names of the functions a formula can call, for the page to list.
  functions(): readonly string[];
}
