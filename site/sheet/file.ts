// A sheet file, in the Tauri spreadsheet's format (its .json and .rexxsheet
// files): a name, a setup script, and cells. A cell is text, or
// { value, expression } (a formula without its '='), or { content } (text
// or a formula with its '='), with a comment, a number format, a style and a
// conditional style (styleExpression). Its formulas are RexxJS, as the
// app's are, unless the file says "formulas": "excel".
//
// sae's own additions, which the app passes over: a cell's validation rule
// (validation.ts's, as an object), the first sheet's name (sheetName) and
// named ranges (names: { QTY: "B2:B4" }), and the workbook's other sheets
// (sheets: [{ name, cells, names }]). writeSheetFile writes it all.
import { addrOf, order } from "./address.ts";
import { show } from "./format.ts";
import type { Note } from "./notes.ts";
import { ruleOf } from "./validation.ts";
import type { Page, Workbook } from "./workbook.ts";

export interface FileSheet {
  readonly name: string;
  readonly entries: readonly [string, string][];   // [key, input] for Sheet.setMany
  readonly notes: ReadonlyMap<string, Note>;
  readonly names: readonly [string, string][];     // [NAME, "B2:B4"]
}

export interface SheetFile {
  readonly name: string;
  readonly language: "Excel" | "RexxJS";
  readonly setupScript: string;
  readonly sheets: readonly FileSheet[];           // the first one, then any others
}

interface FileCell {
  readonly value?: unknown;
  readonly expression?: string | null;
  readonly content?: unknown;
  readonly comment?: string | null;
  readonly format?: string | null;
  readonly style?: unknown;
  readonly styleExpression?: string | null;
  readonly validation?: Record<string, unknown> | null;
}

type Cells = Record<string, string | FileCell>;

function inputOf(c: string | FileCell): string {
  if (typeof c === "string") return c;
  if (c.expression) return `=${c.expression}`;
  return String(c.content ?? c.value ?? "");
}

// A rule as written, read as a rule (or none, if it is not one).
function ruleIn(v: Record<string, unknown>): Note["validation"] {
  const text = (x: unknown) => (x === undefined || x === null ? undefined : String(x));
  try {
    return ruleOf({ kind: text(v.kind), values: Array.isArray(v.values) ? v.values.join(",") : text(v.values), min: text(v.min), max: text(v.max), mode: text(v.mode), when: text(v.when) });
  } catch (e) {
    if (e instanceof RangeError) return undefined;
    throw e;
  }
}

function noteOf(c: string | FileCell): Note {
  if (typeof c === "string") return {};
  const note: Record<string, unknown> = {};
  for (const k of ["comment", "format", "style", "styleExpression"] as const) if (c[k]) note[k] = c[k];
  const rule = c.validation ? ruleIn(c.validation) : undefined;
  if (rule) note.validation = rule;
  return note;
}

function sheetOf(name: string, cells: Cells | undefined, names: unknown): FileSheet {
  const list = Object.entries(cells ?? {}).map(([k, c]): [string, string | FileCell] => [k.toUpperCase(), c]);
  return {
    name,
    entries: list.map(([k, c]): [string, string] => [k, inputOf(c)]).filter(([, input]) => input !== ""),
    notes: new Map(list.map(([k, c]): [string, Note] => [k, noteOf(c)]).filter(([, n]) => Object.keys(n).length)),
    names: Object.entries((names ?? {}) as Record<string, unknown>).map(([n, r]): [string, string] => [n.toUpperCase(), String(r)]),
  };
}

export function readSheetFile(data: any): SheetFile {
  const others = Array.isArray(data?.sheets) ? data.sheets : [];
  return {
    name: String(data?.name ?? "Untitled"),
    language: String(data?.formulas ?? "").toLowerCase() === "excel" ? "Excel" : "RexxJS",
    setupScript: String(data?.setupScript ?? ""),
    sheets: [
      sheetOf(String(data?.sheetName ?? "Sheet1"), data?.cells, data?.names),
      ...others.map((s: any, i: number) => sheetOf(String(s?.name ?? `Sheet${i + 2}`), s?.cells, s?.names)),
    ],
  };
}

// A sheet's cells as the file has them: a constant alone as its text; a
// formula as the value it came to and its expression; notes beside either.
function cellsOf(page: Page): Cells {
  const { sheet, notes } = page;
  const keys = [...new Set([...sheet.keys(), ...notes.keys()])].sort((a, b) => order(addrOf(a)!) - order(addrOf(b)!));
  const cells: Cells = {};
  for (const key of keys) {
    const input = sheet.input(key), note = notes.get(key);
    const formula = input.startsWith("=");
    if (!formula && !Object.keys(note).length) {
      cells[key] = input;
      continue;
    }
    cells[key] = { value: formula ? show(sheet.value(key)) : input, ...(formula ? { expression: input.slice(1) } : {}), ...note };
  }
  return cells;
}

const namesOf = (page: Page): Record<string, string> => Object.fromEntries(page.sheet.names());

// The workbook as a file: JSON-ready.
export function writeSheetFile(wb: Workbook) {
  const [first, ...others] = wb.pages();
  return {
    name: wb.name,
    formulas: wb.sheet.language.name === "Excel" ? "excel" : "rexxjs",
    setupScript: wb.setupScript,
    sheetName: first.name,
    cells: cellsOf(first),
    names: namesOf(first),
    sheets: others.map((p) => ({ name: p.name, cells: cellsOf(p), names: namesOf(p) })),
  };
}
