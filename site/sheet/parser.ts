// Recursive descent over the lexer's tokens into an Expr, a discriminated
// union. Binary operators climb a precedence table, loosest first, as a
// spreadsheet ranks them: comparisons, then &, then + -, then * /, then ^,
// each left-associative; a unary minus binds tighter than all of them
// (-2^2 is 4). A parse error is a FormulaError at the token it stopped on.
// LET and LAMBDA bind names: the parser keeps their scopes, so a bound name
// is a local, and anything else bare a named range, a named formula (or
// #NAME?); a call of a named formula's name calls what it comes to.
import { FormulaError, tokens } from "./lexer.ts";
import type { Op, Token } from "./lexer.ts";
import type { ErrorCode } from "./values.ts";
import { keyOf, splitKey } from "./address.ts";
import type { Addr } from "./address.ts";
import type { Formulas, Names } from "./language.ts";

export type Expr =
  | { readonly kind: "num"; readonly value: number }
  | { readonly kind: "str"; readonly value: string }
  | { readonly kind: "bool"; readonly value: boolean }
  | { readonly kind: "ref"; readonly name: string }
  | { readonly kind: "range"; readonly from: string; readonly to: string }
  | { readonly kind: "spill"; readonly name: string }
  // An array constant, {1,2;3,4}: rows split by ';', each a row's values.
  | { readonly kind: "array"; readonly rows: number; readonly cols: number; readonly values: readonly ArrayItem[] }
  | { readonly kind: "error"; readonly code: ErrorCode; readonly why?: string }
  | { readonly kind: "neg"; readonly arg: Expr }
  | { readonly kind: "binary"; readonly op: Op; readonly left: Expr; readonly right: Expr }
  | { readonly kind: "call"; readonly name: string; readonly args: readonly Expr[] }
  // An argument left out: XLOOKUP(25, E1:H1, E2:H2, , -1).
  | { readonly kind: "missing" }
  // A name LET or LAMBDA bound; LET(x, 1, y, x+1, x*y); LAMBDA(x, x*2);
  // a call of what an expression comes to, LAMBDA(x, x*2)(5) or f(5).
  | { readonly kind: "local"; readonly name: string }
  | { readonly kind: "let"; readonly bindings: readonly (readonly [string, Expr])[]; readonly body: Expr }
  | { readonly kind: "lambda"; readonly params: readonly string[]; readonly body: Expr }
  | { readonly kind: "apply"; readonly fn: Expr; readonly args: readonly Expr[] }
  // A named formula (a named LAMBDA): parsed when it is first worked out,
  // so one that calls itself is not parsed for ever.
  | { readonly kind: "named"; readonly name: string; readonly expr: () => Expr };

// A value of an array constant: an error is tagged, so "#N/A" in quotes
// stays text.
export type ArrayItem = number | string | boolean | { readonly error: ErrorCode };

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
  #ahead: Token | null = null;
  readonly #scopes: Set<string>[] = [];

  readonly #names: Names | undefined;
  readonly #formulas: Formulas;

  constructor(formula: string, names?: Names, formulas: Formulas = () => null) {
    this.#tokens = tokens(formula);
    this.#names = names;
    this.#formulas = formulas;
    this.#next();
  }

  #next(): Token {
    const was = this.#tok;
    if (this.#ahead) {
      this.#tok = this.#ahead;
      this.#ahead = null;
      return was;
    }
    const r = this.#tokens.next();
    if (!r.done) this.#tok = r.value;
    return was;
  }

  // The token after this one, not yet taken.
  #peek(): Token {
    if (!this.#ahead) {
      const r = this.#tokens.next();
      this.#ahead = r.done ? this.#tok : r.value;
    }
    return this.#ahead;
  }

  #bound(name: string): boolean {
    return this.#scopes.some((s) => s.has(name));
  }

  // A function's arguments, from '(' to ')'; one left out is missing.
  #args(): Expr[] {
    this.#expect("(");
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
    return args;
  }

  // What an expression comes to, called: f(1)(2) as often as written.
  #applied(fn: Expr): Expr {
    while (this.#tok.kind === "(") fn = { kind: "apply", fn, args: this.#args() };
    return fn;
  }

  // The names a LET or LAMBDA binds: each a name followed by ',' (a cell
  // there is refused); `each` parses what follows a name, if anything.
  #binding(what: string, each: (name: string) => void): void {
    for (;;) {
      const t = this.#tok;
      if (this.#peek().kind !== "," || (t.kind !== "name" && t.kind !== "ref")) return;
      if (t.kind === "ref") throw new FormulaError(t.at, `${what} are names, not cells: ${t.text}`);
      this.#next();
      this.#next();
      each((t as { name: string }).name);
    }
  }

  // LET(name, value, ..., body): each value sees the names before it.
  #let(at: number): Expr {
    this.#expect("(");
    const scope = new Set<string>(), bindings: [string, Expr][] = [];
    this.#scopes.push(scope);
    try {
      this.#binding("LET's names", (name) => {
        const value = this.#binary(0);
        if (this.#tok.kind !== ",") throw new FormulaError(at, "LET needs a name, its value, and then the value it comes to");
        this.#next();
        bindings.push([name, value]);
        scope.add(name);
      });
      if (!bindings.length) throw new FormulaError(at, "LET needs a name, its value, and then the value it comes to");
      const body = this.#binary(0);
      this.#expect(")");
      return { kind: "let", bindings, body };
    } finally {
      this.#scopes.pop();
    }
  }

  // LAMBDA(param, ..., body).
  #lambda(): Expr {
    this.#expect("(");
    const params: string[] = [];
    this.#binding("LAMBDA's parameters", (name) => params.push(name));
    this.#scopes.push(new Set(params));
    try {
      const body = this.#binary(0);
      this.#expect(")");
      return { kind: "lambda", params, body };
    } finally {
      this.#scopes.pop();
    }
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

  // A named formula by its name, or null when there is none.
  #named(name: string): Expr | null {
    const text = this.#formulas(name);
    if (text === null) return null;
    const names = this.#names, formulas = this.#formulas;
    let expr: Expr | null = null;
    return {
      kind: "named", name, expr: () => {
        if (!expr) {
          try {
            expr = new Parser(text, names, formulas).whole();
          } catch (e) {
            if (!(e instanceof FormulaError)) throw e;
            expr = { kind: "error", code: "#ERROR!", why: `${name}: parse error at ${e.at}: ${e.message}` };
          }
        }
        return expr;
      },
    };
  }

  // An array constant after its '{': numbers (a minus before one), text,
  // TRUE, FALSE and errors, ',' between columns and ';' between rows, every
  // row as long; no references or formulas, as in Excel.
  #array(at: number): Expr {
    const rows: ArrayItem[][] = [[]];
    for (;;) {
      const t = this.#next();
      const minus = t.kind === "op" && t.op === "-";
      const v = minus ? this.#next() : t;
      if (v.kind === "num") rows[rows.length - 1].push(minus ? -v.value : v.value);
      else if (minus) throw new FormulaError(v.at, `expected a number after '-' but found ${shown(v)}`);
      else if (v.kind === "str") rows[rows.length - 1].push(v.value);
      else if (v.kind === "error") rows[rows.length - 1].push({ error: v.code });
      else if (v.kind === "name" && (v.name === "TRUE" || v.name === "FALSE")) rows[rows.length - 1].push(v.name === "TRUE");
      else throw new FormulaError(v.at, `an array constant holds numbers, text, TRUE, FALSE or errors, not ${shown(v)}`);
      const sep = this.#next();
      if (sep.kind === "}") break;
      if (sep.kind === ";") rows.push([]);
      else if (sep.kind !== ",") throw new FormulaError(sep.at, `expected ',', ';' or '}' but found ${shown(sep)}`);
    }
    const cols = rows[0].length;
    if (rows.some((r) => r.length !== cols)) throw new FormulaError(at, "an array constant's rows differ in length");
    return { kind: "array", rows: rows.length, cols, values: rows.flat() };
  }

  #primary(): Expr {
    const t = this.#next();
    switch (t.kind) {
      case "num": return { kind: "num", value: t.value };
      case "str": return { kind: "str", value: t.value };
      case "error": return { kind: "error", code: t.code };
      case "ref": {
        if (t.spill) return { kind: "spill", name: t.name };
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
        const local = this.#bound(t.name);
        if (this.#tok.kind !== "(") {
          if (local) return { kind: "local", name: t.name };
          if (t.name === "TRUE" || t.name === "FALSE") return { kind: "bool", value: t.name === "TRUE" };
          // A named range is its cell or range; with no names to ask, a bare
          // name does not parse.
          if (!this.#names) throw new FormulaError(t.at, `unknown name '${t.text}'`);
          const r = this.#names(t.name);
          if (!r) return this.#named(t.name) ?? { kind: "error", code: "#NAME?", why: `no name ${t.name}` };
          const on = (a: Addr) => (r.sheet ? `${r.sheet}!${keyOf(a)}` : keyOf(a));
          const [a, b] = [on(r.range[0]), on(r.range[1])];
          return a === b ? { kind: "ref", name: a } : { kind: "range", from: a, to: b };
        }
        if (local) return this.#applied({ kind: "local", name: t.name });
        if (t.name === "LET") return this.#applied(this.#let(t.at));
        if (t.name === "LAMBDA") return this.#applied(this.#lambda());
        const named = this.#named(t.name);
        if (named) return this.#applied(named);
        return { kind: "call", name: t.name, args: this.#args() };
      }
      case "{":
        return this.#array(t.at);
      case "(": {
        const e = this.#binary(0);
        this.#expect(")");
        return this.#applied(e);
      }
      default:
        throw new FormulaError(t.at, `expected a value but found ${shown(t)}`);
    }
  }
}

// `formula` is what follows the '='; `names`, the sheet's named ranges;
// `formulas`, its named formulas.
export const parse = (formula: string, names?: Names, formulas?: Formulas): Expr => new Parser(formula, names, formulas).whole();
