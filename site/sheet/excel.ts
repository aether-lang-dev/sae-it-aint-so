// "Excel formulas": the sheet's own language (lexer.ts, parser.ts,
// evaluate.ts, functions.ts) as a Language. A formula reads the cells its
// references and ranges name; it moves token by token, so only references
// change ($ fixes a column or row, and one moved off the sheet is #REF!).
import { COLS, ROWS, addrOf, colName, range } from "./address.ts";
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
      if (addrOf(e.name)) yield e.name;
      return;
    case "range": {
      const a = addrOf(e.from), b = addrOf(e.to);
      if (a && b) yield* range(a, b);
      return;
    }
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

// Where a reference lands, written as it was, or null off the sheet.
function shifted(t: Ref, by: Offset): string | null {
  const a = addrOf(t.name);
  if (!a) return null;
  const col = t.fixCol ? a.col : a.col + by.cols, row = t.fixRow ? a.row : a.row + by.rows;
  if (col < 0 || row < 0 || col >= COLS || row >= ROWS) return null;
  if (col === a.col && row === a.row) return t.text;
  return `${t.fixCol ? "$" : ""}${colName(col)}${t.fixRow ? "$" : ""}${row + 1}`;
}

// A cell's input as it reads moved `by` (a constant, or a formula that does
// not lex, is unchanged).
export function moved(input: string, by: Offset): string {
  if (!input.startsWith("=") || (by.cols === 0 && by.rows === 0)) return input;
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
    const range = toks[i + 1]?.kind === ":" && end?.kind === "ref" ? end : null;
    const a = shifted(t, by), b = range ? shifted(range, by) : "";
    out += input.slice(from, t.at);
    out += a === null || b === null ? "#REF!" : range ? a + input.slice(t.at + t.text.length, range.at) + b : a;
    const last = range ?? t;
    from = last.at + last.text.length;
    if (range) i += 2;
  }
  return out + input.slice(from);
}

export const EXCEL: Language = {
  name: "Excel",
  compile(formula) {
    try {
      const expr = parse(formula);
      return { kind: "formula", reads: [...refsOf(expr)], run: (env) => evaluate(expr, env) };
    } catch (e) {
      if (!(e instanceof FormulaError)) throw e;
      return { kind: "broken", error: new CellError("#ERROR!", `parse error at ${e.at}: ${e.message}`) };
    }
  },
  moved,
  functions: names,
};
