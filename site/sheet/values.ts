// What a cell holds once worked out, and the coercions every operator and
// function goes through. An error is a value too (a CellError): it flows
// through whatever reads it, so a cell that sums a #DIV/0! shows #DIV/0!.
export type ErrorCode = "#DIV/0!" | "#VALUE!" | "#REF!" | "#NAME?" | "#NUM!" | "#N/A" | "#CYCLE!" | "#ERROR!" | "#CALC!" | "#SPILL!";

export class CellError {
  readonly code: ErrorCode;
  readonly why: string;

  constructor(code: ErrorCode, why: string) {
    this.code = code;
    this.why = why;
  }

  toString(): string { return this.code; }
}

// null is an empty cell.
export type Value = number | string | boolean | null | CellError;

// A dynamic array: what a formula may come to (a range, SEQUENCE, FILTER
// ...), row by row; in a sheet it spills.
export interface ArrayValue {
  readonly kind: "array";
  readonly rows: number;
  readonly cols: number;
  readonly values: readonly Value[];
}

// What a formula comes to: one value, or an array.
export type Result = Value | ArrayValue;

export const isArray = (v: unknown): v is ArrayValue => typeof v === "object" && v !== null && (v as ArrayValue).kind === "array";

export const array = (rows: number, cols: number, values: readonly Value[]): ArrayValue => ({ kind: "array", rows, cols, values });

// An array of one value is that value.
export const collapsed = (r: Result): Result => (isArray(r) && r.rows === 1 && r.cols === 1 ? r.values[0] : r);

export const fail = (code: ErrorCode, why: string): never => { throw new CellError(code, why); };

// An operand that is an error is rethrown: what reads an error is one.
export function scalar(v: Value): Exclude<Value, CellError> {
  if (v instanceof CellError) throw v;
  return v;
}

export function toNumber(v: Value): number {
  const s = scalar(v);
  if (s === null) return 0;
  if (typeof s === "number") return s;
  if (typeof s === "boolean") return s ? 1 : 0;
  const n = s.trim() === "" ? NaN : Number(s);
  return Number.isNaN(n) ? fail("#VALUE!", `'${s}' is not a number`) : n;
}

export function toText(v: Value): string {
  const s = scalar(v);
  if (s === null) return "";
  if (typeof s === "boolean") return s ? "TRUE" : "FALSE";
  return typeof s === "number" ? String(Number(s.toPrecision(12))) : s;
}

export const finite = (n: number): number => (Number.isFinite(n) ? n : fail("#VALUE!", "the result is not a finite number"));

export type Comparison = "=" | "<>" | "<" | ">" | "<=" | ">=";

// Numbers (and TRUE, FALSE, empty) by value; anything else as text, ignoring case.
export function compare(op: Comparison, a: Value, b: Value): boolean {
  const x = scalar(a), y = scalar(b);
  const numeric = (v: typeof x) => v === null || typeof v === "number" || typeof v === "boolean";
  const d = numeric(x) && numeric(y)
    ? toNumber(x) - toNumber(y)
    : toText(x).toUpperCase().localeCompare(toText(y).toUpperCase());
  switch (op) {
    case "=": return d === 0;
    case "<>": return d !== 0;
    case "<": return d < 0;
    case ">": return d > 0;
    case "<=": return d <= 0;
    case ">=": return d >= 0;
    default: return op satisfies never;
  }
}
