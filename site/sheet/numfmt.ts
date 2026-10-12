// Excel's number-format language, as GridCraft's numfmt crate and Excel's
// Format Cells > Custom have it. A format is up to four sections, split by
// ';' outside quotes: positive;negative;zero;text (one section serves every
// number, the negative ones with a '-'; a negative section shows the
// number without one). A section may start with a colour ([Red]) or a
// condition ([>=100]); then come literals ("text", \c, bare $ - + ( ) : /
// and spaces; _c is a space, *c a fill, left out here) and either
//   - a number: 0 (a digit), # (a digit if there is one), ? (a digit or a
//     space), '.', ',' between digits (thousands) or after them (scale by
//     a thousand), % (times a hundred), E+00 (scientific), ?/? (a fraction);
//   - a date or time, on Excel's serial numbers (days since 1899-12-30):
//     y, m, d, h, s runs, AM/PM, [h] for elapsed hours; m is minutes beside
//     h or s;
//   - General, or @ (the text itself).
import { parseDate, parts } from "./dates.ts";
import { show } from "./format.ts";
import { CellError } from "./values.ts";
import type { Value } from "./values.ts";

export interface Shown {
  readonly text: string;
  readonly color?: string;
}

type Tok =
  | { readonly t: "lit"; readonly s: string }
  | { readonly t: "digit"; readonly c: "0" | "#" | "?" }
  | { readonly t: "." | "," | "%" | "/" | "@" | "general" }
  | { readonly t: "E"; readonly plus: boolean }
  | { readonly t: "date"; readonly s: string };

interface Section {
  readonly toks: readonly Tok[];
  readonly color?: string;
  readonly cond?: (n: number) => boolean;
}

const COLOURS: Record<string, string> = {
  black: "#000000", blue: "#0000ff", cyan: "#00ffff", green: "#00ff00", magenta: "#ff00ff", red: "#ff0000", white: "#ffffff", yellow: "#ffff00",
};

const COMPARE: Record<string, (a: number, b: number) => boolean> = {
  "<": (a, b) => a < b, "<=": (a, b) => a <= b, ">": (a, b) => a > b, ">=": (a, b) => a >= b, "=": (a, b) => a === b, "<>": (a, b) => a !== b,
};

// The sections of a format, split on ';' outside quotes, brackets and escapes.
function split(pattern: string): string[] {
  const out: string[] = [];
  let cur = "", quoted = false, bracket = false;
  for (let i = 0; i < pattern.length; i++) {
    const c = pattern[i];
    if (c === "\\" && !quoted && i + 1 < pattern.length) { cur += c + pattern[++i]; continue; }
    if (c === '"' && !bracket) quoted = !quoted;
    else if (c === "[" && !quoted) bracket = true;
    else if (c === "]" && !quoted) bracket = false;
    else if (c === ";" && !quoted && !bracket) { out.push(cur); cur = ""; continue; }
    cur += c;
  }
  out.push(cur);
  return out;
}

function section(text: string): Section {
  const toks: Tok[] = [];
  let color: string | undefined, cond: ((n: number) => boolean) | undefined;
  const lit = (s: string) => toks.push({ t: "lit", s });
  let i = 0;
  while (i < text.length) {
    const c = text[i], rest = text.slice(i);
    if (c === '"') {
      const end = text.indexOf('"', i + 1);
      lit(text.slice(i + 1, end < 0 ? text.length : end));
      i = end < 0 ? text.length : end + 1;
    } else if (c === "\\") { lit(text[i + 1] ?? ""); i += 2; }
    else if (c === "_") { lit(" "); i += 2; }
    else if (c === "*") { i += 2; }
    else if (c === "[") {
      const end = text.indexOf("]", i);
      const inner = text.slice(i + 1, end < 0 ? text.length : end);
      i = end < 0 ? text.length : end + 1;
      const m = /^(<=|>=|<>|<|>|=)\s*(-?[\d.]+)$/.exec(inner);
      if (COLOURS[inner.toLowerCase()]) color = COLOURS[inner.toLowerCase()];
      else if (m) cond = (n) => COMPARE[m[1]](n, Number(m[2]));
      else if (/^(h+|m+|s+)$/i.test(inner)) toks.push({ t: "date", s: `[${inner.toLowerCase()[0]}]` });
      else if (inner.startsWith("$")) lit(inner.slice(1).split("-")[0]);
    } else if (/^general/i.test(rest)) { toks.push({ t: "general" }); i += 7; }
    else if (/^(am\/pm|a\/p)/i.test(rest)) {
      const s = /^(am\/pm|a\/p)/i.exec(rest)![0];
      toks.push({ t: "date", s });
      i += s.length;
    } else if (c === "0" || c === "#" || c === "?") { toks.push({ t: "digit", c }); i++; }
    else if (/^[eE][+-]/.test(rest) && toks.some((t) => t.t === "digit")) { toks.push({ t: "E", plus: rest[1] === "+" }); i += 2; }
    else if (/[ymdhs]/i.test(c)) {
      const run = new RegExp(`^${c}+`, "i").exec(rest)![0];
      toks.push({ t: "date", s: run.toLowerCase() });
      i += run.length;
    } else if (c === "." || c === "," || c === "%" || c === "/" || c === "@") { toks.push({ t: c }); i++; }
    else { lit(c); i++; }
  }
  return { toks, color, cond };
}

// n rounded to `places` decimals, half away from zero (by its decimal text,
// so 1.005 is 1.01).
const round = (n: number, places: number): number => Number(`${Math.round(Number(`${n}e${places}`))}e-${places}`);

const grouped = (digits: string): string => digits.replace(/\B(?=(\d{3})+(?!\d))/g, ",");

// Digits into placeholders right to left: the leftmost takes what is left.
function fillRight(digits: string, holders: readonly ("0" | "#" | "?")[]): string[] {
  const out = holders.map(() => "");
  let d = digits.length;
  for (let j = holders.length - 1; j >= 0; j--) {
    if (j === 0) out[j] = digits.slice(0, d);
    else if (d > 0) out[j] = digits[--d];
    if (out[j] === "") out[j] = holders[j] === "0" ? "0" : holders[j] === "?" ? " " : "";
    if (j === 0 && d > 0) d = 0;
  }
  return out;
}

// Digits into placeholders left to right, trailing zeros dropped where # allows.
function fillLeft(digits: string, holders: readonly ("0" | "#" | "?")[]): string[] {
  const out = holders.map((_, j) => digits[j] ?? "0");
  for (let j = holders.length - 1; j >= 0 && out[j] === "0" && holders[j] !== "0"; j--) out[j] = holders[j] === "?" ? " " : "";
  return out;
}

type Holder = "0" | "#" | "?";
const holderAt = (t: Tok): Holder => (t as { c: Holder }).c;

// A number in a numeric section (n >= 0 unless `signed`).
function numeric(n: number, toks: readonly Tok[], signed: boolean): string {
  const fracAt = toks.findIndex((t) => t.t === "/");
  if (fracAt >= 0) return fraction(n, toks, fracAt, signed);
  let x = Math.abs(n) * 100 ** toks.filter((t) => t.t === "%").length;
  const point = toks.findIndex((t) => t.t === "."), eAt = toks.findIndex((t) => t.t === "E");
  const intEnd = [point, eAt].filter((i) => i >= 0).reduce((a, b) => Math.min(a, b), toks.length);
  const intIdx = toks.map((t, i) => (t.t === "digit" && i < intEnd ? i : -1)).filter((i) => i >= 0);
  const fracIdx = toks.map((t, i) => (t.t === "digit" && point >= 0 && i > point && (eAt < 0 || i < eAt) ? i : -1)).filter((i) => i >= 0);
  const expIdx = toks.map((t, i) => (t.t === "digit" && eAt >= 0 && i > eAt ? i : -1)).filter((i) => i >= 0);
  const lastInt = intIdx.length ? intIdx[intIdx.length - 1] : -1;
  // A comma with no digit after it scales; one among the integer digits groups.
  let group = false;
  toks.forEach((t, i) => {
    if (t.t !== ",") return;
    if (!toks.slice(i + 1).some((u) => u.t === "digit")) x /= 1000;
    else if (intIdx[0] < i && i < lastInt) group = true;
  });
  let exp = 0;
  if (eAt >= 0 && x !== 0) {
    const k = Math.max(1, intIdx.length);
    const engineering = k > 1 && intIdx.some((i) => holderAt(toks[i]) === "#");
    const at = Math.floor(Math.log10(x));
    exp = engineering ? Math.floor(at / k) * k : at - (k - 1);
    x /= 10 ** exp;
    // A mantissa that rounds up to the next power moves the exponent on.
    if (round(x, fracIdx.length) >= 10 ** k) {
      const by = engineering ? k : 1;
      x /= 10 ** by;
      exp += by;
    }
  }
  const r = round(x, fracIdx.length);
  const [whole, frac = ""] = r.toFixed(fracIdx.length).split(".");
  const out = new Map<number, string>();
  const ints = fillRight(whole === "0" ? "" : whole, intIdx.map((i) => holderAt(toks[i])));
  if (group) {
    // The integer digits as one run, grouped, where its first placeholder is.
    const run = ints.join(""), spaces = run.length - run.trimStart().length;
    intIdx.forEach((i, j) => out.set(i, j === 0 ? " ".repeat(spaces) + grouped(run.trim()) : ""));
  } else intIdx.forEach((i, j) => out.set(i, ints[j]));
  fillLeft(frac, fracIdx.map((i) => holderAt(toks[i]))).forEach((d, j) => out.set(fracIdx[j], d));
  fillRight(String(Math.abs(exp)), expIdx.map((i) => holderAt(toks[i]))).forEach((d, j) => out.set(expIdx[j], d));
  let text = "";
  toks.forEach((t, i) => {
    if (t.t === "lit") text += t.s;
    else if (t.t === "digit") text += out.get(i) ?? "";
    else if (t.t === "." || t.t === "%") text += t.t;
    else if (t.t === "E") text += `E${exp < 0 ? "-" : t.plus ? "+" : ""}`;
    else if (t.t === "general") text += show(x);
  });
  const zero = toks.some((t) => t.t === "general") ? x === 0 : r === 0;
  return signed && n < 0 && !zero ? `-${text}` : text;
}

// The best numerator for a denominator of at most `maxDen` (or `fixed`).
function nearest(frac: number, maxDen: number, fixed: number | null): [number, number] {
  if (fixed) return [Math.round(frac * fixed), fixed];
  let best: [number, number] = [0, 1], err = Infinity;
  for (let d = 1; d <= maxDen; d++) {
    const num = Math.round(frac * d), e = Math.abs(frac - num / d);
    if (e < err - 1e-12) { best = [num, d]; err = e; }
  }
  return best;
}

function fraction(n: number, toks: readonly Tok[], slash: number, signed: boolean): string {
  // The numerator: the digits just before '/'; the whole part: digits before those.
  let numStart = slash;
  while (numStart > 0 && toks[numStart - 1].t === "digit") numStart--;
  const numIdx = toks.map((_, i) => i).filter((i) => i >= numStart && i < slash);
  const wholeIdx = toks.map((t, i) => (t.t === "digit" && i < numStart ? i : -1)).filter((i) => i >= 0);
  const denIdx = toks.map((t, i) => (t.t === "digit" && i > slash ? i : -1)).filter((i) => i >= 0);
  const fixedLit = toks.slice(slash + 1).find((t) => t.t === "lit" && /^\d+$/.test((t as { s: string }).s)) as { s: string } | undefined;
  const fixed = !denIdx.length && fixedLit ? Number(fixedLit.s) : null;
  const x = Math.abs(n);
  let whole = wholeIdx.length ? Math.floor(x) : 0;
  let [num, den] = nearest(x - whole, 10 ** Math.max(1, denIdx.length) - 1, fixed);
  if (wholeIdx.length && num === den) { whole++; num = 0; }
  // A whole number with a whole part shows no fraction: spaces where it goes.
  const blank = wholeIdx.length > 0 && num === 0;
  const out = new Map<number, string>();
  fillRight(whole === 0 ? "" : String(whole), wholeIdx.map((i) => holderAt(toks[i]))).forEach((d, j) => out.set(wholeIdx[j], d));
  fillRight(String(num), numIdx.map((i) => holderAt(toks[i]))).forEach((d, j) => out.set(numIdx[j], d));
  // The denominator left to right; the last placeholder takes any extra digits.
  const denText = String(den), denHolders = denIdx.map((i) => holderAt(toks[i]));
  denIdx.forEach((i, j) => out.set(i, j < denText.length ? (j === denHolders.length - 1 ? denText.slice(j) : denText[j])
    : denHolders[j] === "0" ? "0" : denHolders[j] === "?" ? " " : ""));
  let text = "";
  toks.forEach((t, i) => {
    const part = blank && i >= numStart;
    let piece = "";
    if (t.t === "lit") piece = t === (fixedLit as unknown) ? String(den) : t.s;
    else if (t.t === "digit") piece = out.get(i) ?? "";
    else if (t.t === "/") piece = "/";
    text += part ? " ".repeat(piece.length) : piece;
  });
  return signed && n < 0 ? `-${text}` : text;
}

const MONTHS = ["January", "February", "March", "April", "May", "June", "July", "August", "September", "October", "November", "December"];
const DAYS = ["Sunday", "Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday"];
const two = (n: number) => String(n).padStart(2, "0");

// A serial number as a date and time.
function dated(serial: number, toks: readonly Tok[]): string | null {
  if (serial < 0) return null;
  const seconds = Math.round(serial * 86400);
  const d = parts(Math.floor(seconds / 86400));
  const secOfDay = seconds % 86400;
  const h = Math.floor(secOfDay / 3600), mi = Math.floor((secOfDay % 3600) / 60), s = secOfDay % 60;
  const twelve = toks.some((t) => t.t === "date" && /^a/i.test(t.s));
  const dates = toks.map((t, i) => (t.t === "date" ? i : -1)).filter((i) => i >= 0);
  const minute = (i: number) => {
    const k = dates.indexOf(i), before = toks[dates[k - 1]] as { s: string } | undefined, after = toks[dates[k + 1]] as { s: string } | undefined;
    return (before && /^\[?h/.test(before.s)) || (after && /^\[?s/.test(after.s));
  };
  let text = "";
  toks.forEach((t, i) => {
    if (t.t === "lit") { text += t.s; return; }
    if (t.t === "general") { text += show(serial); return; }
    if (t.t === "," || t.t === "/" || t.t === "." || t.t === "%") { text += t.t; return; }
    if (t.t !== "date") return;
    const run = t.s, n = run.length;
    if (/^a/i.test(run)) {
      const pm = h >= 12, [am, p] = run.split("/");
      text += pm ? p : am;
    } else if (run === "[h]") text += Math.floor(seconds / 3600);
    else if (run === "[m]") text += Math.floor(seconds / 60);
    else if (run === "[s]") text += seconds;
    else if (run[0] === "y") text += n <= 2 ? two(d.y % 100) : String(d.y);
    else if (run[0] === "m" && minute(i)) text += n === 1 ? mi : two(mi);
    else if (run[0] === "m") {
      const m = d.m - 1;
      text += n === 1 ? m + 1 : n === 2 ? two(m + 1) : n === 3 ? MONTHS[m].slice(0, 3) : n === 4 ? MONTHS[m] : MONTHS[m][0];
    } else if (run[0] === "d") {
      const day = d.d, w = d.weekday;
      text += n === 1 ? day : n === 2 ? two(day) : n === 3 ? DAYS[w].slice(0, 3) : DAYS[w];
    } else if (run[0] === "h") {
      const hh = twelve ? (h % 12 || 12) : h;
      text += n === 1 ? hh : two(hh);
    } else if (run[0] === "s") text += n === 1 ? s : two(s);
  });
  return text;
}

const isDate = (s: Section) => s.toks.some((t) => t.t === "date");

function render(n: number, s: Section, signed: boolean): string | null {
  return isDate(s) ? dated(n, s.toks) : numeric(n, s.toks, signed);
}

const shown = (text: string | null, s: Section): Shown | null => (text === null ? null : s.color ? { text, color: s.color } : { text });

// A value in a format: its text and the colour its section gives, or null
// when the format has nothing for it (text with no @ section, an error).
export function numberFormat(v: Value, pattern: string): Shown | null {
  if (v === null || v instanceof CellError || typeof v === "boolean") return null;
  const sections = split(pattern).map(section);
  if (typeof v === "string") {
    const textSection = sections.length === 4 ? sections[3] : sections.length === 1 && sections[0].toks.some((t) => t.t === "@") ? sections[0] : null;
    if (textSection) return shown(textSection.toks.map((t) => (t.t === "lit" ? t.s : t.t === "@" ? v : "")).join(""), textSection);
    const serial = parseDate(v);
    return serial !== null && isDate(sections[0]) ? shown(dated(serial, sections[0].toks), sections[0]) : null;
  }
  const numbers = sections.slice(0, 3);
  if (numbers.some((s) => s.cond)) {
    const hit = numbers.find((s) => s.cond?.(v)) ?? numbers.find((s) => !s.cond);
    return hit ? shown(render(v, hit, true), hit) : null;
  }
  if (v < 0 && numbers.length >= 2) return shown(render(-v, numbers[1], false), numbers[1]);
  if (v === 0 && numbers.length >= 3) return shown(render(0, numbers[2], false), numbers[2]);
  return shown(render(v, numbers[0], true), numbers[0]);
}
