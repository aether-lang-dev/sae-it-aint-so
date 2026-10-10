// The sheet: what each cell was given, what it came to, and who reads whom.
// Setting cells recomputes them and everything downstream, in dependency
// order, once each, however many cells were set together (a paste). A cell
// on a cycle comes to #CYCLE!, and what reads it inherits the error. The
// sheet tells a listener which cells now show something else; it never draws.
import { addrOf, keyOf, order, range } from "./address.ts";
import type { Addr } from "./address.ts";
import { CellError, evaluate } from "./evaluate.ts";
import type { Value } from "./evaluate.ts";
import { FormulaError } from "./lexer.ts";
import { parse } from "./parser.ts";
import type { Expr } from "./parser.ts";
import { show } from "./format.ts";

export interface SheetListener {
  changed(key: string, value: Value): void;
}

export interface Problem {
  readonly key: string;
  readonly message: string;
}

// What a cell's input compiles to: a formula, a parse error, or a constant.
type Compiled =
  | { readonly kind: "formula"; readonly expr: Expr }
  | { readonly kind: "broken"; readonly error: CellError }
  | { readonly kind: "constant"; readonly value: Value };

const NUMERIC = /^\s*[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?\s*$/;

export function compile(input: string): Compiled {
  if (input.startsWith("=")) {
    try {
      return { kind: "formula", expr: parse(input.slice(1)) };
    } catch (e) {
      if (!(e instanceof FormulaError)) throw e;
      return { kind: "broken", error: new CellError("#ERROR!", `parse error at ${e.at}: ${e.message}`) };
    }
  }
  if (input === "") return { kind: "constant", value: null };
  return { kind: "constant", value: NUMERIC.test(input) ? Number(input) : input };
}

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

// Tab-separated rows, as a clipboard holds them, placed with their first
// cell at `at`; what falls off the sheet is dropped.
export function pasted(tsv: string, at: Addr): [string, string][] {
  return tsv.replace(/\r/g, "").replace(/\n+$/, "").split("\n").flatMap((line, r) =>
    line.split("\t").map((input, c): [Addr, string] => [{ col: at.col + c, row: at.row + r }, input.trim()]))
    .filter(([a]) => addrOf(keyOf(a)) !== null)
    .map(([a, input]) => [keyOf(a), input]);
}

const getOrAdd = <K, V>(m: Map<K, V>, k: K, make: () => V): V => {
  let v = m.get(k);
  if (v === undefined) m.set(k, (v = make()));
  return v;
};

const byOrder = (a: string, b: string): number => order(addrOf(a)!) - order(addrOf(b)!);

export class Sheet {
  readonly #inputs = new Map<string, string>();
  readonly #compiled = new Map<string, Compiled>();
  readonly #values = new Map<string, Value>();
  readonly #reads = new Map<string, Set<string>>();     // a cell -> the cells it reads
  readonly #readBy = new Map<string, Set<string>>();    // a cell -> the cells that read it
  readonly #listener: SheetListener | undefined;

  constructor(listener?: SheetListener) {
    this.#listener = listener;
  }

  input(key: string): string { return this.#inputs.get(key) ?? ""; }
  value(key: string): Value { return this.#values.get(key) ?? null; }

  // The cells holding something, in sheet order.
  keys(): string[] { return [...this.#inputs.keys()].sort(byOrder); }

  // Every cell whose value is an error, in sheet order.
  problems(): Problem[] {
    return [...this.#values].filter(([, v]) => v instanceof CellError).map(([k]) => k).sort(byOrder)
      .map((key) => {
        const e = this.#values.get(key) as CellError;
        return { key, message: `${e.code} ${e.why}` };
      });
  }

  set(key: string, input: string): string[] {
    return this.setMany([[key, input]]);
  }

  // Set several cells, then recompute once. Returns the keys whose shown
  // value changed, in sheet order (the listener heard each of them).
  setMany(entries: Iterable<readonly [string, string]>): string[] {
    const set: string[] = [];
    for (const [k, input] of entries) {
      const a = addrOf(k);
      if (!a) throw new RangeError(`${k} is not a cell on the sheet`);
      const key = keyOf(a);
      if (input === "") this.#inputs.delete(key); else this.#inputs.set(key, input);
      const c = compile(input);
      this.#compiled.set(key, c);
      this.#link(key, c.kind === "formula" ? new Set(refsOf(c.expr)) : new Set());
      set.push(key);
    }
    return this.#recompute(set);
  }

  #link(key: string, reads: Set<string>): void {
    for (const old of this.#reads.get(key) ?? []) this.#readBy.get(old)?.delete(key);
    this.#reads.set(key, reads);
    for (const r of reads) getOrAdd(this.#readBy, r, () => new Set()).add(key);
  }

  // The set cells and everything downstream of them.
  #downstream(from: readonly string[]): Set<string> {
    const seen = new Set<string>();
    const visit = (k: string): void => {
      if (seen.has(k)) return;
      seen.add(k);
      this.#readBy.get(k)?.forEach(visit);
    };
    from.forEach(visit);
    return seen;
  }

  // Kahn's algorithm over the cells in `cells`, by the reads among them:
  // the ones it can order, and the ones left (on a cycle, or downstream of
  // one).
  #ordered(cells: Set<string>): { ordered: string[]; left: Set<string> } {
    const waiting = new Map<string, number>();
    for (const k of cells) waiting.set(k, [...(this.#reads.get(k) ?? [])].filter((r) => cells.has(r)).length);
    const ready = [...cells].filter((k) => waiting.get(k) === 0).sort(byOrder);
    const ordered: string[] = [];
    for (let k = ready.shift(); k !== undefined; k = ready.shift()) {
      ordered.push(k);
      for (const d of this.#readBy.get(k) ?? []) {
        if (!cells.has(d)) continue;
        const n = waiting.get(d)! - 1;
        waiting.set(d, n);
        if (n === 0) ready.push(d);
      }
    }
    const done = new Set(ordered);
    return { ordered, left: new Set([...cells].filter((k) => !done.has(k))) };
  }

  // A cell in `left` is on a cycle when it reads its way back to itself.
  #cycleThrough(start: string, left: Set<string>): string[] | null {
    const path: string[] = [];
    const seen = new Set<string>();
    const walk = (k: string): boolean => {
      path.push(k);
      for (const r of this.#reads.get(k) ?? []) {
        if (r === start) return true;
        if (left.has(r) && !seen.has(r)) {
          seen.add(r);
          if (walk(r)) return true;
        }
      }
      path.pop();
      return false;
    };
    return walk(start) ? path : null;
  }

  #recompute(set: readonly string[]): string[] {
    const before = new Map<string, string>();
    const affected = this.#downstream(set);
    for (const k of affected) before.set(k, show(this.value(k)));

    const { ordered, left } = this.#ordered(affected);
    for (const k of ordered) this.#evaluate(k);
    if (left.size > 0) {
      const onCycle = new Set<string>();
      for (const k of left) {
        const path = this.#cycleThrough(k, left);
        if (!path) continue;
        onCycle.add(k);
        this.#values.set(k, new CellError("#CYCLE!", `a circular reference: ${[...path, k].join(" → ")}`));
      }
      // What is downstream of a cycle reads its error, in order.
      const rest = new Set([...left].filter((k) => !onCycle.has(k)));
      for (const k of this.#ordered(rest).ordered) this.#evaluate(k);
    }

    const changed = [...affected].filter((k) => set.includes(k) || before.get(k) !== show(this.value(k))).sort(byOrder);
    for (const k of changed) this.#listener?.changed(k, this.value(k));
    return changed;
  }

  #evaluate(key: string): void {
    const c = this.#compiled.get(key);
    let v: Value = null;
    if (c?.kind === "formula") v = evaluate(c.expr, { get: (k) => this.value(k) }) ?? 0;
    else if (c?.kind === "broken") v = c.error;
    else if (c?.kind === "constant") v = c.value;
    if (v === null && !this.#inputs.has(key)) this.#values.delete(key); else this.#values.set(key, v);
  }
}

