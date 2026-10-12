// "Excel formulas": the sheet's own language (lexer.ts, parser.ts,
// evaluate.ts, functions.ts) as a Language. A formula reads the cells its
// references and ranges name; it is rewritten token by token, so only
// references change ($ fixes a column or row in a copy, and a reference
// moved off the sheet, or into what was deleted, is #REF!).
import { cellAddr, colName, span, splitKey } from "./address.ts";
import type { Addr } from "./address.ts";
import { movedBy } from "./shift.ts";
import type { Edit, Fixed } from "./shift.ts";
import { evaluate } from "./evaluate.ts";
import { names } from "./functions.ts";
import type { Language, Offset } from "./language.ts";
import { FormulaError, tokens } from "./lexer.ts";
import type { Token } from "./lexer.ts";
import { parse } from "./parser.ts";
import type { Expr } from "./parser.ts";
import { CellError } from "./values.ts";

// The cells an expression reads, ranges spelled out; off-sheet ones are left
// to the evaluator (#REF!).
export function* refsOf(e: Expr): Generator<string, void, undefined> {
  switch (e.kind) {
    case "ref":
      if (cellAddr(e.name)) yield e.name;
      return;
    case "range":
      yield* span(e.from, e.to)?.keys ?? [];
      return;
    case "neg": return yield* refsOf(e.arg);
    case "binary":
      yield* refsOf(e.left);
      return yield* refsOf(e.right);
    case "call":
      for (const a of e.args) yield* refsOf(a);
      return;
    default:
      return;
  }
}

type Ref = Extract<Token, { kind: "ref" }>;

const fixedOf = (t: Ref): Fixed => ({ col: t.fixCol, row: t.fixRow });

// A reference at its new place, written as it was ($ and all), or as typed
// when it has not moved.
// (Its sheet, if it names one, as typed.)
function written(t: Ref, to: Addr): string {
  const a = cellAddr(t.name)!;
  if (to.col === a.col && to.row === a.row) return t.text;
  return `${t.text.slice(0, t.text.lastIndexOf("!") + 1)}${t.fixCol ? "$" : ""}${colName(to.col)}${t.fixRow ? "$" : ""}${to.row + 1}`;
}

// A cell's input with its references moved by `edit` (a constant, or a
// formula that does not lex, is unchanged). Token by token, so only the
// references change.
function rewrite(input: string, edit: Edit): string {
  if (!input.startsWith("=")) return input;
  let toks: Token[];
  try {
    toks = [...tokens(input.slice(1), 1)];
  } catch (e) {
    if (e instanceof FormulaError) return input;
    throw e;
  }
  let out = "", from = 0;
  for (let i = 0; i < toks.length; i++) {
    const t = toks[i];
    if (t.kind !== "ref") continue;
    const end = toks[i + 2];
    const other = toks[i + 1]?.kind === ":" && end?.kind === "ref" ? end : null;
    if (!edit.moves(splitKey(t.name).sheet)) {
      if (other) i += 2;
      continue;
    }
    const a = cellAddr(t.name), b = other ? cellAddr(other.name) : null;
    out += input.slice(from, t.at);
    if (other) {
      const r = a && b ? edit.range(a, b, fixedOf(t), fixedOf(other)) : null;
      out += r ? written(t, r[0]) + input.slice(t.at + t.text.length, other.at) + written(other, r[1]) : "#REF!";
    } else {
      const to = a ? edit.cell(a, fixedOf(t)) : null;
      out += to ? written(t, to) : "#REF!";
    }
    const last = other ?? t;
    from = last.at + last.text.length;
    if (other) i += 2;
  }
  return out + input.slice(from);
}

// A cell's input as it reads copied `by` cells.
export const moved = (input: string, by: Offset): string => movedBy(EXCEL, input, by);

export const EXCEL: Language = {
  name: "Excel",
  compile(formula, names) {
    try {
      const expr = parse(formula, names ?? (() => null));
      return { kind: "formula", reads: [...refsOf(expr)], run: (env) => evaluate(expr, env) };
    } catch (e) {
      if (!(e instanceof FormulaError)) throw e;
      return { kind: "broken", error: new CellError("#ERROR!", `parse error at ${e.at}: ${e.message}`) };
    }
  },
  rewrite,
  functions: names,
};
