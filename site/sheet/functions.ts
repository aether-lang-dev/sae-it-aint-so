// The function library: each function is declared with how many arguments
// it takes, and gets them as Args, a range's cells row by row with the
// range's width (VLOOKUP and INDEX need its shape), or one value. An
// argument that is an error arrives as that error, so IFERROR and ISERROR
// can look at it; everything else rethrows it as soon as it reads it.
import { CellError, array, compare, fail, finite, isArray, scalar, toNumber, toText } from "./values.ts";
import { numberFormat } from "./numfmt.ts";
import type { ArrayValue, Comparison, Result, Value } from "./values.ts";
import { sortOrder } from "./sortfind.ts";
import { sparkline } from "./charts.ts";
import { addMonths, dateDif, endOfMonth, now, parseDate, parts, serial, workdayFrom, workdaysBetween } from "./dates.ts";
import { fv, irr, nper, npv, pmt, pv, rate } from "./finance.ts";

export interface Arg {
  readonly values: readonly Value[];
  readonly cols: number;
}

export const single = (v: Value): Arg => ({ values: [v], cols: 1 });

// A function gives one value, or (SEQUENCE, FILTER ...) a dynamic array.
type Fn = (args: readonly Arg[]) => Value | ArrayValue;

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
export function call(name: string, args: readonly Arg[]): Result {
  const spec = library.get(name);
  if (!spec) return fail("#NAME?", `no function ${name}`);
  if (args.length < spec.min || args.length > spec.max) return fail("#VALUE!", `${name} takes ${takes(spec.min, spec.max)}`);
  return lifted(spec.fn, args, new Set());
}

// An argument that is a range where the function takes one value (val()).
class ScalarWanted extends CellError {
  readonly index: number;
  constructor(index: number) {
    super("#VALUE!", `argument ${index + 1} is a range where one value goes`);
    this.index = index;
  }
}

// A function given a range where it takes one value is worked out once for
// each of the range's cells, as a spreadsheet's are: UPPER(A1:A3) is three
// values, LEFT(A1:A3, B1:B3) three pairs. Which arguments take one value
// is the function's own to say (val() refuses a range); the ranges given
// for them (`over`) are taken cell by cell, a one-row or one-column one
// broadcast, #N/A past an end. An error in one cell is that cell's.
function lifted(fn: Fn, args: readonly Arg[], over: ReadonlySet<number>): Result {
  if (over.size === 0) {
    try {
      return fn(args);
    } catch (e) {
      if (!(e instanceof ScalarWanted)) throw e;
      return lifted(fn, args, new Set([e.index]));
    }
  }
  const shapes = [...over].map((i) => ({ i, rows: args[i].values.length / args[i].cols, cols: args[i].cols }));
  const rows = Math.max(...shapes.map((x) => x.rows)), cols = Math.max(...shapes.map((x) => x.cols));
  const cell = (x: { i: number; rows: number; cols: number }, r: number, c: number): Value => {
    const rr = x.rows === 1 ? 0 : r, cc = x.cols === 1 ? 0 : c;
    return rr < x.rows && cc < x.cols ? args[x.i].values[rr * x.cols + cc] : new CellError("#N/A", "past the end of an array");
  };
  const values: Value[] = [];
  for (let r = 0; r < rows; r++) {
    for (let c = 0; c < cols; c++) {
      const at = args.map((a, i) => (over.has(i) ? single(cell(shapes.find((x) => x.i === i)!, r, c)) : a));
      try {
        const v = fn(at);
        values.push(isArray(v) ? (v.values.length === 1 ? v.values[0] : new CellError("#CALC!", "an array in a cell of an array")) : v);
      } catch (e) {
        if (e instanceof ScalarWanted && !over.has(e.index)) return lifted(fn, args, new Set([...over, e.index]));
        if (!(e instanceof CellError)) throw e;
        values.push(e);
      }
    }
  }
  return array(rows, cols, values);
}

export const names = (): string[] => [...library.keys(), "IF"].sort();

// --- reading arguments ---

// Whether argument i was left out (missing, or written as nothing: f(a,,c)).
const absent = (args: readonly Arg[], i: number): boolean => !args[i] || args[i].values.length === 0;

// Argument i as one value (null when it was left out).
function val(args: readonly Arg[], i: number): Value {
  const a = args[i];
  if (absent(args, i)) return null;
  if (a.values.length !== 1) throw new ScalarWanted(i);
  return a.values[0];
}

const num = (args: readonly Arg[], i: number, otherwise?: number): number =>
  absent(args, i) && otherwise !== undefined ? otherwise : toNumber(val(args, i));
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
// A range's numbers as a line of blocks (as Google Sheets' SPARKLINE, in text).
def("SPARKLINE", 1, 1, (args) => sparkline(numbers(args)));
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

// TEXT: a value in an Excel number format ("0.00", "#,##0", "0%",
// "yyyy-mm-dd"); text that reads as a number is formatted as one.
def("TEXT", 2, 2, (args) => {
  const v = scalar(val(args, 0)), n = typeof v === "string" && v.trim() !== "" && !isNaN(Number(v)) ? Number(v) : v;
  return numberFormat(n, str(args, 1))?.text ?? toText(v);
});

// Where the delimiters (any of them; an array is several) are in `text`,
// left to right, none overlapping: [start, end] each.
function delimited(text: string, delims: readonly string[], anyCase: boolean): [number, number][] {
  const t = anyCase ? text.toLowerCase() : text, ds = delims.filter((d) => d !== "").map((d) => (anyCase ? d.toLowerCase() : d)).sort((x, y) => y.length - x.length);
  const out: [number, number][] = [];
  for (let i = 0; i < t.length;) {
    const d = ds.find((x) => t.startsWith(x, i));
    if (d === undefined) i++; else {
      out.push([i, i + d.length]);
      i += d.length;
    }
  }
  return out;
}
const delimiters = (a: Arg): string[] => a.values.map(toText);

// TEXTBEFORE and TEXTAFTER: the text before (after) the instance_num-th
// delimiter, counted from the end when negative; match_mode 1 ignores
// case; match_end 1 counts the text's end (start, from the end) as one;
// if_not_found, or #N/A.
const around = (before: boolean): Fn => (args) => {
  const text = str(args, 0), ds = delimiters(args[1]), n = whole(args, 2, 1);
  const anyCase = !absent(args, 3) && num(args, 3) !== 0, atEnd = !absent(args, 4) && num(args, 4) !== 0;
  if (n === 0 || Math.abs(n) > text.length + 1) return fail("#VALUE!", `${before ? "TEXTBEFORE" : "TEXTAFTER"}'s instance_num is ${n}`);
  if (ds.every((d) => d === "")) return (n > 0) === before ? "" : text;
  const found = delimited(text, ds, anyCase);
  if (atEnd) n > 0 ? found.push([text.length, text.length]) : found.unshift([0, 0]);
  const m = n > 0 ? found[n - 1] : found[found.length + n];
  if (!m) return absent(args, 5) ? fail("#N/A", `${before ? "TEXTBEFORE" : "TEXTAFTER"} found no delimiter ${n}`) : val(args, 5);
  return before ? text.slice(0, m[0]) : text.slice(m[1]);
};
def("TEXTBEFORE", 2, 6, around(true));
def("TEXTAFTER", 2, 6, around(false));

// TEXTSPLIT: text into columns at col_delimiter and rows at row_delimiter
// (either can be several, either left out); ignore_empty 1 drops empty
// pieces; match_mode 1 ignores case; short rows padded with pad_with, or
// #N/A.
def("TEXTSPLIT", 2, 6, (args) => {
  const text = str(args, 0), anyCase = !absent(args, 4) && num(args, 4) !== 0, skip = !absent(args, 3) && num(args, 3) !== 0;
  const split = (s: string, ds: readonly string[]): string[] => {
    if (!ds.some((d) => d !== "")) return [s];
    const at = delimited(s, ds, anyCase), pieces: string[] = [];
    let from = 0;
    for (const [a, b] of at) {
      pieces.push(s.slice(from, a));
      from = b;
    }
    pieces.push(s.slice(from));
    return skip ? pieces.filter((p) => p !== "") : pieces;
  };
  const cols = absent(args, 1) ? [] : delimiters(args[1]), rowDs = absent(args, 2) ? [] : delimiters(args[2]);
  if (!cols.some((d) => d !== "") && !rowDs.some((d) => d !== "")) return fail("#VALUE!", "TEXTSPLIT needs a delimiter");
  const lines = split(text, rowDs).map((line) => split(line, cols)).filter((l) => l.length);
  if (!lines.length) return fail("#CALC!", "TEXTSPLIT found nothing");
  const w = Math.max(...lines.map((l) => l.length)), pad = absent(args, 5) ? NA() : val(args, 5);
  return fromRows(lines.map((l) => [...l, ...Array.from({ length: w - l.length }, () => pad)]));
});

// --- conditionals ---

def("IFS", 2, Infinity, (args) => {
  for (let i = 0; i + 1 < args.length; i += 2) if (toNumber(val(args, i)) !== 0) return val(args, i + 1);
  return fail("#N/A", "no condition was true");
});
def("SWITCH", 3, Infinity, (args) => {
  const x = scalar(val(args, 0));
  let i = 1;
  for (; i + 1 < args.length; i += 2) if (compare("=", x, scalar(val(args, i)))) return val(args, i + 1);
  return i < args.length ? val(args, i) : fail("#N/A", `${toText(x)} matched no case`);
});
def("IFNA", 2, 2, (args) => {
  const v = val(args, 0);
  return v instanceof CellError && v.code === "#N/A" ? val(args, 1) : v;
});
def("NA", 0, 0, () => fail("#N/A", "NA()"));

// --- conditional aggregates over several criteria ---

// The values of `of` where every (range, criterion) pair holds.
function where(name: string, of: Arg, pairs: readonly Arg[]): Value[] {
  const tests: [readonly Value[], (v: Value) => boolean][] = [];
  for (let i = 0; i + 1 < pairs.length; i += 2) {
    if (pairs[i].values.length !== of.values.length) return fail("#VALUE!", `${name}'s ranges differ in size`);
    tests.push([pairs[i].values, criterion(scalar(pairs[i + 1].values[0] ?? null))]);
  }
  return of.values.filter((_, j) => tests.every(([vs, ok]) => ok(vs[j])));
}
const numbersIn = (vs: readonly Value[]): number[] => vs.map(scalar).filter((v): v is number => typeof v === "number");

def("SUMIFS", 3, Infinity, (args) => sum(numbersIn(where("SUMIFS", args[0], args.slice(1)))));
def("COUNTIFS", 2, Infinity, (args) => where("COUNTIFS", args[0], args).length);
def("AVERAGEIFS", 3, Infinity, (args) => {
  const ns = numbersIn(where("AVERAGEIFS", args[0], args.slice(1)));
  return ns.length ? sum(ns) / ns.length : fail("#DIV/0!", "AVERAGEIFS matched no numbers");
});
def("MAXIFS", 3, Infinity, (args) => {
  const ns = numbersIn(where("MAXIFS", args[0], args.slice(1)));
  return ns.length ? Math.max(...ns) : 0;
});
def("MINIFS", 3, Infinity, (args) => {
  const ns = numbersIn(where("MINIFS", args[0], args.slice(1)));
  return ns.length ? Math.min(...ns) : 0;
});
def("SUMPRODUCT", 1, Infinity, (args) => {
  const n = args[0].values.length;
  if (args.some((a) => a.values.length !== n)) return fail("#VALUE!", "SUMPRODUCT's ranges differ in size");
  let total = 0;
  for (let i = 0; i < n; i++) {
    const vs = args.map((a) => scalar(a.values[i]));
    total += vs.every((v) => typeof v === "number") ? vs.reduce((p, v) => p * (v as number), 1) : 0;
  }
  return total;
});

// --- order statistics ---

const sorted = (args: readonly Arg[], i: number): number[] => numbersIn(args[i].values).sort((x, y) => x - y);
function kth(name: string, largest: boolean): Fn {
  return (args) => {
    const ns = sorted(args, 0), k = Math.trunc(num(args, 1));
    if (k < 1 || k > ns.length) return fail("#NUM!", `${name}'s k is ${k} of ${ns.length} numbers`);
    return largest ? ns[ns.length - k] : ns[k - 1];
  };
}
def("LARGE", 2, 2, kth("LARGE", true));
def("SMALL", 2, 2, kth("SMALL", false));
def("RANK", 2, 3, (args) => {
  const x = num(args, 0), ns = sorted(args, 1), ascending = num(args, 2, 0) !== 0;
  if (!ns.includes(x)) return notFound(x);
  return 1 + ns.filter((n) => (ascending ? n < x : n > x)).length;
});
// PERCENTILE (inclusive): k from 0 to 1, between the numbers in order.
function percentile(ns: readonly number[], k: number, name: string): number {
  if (!ns.length) return fail("#NUM!", `${name} of no numbers`);
  if (k < 0 || k > 1) return fail("#NUM!", `${name}'s k is outside 0 to 1`);
  const at = k * (ns.length - 1), lo = Math.floor(at);
  return lo + 1 < ns.length ? ns[lo] + (at - lo) * (ns[lo + 1] - ns[lo]) : ns[lo];
}
def("PERCENTILE", 2, 2, (args) => percentile(sorted(args, 0), num(args, 1), "PERCENTILE"));
def("QUARTILE", 2, 2, (args) => {
  const q = Math.trunc(num(args, 1));
  return q < 0 || q > 4 ? fail("#NUM!", "QUARTILE's quart is 0 to 4") : percentile(sorted(args, 0), q / 4, "QUARTILE");
});
def("MODE", 1, Infinity, (args) => {
  const ns = numbers(args), counts = new Map<number, number>();
  for (const n of ns) counts.set(n, (counts.get(n) ?? 0) + 1);
  let best: number | null = null;
  for (const n of ns) if (counts.get(n)! > 1 && (best === null || counts.get(n)! > counts.get(best)!)) best = n;
  return best ?? fail("#N/A", "MODE: no number repeats");
});
const squares = (ns: readonly number[]): number => {
  const m = sum(ns) / ns.length;
  return ns.reduce((s, n) => s + (n - m) ** 2, 0);
};
def("VAR", 1, Infinity, (args) => {
  const ns = numbers(args);
  return ns.length < 2 ? fail("#DIV/0!", "VAR needs two numbers or more") : squares(ns) / (ns.length - 1);
});
def("VARP", 1, Infinity, (args) => {
  const ns = numbers(args);
  return ns.length ? squares(ns) / ns.length : fail("#DIV/0!", "VARP of no numbers");
});
def("STDEVP", 1, Infinity, (args) => {
  const ns = numbers(args);
  return ns.length ? Math.sqrt(squares(ns) / ns.length) : fail("#DIV/0!", "STDEVP of no numbers");
});

// --- dates and times (dates.ts) ---

// Argument i as a serial: a number, or a date written as text.
function date(args: readonly Arg[], i: number): number {
  const v = scalar(val(args, i));
  if (typeof v === "string") return parseDate(v) ?? fail("#VALUE!", `'${v}' is not a date`);
  return toNumber(v);
}
const holidays = (args: readonly Arg[], i: number): Set<number> =>
  new Set(absent(args, i) ? [] : args[i].values.filter((v) => v !== null).map((v) => Math.floor(typeof v === "string" ? parseDate(v) ?? NaN : toNumber(v))));

def("DATE", 3, 3, (args) => {
  const y = Math.trunc(num(args, 0));
  return serial(y < 1900 ? y + 1900 : y, Math.trunc(num(args, 1)), Math.trunc(num(args, 2)));
});
def("DATEVALUE", 1, 1, (args) => date(args, 0));
def("YEAR", 1, 1, (args) => parts(date(args, 0)).y);
def("MONTH", 1, 1, (args) => parts(date(args, 0)).m);
def("DAY", 1, 1, (args) => parts(date(args, 0)).d);
def("WEEKDAY", 1, 2, (args) => {
  const w = parts(date(args, 0)).weekday, type = num(args, 1, 1);
  return type === 2 ? ((w + 6) % 7) + 1 : type === 3 ? (w + 6) % 7 : w + 1;
});
def("EDATE", 2, 2, (args) => addMonths(date(args, 0), Math.trunc(num(args, 1))));
def("EOMONTH", 2, 2, (args) => endOfMonth(date(args, 0), Math.trunc(num(args, 1))));
def("DAYS", 2, 2, (args) => Math.floor(date(args, 0)) - Math.floor(date(args, 1)));
def("DATEDIF", 3, 3, (args) => {
  const a = date(args, 0), b = date(args, 1);
  if (a > b) return fail("#NUM!", "DATEDIF's start is after its end");
  return dateDif(a, b, str(args, 2)) ?? fail("#NUM!", `${str(args, 2)} is not a unit (Y, M, D, YM, MD, YD)`);
});
def("NETWORKDAYS", 2, 3, (args) => workdaysBetween(date(args, 0), date(args, 1), holidays(args, 2)));
def("WORKDAY", 2, 3, (args) => workdayFrom(date(args, 0), Math.trunc(num(args, 1)), holidays(args, 2)));
def("TIME", 3, 3, (args) => ((num(args, 0) * 3600 + num(args, 1) * 60 + num(args, 2)) / 86400) % 1);
const clock = (args: readonly Arg[]) => Math.round((date(args, 0) % 1) * 86400);
def("HOUR", 1, 1, (args) => Math.floor(clock(args) / 3600) % 24);
def("MINUTE", 1, 1, (args) => Math.floor(clock(args) / 60) % 60);
def("SECOND", 1, 1, (args) => clock(args) % 60);
def("TODAY", 0, 0, () => Math.floor(now()));
def("NOW", 0, 0, () => now());

// --- money (finance.ts) ---

def("PMT", 3, 5, (args) => finite(pmt(num(args, 0), num(args, 1), num(args, 2), num(args, 3, 0), num(args, 4, 0))));
def("FV", 3, 5, (args) => finite(fv(num(args, 0), num(args, 1), num(args, 2), num(args, 3, 0), num(args, 4, 0))));
def("PV", 3, 5, (args) => finite(pv(num(args, 0), num(args, 1), num(args, 2), num(args, 3, 0), num(args, 4, 0))));
def("NPER", 3, 5, (args) => finite(nper(num(args, 0), num(args, 1), num(args, 2), num(args, 3, 0), num(args, 4, 0))));
def("RATE", 3, 6, (args) =>
  rate(num(args, 0), num(args, 1), num(args, 2), num(args, 3, 0), num(args, 4, 0), num(args, 5, 0.1)) ?? fail("#NUM!", "RATE did not settle"));
def("NPV", 2, Infinity, (args) => npv(num(args, 0), numbers(args.slice(1))));
def("IRR", 1, 2, (args) => {
  const flows = numbersIn(args[0].values);
  if (!flows.some((c) => c < 0) || !flows.some((c) => c > 0)) return fail("#NUM!", "IRR needs a negative and a positive cash flow");
  return irr(flows, num(args, 1, 0.1)) ?? fail("#NUM!", "IRR did not settle");
});

// --- dynamic arrays ---

const rowsOf = (a: Arg): Value[][] => Array.from({ length: a.values.length / a.cols }, (_, i) => a.values.slice(i * a.cols, (i + 1) * a.cols));
const fromRows = (rows: readonly (readonly Value[])[]): ArrayValue => array(rows.length, rows[0]?.length ?? 0, rows.flat());
const transposed = (a: Arg): Arg => {
  const rows = a.values.length / a.cols;
  return { values: Array.from({ length: a.values.length }, (_, k) => a.values[(k % rows) * a.cols + Math.floor(k / rows)]), cols: rows };
};
const turned = (x: ArrayValue): ArrayValue => {
  const t = transposed({ values: x.values, cols: x.cols });
  return array(t.values.length / t.cols, t.cols, t.values);
};

def("SEQUENCE", 1, 4, (args) => {
  const rows = Math.trunc(num(args, 0)), cols = Math.trunc(num(args, 1, 1)), start = num(args, 2, 1), step = num(args, 3, 1);
  if (rows < 1 || cols < 1) return fail("#CALC!", `SEQUENCE of no ${rows < 1 ? "rows" : "columns"}`);
  if (rows * cols > 10_000) return fail("#NUM!", "SEQUENCE of more than 10000 values");
  return array(rows, cols, Array.from({ length: rows * cols }, (_, i) => start + step * i));
});
def("FILTER", 2, 3, (args) => {
  const a = args[0], include = args[1], rows = a.values.length / a.cols;
  const keep = include.values.map((v) => toNumber(v) !== 0);
  // A column of TRUE and FALSE keeps rows; a row of them keeps columns.
  const byRow = include.cols === 1 && keep.length === rows;
  if (!byRow && !(keep.length === a.cols && include.cols === keep.length)) return fail("#VALUE!", "FILTER's include is not the array's height or width");
  const lines = rowsOf(byRow ? a : transposed(a)).filter((_, i) => keep[i]);
  if (!lines.length) return absent(args, 2) ? fail("#CALC!", "FILTER found nothing") : val(args, 2);
  return byRow ? fromRows(lines) : turned(fromRows(lines));
});
// Rows in order of a key each (ascending, or not), equal ones as they were.
const ordered = <T>(items: readonly T[], key: (t: T) => Value, ascending: boolean): T[] =>
  items.map((t, i) => ({ t, i })).sort((p, q) => (ascending ? 1 : -1) * sortOrder(key(p.t), key(q.t)) || p.i - q.i).map((x) => x.t);
def("SORT", 1, 4, (args) => {
  const byCol = !absent(args, 3) && num(args, 3) !== 0, a = byCol ? transposed(args[0]) : args[0];
  const index = Math.trunc(num(args, 1, 1)), ascending = num(args, 2, 1) >= 0;
  if (index < 1 || index > a.cols) return fail("#VALUE!", `SORT's index ${index} is outside the array`);
  const out = fromRows(ordered(rowsOf(a), (row) => row[index - 1], ascending));
  return byCol ? turned(out) : out;
});
def("SORTBY", 2, Infinity, (args) => {
  const rows = rowsOf(args[0]), keys: { by: readonly Value[]; ascending: boolean }[] = [];
  for (let i = 1; i < args.length; i += 2) {
    if (args[i].values.length !== rows.length) return fail("#VALUE!", "SORTBY's arrays differ in size");
    keys.push({ by: args[i].values, ascending: num(args, i + 1, 1) >= 0 });
  }
  const order = rows.map((_, i) => i).sort((p, q) => {
    for (const k of keys) {
      const c = (k.ascending ? 1 : -1) * sortOrder(k.by[p], k.by[q]);
      if (c) return c;
    }
    return p - q;
  });
  return fromRows(order.map((i) => rows[i]));
});
def("UNIQUE", 1, 3, (args) => {
  const byCol = !absent(args, 1) && num(args, 1) !== 0, once = !absent(args, 2) && num(args, 2) !== 0;
  const lines = rowsOf(byCol ? transposed(args[0]) : args[0]);
  const keyOf = (line: readonly Value[]) => JSON.stringify(line.map((v) => (v instanceof CellError ? v.code : toText(v).toUpperCase())));
  const counts = new Map<string, number>();
  for (const line of lines) counts.set(keyOf(line), (counts.get(keyOf(line)) ?? 0) + 1);
  const seen = new Set<string>();
  const kept = lines.filter((line) => {
    const k = keyOf(line);
    if (seen.has(k) || (once && counts.get(k)! > 1)) return false;
    seen.add(k);
    return true;
  });
  if (!kept.length) return fail("#CALC!", "UNIQUE found nothing");
  return byCol ? turned(fromRows(kept)) : fromRows(kept);
});
def("TRANSPOSE", 1, 1, (args) => turned(array(args[0].values.length / args[0].cols, args[0].cols, args[0].values)));

// --- shaping arrays ---

const NA = (): CellError => new CellError("#N/A", "past the end of an array");
// A count argument: a whole number.
const whole = (args: readonly Arg[], i: number, otherwise: number): number => Math.trunc(num(args, i, otherwise));
// TAKE keeps the first rows and columns (the last, when negative); DROP
// keeps all but them.
const cut = (take: boolean): Fn => (args) => {
  const a = args[0], rows = a.values.length / a.cols;
  const part = (n: number, len: number): [number, number] =>
    take ? (n >= 0 ? [0, Math.min(n, len)] : [Math.max(0, len + n), len]) : n >= 0 ? [Math.min(n, len), len] : [0, Math.max(0, len + n)];
  const [r0, r1] = part(whole(args, 1, take ? rows : 0), rows), [c0, c1] = part(whole(args, 2, take ? a.cols : 0), a.cols);
  if (r1 <= r0 || c1 <= c0) return fail("#CALC!", `${take ? "TAKE" : "DROP"} leaves nothing`);
  return fromRows(rowsOf(a).slice(r0, r1).map((row) => row.slice(c0, c1)));
};
def("TAKE", 2, 3, cut(true));
def("DROP", 2, 3, cut(false));
// CHOOSEROWS and CHOOSECOLS: the rows (columns) by number, from the end
// when negative, in the order asked, as often as asked.
const choose = (byCol: boolean): Fn => (args) => {
  const lines = rowsOf(byCol ? transposed(args[0]) : args[0]);
  const picked = args.slice(1).flatMap((a) => a.values).map((v) => {
    const n = Math.trunc(toNumber(v)), i = n < 0 ? lines.length + n : n - 1;
    return i >= 0 && i < lines.length ? lines[i] : fail("#VALUE!", `${byCol ? "CHOOSECOLS" : "CHOOSEROWS"} has no ${byCol ? "column" : "row"} ${n}`);
  });
  return byCol ? turned(fromRows(picked)) : fromRows(picked);
};
def("CHOOSEROWS", 2, Infinity, choose(false));
def("CHOOSECOLS", 2, Infinity, choose(true));
// VSTACK: the arrays one under another, as wide as the widest, #N/A where
// one is narrower; HSTACK, side by side.
const stacked = (args: readonly Arg[]): ArrayValue => {
  const lines = args.filter((a) => a.values.length).flatMap(rowsOf), w = Math.max(...lines.map((l) => l.length));
  return fromRows(lines.map((l) => [...l, ...Array.from({ length: w - l.length }, NA)]));
};
def("VSTACK", 1, Infinity, stacked);
def("HSTACK", 1, Infinity, (args) => turned(stacked(args.filter((a) => a.values.length).map(transposed))));
// TOCOL and TOROW: an array as one column (row), by rows or (scan_by_column)
// by columns; ignore 1 skips blanks, 2 errors, 3 both.
const flattened = (args: readonly Arg[]): Value[] => {
  const ignore = whole(args, 1, 0), byCol = !absent(args, 2) && num(args, 2) !== 0;
  const a = byCol ? transposed(args[0]) : args[0];
  return a.values.filter((v) => !((ignore & 1 && blank(v)) || (ignore & 2 && v instanceof CellError)));
};
def("TOCOL", 1, 3, (args) => {
  const vs = flattened(args);
  return vs.length ? array(vs.length, 1, vs) : fail("#CALC!", "TOCOL found nothing");
});
def("TOROW", 1, 3, (args) => {
  const vs = flattened(args);
  return vs.length ? array(1, vs.length, vs) : fail("#CALC!", "TOROW found nothing");
});
// WRAPROWS and WRAPCOLS: a row or column of values in rows (columns) of
// `count`, the last padded with pad_with or #N/A.
const wrapped = (byCol: boolean): Fn => (args) => {
  const vs = args[0].values, n = whole(args, 1, 0);
  if (args[0].cols !== 1 && args[0].cols !== vs.length) return fail("#VALUE!", "only a row or a column can be wrapped");
  if (n < 1) return fail("#NUM!", "wrapping in fewer than 1");
  const pad = absent(args, 2) ? NA() : val(args, 2);
  const lines = Array.from({ length: Math.ceil(vs.length / n) }, (_, i) => Array.from({ length: n }, (_, j) => (i * n + j < vs.length ? vs[i * n + j] : pad)));
  return byCol ? turned(fromRows(lines)) : fromRows(lines);
};
def("WRAPROWS", 2, 3, wrapped(false));
def("WRAPCOLS", 2, 3, wrapped(true));
// EXPAND: an array made as big as rows by cols, padded with pad_with or #N/A.
def("EXPAND", 2, 4, (args) => {
  const a = args[0], rows = a.values.length / a.cols;
  const r = whole(args, 1, rows), c = whole(args, 2, a.cols), pad = absent(args, 3) ? NA() : val(args, 3);
  if (r < rows || c < a.cols) return fail("#VALUE!", "EXPAND cannot make an array smaller");
  return array(r, c, Array.from({ length: r * c }, (_, k) => {
    const i = Math.floor(k / c), j = k % c;
    return i < rows && j < a.cols ? a.values[i * a.cols + j] : pad;
  }));
});

// --- lookup ---

// A wildcard pattern (* any run, ? one character, ~ before either for
// itself) as a test, ignoring case.
function wildcard(pattern: string): (v: Value) => boolean {
  let re = "";
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i];
    if (c === "~" && i + 1 < pattern.length) re += pattern[++i].replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    else if (c === "*") re += ".*";
    else if (c === "?") re += ".";
    else re += c.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }
  const r = new RegExp(`^${re}$`, "i");
  return (v) => v !== null && !(v instanceof CellError) && r.test(toText(v));
}

// XLOOKUP's and XMATCH's search: the index in `list` of x by match mode
// (0 exact, -1 exact or next smaller, 1 exact or next larger, 2 wildcard),
// searching first to last (1) or last to first (-1); -1 when not there.
function xsearch(x: Value, list: readonly Value[], mode: number, from: number): number {
  const order = list.map((_, i) => i);
  if (from < 0) order.reverse();
  if (mode === 2) {
    const ok = wildcard(toText(x));
    return order.find((i) => ok(list[i])) ?? -1;
  }
  const real = (v: Value) => v !== null && !(v instanceof CellError);
  const exact = order.find((i) => real(list[i]) && compare("=", list[i], x));
  if (exact !== undefined || mode === 0) return exact ?? -1;
  let best = -1;
  for (const i of order) {
    const v = list[i];
    if (!real(v) || !(mode < 0 ? compare("<", v, x) : compare(">", v, x))) continue;
    if (best < 0 || (mode < 0 ? compare(">", v, list[best]) : compare("<", v, list[best]))) best = i;
  }
  return best;
}

// XLOOKUP's return: the value at the match, or, when the return range is
// wider (taller) than a column (row) of lookups, the whole row (column).
def("XLOOKUP", 3, 6, (args) => {
  const x = scalar(val(args, 0)), list = args[1].values, back = args[2];
  const lookRows = list.length / args[1].cols, backRows = back.values.length / back.cols;
  const down = args[1].cols === 1 && backRows === list.length, across = lookRows === 1 && back.cols === list.length;
  if (!down && !across) return fail("#VALUE!", "XLOOKUP's lookup and return ranges differ in size");
  const at = xsearch(x, list, num(args, 4, 0), num(args, 5, 1));
  if (at < 0) return absent(args, 3) ? notFound(x) : val(args, 3);
  if (down) return back.cols === 1 ? back.values[at] : array(1, back.cols, back.values.slice(at * back.cols, (at + 1) * back.cols));
  return backRows === 1 ? back.values[at] : array(backRows, 1, back.values.filter((_, k) => k % back.cols === at));
});
def("XMATCH", 2, 4, (args) => {
  const x = scalar(val(args, 0)), at = xsearch(x, args[1].values, num(args, 2, 0), num(args, 3, 1));
  return at < 0 ? notFound(x) : at + 1;
});
def("HLOOKUP", 3, 4, (args) => {
  const x = scalar(val(args, 0)), { values, cols } = args[1], r = Math.trunc(num(args, 2)), rows = values.length / cols;
  if (r < 1) return fail("#VALUE!", "HLOOKUP's row starts at 1");
  if (r > rows) return fail("#REF!", `HLOOKUP row ${r} of a table ${rows} high`);
  const c = position(x, values.slice(0, cols), num(args, 3, 1) !== 0 ? 1 : 0);
  return c < 0 ? notFound(x) : values[(r - 1) * cols + c];
});

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
