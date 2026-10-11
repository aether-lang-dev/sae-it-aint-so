// A sheet file, in the Tauri spreadsheet's format (its .json and .rexxsheet
// files): a name, a setup script, and cells. A cell is text, or
// { value, expression } (a formula without its '='), or { content } (text
// or a formula with its '='), with a comment, a number format, a style and a
// conditional style (styleExpression). Its formulas are RexxJS, as the
// app's are, unless the file says "formulas": "excel".
import type { Note } from "./notes.ts";

export interface SheetFile {
  readonly name: string;
  readonly language: "Excel" | "RexxJS";
  readonly setupScript: string;
  readonly entries: readonly [string, string][];   // [key, input] for Sheet.setMany
  readonly notes: ReadonlyMap<string, Note>;
}

interface FileCell {
  readonly value?: unknown;
  readonly expression?: string | null;
  readonly content?: unknown;
  readonly comment?: string | null;
  readonly format?: string | null;
  readonly style?: unknown;
  readonly styleExpression?: string | null;
}

function inputOf(c: string | FileCell): string {
  if (typeof c === "string") return c;
  if (c.expression) return `=${c.expression}`;
  return String(c.content ?? c.value ?? "");
}

function noteOf(c: string | FileCell): Note {
  if (typeof c === "string") return {};
  const note: Record<string, unknown> = {};
  for (const k of ["comment", "format", "style", "styleExpression"] as const) if (c[k]) note[k] = c[k];
  return note;
}

export function readSheetFile(data: any): SheetFile {
  const cells = Object.entries((data?.cells ?? {}) as Record<string, string | FileCell>)
    .map(([k, c]): [string, string | FileCell] => [k.toUpperCase(), c]);
  return {
    name: String(data?.name ?? "Untitled"),
    language: String(data?.formulas ?? "").toLowerCase() === "excel" ? "Excel" : "RexxJS",
    setupScript: String(data?.setupScript ?? ""),
    entries: cells.map(([k, c]) => [k, inputOf(c)]),
    notes: new Map(cells.map(([k, c]): [string, Note] => [k, noteOf(c)]).filter(([, n]) => Object.keys(n).length)),
  };
}
