// How values read on the sheet, and `fmt`, a tagged template that shows each
// value it is given the way a cell would: fmt`${key} is ${value}`.
import { CellError } from "./values.ts";
import type { Value } from "./values.ts";

export function show(v: Value): string {
  if (v === null) return "";
  if (v instanceof CellError) return v.code;
  if (typeof v === "boolean") return v ? "TRUE" : "FALSE";
  if (typeof v === "number") return String(Number(v.toPrecision(10)));
  return v;
}

export function fmt(strings: TemplateStringsArray, ...values: Value[]): string {
  return strings.reduce((out, s, i) => out + s + (i < values.length ? show(values[i]) : ""), "");
}

// The status line for a cell: what was typed, what it came to, and why it
// is an error when it is one.
export function describe(key: string, input: string, value: Value): string {
  if (input === "") return `${key}: (empty)`;
  const why = value instanceof CellError ? ` ${value.why}` : "";
  return fmt`${key}: ${input} → ${value}` + why;
}
