// Formula auditing's model: a printer, and Evaluate Formula's steps.
//
// print() writes an Expr as Excel would: functions and references in upper
// case, no spaces, parentheses only where precedence needs them (the
// operators are left-associative, so a right operand of the same level
// keeps its parentheses). evaluationSteps() works a formula out one
// reduction at a time, as Excel's Evaluate Formula does: the leftmost
// innermost reference, range or operation whose operands are known, until
// one value is left; a range shows as an array ({1;2;3} down, {1,2} across);
// IF works out its condition, then becomes the branch it takes.
import { evaluate } from "./evaluate.ts";
import type { Env } from "./evaluate.ts";
import { show } from "./format.ts";
import type { Formulas, Names } from "./language.ts";
import { parse } from "./parser.ts";
import type { Expr } from "./parser.ts";
import { CellError, array, isArray, toNumber } from "./values.ts";
import type { Result, Value } from "./values.ts";

const LEVEL: Record<string, number> = { "=": 0, "<>": 0, "<": 0, ">": 0, "<=": 0, ">=": 0, "&": 1, "+": 2, "-": 2, "*": 3, "/": 3, "^": 4 };
const NEG = 5, ATOM = 6;

// An Expr being worked out: once a part is known, its text stands for it.
interface Node {
  e: Expr;
  kids: Node[];
  text?: string;
}

const kidsOf = (e: Expr): readonly Expr[] => {
  switch (e.kind) {
    case "neg": return [e.arg];
    case "binary": return [e.left, e.right];
    case "call": return e.args;
    case "let": return [...e.bindings.map(([, v]) => v), e.body];
    case "lambda": return [e.body];
    case "apply": return [e.fn, ...e.args];
    default: return [];
  }
};
// LET, LAMBDA and a call of one are worked out whole, in one step.
const whole = (e: Expr) => e.kind === "let" || e.kind === "lambda" || e.kind === "apply";

// A value as a formula writes it; an array as {1,2;3,4} (rows split by ;).
export function literal(v: Result): string {
  if (isArray(v)) {
    const rows = Array.from({ length: v.rows }, (_, i) => v.values.slice(i * v.cols, (i + 1) * v.cols).map(literal).join(","));
    return `{${rows.join(";")}}`;
  }
  if (typeof v === "string") return `"${v.replace(/"/g, '""')}"`;
  if (v === null) return '""';
  return show(v);
}

function nodeOf(e: Expr): Node {
  const n: Node = { e, kids: kidsOf(e).map(nodeOf) };
  if (e.kind === "num" || e.kind === "str" || e.kind === "bool") n.text = literal(e.value);
  if (e.kind === "error") n.text = e.code;
  if (e.kind === "missing") n.text = "";
  if (e.kind === "array") n.text = literal(array(e.rows, e.cols, e.values.map((v) => (typeof v === "object" ? new CellError(v.error, "") : v))));
  return n;
}

const level = (n: Node): number => (n.text !== undefined ? ATOM : n.e.kind === "binary" ? LEVEL[n.e.op] : n.e.kind === "neg" ? NEG : ATOM);

function printed(n: Node): string {
  if (n.text !== undefined) return n.text;
  const e = n.e;
  const wrap = (k: Node, parens: boolean) => (parens ? `(${printed(k)})` : printed(k));
  switch (e.kind) {
    case "ref": return e.name;
    case "spill": return `${e.name}#`;
    case "range": return `${e.from}:${e.to}`;
    case "neg": return `-${wrap(n.kids[0], level(n.kids[0]) < NEG)}`;
    case "binary": {
      const l = LEVEL[e.op];
      return `${wrap(n.kids[0], level(n.kids[0]) < l)}${e.op}${wrap(n.kids[1], level(n.kids[1]) <= l)}`;
    }
    case "call": return `${e.name}(${n.kids.map(printed).join(",")})`;
    case "missing": return "";
    case "local": return e.name;
    case "let": return `LET(${e.bindings.map(([name], i) => `${name},${printed(n.kids[i])}`).join(",")},${printed(n.kids[n.kids.length - 1])})`;
    case "lambda": return `LAMBDA(${[...e.params, printed(n.kids[0])].join(",")})`;
    case "apply": return `${printed(n.kids[0])}(${n.kids.slice(1).map(printed).join(",")})`;
    case "named": return e.name;
    default: return "";
  }
}

export const print = (e: Expr): string => printed(nodeOf(e));

const isIf = (n: Node) => n.e.kind === "call" && n.e.name === "IF" && (n.kids.length === 2 || n.kids.length === 3);

// The next part to work out: leftmost innermost, IF's condition before it.
function next(n: Node): Node | null {
  if (n.text !== undefined) return null;
  if (whole(n.e)) return n;
  for (const k of isIf(n) ? n.kids.slice(0, 1) : n.kids) {
    const found = next(k);
    if (found) return found;
  }
  return n;
}

// `formula` (what follows its '=') printed, then after each step. A parse
// error is thrown, as parse() throws it.
export function evaluationSteps(formula: string, env: Env, names: Names = () => null, formulas?: Formulas): string[] {
  const root = nodeOf(parse(formula, names, formulas));
  const steps = [printed(root)];
  for (let n = next(root); n; n = next(root)) {
    if (isIf(n)) {
      // The condition as the evaluator reads it: a number, not 0.
      let yes: boolean | CellError;
      try {
        yes = toNumber(evaluate(n.kids[0].e, env)) !== 0;
      } catch (err) {
        if (!(err instanceof CellError)) throw err;
        yes = err;
      }
      const taken = yes === true ? n.kids[1] : n.kids[2];
      if (yes instanceof CellError) n.text = yes.code;
      else if (taken) Object.assign(n, { e: taken.e, kids: taken.kids, text: taken.text });
      else n.text = "FALSE";
    } else {
      n.text = literal(evaluate(n.e, env));
    }
    steps.push(printed(root));
  }
  return steps;
}
