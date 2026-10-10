// How a formula's Expr is worked out against the sheet's cells. Values,
// errors and coercions are values.ts; the functions are functions.ts.
import { addrOf, range } from "./address.ts";
import type { Expr } from "./parser.ts";
import { call, single } from "./functions.ts";
import type { Arg } from "./functions.ts";
import { CellError, compare, fail, finite, toNumber, toText } from "./values.ts";
import type { Value } from "./values.ts";

export interface Env {
  get(key: string): Value;
}

class Evaluator {
  readonly #env: Env;

  constructor(env: Env) {
    this.#env = env;
  }

  // A function's argument: a range's cells and width, or one value. An
  // error is passed on as a value, for IFERROR and ISERROR to see.
  #arg(e: Expr): Arg {
    if (e.kind === "range") {
      const a = addrOf(e.from), b = addrOf(e.to);
      if (!a || !b) return fail("#REF!", `${a ? e.to : e.from} is not on the sheet`);
      return { values: [...range(a, b)].map((k) => this.#env.get(k)), cols: Math.abs(a.col - b.col) + 1 };
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
        return call(e.name, e.args.map((a) => this.#arg(a)));
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
