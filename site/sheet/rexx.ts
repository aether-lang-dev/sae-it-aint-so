// "RexxJS formulas": the sheet's other language, as the Tauri spreadsheet
// (RexxJS/example-app-spreadsheet) has it. A formula is a RexxJS expression
// (=A1 + B1, =UPPER(A2) || '!', =A2 |> LOWER, =B2 > 500), worked out as
// `LET CELLRESULT = ...` on one interpreter whose unset variables that name
// cells read the sheet; a sheet's setup script (LET TAX_RATE = 0.08) runs on
// it first. The app's range functions (its public/lib/spreadsheet-functions
// .js) are here in TypeScript: SUM_RANGE("A1:A3") and friends, and CELL.
// Another sheet's cell is a variable, Costs_B2 (the app's Sheet.A1 is a
// RexxJS compound variable, so sae takes _), and its ranges are strings,
// SUM_RANGE("Costs!B1:B3").
import { addrOf, keyOf, parseRange, qualified, range, sheetPrefix } from "./address.ts";
import type { Env, Formula, Formulas, Language, Names, Tables } from "./language.ts";
import { aggregate, groupBy, pluck, queryOf, result, where } from "./query.ts";
import type { Query } from "./query.ts";
import { array } from "./values.ts";
import type { Addr } from "./address.ts";
import type { Edit } from "./shift.ts";
import { RexxInterpreter, parse } from "./rexxjs.js";
import { CellError } from "./values.ts";
import type { Result, Value } from "./values.ts";
import { colName } from "./address.ts";
import { sparkline } from "./charts.ts";

// A cell name, or a range of two, anywhere in a formula (in a string too:
// SUM_RANGE("A1:A3") reads A1 to A3), perhaps on another sheet
// ("Costs!B1:B3", "'My Costs'!B1"). $ is the app's, for copying.
const SHEET = "(?:([A-Za-z_]\\w*)|'([^']+)')!";
const REFS = new RegExp(`(?<![\\w$!])(?:${SHEET})?\\$?([A-Za-z]+)\\$?(\\d+)(?:\\s*:\\s*\\$?([A-Za-z]+)\\$?(\\d+))?(?![\\w(])`, "g");
const REWRITE = new RegExp(`(?<![\\w$!])(${SHEET})?(\\$?)([A-Za-z]+)(\\$?)(\\d+)(?::(\\$?)([A-Za-z]+)(\\$?)(\\d+))?(?![\\w(])`, "g");
// Another sheet's cell as a variable: Costs_B2 (the last _ splits it). Only
// an unset variable is read so, so a setup script's RATE_Q1 is its own.
const SHEET_CELL = /^(\w+)_([A-Za-z]+\d+)$/;

const lastLine = (e: unknown): string => String((e as Error)?.message ?? e).split("\n").pop()!;

// A named LAMBDA as RexxJS formulas read one: LAMBDA(a, b, body), its
// body a RexxJS expression, or statements (lines, or clauses split by ';')
// that LET RESULT, as a formula's statements do. IF() works out only the
// branch it takes, so one can call itself: IF(n < 2, 1, n * FACT(n - 1)).
// Its parts, or why it is not one.
export function lambdaOf(text: string): { params: string[]; body: string; statements: boolean } | string {
  const m = /^\s*LAMBDA\s*\(([\s\S]*)\)\s*$/i.exec(text);
  if (!m) return "a named formula in RexxJS formulas is a LAMBDA: =LAMBDA(x, x * 2)";
  const params: string[] = [];
  let rest = m[1];
  for (let p = /^\s*([A-Za-z_]\w*)\s*,/.exec(rest); p; p = /^\s*([A-Za-z_]\w*)\s*,/.exec(rest)) {
    if (addrOf(p[1])) return `a LAMBDA's names are not cells: ${p[1]}`;
    params.push(p[1]);
    rest = rest.slice(p[0].length);
  }
  const body = rest.trim();
  if (!body) return "a LAMBDA needs a body after its names";
  // Statements: lines, or a LET, SELECT, DO, or IF ... THEN (IF(...) is
  // the function).
  const statements = body.includes("\n") || /^(LET|SELECT|DO)\b/i.test(body) || (/^IF\b/i.test(body) && /\bTHEN\b/i.test(body));
  try {
    parse(statements ? body : `LET CELLRESULT = ${body}`);
  } catch (e) {
    return lastLine(e);
  }
  return { params, body, statements };
}

// The functions a formula calls that are named LAMBDAs, and those they call.
function lambdasIn(formula: string, formulas: Formulas | undefined, seen = new Set<string>()): string[] {
  for (const m of formula.matchAll(/([A-Za-z_]\w*)\s*\(/g)) {
    const name = m[1].toUpperCase(), text = formulas?.(name);
    if (text === null || text === undefined || seen.has(name)) continue;
    seen.add(name);
    const l = lambdaOf(text);
    if (typeof l !== "string") lambdasIn(l.body, formulas, seen);
  }
  return [...seen];
}

function readsOf(formula: string, names?: Names, tables?: Tables, formulas?: Formulas): string[] {
  const reads = new Set<string>();
  // What a named LAMBDA's body reads, the formula that calls it reads.
  for (const name of lambdasIn(formula, formulas)) {
    const l = lambdaOf(formulas!(name)!);
    if (typeof l !== "string") for (const k of readsOf(l.body, names, tables)) reads.add(k);
  }
  for (const m of formula.matchAll(REFS)) {
    const sheet = m[1] ?? m[2];
    const a = addrOf(`${m[3]}${m[4]}`);
    if (!a) continue;
    const b = m[5] ? addrOf(`${m[5]}${m[6]}`) : a;
    if (b) for (const k of range(a, b)) reads.add(sheet ? qualified(sheet, k) : k);
  }
  for (const m of formula.matchAll(/(?<![\w$])\w+(?![\w(])/g)) {
    const v = sheetCell(m[0]);
    if (v) reads.add(v);
  }
  // A named range's cells, wherever its name is (bare, or in a string).
  for (const m of formula.matchAll(/[A-Za-z_]\w*/g)) {
    const n = names?.(m[0].toUpperCase()), r = n?.range ?? tables?.(m[0])?.range;
    if (r) for (const k of range(r[0], r[1])) reads.add(n?.sheet ? qualified(n.sheet, k) : k);
  }
  return [...reads];
}

// Costs_B2 as the key COSTS!B2.
function sheetCell(name: string): string | null {
  const m = SHEET_CELL.exec(name), a = m ? addrOf(m[2]) : null;
  return m && a ? qualified(m[1], keyOf(a)) : null;
}

// What the query functions give along a pipe: a query, or rows of values (a
// column, or each group's key beside its aggregate); a cell spills either.
// Each is a class instance, as the app's RangeQuery is: RexxJS passes those
// along a pipe as they are, where it converts plain objects holding arrays.
class Piped {
  readonly q: Query;
  constructor(q: Query) { this.q = q; }
}
class Rows {
  readonly rows: readonly (readonly Value[])[];
  constructor(rows: readonly (readonly Value[])[]) { this.rows = rows; }
}
const rowsOf = (rows: readonly (readonly Value[])[]): Rows => new Rows(rows);
const spilled = (rows: readonly (readonly Value[])[]): Result => {
  const width = Math.max(1, ...rows.map((r) => r.length));
  return rows.length ? array(rows.length, width, rows.flatMap((r) => Array.from({ length: width }, (_, i) => r[i] ?? null))) : null;
};

// A number where RexxJS gives one; text; rows spilled; or the JSON of what
// it built.
function fromRexx(v: unknown): Result {
  if (v === undefined || v === null) return null;
  if (typeof v === "boolean") return v ? 1 : 0;
  if (typeof v === "number" || typeof v === "string") return v;
  if (v instanceof Piped) return spilled(result(v.q));
  if (v instanceof Rows) return spilled(v.rows);
  return JSON.stringify(v);
}

// The numbers among a range's values, as the app reads them (parseFloat).
const numbers = (vs: readonly unknown[]): number[] => vs.map((v) => parseFloat(String(v))).filter((n) => !isNaN(n));
const mean = (ns: readonly number[]) => ns.reduce((s, n) => s + n, 0) / ns.length;
const squares = (ns: readonly number[]) => {
  const m = mean(ns);
  return ns.reduce((s, n) => s + (n - m) ** 2, 0);
};

// SUMIF_RANGE's and COUNTIF_RANGE's ">5", "=10", "<>2".
function criterion(condition: string): (n: number) => boolean {
  const m = /^([><=!]+)(.+)$/.exec(String(condition));
  if (!m) throw new Error('Invalid condition format. Use: ">5", "=10", "<100", etc.');
  const t = parseFloat(m[2]);
  if (isNaN(t)) throw new Error("Condition value must be a number");
  switch (m[1]) {
    case ">": return (n) => n > t;
    case ">=": return (n) => n >= t;
    case "<": return (n) => n < t;
    case "<=": return (n) => n <= t;
    case "=": case "==": return (n) => n === t;
    case "!=": case "<>": return (n) => n !== t;
    default: throw new Error(`Unknown operator: ${m[1]}`);
  }
}

// Gives an interpreter the sheet's functions. RexxJS looks among its
// built-ins before the functions it is given, and has a GROUP_BY of its own
// (over arrays, through an argument converter); the sheet's name wins, so a
// built-in it shadows goes, its converter with it.
export function install(it: RexxInterpreter, functions: Record<string, (...args: any[]) => unknown>): void {
  for (const name of Object.keys(functions)) {
    delete it.builtInFunctions[name];
    delete it.builtInFunctions[`${name}_positional_args_to_named_param_map`];
  }
  Object.assign(it.externalFunctions, functions);
}

// The app's range functions over `read`, a cell's value as RexxJS sees it.
export function rangeFunctions(read: (key: string) => unknown, names: () => Names | undefined = () => undefined,
  tables: () => Tables | undefined = () => undefined): Record<string, (...args: any[]) => unknown> {
  // A range's corners and the keys to read its cells by: "Costs!B1:B3" is
  // on Costs; a name is on its own sheet.
  const located = (ref: string): { r: [Addr, Addr]; key: (k: string) => string } => {
    const m = /^\s*(?:'([^']+)'|([^'!]+))!(.*)$/.exec(String(ref));
    let sheet = m ? (m[1] ?? m[2]).trim() : null;
    let r = sheet !== null ? parseRange(m![3]) : parseRange(String(ref));
    if (!r && sheet === null) {
      const n = names()?.(String(ref).trim().toUpperCase());
      r = n?.range ?? null;
      sheet = n?.sheet ?? null;
    }
    if (!r) throw new Error(`Invalid range: ${ref}`);
    return { r, key: (k) => (sheet !== null ? qualified(sheet, k) : k) };
  };
  const values = (ref: string): unknown[] => {
    const { r, key } = located(ref);
    return [...range(r[0], r[1])].map((k) => read(key(k)));
  };
  // A range as rows of values, and its first column.
  const grid = (r: [Addr, Addr], key: (k: string) => string = (k) => k) => {
    const left = Math.min(r[0].col, r[1].col), right = Math.max(r[0].col, r[1].col);
    const rows: Value[][] = [];
    for (let row = Math.min(r[0].row, r[1].row); row <= Math.max(r[0].row, r[1].row); row++) {
      const line: Value[] = [];
      for (let col = left; col <= right; col++) {
        const v = read(key(keyOf({ col, row })));
        line.push(v === "" ? null : (v as Value));
      }
      rows.push(line);
    }
    return { rows, left };
  };
  const query = (q: unknown, fn: string): Query => {
    if (!(q instanceof Piped)) throw new Error(`${fn} takes a query: RANGE(...) or TABLE(...) |> ${fn}(...)`);
    return q.q;
  };
  const aggregated = (a: number | [string, number][]) => (typeof a === "number" ? a : rowsOf(a));
  return {
    SUM_RANGE: (r: string) => numbers(values(r)).reduce((s, n) => s + n, 0),
    AVERAGE_RANGE: (r: string) => {
      const ns = numbers(values(r));
      return ns.length ? mean(ns) : 0;
    },
    COUNT_RANGE: (r: string) => values(r).filter((v) => v !== "" && v !== null && v !== undefined).length,
    MIN_RANGE: (r: string) => {
      const ns = numbers(values(r));
      return ns.length ? Math.min(...ns) : 0;
    },
    MAX_RANGE: (r: string) => {
      const ns = numbers(values(r));
      return ns.length ? Math.max(...ns) : 0;
    },
    MEDIAN_RANGE: (r: string) => {
      const ns = numbers(values(r)).sort((x, y) => x - y);
      if (!ns.length) return 0;
      const mid = Math.floor(ns.length / 2);
      return ns.length % 2 ? ns[mid] : (ns[mid - 1] + ns[mid]) / 2;
    },
    STDEV_RANGE: (r: string) => {
      const ns = numbers(values(r));
      return ns.length < 2 ? 0 : Math.sqrt(squares(ns) / (ns.length - 1));
    },
    STDEVP_RANGE: (r: string) => {
      const ns = numbers(values(r));
      return ns.length ? Math.sqrt(squares(ns) / ns.length) : 0;
    },
    VAR_RANGE: (r: string) => {
      const ns = numbers(values(r));
      return ns.length < 2 ? 0 : squares(ns) / (ns.length - 1);
    },
    VARP_RANGE: (r: string) => {
      const ns = numbers(values(r));
      return ns.length ? squares(ns) / ns.length : 0;
    },
    PRODUCT_RANGE: (r: string) => {
      const ns = numbers(values(r));
      return ns.length ? ns.reduce((p, n) => p * n, 1) : 0;
    },
    SUMIF_RANGE: (r: string, condition: string) => {
      const ok = criterion(condition);
      return numbers(values(r)).filter(ok).reduce((s, n) => s + n, 0);
    },
    COUNTIF_RANGE: (r: string, condition: string) => {
      const ok = criterion(condition);
      return numbers(values(r)).filter(ok).length;
    },
    CELL: (ref: string) => values(ref)[0],
    // The app's queries (query.ts): RANGE("A1:D9") |> WHERE("amount > 100")
    // |> GROUP_BY("region") |> SUM("amount"). WHERE's condition is RexxJS,
    // worked out on an interpreter of its own a row at a time, each column's
    // name (or column_C) bound to the row's value.
    RANGE: (ref: string) => {
      const { r, key } = located(ref), g = grid(r, key);
      return new Piped(queryOf(g.rows, g.left));
    },
    TABLE: (name: string) => {
      const t = tables()?.(String(name));
      if (!t) throw new Error(`no table ${name}`);
      const g = grid(t.range);
      const rows = t.headers ? g.rows.slice(1) : g.rows;
      return new Piped(queryOf(rows, g.left, t.columns ?? (t.headers ? g.rows[0].map((v) => String(v ?? "")) : null)));
    },
    WHERE: async (q: unknown, condition: string) => {
      const it = new RexxInterpreter(null, { output: () => {} });
      const test = parse(`LET OK = (${condition})`);
      // A name that is no column is an error, not Rexx's unset variable
      // (its own name), which would compare as text.
      let col: (name: string) => Value | undefined = () => undefined;
      it.variableResolver = (name: string) => {
        const v = col(name);
        if (v === undefined) throw new Error(`no column ${name.toLowerCase()}`);
        return v ?? "";
      };
      return new Piped(await where(query(q, "WHERE"), async (c) => {
        col = c;
        await it.run(test);
        const ok = it.getVariable("OK");
        if (ok !== true && ok !== false && ![0, 1, "0", "1"].includes(ok)) throw new Error(`WHERE's condition is not true or false: ${condition}`);
        return ok === true || ok === 1 || ok === "1";
      }));
    },
    PLUCK: (q: unknown, column: string) => rowsOf(pluck(query(q, "PLUCK"), column)),
    GROUP_BY: (q: unknown, column: string) => new Piped(groupBy(query(q, "GROUP_BY"), column)),
    SUM: (q: unknown, column: string) => aggregated(aggregate(query(q, "SUM"), "sum", column)),
    AVG: (q: unknown, column: string) => aggregated(aggregate(query(q, "AVG"), "avg", column)),
    COUNT: (q: unknown) => aggregated(aggregate(query(q, "COUNT"), "count")),
    RESULT: (q: unknown) => rowsOf(result(query(q, "RESULT"))),
    SPARKLINE_RANGE: (r: string) => sparkline(numbers(values(r))),
  };
}

// The app's style functions, for conditional styles: each gives a style
// object, which formats.ts's toStyle turns into what the grid draws.
const STYLE_FUNCTIONS: Record<string, (...args: any[]) => unknown> = {
  STYLE: (...args: unknown[]) => {
    const style: Record<string, unknown> = {};
    for (let i = 0; i + 1 < args.length; i += 2) style[String(args[i])] = args[i + 1];
    return style;
  },
  STYLE_IF: (condition: unknown, yes: unknown, no?: unknown) =>
    condition && condition !== "0" && condition !== 0 ? yes : (no ?? {}),
  BG_COLOR: (c: string) => ({ backgroundColor: c }),
  TEXT_COLOR: (c: string) => ({ color: c }),
  BOLD: () => ({ fontWeight: "bold" }),
  ITALIC: () => ({ fontStyle: "italic" }),
  ALIGN_LEFT: () => ({ textAlign: "left" }),
  ALIGN_CENTER: () => ({ textAlign: "center" }),
  ALIGN_RIGHT: () => ({ textAlign: "right" }),
  MERGE_STYLES: (...styles: unknown[]) => Object.assign({}, ...styles.map((s) => (typeof s === "string" ? JSON.parse(s) : s))),
  RED_TEXT: () => ({ color: "#d32f2f" }),
  GREEN_TEXT: () => ({ color: "#388e3c" }),
  BLUE_TEXT: () => ({ color: "#1976d2" }),
  ORANGE_TEXT: () => ({ color: "#f57c00" }),
  RED_BG: () => ({ backgroundColor: "#ffebee" }),
  GREEN_BG: () => ({ backgroundColor: "#e8f5e9" }),
  BLUE_BG: () => ({ backgroundColor: "#e3f2fd" }),
  YELLOW_BG: () => ({ backgroundColor: "#fff9c4" }),
  ORANGE_BG: () => ({ backgroundColor: "#ffe0b2" }),
};

// How deep named LAMBDAs may call named LAMBDAs before the formula is #NUM!.
const DEPTH = 200;

export class RexxLanguage implements Language {
  readonly name = "RexxJS";
  readonly #functions: Record<string, (...args: any[]) => unknown> = {
    ...rangeFunctions((k) => this.#read(k), () => this.#names, () => this.#tables), ...STYLE_FUNCTIONS,
  };
  readonly #it: any;
  #env: Env | null = null;
  #names: Names | undefined;
  #tables: Tables | undefined;
  #formulas: Formulas | undefined;
  #errorRead: CellError | null = null;
  #depth = 0;
  // A named LAMBDA's body, parsed once.
  readonly #parsed = new Map<string, unknown>();

  constructor() {
    this.#it = this.#interpreter();
    // A named LAMBDA is a function too, looked up as it is called.
    const own = this.#it.externalFunctions;
    this.#it.externalFunctions = new Proxy(own, {
      get: (t, p) => (typeof p !== "string" || p in t ? t[p as string] : this.#lambda(p)),
    });
  }

  // An interpreter whose unset variables that name cells read them (a
  // named range's name reads its cell, or its cells' values), with the
  // app's functions; SETCELL is a script's (a formula only reads).
  #interpreter(): any {
    const it = new RexxInterpreter(null, { output: () => {} });
    it.variableResolver = (name: string) => {
      if (addrOf(name)) return this.#read(keyOf(addrOf(name)!));
      const other = sheetCell(name);
      if (other) return this.#read(other);
      const n = this.#names?.(name.toUpperCase());
      if (!n) return undefined;
      const vs = [...range(n.range[0], n.range[1])].map((k) => this.#read(n.sheet ? qualified(n.sheet, k) : k));
      return vs.length === 1 ? vs[0] : vs;
    };
    install(it, {
      ...this.#functions,
      SETCELL: () => {
        throw new Error("SETCELL changes the sheet: run it in a script, not a formula");
      },
    });
    return it;
  }

  // A named LAMBDA as a function, or undefined when `name` names none. Each
  // call works out its body on an interpreter of its own, its names bound
  // to the values given (in any case), the sheet, the setup script's
  // variables and every function as the formula has them; what it gives
  // is what its body comes to (RESULT, for statements).
  #lambda(name: string): ((...args: unknown[]) => Promise<unknown>) | undefined {
    const text = this.#formulas?.(name.toUpperCase());
    if (text === null || text === undefined) return undefined;
    return async (...args: unknown[]) => {
      const fail = (code: "#ERROR!" | "#VALUE!" | "#NUM!", why: string): never => {
        this.#errorRead ??= new CellError(code, why);
        throw new Error(why);
      };
      const l = lambdaOf(text);
      if (typeof l === "string") return fail("#ERROR!", `${name.toUpperCase()}: ${l}`);
      if (args.length !== l.params.length) fail("#VALUE!", `${name.toUpperCase()} takes ${l.params.length} values, given ${args.length}`);
      if (this.#depth >= DEPTH) fail("#NUM!", `LAMBDAs call LAMBDAs more than ${DEPTH} deep`);
      const source = l.statements ? l.body : `LET CELLRESULT = ${l.body}`;
      if (!this.#parsed.has(source)) this.#parsed.set(source, parse(source));
      const it = this.#interpreter(), main = this.#it;
      const resolve = it.variableResolver;
      it.variableResolver = (v: string) => resolve(v) ?? main.variables.get(v);
      it.externalFunctions = main.externalFunctions;
      l.params.forEach((p, i) => {
        for (const n of new Set([p, p.toUpperCase(), p.toLowerCase()])) it.variables.set(n, args[i]);
      });
      this.#depth++;
      try {
        await it.run(this.#parsed.get(source));
      } finally {
        this.#depth--;
      }
      return it.variables.get(l.statements ? "RESULT" : "CELLRESULT");
    };
  }

  // A cell's value as RexxJS sees it: '' for an empty one, a number or
  // text; an error read is remembered, and is the formula's value.
  #read(key: string): unknown {
    const v = this.#env?.get(key) ?? null;
    if (v instanceof CellError) {
      this.#errorRead ??= v;
      return "";
    }
    if (v === null) return "";
    if (typeof v === "boolean") return v ? 1 : 0;
    const n = typeof v === "string" ? parseFloat(v) : NaN;
    return typeof v === "string" && !isNaN(n) && String(n) === v.trim() ? n : v;
  }

  // The sheet's setup script, run once on the interpreter: what it LETs,
  // every formula can read. Null, or why it failed.
  async setup(script: string): Promise<string | null> {
    if (!script.trim()) return null;
    try {
      await this.#it.run(parse(script));
      return null;
    } catch (e) {
      return String((e as Error)?.message ?? e);
    }
  }

  compile(formula: string, names?: Names, tables?: Tables, formulas?: Formulas): Formula {
    const statements = /^\s*LET\b/i.test(formula) || formula.includes("\n");
    let commands: unknown;
    try {
      commands = parse(statements ? formula : `LET CELLRESULT = ${formula}`);
    } catch (e) {
      return { kind: "broken", error: new CellError("#ERROR!", lastLine(e)) };
    }
    return {
      kind: "formula",
      reads: readsOf(formula, names, tables, formulas),
      run: async (env) => {
        this.#env = env;
        this.#names = names;
        this.#tables = tables;
        this.#formulas = formulas;
        this.#errorRead = null;
        try {
          await this.#it.run(commands);
          if (this.#errorRead) return this.#errorRead;
          return fromRexx(this.#it.getVariable(statements ? "RESULT" : "CELLRESULT"));
        } catch (e) {
          return this.#errorRead ?? new CellError("#ERROR!", lastLine(e));
        } finally {
          this.#env = null;
        }
      },
    };
  }

  // The app's copy rule, for every edit: every cell name, and range, is
  // rewritten, in strings too; $ fixes a part in a copy. (Costs_B2 is a
  // variable, and stays as written.)
  rewrite(input: string, edit: Edit): string {
    if (!input.startsWith("=")) return input;
    const name = (to: Addr, fixCol: string, fixRow: string) => `${fixCol}${colName(to.col)}${fixRow}${to.row + 1}`;
    return input.replace(REWRITE, (text, prefix: string | undefined, bare: string | undefined, quoted: string | undefined,
      fc1: string, c1: string, fr1: string, r1: string, fc2?: string, c2?: string, fr2?: string, r2?: string) => {
      const sheet = bare ?? quoted;
      if (!edit.moves(sheet ? sheet.toUpperCase() : null)) return text;
      const p = prefix ?? "";
      const a = addrOf(`${c1}${r1}`);
      if (c2 === undefined) {
        const to = a ? edit.cell(a, { col: !!fc1, row: !!fr1 }) : null;
        return to ? (to.col === a!.col && to.row === a!.row ? text : p + name(to, fc1, fr1)) : "#REF!";
      }
      const b = addrOf(`${c2}${r2}`);
      const r = a && b ? edit.range(a, b, { col: !!fc1, row: !!fr1 }, { col: !!fc2, row: !!fr2 }) : null;
      return r ? `${p}${name(r[0], fc1, fr1)}:${name(r[1], fc2!, fr2!)}` : "#REF!";
    });
  }

  // References to sheet `from` naming `to`: Costs!B2 and 'Costs'!B2, in
  // strings too, and the variable form Costs_B2, which cannot name a sheet
  // with a space (null).
  renamed(input: string, from: string, to: string): string | null {
    if (!input.startsWith("=")) return input;
    let impossible = false;
    const out = input.replace(REWRITE, (text, prefix: string | undefined, bare: string | undefined, quoted: string | undefined) =>
      prefix && (bare ?? quoted)!.toUpperCase() === from ? sheetPrefix(to) + text.slice(prefix.length) : text,
    ).replace(/\b([A-Za-z]\w*)_([A-Za-z]+\d+)\b/g, (text, sheet: string, cell: string) => {
      if (sheet.toUpperCase() !== from) return text;
      if (!/^[A-Za-z]\w*$/.test(to)) impossible = true;
      return `${to}_${cell}`;
    });
    return impossible ? null : out;
  }

  functions(): readonly string[] {
    return Object.keys(this.#functions).sort();
  }

  // Cell names and ranges anywhere in a formula (in strings too), in order.
  references(formula: string): string[] {
    const out = [...formula.matchAll(REFS)].map((m) => {
      const sheet = m[1] ?? m[2], cell = `${m[3]}${m[4]}`.toUpperCase(), to = m[5] ? `:${m[5]}${m[6]}`.toUpperCase() : "";
      return `${sheet ? `${sheet.toUpperCase()}!` : ""}${cell}${to}`;
    });
    return [...new Set(out)];
  }
}
