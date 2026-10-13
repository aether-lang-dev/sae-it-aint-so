// A cell's editor, as the Tauri spreadsheet's SETCELLEDITOR gives one: a
// checkbox (TRUE or FALSE, drawn ☑ or ☐ and toggled), a dropdown (one of
// its options) or a date (YYYY-MM-DD). The app keeps them but never draws
// them; here the workbook draws a checkbox, the editor bar (view/) offers
// the choices, and cell.set holds what is typed to them. No ui, no sheet.
import { CellError } from "./values.ts";
import type { Value } from "./values.ts";

export type EditorKind = "checkbox" | "dropdown" | "date";
export const EDITOR_KINDS: readonly EditorKind[] = ["checkbox", "dropdown", "date"];

export interface CellEditor {
  readonly kind: EditorKind;
  readonly options?: readonly string[];   // a dropdown's
  readonly format?: string;               // a date's, as the app keeps it
}

// An editor from a kind and its options (a dropdown's, comma-separated) or
// format; a RangeError says what is wrong.
export function editorOf(kind: string, options?: string, format?: string): CellEditor {
  const k = kind.trim().toLowerCase() as EditorKind;
  if (!EDITOR_KINDS.includes(k)) throw new RangeError(`${kind} is not an editor (${EDITOR_KINDS.join(", ")})`);
  if (k === "dropdown") {
    const list = (options ?? "").split(",").map((o) => o.trim()).filter((o) => o);
    if (!list.length) throw new RangeError("a dropdown needs options");
    return { kind: k, options: list };
  }
  return k === "date" && format ? { kind: k, format } : { kind: k };
}

const DATE = /^(\d{4})-(\d{2})-(\d{2})$/;
const isDate = (s: string) => {
  const m = DATE.exec(s);
  if (!m) return false;
  const d = new Date(Date.UTC(Number(m[1]), Number(m[2]) - 1, Number(m[3])));
  return d.getUTCMonth() === Number(m[2]) - 1 && d.getUTCDate() === Number(m[3]);
};

// Why an input does not suit the editor, or null. Empty, and a formula,
// always do.
export function refusal(e: CellEditor, input: string): string | null {
  const t = input.trim();
  if (t === "" || t.startsWith("=")) return null;
  switch (e.kind) {
    case "checkbox": return /^(true|false)$/i.test(t) ? null : "is a checkbox: TRUE or FALSE";
    case "dropdown": return e.options!.includes(t) ? null : `is one of ${e.options!.join(", ")}`;
    case "date": return isDate(t) ? null : "is a date: YYYY-MM-DD";
  }
}

// Whether a checkbox's value is ticked: TRUE, 1, or the text TRUE.
export const checked = (v: Value): boolean =>
  !(v instanceof CellError) && (v === true || v === 1 || (typeof v === "string" && v.trim().toUpperCase() === "TRUE"));

// What a cell with an editor shows: a checkbox its box; the others what
// the cell shows anyway.
export const drawn = (e: CellEditor, v: Value, shown: string): string => (e.kind === "checkbox" ? (checked(v) ? "☑" : "☐") : shown);

// The input a checkbox's toggle sets.
export const toggled = (v: Value): string => (checked(v) ? "FALSE" : "TRUE");

// The editor as the app's GETCELLEDITOR gives it: {type, config}.
export const asApp = (e: CellEditor) => ({ type: e.kind, config: e.options ? { options: [...e.options] } : e.format ? { format: e.format } : {} });

// An editor as a file holds it, read back; undefined for anything else.
export function editorIn(o: unknown): CellEditor | undefined {
  const e = o as { kind?: unknown; options?: unknown; format?: unknown } | null;
  if (!e || typeof e !== "object" || !EDITOR_KINDS.includes(e.kind as EditorKind)) return undefined;
  try {
    return editorOf(String(e.kind), Array.isArray(e.options) ? e.options.map(String).join(",") : undefined, typeof e.format === "string" ? e.format : undefined);
  } catch {
    return undefined;
  }
}
