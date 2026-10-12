// "RexxJS formulas": the sheet's other language, as the Tauri spreadsheet
// (RexxJS/example-app-spreadsheet) has it. A formula is a RexxJS expression
// (=A1 + B1, =UPPER(A2) || '!', =A2 |> LOWER, =B2 > 500), worked out as
// `LET CELLRESULT = ...` on one interpreter whose unset variables that name
// cells read the sheet; a sheet's setup script (LET TAX_RATE = 0.08) runs on
// it first. The app's range functions (its public/lib/spreadsheet-functions
// .js) are here in TypeScript: SUM_RANGE("A1:A3") and friends, and CELL.
import { addrOf, keyOf, range } from "./address.ts";
import type { Env, Formula, Language } from "./language.ts";
import type { Addr } from "./address.ts";
import type { Edit } from "./shift.ts";
import { RexxInterpreter, parse } from "./rexxjs.js";
import { CellError } from "./values.ts";
import type { Value } from "./values.ts";
import { colName } from "./address.ts";

// A cell name, or a range of two, anywhere in a formula (in a string too:
// SUM_RANGE("A1:A3") reads A1 to A3). $ is the app's, for copying.
const REFS = /(?<![\w$])\$?([A-Za-z]+)\$?(\d+)(?:\s*:\s*\$?([A-Za-z]+)\$?(\d+))?(?![\w(])/g;
const REWRITE = /(?<![\w$])(\$?)([A-Za-z]+)(\$?)(\d+)(?::(\$?)([A-Za-z]+)(\$?)(\d+))?(?![\w(])/g;

const lastLine = (e: unknown): string => String((e as Error)?.message ?? e).split("\n").pop()!;

function readsOf(formula: string): string[] {
  const reads = new Set<string>();
  for (const m of formula.matchAll(REFS)) {
    const a = addrOf(`${m[1]}${m[2]}`);
    if (!a) continue;
    const b = m[3] ? addrOf(`${m[3]}${m[4]}`) : a;
    if (b) for (const k of range(a, b)) reads.add(k);
  }
  return [...reads];
}

// A number where RexxJS gives one; text, or the JSON of what it built.
function fromRexx(v: unknown): Value {
  if (v === undefined || v === null) return null;
  if (typeof v === "boolean") return v ? 1 : 0;
  if (typeof v === "number" || typeof v === "string") return v;
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

// The app's range functions over `read`, a cell's value as RexxJS sees it.
export function rangeFunctions(read: (key: string) => unknown): Record<string, (...args: any[]) => unknown> {
  const values = (ref: string): unknown[] => {
    const [from, to = from] = String(ref).split(":");
    const a = addrOf(from), b = addrOf(to);
    if (!a || !b) throw new Error(`Invalid range: ${ref}`);
    return [...range(a, b)].map(read);
  };
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

export class RexxLanguage implements Language {
  readonly name = "RexxJS";
  readonly #it: any;
  readonly #functions: Record<string, (...args: any[]) => unknown>;
  #env: Env | null = null;
  #errorRead: CellError | null = null;

  constructor() {
    this.#it = new RexxInterpreter(null, { output: () => {} });
    // An unset variable that names a cell reads it.
    this.#it.variableResolver = (name: string) => (addrOf(name) ? this.#read(keyOf(addrOf(name)!)) : undefined);
    this.#functions = { ...rangeFunctions((k) => this.#read(k)), ...STYLE_FUNCTIONS };
    Object.assign(this.#it.externalFunctions, this.#functions, {
      // A formula only reads: scripts change cells (script.ts).
      SETCELL: () => {
        throw new Error("SETCELL changes the sheet: run it in a script, not a formula");
      },
    });
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

  compile(formula: string): Formula {
    const statements = /^\s*LET\b/i.test(formula) || formula.includes("\n");
    let commands: unknown;
    try {
      commands = parse(statements ? formula : `LET CELLRESULT = ${formula}`);
    } catch (e) {
      return { kind: "broken", error: new CellError("#ERROR!", lastLine(e)) };
    }
    return {
      kind: "formula",
      reads: readsOf(formula),
      run: async (env) => {
        this.#env = env;
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
  // rewritten, in strings too; $ fixes a part in a copy.
  rewrite(input: string, edit: Edit): string {
    if (!input.startsWith("=")) return input;
    const name = (to: Addr, fixCol: string, fixRow: string) => `${fixCol}${colName(to.col)}${fixRow}${to.row + 1}`;
    return input.replace(REWRITE, (text, fc1: string, c1: string, fr1: string, r1: string, fc2?: string, c2?: string, fr2?: string, r2?: string) => {
      const a = addrOf(`${c1}${r1}`);
      if (c2 === undefined) {
        const to = a ? edit.cell(a, { col: !!fc1, row: !!fr1 }) : null;
        return to ? (to.col === a!.col && to.row === a!.row ? text : name(to, fc1, fr1)) : "#REF!";
      }
      const b = addrOf(`${c2}${r2}`);
      const r = a && b ? edit.range(a, b, { col: !!fc1, row: !!fr1 }, { col: !!fc2, row: !!fr2 }) : null;
      return r ? `${name(r[0], fc1, fr1)}:${name(r[1], fc2!, fr2!)}` : "#REF!";
    });
  }

  functions(): readonly string[] {
    return Object.keys(this.#functions).sort();
  }
}
