// The function library: each function is declared with how many arguments
// it takes, and gets them as Args, a range's cells row by row with the
// range's width (VLOOKUP and INDEX need its shape), or one value. An
// argument that is an error arrives as that error, so IFERROR and ISERROR
// can look at it; everything else rethrows it as soon as it reads it.
import { CellError, compare, fail, finite, scalar, toNumber, toText } from "./values.ts";
import type { Comparison, Value } from "./values.ts";

export interface Arg {
  readonly values: readonly Value[];
  readonly cols: number;
}

export const single = (v: Value): Arg => ({ values: [v], cols: 1 });

type Fn = (args: readonly Arg[]) => Value;

interface Spec {
  readonly min: number;
  readonly max: number;
  readonly fn: Fn;
}

const library = new Map<string, Spec>();

const def = (name: string, min: number, max: number, fn: Fn): void => {
  library.set(name, { min, max, fn });
};

const plural = (n: number) => `${n} value${n === 1 ? "" : "s"}`;
const takes = (min: number, max: number): string =>
  max === min ? plural(min) : max === Infinity ? `at least ${plural(min)}` : max === min + 1 ? `${min} or ${plural(max)}` : `${min} to ${plural(max)}`;

// Call a function by name; IF is the evaluator's, since it must not work
// out the branch it does not take.
export function call(name: string, args: readonly Arg[]): Value {
  const spec = library.get(name);
  if (!spec) return fail("#NAME?", `no function ${name}`);
  if (args.length < spec.min || args.length > spec.max) return fail("#VALUE!", `${name} takes ${takes(spec.min, spec.max)}`);
  return spec.fn(args);
}

export const names = (): string[] => [...library.keys(), "IF"].sort();

// --- reading arguments ---

// Argument i as one value (null when it was left out).
function val(args: readonly Arg[], i: number): Value {
  const a = args[i];
  if (!a) return null;
  return a.values.length === 1 ? a.values[0] : fail("#VALUE!", `argument ${i + 1} is a range where one value goes`);
}

const num = (args: readonly Arg[], i: number, absent?: number): number =>
  args[i] === undefined && absent !== undefined ? absent : toNumber(val(args, i));
const str = (args: readonly Arg[], i: number): string => toText(val(args, i));
const every = (args: readonly Arg[]): Value[] => args.flatMap((a) => a.values);
const numbers = (args: readonly Arg[]): number[] =>
  every(args).map(scalar).filter((v): v is number => typeof v === "number");
const sum = (ns: readonly number[]): number => ns.reduce((s, n) => s + n, 0);
const blank = (v: Value): boolean => v === null || v === "";

// Rounding away from zero (as spreadsheets do: ROUND(-2.5, 0) is -3), up or
// down, to `digits` places; toPrecision(15) first so 2.675 * 100 is 267.5.
function rounder(how: (x: number) => number): Fn {
  return (args) => {
    const x = num(args, 0), f = 10 ** Math.trunc(num(args, 1, 0));
    return (Math.sign(x) * how(Number((Math.abs(x) * f).toPrecision(15)))) / f;
  };
}

// A COUNTIF criterion: 5, "apples", ">5", "<>apples", "" (blank).
export function criterion(c: Value): (v: Value) => boolean {
  if (typeof c !== "string") {
    const want = scalar(c);
    return (v) => typeof v === "number" && compare("=", v, want);
  }
  const m = /^(<>|<=|>=|=|<|>)?([\s\S]*)$/.exec(c)!;
  const op = (m[1] ?? "=") as Comparison, text = m[2];
  const rhs: Value = text.trim() !== "" && !Number.isNaN(Number(text)) ? Number(text) : text;
  return (v) => {
    if (v instanceof CellError) return false;
    if (rhs === "") return (op === "=") === blank(v);
    if (typeof rhs === "number" ? typeof v !== "number" : typeof v !== "string") return op === "<>";
    return compare(op, v, rhs);
  };
}

function ifs(args: readonly Arg[]): number[] {
  const test = criterion(val(args, 1));
  const from = args[0].values, of = (args[2] ?? args[0]).values;
  return from.flatMap((v, i) => {
    if (!test(v)) return [];
    const s = scalar(of[i] ?? null);
    return typeof s === "number" ? [s] : [];
  });
}

const notFound = (x: Value): never => fail("#N/A", `${toText(x)} is not there`);

// The position in `list` MATCH means by type 0 (equal), 1 (the largest at
// most x, in ascending order) or -1 (the smallest at least x, descending).
function position(x: Value, list: readonly Value[], type: number): number {
  if (type === 0) return list.findIndex((v) => !(v instanceof CellError) && v !== null && compare("=", v, x));
  const keep: Comparison = type > 0 ? "<=" : ">=";
  let at = -1;
  for (const [i, v] of list.entries()) {
    if (v === null || v instanceof CellError) continue;
    if (!compare(keep, v, x)) break;
    at = i;
  }
  return at;
}

// --- maths and statistics ---

def("SUM", 1, Infinity, (args) => sum(numbers(args)));
def("PRODUCT", 1, Infinity, (args) => {
  const ns = numbers(args);
  return ns.length ? finite(ns.reduce((p, n) => p * n, 1)) : 0;
});
def("AVERAGE", 1, Infinity, (args) => {
  const ns = numbers(args);
  return ns.length ? sum(ns) / ns.length : fail("#DIV/0!", "AVERAGE of no numbers");
});
def("MIN", 1, Infinity, (args) => { const ns = numbers(args); return ns.length ? Math.min(...ns) : 0; });
def("MAX", 1, Infinity, (args) => { const ns = numbers(args); return ns.length ? Math.max(...ns) : 0; });
def("MEDIAN", 1, Infinity, (args) => {
  const ns = numbers(args).sort((a, b) => a - b), mid = ns.length >> 1;
  if (!ns.length) return fail("#NUM!", "MEDIAN of no numbers");
  return ns.length % 2 ? ns[mid] : (ns[mid - 1] + ns[mid]) / 2;
});
def("STDEV", 1, Infinity, (args) => {
  const ns = numbers(args);
  if (ns.length < 2) return fail("#DIV/0!", "STDEV needs two numbers or more");
  const mean = sum(ns) / ns.length;
  return Math.sqrt(sum(ns.map((n) => (n - mean) ** 2)) / (ns.length - 1));
});
def("COUNT", 1, Infinity, (args) => numbers(args).length);
def("COUNTA", 1, Infinity, (args) => every(args).filter((v) => v !== null).length);
def("COUNTBLANK", 1, 1, (args) => args[0].values.filter(blank).length);
def("ABS", 1, 1, (args) => Math.abs(num(args, 0)));
def("SIGN", 1, 1, (args) => Math.sign(num(args, 0)));
def("INT", 1, 1, (args) => Math.floor(num(args, 0)));
def("ROUND", 1, 2, rounder(Math.round));
def("ROUNDUP", 1, 2, rounder(Math.ceil));
def("ROUNDDOWN", 1, 2, rounder(Math.floor));
def("MOD", 2, 2, (args) => {
  const a = num(args, 0), b = num(args, 1);
  return b === 0 ? fail("#DIV/0!", "MOD by zero") : a - b * Math.floor(a / b);
});
def("POWER", 2, 2, (args) => finite(num(args, 0) ** num(args, 1)));
def("SQRT", 1, 1, (args) => {
  const x = num(args, 0);
  return x < 0 ? fail("#NUM!", "the square root of a negative number") : Math.sqrt(x);
});
def("PI", 0, 0, () => Math.PI);

// --- conditional sums and counts ---

def("SUMIF", 2, 3, (args) => sum(ifs(args)));
def("COUNTIF", 2, 2, (args) => args[0].values.filter(criterion(val(args, 1))).length);
def("AVERAGEIF", 2, 3, (args) => {
  const ns = ifs(args);
  return ns.length ? sum(ns) / ns.length : fail("#DIV/0!", "AVERAGEIF matched no numbers");
});

// --- logic and information ---

const truths = (name: string, args: readonly Arg[]): boolean[] => {
  const ts = every(args).map(scalar).filter((v) => v !== null && typeof v !== "string").map((v) => toNumber(v) !== 0);
  return ts.length ? ts : fail("#VALUE!", `${name} found no TRUE or FALSE`);
};
def("AND", 1, Infinity, (args) => truths("AND", args).every(Boolean));
def("OR", 1, Infinity, (args) => truths("OR", args).some(Boolean));
def("NOT", 1, 1, (args) => num(args, 0) === 0);
def("IFERROR", 2, 2, (args) => {
  const x = val(args, 0);
  return x instanceof CellError ? val(args, 1) : x;
});
def("ISERROR", 1, 1, (args) => val(args, 0) instanceof CellError);
def("ISNUMBER", 1, 1, (args) => typeof val(args, 0) === "number");
def("ISTEXT", 1, 1, (args) => typeof val(args, 0) === "string");
def("ISBLANK", 1, 1, (args) => val(args, 0) === null);
def("CHOOSE", 2, Infinity, (args) => {
  const i = Math.trunc(num(args, 0));
  return i >= 1 && i < args.length ? val(args, i) : fail("#VALUE!", `CHOOSE has no choice ${i}`);
});

// --- text ---

def("CONCAT", 1, Infinity, (args) => every(args).map(toText).join(""));
def("TEXTJOIN", 3, Infinity, (args) => {
  const skip = num(args, 1) !== 0;
  return every(args.slice(2)).map(toText).filter((s) => !(skip && s === "")).join(str(args, 0));
});
def("LEN", 1, 1, (args) => str(args, 0).length);
def("UPPER", 1, 1, (args) => str(args, 0).toUpperCase());
def("LOWER", 1, 1, (args) => str(args, 0).toLowerCase());
def("PROPER", 1, 1, (args) => str(args, 0).toLowerCase().replace(/(^|[^a-z])([a-z])/g, (_, before: string, c: string) => before + c.toUpperCase()));
def("TRIM", 1, 1, (args) => str(args, 0).trim().replace(/ +/g, " "));
def("LEFT", 1, 2, (args) => {
  const n = num(args, 1, 1);
  return n < 0 ? fail("#VALUE!", "LEFT of fewer than no characters") : str(args, 0).slice(0, n);
});
def("RIGHT", 1, 2, (args) => {
  const n = num(args, 1, 1), s = str(args, 0);
  return n < 0 ? fail("#VALUE!", "RIGHT of fewer than no characters") : n === 0 ? "" : s.slice(-n);
});
def("MID", 3, 3, (args) => {
  const start = num(args, 1), n = num(args, 2);
  return start < 1 || n < 0 ? fail("#VALUE!", "MID starts at 1 and takes no fewer than no characters") : str(args, 0).substr(start - 1, n);
});
def("FIND", 2, 3, (args) => {
  const needle = str(args, 0), hay = str(args, 1), at = hay.indexOf(needle, num(args, 2, 1) - 1);
  return at < 0 ? fail("#VALUE!", `'${needle}' is not in '${hay}'`) : at + 1;
});
def("SUBSTITUTE", 3, 3, (args) => {
  const old = str(args, 1);
  return old === "" ? str(args, 0) : str(args, 0).split(old).join(str(args, 2));
});
def("REPT", 2, 2, (args) => {
  const n = Math.trunc(num(args, 1));
  return n < 0 ? fail("#VALUE!", "REPT fewer than no times") : str(args, 0).repeat(n);
});
def("EXACT", 2, 2, (args) => str(args, 0) === str(args, 1));
def("VALUE", 1, 1, (args) => num(args, 0));

// --- lookup ---

def("ROWS", 1, 1, (args) => args[0].values.length / args[0].cols);
def("COLUMNS", 1, 1, (args) => args[0].cols);
def("INDEX", 2, 3, (args) => {
  const { values, cols } = args[0], rows = values.length / cols;
  // INDEX(list, n) counts along a single row or column.
  let r = num(args, 1), c = num(args, 2, 1);
  if (args.length === 2 && rows === 1) [r, c] = [1, r];
  return r >= 1 && r <= rows && c >= 1 && c <= cols
    ? values[(r - 1) * cols + (c - 1)]
    : fail("#REF!", `INDEX ${r}, ${c} is outside ${rows} x ${cols}`);
});
def("MATCH", 2, 3, (args) => {
  const x = scalar(val(args, 0)), at = position(x, args[1].values, Math.sign(num(args, 2, 1)));
  return at < 0 ? notFound(x) : at + 1;
});
def("VLOOKUP", 3, 4, (args) => {
  const x = scalar(val(args, 0)), { values, cols } = args[1], c = Math.trunc(num(args, 2));
  if (c < 1) return fail("#VALUE!", "VLOOKUP's column starts at 1");
  if (c > cols) return fail("#REF!", `VLOOKUP column ${c} of a table ${cols} wide`);
  const firsts = values.filter((_, i) => i % cols === 0);
  const r = position(x, firsts, num(args, 3, 1) !== 0 ? 1 : 0);
  return r < 0 ? notFound(x) : values[r * cols + c - 1];
});
