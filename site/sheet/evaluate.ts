// What a cell holds once worked out, and how a formula's Expr is worked out.
// An error is a value too (a CellError): it flows through whatever reads it,
// so a cell that sums a #DIV/0! shows #DIV/0!.
import { addrOf, range } from "./address.ts";
import type { Expr } from "./parser.ts";

export type ErrorCode = "#DIV/0!" | "#VALUE!" | "#REF!" | "#NAME?" | "#CYCLE!" | "#ERROR!";

export class CellError {
  readonly code: ErrorCode;
  readonly why: string;

  constructor(code: ErrorCode, why: string) {
    this.code = code;
    this.why = why;
  }

  toString(): string { return this.code; }
}

// null is an empty cell.
export type Value = number | string | boolean | null | CellError;

export interface Env {
  get(key: string): Value;
}

const fail = (code: ErrorCode, why: string): never => { throw new CellError(code, why); };

// The checks a formula's operands go through; an error operand is rethrown.
function scalar(v: Value): Exclude<Value, CellError> {
  if (v instanceof CellError) throw v;
  return v;
}

export function toNumber(v: Value): number {
  const s = scalar(v);
  if (s === null) return 0;
  if (typeof s === "number") return s;
  if (typeof s === "boolean") return s ? 1 : 0;
  const n = s.trim() === "" ? NaN : Number(s);
  return Number.isNaN(n) ? fail("#VALUE!", `'${s}' is not a number`) : n;
}

export function toText(v: Value): string {
  const s = scalar(v);
  if (s === null) return "";
  if (typeof s === "boolean") return s ? "TRUE" : "FALSE";
  return typeof s === "number" ? String(Number(s.toPrecision(12))) : s;
}

const finite = (n: number): number => (Number.isFinite(n) ? n : fail("#VALUE!", "the result is not a finite number"));

function compare(op: string, a: Value, b: Value): boolean {
  const x = scalar(a), y = scalar(b);
  const numeric = (v: typeof x) => v === null || typeof v === "number" || typeof v === "boolean";
  const d = numeric(x) && numeric(y)
    ? toNumber(x) - toNumber(y)
    : toText(x).toUpperCase().localeCompare(toText(y).toUpperCase());
  switch (op) {
    case "=": return d === 0;
    case "<>": return d !== 0;
    case "<": return d < 0;
    case ">": return d > 0;
    case "<=": return d <= 0;
    default: return d >= 0;
  }
}

// A function's arguments, each a list: a range gives its cells, anything
// else one value.
type Fn = (args: readonly Value[][]) => Value;

const numbers = (args: readonly Value[][]): number[] =>
  args.flat().map(scalar).filter((v): v is number => typeof v === "number");
const one = (name: string, args: readonly Value[][], count: number): Value[] =>
  args.length === count && args.every((a) => a.length === 1)
    ? args.map((a) => a[0])
    : fail("#VALUE!", `${name} takes ${count} value${count === 1 ? "" : "s"}`);

export const functions: ReadonlyMap<string, Fn> = new Map<string, Fn>([
  ["SUM", (args) => numbers(args).reduce((s, n) => s + n, 0)],
  ["AVERAGE", (args) => {
    const ns = numbers(args);
    return ns.length ? ns.reduce((s, n) => s + n, 0) / ns.length : fail("#DIV/0!", "AVERAGE of no numbers");
  }],
  ["MIN", (args) => { const ns = numbers(args); return ns.length ? Math.min(...ns) : 0; }],
  ["MAX", (args) => { const ns = numbers(args); return ns.length ? Math.max(...ns) : 0; }],
  ["COUNT", (args) => numbers(args).length],
  ["ABS", (args) => Math.abs(toNumber(one("ABS", args, 1)[0]))],
  ["ROUND", (args) => {
    const [x, digits] = one("ROUND", args, 2).map(toNumber);
    const f = 10 ** Math.trunc(digits);
    return Math.round(x * f) / f;
  }],
  ["CONCAT", (args) => args.flat().map(toText).join("")],
  ["LEN", (args) => toText(one("LEN", args, 1)[0]).length],
]);

class Evaluator {
  readonly #env: Env;

  constructor(env: Env) {
    this.#env = env;
  }

  // Every cell a range names, or #REF! when a corner is off the sheet.
  #cells(from: string, to: string): Value[] {
    const a = addrOf(from), b = addrOf(to);
    if (!a || !b) return fail("#REF!", `${a ? to : from} is not on the sheet`);
    return [...range(a, b)].map((k) => this.#env.get(k));
  }

  #args(e: Expr): Value[] {
    return e.kind === "range" ? this.#cells(e.from, e.to) : [this.value(e)];
  }

  value(e: Expr): Value {
    switch (e.kind) {
      case "num":
      case "str":
      case "bool":
        return e.value;
      case "ref":
        return addrOf(e.name) ? this.#env.get(e.name) : fail("#REF!", `${e.name} is not on the sheet`);
      case "range":
        return fail("#VALUE!", `${e.from}:${e.to} is a range where one value goes`);
      case "neg":
        return -toNumber(this.value(e.arg));
      case "binary": {
        const a = this.value(e.left), b = this.value(e.right);
        switch (e.op) {
          case "+": return finite(toNumber(a) + toNumber(b));
          case "-": return finite(toNumber(a) - toNumber(b));
          case "*": return finite(toNumber(a) * toNumber(b));
          case "/": return toNumber(b) === 0 ? fail("#DIV/0!", "divide by zero") : finite(toNumber(a) / toNumber(b));
          case "^": return finite(toNumber(a) ** toNumber(b));
          case "&": return toText(a) + toText(b);
          default: return compare(e.op, a, b);
        }
      }
      case "call": {
        if (e.name === "IF") {
          // Only the branch taken is worked out: IF(B1=0, 0, A1/B1) is safe.
          if (e.args.length < 2 || e.args.length > 3) return fail("#VALUE!", "IF takes 2 or 3 values");
          const pick = toNumber(this.value(e.args[0])) !== 0 ? e.args[1] : e.args[2];
          return pick ? this.value(pick) : false;
        }
        const fn = functions.get(e.name);
        return fn ? fn(e.args.map((a) => this.#args(a))) : fail("#NAME?", `no function ${e.name}`);
      }
      default:
        throw new TypeError(`unknown expression: ${JSON.stringify(e satisfies never)}`);
    }
  }
}

export function evaluate(e: Expr, env: Env): Value {
  try {
    return new Evaluator(env).value(e);
  } catch (err) {
    if (err instanceof CellError) return err;
    throw err;
  }
}
