// The sheet: what each cell was given, what it came to, and who reads whom.
// Setting cells recomputes them and everything downstream, in dependency
// order, once each, however many cells were set together (a paste). A cell
// on a cycle comes to #CYCLE!, and what reads it inherits the error. The
// sheet tells a listener which cells now show something else; it never draws.
// What a formula means is its Language's (the sheet's major setting, Excel
// or RexxJS); evaluation may be asynchronous, so setting cells is a promise,
// and two settings take turns.
import { addrOf, keyOf, order } from "./address.ts";
import { CellError } from "./values.ts";
import type { Value } from "./values.ts";
import { EXCEL } from "./excel.ts";
import type { Formula, Language, Names } from "./language.ts";
import type { Addr } from "./address.ts";
import { show } from "./format.ts";

export interface SheetListener {
  changed(key: string, value: Value): void;
}

export interface Problem {
  readonly key: string;
  readonly message: string;
}

// What a cell's input compiles to: a formula (or a parse error) in the
// sheet's language, or a constant.
export type Compiled = Formula | { readonly kind: "constant"; readonly value: Value };

const NUMERIC = /^\s*[-+]?(?:\d+\.?\d*|\.\d+)(?:[eE][-+]?\d+)?\s*$/;

export function compile(input: string, language: Language = EXCEL, names?: Names): Compiled {
  if (input.startsWith("=")) return language.compile(input.slice(1), names);
  if (input === "") return { kind: "constant", value: null };
  return { kind: "constant", value: NUMERIC.test(input) ? Number(input) : input };
}

const getOrAdd = <K, V>(m: Map<K, V>, k: K, make: () => V): V => {
  let v = m.get(k);
  if (v === undefined) m.set(k, (v = make()));
  return v;
};

const HISTORY = 100;   // undo steps kept, as the Tauri spreadsheet keeps

const byOrder = (a: string, b: string): number => order(addrOf(a)!) - order(addrOf(b)!);

export class Sheet {
  readonly #inputs = new Map<string, string>();
  readonly #compiled = new Map<string, Compiled>();
  readonly #values = new Map<string, Value>();
  readonly #reads = new Map<string, Set<string>>();     // a cell -> the cells it reads
  readonly #readBy = new Map<string, Set<string>>();    // a cell -> the cells that read it
  readonly #listener: SheetListener | undefined;
  #language: Language;
  #turn: Promise<unknown> = Promise.resolve();
  #busy = false;
  readonly #names = new Map<string, [Addr, Addr]>();
  // Each step is the inputs a change replaced, to put back.
  readonly #undo: (readonly [string, string][])[] = [];
  readonly #redo: (readonly [string, string][])[] = [];

  constructor(listener?: SheetListener, language: Language = EXCEL) {
    this.#listener = listener;
    this.#language = language;
  }

  get language(): Language { return this.#language; }

  // Working the sheet out now: a formula is running (so whatever it calls
  // must not wait for the sheet to change, which waits for it).
  get busy(): boolean { return this.#busy; }

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

  set(key: string, input: string): Promise<string[]> {
    return this.setMany([[key, input]]);
  }

  // Set several cells, then recompute once. Gives the keys whose shown value
  // changed, in sheet order (the listener heard each of them). A key off the
  // sheet is refused before anything is set.
  setMany(entries: Iterable<readonly [string, string]>): Promise<string[]> {
    const list = [...entries].map(([k, input]): [string, string] => {
      const a = addrOf(k);
      if (!a) throw new RangeError(`${k} is not a cell on the sheet`);
      return [keyOf(a), input];
    });
    return this.#inTurn(() => {
      this.#remember(this.#undo, list);
      this.#redo.length = 0;
      return this.#apply(list);
    });
  }

  get canUndo(): boolean { return this.#undo.length > 0; }
  get canRedo(): boolean { return this.#redo.length > 0; }

  // The last change taken back (its inputs put back, and the sheet worked
  // out), or done again. Each gives the keys whose shown value changed.
  undo(): Promise<string[]> { return this.#inTurn(() => this.#step(this.#undo, this.#redo)); }
  redo(): Promise<string[]> { return this.#inTurn(() => this.#step(this.#redo, this.#undo)); }

  // No history: a file opened is where undo stops.
  forget(): void {
    this.#undo.length = 0;
    this.#redo.length = 0;
  }

  async #step(from: (readonly [string, string][])[], to: (readonly [string, string][])[]): Promise<string[]> {
    const step = from.pop();
    if (!step) return [];
    this.#remember(to, step);
    return this.#apply(step);
  }

  // The inputs `list` is about to replace, once per key, as one step.
  #remember(stack: (readonly [string, string][])[], list: readonly (readonly [string, string])[]): void {
    const before = new Map<string, string>();
    for (const [key] of list) if (!before.has(key)) before.set(key, this.input(key));
    stack.push([...before]);
    if (stack.length > HISTORY) stack.shift();
  }

  #apply(list: readonly (readonly [string, string])[]): Promise<string[]> {
    for (const [key, input] of list) {
      if (input === "") this.#inputs.delete(key); else this.#inputs.set(key, input);
      this.#compile(key);
    }
    return this.#recompute(list.map(([key]) => key));
  }

  // Another language (the major setting): every formula compiled again in
  // it, and the whole sheet worked out again.
  setLanguage(language: Language): Promise<string[]> {
    return this.#inTurn(() => {
      this.#language = language;
      return this.#recomputeAll();
    });
  }

  // An expression in the sheet's language, worked out against the sheet
  // (a conditional style): its value, or the error it came to.
  evaluate(formula: string): Promise<Value> {
    return this.#inTurn(async () => {
      const f = this.#language.compile(formula, (n) => this.#names.get(n) ?? null);
      return f.kind === "broken" ? f.error : (await f.run({ get: (k) => this.value(k) })) ?? null;
    });
  }

  // The named ranges, by name: [NAME, "B2:B4"].
  names(): [string, string][] {
    return [...this.#names].sort(([x], [y]) => (x < y ? -1 : 1)).map(([n, [a, b]]) => [n, keyOf(a) === keyOf(b) ? keyOf(a) : `${keyOf(a)}:${keyOf(b)}`]);
  }

  name(n: string): [Addr, Addr] | null {
    return this.#names.get(n.toUpperCase()) ?? null;
  }

  // A name for a range defined (or redefined), or deleted (null): every
  // formula compiled again, as any may read it.
  define(n: string, r: [Addr, Addr] | null): Promise<string[]> {
    return this.#inTurn(() => {
      if (r) this.#names.set(n.toUpperCase(), r); else this.#names.delete(n.toUpperCase());
      return this.#recomputeAll();
    });
  }

  // Everything worked out again, as after a language's setup script ran.
  recalculate(): Promise<string[]> {
    return this.#inTurn(() => this.#recomputeAll());
  }

  #recomputeAll(): Promise<string[]> {
    const keys = this.keys();
    keys.forEach((k) => this.#compile(k));
    return this.#recompute(keys);
  }

  #compile(key: string): void {
    const c = compile(this.input(key), this.#language, (n) => this.#names.get(n) ?? null);
    this.#compiled.set(key, c);
    this.#link(key, new Set(c.kind === "formula" ? c.reads : []));
  }

  // One change at a time: a language's evaluation may be asynchronous, and
  // RexxJS's holds one interpreter.
  #inTurn<T>(work: () => Promise<T>): Promise<T> {
    const done = this.#turn.then(async () => {
      this.#busy = true;
      try {
        return await work();
      } finally {
        this.#busy = false;
      }
    });
    this.#turn = done.catch(() => {});
    return done;
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

  async #recompute(set: readonly string[]): Promise<string[]> {
    const before = new Map<string, string>();
    const affected = this.#downstream(set);
    for (const k of affected) before.set(k, show(this.value(k)));

    const { ordered, left } = this.#ordered(affected);
    for (const k of ordered) await this.#evaluate(k);
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
      for (const k of this.#ordered(rest).ordered) await this.#evaluate(k);
    }

    const changed = [...affected].filter((k) => set.includes(k) || before.get(k) !== show(this.value(k))).sort(byOrder);
    for (const k of changed) this.#listener?.changed(k, this.value(k));
    return changed;
  }

  async #evaluate(key: string): Promise<void> {
    const c = this.#compiled.get(key);
    let v: Value = null;
    if (c?.kind === "formula") v = (await c.run({ get: (k) => this.value(k) })) ?? 0;
    else if (c?.kind === "broken") v = c.error;
    else if (c?.kind === "constant") v = c.value;
    if (v === null && !this.#inputs.has(key)) this.#values.delete(key); else this.#values.set(key, v);
  }
}

