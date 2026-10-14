// How a formula's Expr is worked out against the sheet's cells. Values,
// errors and coercions are values.ts; the functions are functions.ts.
//
// A result may be a dynamic array (values.ts): a range, or an operator over
// one, worked out cell by cell (a row or a column broadcast across the
// other's, #N/A where one runs out), IF over one, or a function that gives
// one (SEQUENCE, FILTER ...). LET's and LAMBDA's names live in scopes here;
// a LAMBDA is a closure, a value only while a formula is worked out (one
// that comes to a LAMBDA is #CALC!), and MAP, REDUCE, SCAN, BYROW, BYCOL and
// MAKEARRAY call one: they are special forms here, as IF is.
import { cellAddr, span } from "./address.ts";
import type { Expr } from "./parser.ts";
import { call, single } from "./functions.ts";
import type { Arg } from "./functions.ts";
import { CellError, array, collapsed, compare, fail, finite, isArray, toNumber, toText } from "./values.ts";
import type { ArrayValue, Result, Value } from "./values.ts";
import type { Op } from "./lexer.ts";

// The forms worked out here rather than by the library (IF is listed there).
export const SPECIAL_FORMS: readonly string[] = ["LET", "LAMBDA", "MAP", "REDUCE", "SCAN", "BYROW", "BYCOL", "MAKEARRAY"];

export interface Env {
  get(key: string): Value;
  // What a cell spills (A1#), or null when it spills nothing.
  spill?(key: string): ArrayValue | null;
}

interface Closure {
  readonly kind: "lambda";
  readonly params: readonly string[];
  readonly body: Expr;
  readonly scope: Scope;
}

// What a name in scope stands for.
type Bound = Result | Closure;
type Scope = ReadonlyMap<string, Bound>;

const isClosure = (v: Bound): v is Closure => typeof v === "object" && v !== null && (v as Closure).kind === "lambda";

// One operator on two values.
function operate(op: Op, a: Value, b: Value): Value {
  switch (op) {
    case "+": return finite(toNumber(a) + toNumber(b));
    case "-": return finite(toNumber(a) - toNumber(b));
    case "*": return finite(toNumber(a) * toNumber(b));
    case "/": return toNumber(b) === 0 ? fail("#DIV/0!", "divide by zero") : finite(toNumber(a) / toNumber(b));
    case "^": return finite(toNumber(a) ** toNumber(b));
    case "&": return toText(a) + toText(b);
    default: return compare(op, a, b);
  }
}

// `f` over values, or cell by cell over arrays: a one-row (one-column)
// array is broadcast down (across); past an array's end is #N/A; an error
// in a cell is that cell's.
function lift(inputs: readonly Result[], f: (vs: Value[]) => Value): Result {
  if (!inputs.some(isArray)) return f(inputs as Value[]);
  const grids = inputs.filter(isArray);
  const rows = Math.max(...grids.map((g) => g.rows)), cols = Math.max(...grids.map((g) => g.cols));
  const at = (x: Result, i: number, j: number): Value => {
    if (!isArray(x)) return x;
    const r = x.rows === 1 ? 0 : i, c = x.cols === 1 ? 0 : j;
    return r < x.rows && c < x.cols ? x.values[r * x.cols + c] : new CellError("#N/A", "past the end of an array");
  };
  const values: Value[] = [];
  for (let i = 0; i < rows; i++) {
    for (let j = 0; j < cols; j++) {
      try {
        values.push(f(inputs.map((x) => at(x, i, j))));
      } catch (err) {
        if (!(err instanceof CellError)) throw err;
        values.push(err);
      }
    }
  }
  return array(rows, cols, values);
}

const truth = (v: Value): boolean => toNumber(v) !== 0;

// How deep LAMBDAs may call LAMBDAs (a named one calling itself) before
// the formula is #NUM!.
const DEPTH = 200;

class Evaluator {
  readonly #env: Env;
  #scope: Scope = new Map();
  #depth = 0;

  constructor(env: Env) {
    this.#env = env;
  }

  // `work` in `scope`, the scope put back after.
  #within<T>(scope: Scope, work: () => T): T {
    const was = this.#scope;
    this.#scope = scope;
    try {
      return work();
    } finally {
      this.#scope = was;
    }
  }

  // Anything an expression comes to: a value, an array, or a closure.
  any(e: Expr): Bound {
    switch (e.kind) {
      case "local": {
        const v = this.#scope.get(e.name);
        return v === undefined ? fail("#NAME?", `no name ${e.name}`) : v;
      }
      case "let": {
        const scope = new Map(this.#scope);
        return this.#within(scope, () => {
          for (const [name, value] of e.bindings) scope.set(name, this.any(value));
          return this.any(e.body);
        });
      }
      case "lambda":
        return { kind: "lambda", params: e.params, body: e.body, scope: this.#scope };
      // A named formula is worked out in no scope but its own: what it
      // names is the sheet's, not the caller's.
      case "named":
        return this.#within(new Map(), () => this.any(e.expr()));
      case "apply": {
        const fn = this.any(e.fn);
        if (!isClosure(fn)) return fail("#VALUE!", "only a LAMBDA can be called");
        return this.#invoke(fn, e.args.map((a) => this.any(a)));
      }
      default:
        return this.result(e);
    }
  }

  #invoke(fn: Closure, args: readonly Bound[]): Bound {
    if (args.length !== fn.params.length) return fail("#VALUE!", `LAMBDA takes ${fn.params.length} values, given ${args.length}`);
    if (this.#depth >= DEPTH) return fail("#NUM!", `LAMBDAs call LAMBDAs more than ${DEPTH} deep`);
    const scope = new Map(fn.scope);
    fn.params.forEach((p, i) => scope.set(p, args[i]));
    this.#depth++;
    try {
      return this.#within(scope, () => this.any(fn.body));
    } finally {
      this.#depth--;
    }
  }

  // A value or an array: not a closure.
  result(e: Expr): Result {
    switch (e.kind) {
      case "num":
      case "str":
      case "bool":
        return e.value;
      case "ref":
        return cellAddr(e.name) ? this.#env.get(e.name) : fail("#REF!", `${e.name} is not on the sheet`);
      case "spill": {
        const spilt = this.#env.spill?.(e.name);
        if (spilt) return spilt;
        const v = this.#env.get(e.name);
        return v instanceof CellError ? v : fail("#REF!", `${e.name} spills nothing`);
      }
      case "range": {
        const s = span(e.from, e.to);
        if (!s) return fail("#REF!", `${cellAddr(e.from) ? e.to : e.from} is not on the sheet`);
        return array(s.keys.length / s.cols, s.cols, s.keys.map((k) => this.#env.get(k)));
      }
      case "missing":
        return null;
      // An error in an array constant is that cell's value.
      case "array":
        return array(e.rows, e.cols, e.values.map((v) => (typeof v === "object" ? new CellError(v.error, "written in the formula") : v)));
      case "local":
      case "let":
      case "lambda":
      case "apply":
      case "named": {
        const v = this.any(e);
        return isClosure(v) ? fail("#VALUE!", "a LAMBDA where a value goes") : v;
      }
      case "error":
        return fail(e.code, e.why ?? (e.code === "#REF!" ? "a reference moved off the sheet" : "written in the formula"));
      case "neg":
        return lift([this.result(e.arg)], ([x]) => -toNumber(x));
      case "binary":
        return lift([this.result(e.left), this.result(e.right)], ([a, b]) => operate(e.op, a, b));
      case "call":
        return this.#call(e);
      default:
        throw new TypeError(`unknown expression: ${JSON.stringify(e satisfies never)}`);
    }
  }

  // A function's argument: a range's or an array's cells and width, or one
  // value. An error is passed on as a value, for IFERROR and ISERROR to see.
  #arg(e: Expr): Arg {
    if (e.kind === "missing") return { values: [], cols: 0 };
    try {
      const r = this.result(e);
      return isArray(r) ? { values: r.values, cols: r.cols } : single(r);
    } catch (err) {
      if (err instanceof CellError && e.kind !== "range") return single(err);
      throw err;
    }
  }

  #grid(e: Expr): ArrayValue {
    const r = this.result(e);
    return isArray(r) ? r : array(1, 1, [r]);
  }

  #closure(e: Expr, name: string): Closure {
    const f = this.any(e);
    return isClosure(f) ? f : fail("#VALUE!", `${name} takes a LAMBDA last`);
  }

  // What a LAMBDA gave, as one value (an error in it is that value).
  #one(name: string, work: () => Bound): Value {
    try {
      const v = work();
      if (isClosure(v)) return fail("#CALC!", `${name}'s LAMBDA gives a LAMBDA`);
      const c = collapsed(v);
      return isArray(c) ? fail("#CALC!", `${name}'s LAMBDA gives an array`) : c;
    } catch (err) {
      if (!(err instanceof CellError)) throw err;
      return err;
    }
  }

  #call(e: Extract<Expr, { kind: "call" }>): Result {
    const args = e.args;
    const takes = (n: number) => (args.length !== n ? fail("#VALUE!", `${e.name} takes ${n} values`) : null);
    switch (e.name) {
      case "IF": {
        // Only the branch taken is worked out: IF(B1=0, 0, A1/B1) is safe;
        // over an array, cell by cell.
        if (args.length < 2 || args.length > 3) return fail("#VALUE!", "IF takes 2 or 3 values");
        const cond = this.result(args[0]);
        if (isArray(cond)) return lift([cond, this.result(args[1]), args[2] ? this.result(args[2]) : false], ([c, y, n]) => (truth(c) ? y : n));
        const pick = truth(cond) ? args[1] : args[2];
        return pick ? this.result(pick) : false;
      }
      case "MAP": {
        if (args.length < 2) return fail("#VALUE!", "MAP takes an array and a LAMBDA");
        const fn = this.#closure(args[args.length - 1], "MAP"), grids = args.slice(0, -1).map((a) => this.#grid(a));
        if (grids.some((g) => g.rows !== grids[0].rows || g.cols !== grids[0].cols)) return fail("#VALUE!", "MAP's arrays differ in size");
        return array(grids[0].rows, grids[0].cols, grids[0].values.map((_, i) => this.#one("MAP", () => this.#invoke(fn, grids.map((g) => g.values[i])))));
      }
      case "REDUCE":
      case "SCAN": {
        takes(3);
        const fn = this.#closure(args[2], e.name), g = this.#grid(args[1]);
        let acc: Bound = this.result(args[0]);
        const seen: Value[] = [];
        for (const v of g.values) {
          acc = this.#invoke(fn, [acc, v]);
          seen.push(this.#one(e.name, () => acc));
        }
        return e.name === "SCAN" ? array(g.rows, g.cols, seen) : this.#one("REDUCE", () => acc);
      }
      case "BYROW":
      case "BYCOL": {
        takes(2);
        const fn = this.#closure(args[1], e.name), g = this.#grid(args[0]);
        const byRow = e.name === "BYROW";
        const lines = byRow
          ? Array.from({ length: g.rows }, (_, i) => array(1, g.cols, g.values.slice(i * g.cols, (i + 1) * g.cols)))
          : Array.from({ length: g.cols }, (_, j) => array(g.rows, 1, g.values.filter((_, k) => k % g.cols === j)));
        const out = lines.map((line) => this.#one(e.name, () => this.#invoke(fn, [line])));
        return byRow ? array(out.length, 1, out) : array(1, out.length, out);
      }
      case "MAKEARRAY": {
        takes(3);
        const rows = Math.trunc(toNumber(this.#scalar(args[0]))), cols = Math.trunc(toNumber(this.#scalar(args[1])));
        if (rows < 1 || cols < 1) return fail("#CALC!", "MAKEARRAY of no rows or columns");
        const fn = this.#closure(args[2], "MAKEARRAY"), values: Value[] = [];
        for (let i = 1; i <= rows; i++) for (let j = 1; j <= cols; j++) values.push(this.#one("MAKEARRAY", () => this.#invoke(fn, [i, j])));
        return array(rows, cols, values);
      }
      default:
        return call(e.name, args.map((a) => this.#arg(a)));
    }
  }

  #scalar(e: Expr): Value {
    const r = collapsed(this.result(e));
    return isArray(r) ? fail("#VALUE!", "an array where one value goes") : r;
  }
}

// What a formula comes to: a value, or an array (of more than one value).
export function evaluate(e: Expr, env: Env): Result {
  try {
    const v = new Evaluator(env).any(e);
    return isClosure(v) ? new CellError("#CALC!", "a formula's value is a LAMBDA: call it") : collapsed(v);
  } catch (err) {
    if (err instanceof CellError) return err;
    throw err;
  }
}
