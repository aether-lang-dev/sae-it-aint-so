// The function library: each function is declared with how many arguments
// it takes, and gets them as Args, a range's cells row by row with the
// range's width (VLOOKUP and INDEX need its shape), or one value. An
// argument that is an error arrives as that error, so IFERROR and ISERROR
// can look at it; everything else rethrows it as soon as it reads it.
import { CellError, compare, fail, finite, scalar, toNumber, toText } from "./values.ts";
import type { Comparison, Value } from "./values.ts";
import { sparkline } from "./charts.ts";
import { addMonths, dateDif, endOfMonth, now, parseDate, parts, serial, workdayFrom, workdaysBetween } from "./dates.ts";
import { fv, irr, nper, npv, pmt, pv, rate } from "./finance.ts";

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

// Whether argument i was left out (missing, or written as nothing: f(a,,c)).
const absent = (args: readonly Arg[], i: number): boolean => !args[i] || args[i].values.length === 0;

// Argument i as one value (null when it was left out).
function val(args: readonly Arg[], i: number): Value {
  const a = args[i];
  if (absent(args, i)) return null;
  return a.values.length === 1 ? a.values[0] : fail("#VALUE!", `argument ${i + 1} is a range where one value goes`);
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

def("XLOOKUP", 3, 6, (args) => {
  const x = scalar(val(args, 0)), list = args[1].values, back = args[2].values;
  if (back.length !== list.length) return fail("#VALUE!", "XLOOKUP's lookup and return ranges differ in size");
  const at = xsearch(x, list, num(args, 4, 0), num(args, 5, 1));
  if (at >= 0) return back[at];
  return absent(args, 3) ? notFound(x) : val(args, 3);
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
