// A formula's tokens, one at a time, from a generator. Each knows where it
// starts (1-based, counting the formula's leading '=') so an error can say
// "at 8" of what the person typed.
export type Op = "+" | "-" | "*" | "/" | "^" | "&" | "=" | "<>" | "<" | ">" | "<=" | ">=";

export type Token = (
  | { readonly kind: "num"; readonly value: number }
  | { readonly kind: "str"; readonly value: string }
  | { readonly kind: "ref"; readonly name: string }
  | { readonly kind: "name"; readonly name: string }
  | { readonly kind: "op"; readonly op: Op }
  | { readonly kind: "(" | ")" | "," | ":" }
  | { readonly kind: "end" }
) & { readonly at: number; readonly text: string };

export class FormulaError extends Error {
  readonly at: number;

  constructor(at: number, message: string) {
    super(message);
    this.at = at;
  }
}

const OPS: readonly Op[] = ["<>", "<=", ">=", "+", "-", "*", "/", "^", "&", "=", "<", ">"];
const NUMBER = /^(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?/;
const WORD = /^[A-Za-z_][A-Za-z0-9_]*/;
const REF = /^[A-Za-z]+[0-9]+$/;

// `formula` is what follows the '='; `from` is where it starts in the input.
export function* tokens(formula: string, from = 2): Generator<Token, void, undefined> {
  let i = 0;
  while (i < formula.length) {
    const rest = formula.slice(i), at = from + i, c = formula[i];
    if (c === " ") { i++; continue; }
    const num = NUMBER.exec(rest)?.[0];
    if (num) {
      yield { kind: "num", value: Number(num), at, text: num };
      i += num.length;
      continue;
    }
    const word = WORD.exec(rest)?.[0];
    if (word) {
      const upper = word.toUpperCase();
      yield REF.test(word) ? { kind: "ref", name: upper, at, text: word } : { kind: "name", name: upper, at, text: word };
      i += word.length;
      continue;
    }
    if (c === '"') {
      let j = i + 1, value = "";
      for (;;) {
        if (j >= formula.length) throw new FormulaError(at, "a string that never ends");
        if (formula[j] === '"') {
          if (formula[j + 1] !== '"') break;
          j++;
        }
        value += formula[j++];
      }
      yield { kind: "str", value, at, text: formula.slice(i, j + 1) };
      i = j + 1;
      continue;
    }
    if (c === "(" || c === ")" || c === "," || c === ":") {
      yield { kind: c, at, text: c };
      i++;
      continue;
    }
    const op = OPS.find((o) => rest.startsWith(o));
    if (op) {
      yield { kind: "op", op, at, text: op };
      i += op.length;
      continue;
    }
    throw new FormulaError(at, `unexpected '${c}'`);
  }
  yield { kind: "end", at: from + formula.length, text: "" };
}
