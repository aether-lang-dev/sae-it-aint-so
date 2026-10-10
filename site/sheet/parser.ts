// Recursive descent over the lexer's tokens into an Expr, a discriminated
// union. Binary operators climb a precedence table, loosest first, as a
// spreadsheet ranks them: comparisons, then &, then + -, then * /, then ^,
// each left-associative; a unary minus binds tighter than all of them
// (-2^2 is 4). A parse error is a FormulaError at the token it stopped on.
import { FormulaError, tokens } from "./lexer.ts";
import type { Op, Token } from "./lexer.ts";

export type Expr =
  | { readonly kind: "num"; readonly value: number }
  | { readonly kind: "str"; readonly value: string }
  | { readonly kind: "bool"; readonly value: boolean }
  | { readonly kind: "ref"; readonly name: string }
  | { readonly kind: "range"; readonly from: string; readonly to: string }
  | { readonly kind: "neg"; readonly arg: Expr }
  | { readonly kind: "binary"; readonly op: Op; readonly left: Expr; readonly right: Expr }
  | { readonly kind: "call"; readonly name: string; readonly args: readonly Expr[] };

const LEVELS: readonly (readonly Op[])[] = [
  ["=", "<>", "<", ">", "<=", ">="],
  ["&"],
  ["+", "-"],
  ["*", "/"],
  ["^"],
];

const shown = (t: Token): string => (t.kind === "end" ? "the end" : `'${t.text}'`);

class Parser {
  readonly #tokens: Iterator<Token, void, undefined>;
  #tok!: Token;

  constructor(formula: string) {
    this.#tokens = tokens(formula);
    this.#next();
  }

  #next(): Token {
    const was = this.#tok;
    const r = this.#tokens.next();
    if (!r.done) this.#tok = r.value;
    return was;
  }

  #expect(kind: Token["kind"]): Token {
    if (this.#tok.kind !== kind) throw new FormulaError(this.#tok.at, `expected '${kind}' but found ${shown(this.#tok)}`);
    return this.#next();
  }

  whole(): Expr {
    const e = this.#binary(0);
    if (this.#tok.kind !== "end") throw new FormulaError(this.#tok.at, `unexpected ${shown(this.#tok)}`);
    return e;
  }

  #binary(level: number): Expr {
    if (level === LEVELS.length) return this.#unary();
    let left = this.#binary(level + 1);
    for (let t = this.#tok; t.kind === "op" && LEVELS[level].includes(t.op); t = this.#tok) {
      this.#next();
      left = { kind: "binary", op: t.op, left, right: this.#binary(level + 1) };
    }
    return left;
  }

  #unary(): Expr {
    const t = this.#tok;
    if (t.kind === "op" && (t.op === "-" || t.op === "+")) {
      this.#next();
      const arg = this.#unary();
      return t.op === "-" ? { kind: "neg", arg } : arg;
    }
    return this.#primary();
  }

  #primary(): Expr {
    const t = this.#next();
    switch (t.kind) {
      case "num": return { kind: "num", value: t.value };
      case "str": return { kind: "str", value: t.value };
      case "ref": {
        if (this.#tok.kind !== ":") return { kind: "ref", name: t.name };
        this.#next();
        const to = this.#tok;
        if (to.kind !== "ref") throw new FormulaError(to.at, `expected a cell after ':' but found ${shown(to)}`);
        this.#next();
        return { kind: "range", from: t.name, to: to.name };
      }
      case "name": {
        if (this.#tok.kind !== "(") {
          if (t.name === "TRUE" || t.name === "FALSE") return { kind: "bool", value: t.name === "TRUE" };
          throw new FormulaError(t.at, `unknown name '${t.text}'`);
        }
        this.#next();
        const args: Expr[] = [];
        if (this.#tok.kind !== ")") {
          args.push(this.#binary(0));
          while (this.#tok.kind === ",") {
            this.#next();
            args.push(this.#binary(0));
          }
        }
        this.#expect(")");
        return { kind: "call", name: t.name, args };
      }
      case "(": {
        const e = this.#binary(0);
        this.#expect(")");
        return e;
      }
      default:
        throw new FormulaError(t.at, `expected a value but found ${shown(t)}`);
    }
  }
}

// `formula` is what follows the '='.
export const parse = (formula: string): Expr => new Parser(formula).whole();
