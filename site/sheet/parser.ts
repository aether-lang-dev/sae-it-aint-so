// Recursive descent over the lexer's tokens into an Expr, a discriminated
// union. Binary operators climb a precedence table, loosest first, as a
// spreadsheet ranks them: comparisons, then &, then + -, then * /, then ^,
// each left-associative; a unary minus binds tighter than all of them
// (-2^2 is 4). A parse error is a FormulaError at the token it stopped on.
import { FormulaError, tokens } from "./lexer.ts";
import type { Op, Token } from "./lexer.ts";
import type { ErrorCode } from "./values.ts";
import { keyOf, splitKey } from "./address.ts";
import type { Names } from "./language.ts";

export type Expr =
  | { readonly kind: "num"; readonly value: number }
  | { readonly kind: "str"; readonly value: string }
  | { readonly kind: "bool"; readonly value: boolean }
  | { readonly kind: "ref"; readonly name: string }
  | { readonly kind: "range"; readonly from: string; readonly to: string }
  | { readonly kind: "error"; readonly code: ErrorCode; readonly why?: string }
  | { readonly kind: "neg"; readonly arg: Expr }
  | { readonly kind: "binary"; readonly op: Op; readonly left: Expr; readonly right: Expr }
  | { readonly kind: "call"; readonly name: string; readonly args: readonly Expr[] }
  // An argument left out: XLOOKUP(25, E1:H1, E2:H2, , -1).
  | { readonly kind: "missing" };

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

  readonly #names: Names | undefined;

  constructor(formula: string, names?: Names) {
    this.#tokens = tokens(formula);
    this.#names = names;
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
      case "error": return { kind: "error", code: t.code };
      case "ref": {
        if (this.#tok.kind !== ":") return { kind: "ref", name: t.name };
        this.#next();
        const to = this.#tok;
        if (to.kind !== "ref") throw new FormulaError(to.at, `expected a cell after ':' but found ${shown(to)}`);
        this.#next();
        // Costs!B1:B3 is all on Costs.
        const sheet = splitKey(t.name).sheet, other = splitKey(to.name);
        if (other.sheet !== null && other.sheet !== sheet) throw new FormulaError(to.at, "a range on two sheets");
        return { kind: "range", from: t.name, to: sheet === null ? other.cell : `${sheet}!${other.cell}` };
      }
      case "name": {
        if (this.#tok.kind !== "(") {
          if (t.name === "TRUE" || t.name === "FALSE") return { kind: "bool", value: t.name === "TRUE" };
          // A named range is its cell or range; with no names to ask, a bare
          // name does not parse.
          if (!this.#names) throw new FormulaError(t.at, `unknown name '${t.text}'`);
          const r = this.#names(t.name);
          if (!r) return { kind: "error", code: "#NAME?", why: `no name ${t.name}` };
          const [a, b] = [keyOf(r[0]), keyOf(r[1])];
          return a === b ? { kind: "ref", name: a } : { kind: "range", from: a, to: b };
        }
        this.#next();
        const args: Expr[] = [];
        const arg = (): Expr => (this.#tok.kind === "," || this.#tok.kind === ")" ? { kind: "missing" } : this.#binary(0));
        if (this.#tok.kind !== ")") {
          args.push(arg());
          while (this.#tok.kind === ",") {
            this.#next();
            args.push(arg());
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

// `formula` is what follows the '='; `names`, the sheet's named ranges.
export const parse = (formula: string, names?: Names): Expr => new Parser(formula, names).whole();
