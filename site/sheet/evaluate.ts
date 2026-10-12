// How a formula's Expr is worked out against the sheet's cells. Values,
// errors and coercions are values.ts; the functions are functions.ts. LET's
// and LAMBDA's names live in scopes here; a LAMBDA is a closure, a value
// only while a formula is worked out (one that comes to a LAMBDA is #CALC!).
import { cellAddr, span } from "./address.ts";
import type { Expr } from "./parser.ts";
import { call, single } from "./functions.ts";
import type { Arg } from "./functions.ts";
import { CellError, compare, fail, finite, toNumber, toText } from "./values.ts";
import type { Value } from "./values.ts";

export interface Env {
  get(key: string): Value;
}

interface Closure {
  readonly kind: "lambda";
  readonly params: readonly string[];
  readonly body: Expr;
  readonly scope: Scope;
}

// What a name in scope stands for.
type Bound = Value | Closure;
type Scope = ReadonlyMap<string, Bound>;

const isClosure = (v: Bound): v is Closure => typeof v === "object" && v !== null && !(v instanceof CellError);

class Evaluator {
  readonly #env: Env;
  #scope: Scope = new Map();

  constructor(env: Env) {
    this.#env = env;
  }

  // `e` in `scope`, the scope put back after.
  #within<T>(scope: Scope, work: () => T): T {
    const was = this.#scope;
    this.#scope = scope;
    try {
      return work();
    } finally {
      this.#scope = was;
    }
  }

  // Anything an expression comes to: a value, or a closure.
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
      case "apply": {
        const fn = this.any(e.fn);
        if (!isClosure(fn)) return fail("#VALUE!", "only a LAMBDA can be called");
        if (e.args.length !== fn.params.length) return fail("#VALUE!", `LAMBDA takes ${fn.params.length} values, given ${e.args.length}`);
        const scope = new Map(fn.scope);
        fn.params.forEach((p, i) => scope.set(p, this.any(e.args[i])));
        return this.#within(scope, () => this.any(fn.body));
      }
      default:
        return this.value(e);
    }
  }

  // A function's argument: a range's cells and width, or one value. An
  // error is passed on as a value, for IFERROR and ISERROR to see.
  #arg(e: Expr): Arg {
    if (e.kind === "missing") return { values: [], cols: 0 };
    if (e.kind === "range") {
      const s = span(e.from, e.to);
      if (!s) return fail("#REF!", `${cellAddr(e.from) ? e.to : e.from} is not on the sheet`);
      return { values: s.keys.map((k) => this.#env.get(k)), cols: s.cols };
    }
    try {
      return single(this.value(e));
    } catch (err) {
      if (err instanceof CellError) return single(err);
      throw err;
    }
  }

  value(e: Expr): Value {
    switch (e.kind) {
      case "num":
      case "str":
      case "bool":
        return e.value;
      case "ref":
        return cellAddr(e.name) ? this.#env.get(e.name) : fail("#REF!", `${e.name} is not on the sheet`);
      case "missing":
        return null;
      case "local":
      case "let":
      case "lambda":
      case "apply": {
        const v = this.any(e);
        return isClosure(v) ? fail("#VALUE!", "a LAMBDA where a value goes") : v;
      }
      case "error":
        return fail(e.code, e.why ?? (e.code === "#REF!" ? "a reference moved off the sheet" : "written in the formula"));
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
        return call(e.name, e.args.map((a) => this.#arg(a)));
      }
      default:
        throw new TypeError(`unknown expression: ${JSON.stringify(e satisfies never)}`);
    }
  }
}

export function evaluate(e: Expr, env: Env): Value {
  try {
    const v = new Evaluator(env).any(e);
    return isClosure(v) ? new CellError("#CALC!", "a formula's value is a LAMBDA: call it") : v;
  } catch (err) {
    if (err instanceof CellError) return err;
    throw err;
  }
}
