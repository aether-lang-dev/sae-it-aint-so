// The seam under the page: every action on a workbook is a command, as in
// GridCraft (its engine.execute) and the Tauri spreadsheet's control bus. A
// command has an id ("data.sortDescending"), a label and string parameters
// ("range=F4:G7 by=G"), and gives an Outcome: ok or refused, a message, the
// cells whose shown value changed, and sometimes an output (what cell.get
// read, what edit.find found). The page's panels and keys run commands and
// nothing else; so do RexxJS scripts (ADDRESS SHEET, SETCELL, GETCELL:
// script.ts), and the specs, headless and in the browser (the page's
// command bar). The commands that change the workbook are journaled as
// command lines, which replay.
import { COLS, ROWS, colName, keyOf, parseRange, range, splitKey } from "./address.ts";
import { evaluationSteps } from "./audit.ts";
import type { Addr } from "./address.ts";
import { copied, filled, pasted } from "./copy.ts";
import { fromCsv, toCsv } from "./csv.ts";
import { readSheetFile, writeSheetFile } from "./file.ts";
import type { SheetFile } from "./file.ts";
import { show } from "./format.ts";
import { EXAMPLE, FORMATTED, SAMPLE_BUDGET, TEST_SHEET } from "./samples.ts";
import { runScript } from "./script.ts";
import { continued } from "./series.ts";
import { check, describeRule, ruleOf } from "./validation.ts";
import { ICONS, describeRule as describeCf, rangeName } from "./rules.ts";
import type { CfRule, Comparison, IconSet } from "./rules.ts";
import { toStyle } from "./formats.ts";
import type { Look } from "./formats.ts";
import { CHART_KINDS } from "./charts.ts";
import type { ChartKind } from "./charts.ts";
import type { ChartSpec } from "./workbook.ts";
import type { TableDef } from "./language.ts";
import { deleted, inserted, movedBy, restructured } from "./shift.ts";
import type { Scope } from "./shift.ts";
import { found, replaced, sortMoves, sorted } from "./sortfind.ts";
import { distinctRows, secant, splitText } from "./whatif.ts";
import { criterion } from "./functions.ts";

const NUMERIC_TEXT = /^\s*[-+]?(?:\d+\.?\d*|\.\d+)\s*$/;
import { CellError } from "./values.ts";
import type { Value } from "./values.ts";
import type { Direction, LanguageName, Page, Workbook } from "./workbook.ts";
import { FormulaError } from "./lexer.ts";

export type Params = Readonly<Record<string, string>>;

// Where files are saved: the page's `storage` (get, set, remove; a key is
// letters, digits, '.', '_' or '-'), or one in memory.
export interface Store {
  get(key: string): string | null;
  set(key: string, value: string): void;
  remove(key: string): void;
}

export function memoryStore(): Store {
  const m = new Map<string, string>();
  return { get: (k) => m.get(k) ?? null, set: (k, v) => { m.set(k, v); }, remove: (k) => { m.delete(k); } };
}

export interface Outcome {
  readonly ok: boolean;
  readonly message: string;
  readonly changed: readonly string[];
  readonly output?: unknown;
}

interface Spec {
  readonly id: string;
  readonly label: string;
  readonly params: readonly string[];       // each required
  readonly optional?: readonly string[];
  readonly journaled: boolean;              // it changes the workbook (or the clipboard)
  run(wb: Workbook, p: Params, store: Store): Promise<Outcome>;
}

// A command that cannot run as asked: its message is the Outcome's.
class Refused extends Error {}
const refuse = (message: string): never => { throw new Refused(message); };

// ---- The command line: an id, then name=value pairs; a value with spaces,
// quotes or '=' is quoted, "" being a quote inside.

export function parseLine(line: string): { id: string; params: Record<string, string> } {
  const m = /^\s*(\S+)/.exec(line);
  const params: Record<string, string> = {};
  let rest = line.slice(m ? m[0].length : 0);
  for (;;) {
    const p = /^\s*([A-Za-z_][\w]*)=("(?:[^"]|"")*"|\S*)/.exec(rest);
    if (!p) break;
    params[p[1]] = p[2].startsWith('"') ? p[2].slice(1, -1).replace(/""/g, '"') : p[2];
    rest = rest.slice(p[0].length);
  }
  return { id: m ? m[1] : "", params };
}

export function lineOf(id: string, params: Params): string {
  const value = (v: string) => (v === "" || /[\s"=]/.test(v) ? `"${v.replace(/"/g, '""')}"` : v);
  return [id, ...Object.entries(params).map(([k, v]) => `${k}=${value(v)}`)].join(" ");
}

// ---- Reading parameters

const cellOf = (s: string): string => {
  const r = parseRange(s);
  return r && keyOf(r[0]) === keyOf(r[1]) ? keyOf(r[0]) : refuse(`${s} is not a cell on the sheet`);
};
const rangeOf = (s: string): [Addr, Addr] => parseRange(s) ?? refuse(`${s} is not a range on the sheet`);
const named = ([a, b]: [Addr, Addr]) => `${keyOf(a)}:${keyOf(b)}`;
const flag = (s: string | undefined) => /^(1|true|yes|on)$/i.test(s ?? "");
const topLeft = ([a, b]: [Addr, Addr]): Addr => ({ col: Math.min(a.col, b.col), row: Math.min(a.row, b.row) });
const columnOf = (s: string): number => {
  const c = String(s).trim().toUpperCase().charCodeAt(0) - 65;
  return s.trim().length === 1 && c >= 0 && c < COLS ? c : refuse(`${s} is not a column on the sheet`);
};
const countOf = (s: string | undefined): number => {
  const n = Number(s ?? "1");
  return Number.isInteger(n) && n >= 1 ? n : refuse(`${s} is not a count`);
};

// ---- What changing commands share

const inputs = (wb: Workbook) => (key: string) => wb.sheet.input(key);

async function setting(wb: Workbook, entries: readonly (readonly [string, string])[], what: string): Promise<Outcome> {
  const changed = await wb.sheet.setMany(entries);
  await wb.settle();
  return { ok: true, message: `${what}: ${new Set(entries.map(([k]) => k)).size} cells set, ${changed.length} changed`, changed };
}

async function changedBy(wb: Workbook, changed: readonly string[], message: string): Promise<Outcome> {
  await wb.settle();
  return { ok: true, message, changed };
}

const SAMPLES: Record<string, unknown> = { budget: SAMPLE_BUDGET, test: TEST_SHEET, formatted: FORMATTED };

// A sheet file: the workbook emptied, its language, its setup script run,
// each sheet's cells set, its notes and names kept; where undo stops.
async function open(wb: Workbook, file: SheetFile): Promise<Outcome> {
  const before = wb.sheet.keys();
  wb.reset(file.sheets[0].name);
  const failed = file.language === "RexxJS" ? await wb.rexx.setup(file.setupScript) : null;
  await wb.setLanguage(wb.language(file.language));
  for (const [i, s] of file.sheets.entries()) {
    if (i > 0) await wb.add(s.name);
    for (const [n, r] of s.names) {
      const corners = parseRange(r);
      if (corners) await wb.sheet.define(n, corners);
    }
    await wb.sheet.setMany(s.entries);
    wb.sheet.forget();
    for (const [key, note] of s.notes) wb.notes.set(key, note);
    wb.page(s.name)!.rules = [...s.rules];
    const page = wb.page(s.name)!;
    page.charts = [...s.charts];
    page.hiddenRows = new Set(s.view.hiddenRows);
    page.hiddenCols = new Set(s.view.hiddenCols);
    page.frozen = s.view.frozenRows;
    page.heights = new Map(s.view.rowHeights);
    page.merges = s.merges.map((m) => parseRange(m)!);
    for (const t of s.tables) await wb.sheet.defineTable(t.name, t);
  }
  wb.activate(file.sheets[0].name);
  wb.name = file.name;
  wb.setupScript = file.setupScript;
  await wb.settle();
  const cells = file.sheets.reduce((n, s) => n + s.entries.length, 0);
  const message = `opened ${file.name}: ${cells} cells, ${file.language} formulas`;
  return { ok: true, message: failed ? `${message}; its setup script failed: ${failed.split("\n").pop()}` : message, changed: [...new Set([...before, ...wb.sheet.keys()])] };
}

// Saved files: each under "sheet.file.<name>" (any character of the name
// but a letter or digit as _ and its code: "Spec book" is Spec_0020book),
// and their names, in the order saved, under "sheet.files".
const FILES = "sheet.files";
const fileKey = (name: string) => `sheet.file.${name.replace(/[^A-Za-z0-9]/g, (c) => `_${c.charCodeAt(0).toString(16).padStart(4, "0")}`)}`;
const savedNames = (store: Store): string[] => {
  try {
    const v = JSON.parse(store.get(FILES) ?? "[]");
    return Array.isArray(v) ? v.map(String) : [];
  } catch {
    return [];
  }
};
const savedName = (store: Store, name: string): string =>
  savedNames(store).find((n) => n.toUpperCase() === name.trim().toUpperCase()) ?? refuse(`no saved file ${name}`);

// The used part of the sheet: A1 to its last row and column.
function usedRange(wb: Workbook): [Addr, Addr] {
  const used = wb.sheet.keys().map((k) => parseRange(k)![0]);
  return [{ col: 0, row: 0 }, { col: Math.max(0, ...used.map((a) => a.col)), row: Math.max(0, ...used.map((a) => a.row)) }];
}

// Rows or columns inserted or deleted: every cell and formula moved, as one
// change (one undo); notes and conditional styles follow, and so do other
// sheets' references to this one (each sheet's own change).
function restructure(how: "insert" | "delete", axis: "row" | "col") {
  return async (wb: Workbook, p: Params): Promise<Outcome> => {
    const at = axis === "row" ? Number(p.at) - 1 : columnOf(p.at);
    if (!Number.isInteger(at) || at < 0 || at >= (axis === "row" ? ROWS : COLS)) refuse(`${p.at} is not a ${axis === "row" ? "row" : "column"} on the sheet`);
    const n = countOf(p.count);
    const here = wb.active.toUpperCase();
    const editOf = (moves: Scope) => (how === "insert" ? inserted(axis, at, n, moves) : deleted(axis, at, n, moves));
    const edit = editOf((sheet) => sheet === null || sheet === here);
    const entries = restructured(wb.sheet.keys().map((k) => [k, wb.sheet.input(k)]), edit, wb.sheet.language);
    const there = editOf((sheet) => sheet === here);
    for (const page of wb.pages()) {
      if (page.sheet === wb.sheet) continue;
      const rewritten = page.sheet.keys().map((k): [string, string] => [k, page.sheet.language.rewrite(page.sheet.input(k), there)])
        .filter(([k, input]) => input !== page.sheet.input(k));
      if (rewritten.length) await page.sheet.setMany(rewritten);
    }
    wb.notes.remap((a) => edit.cell(a, { col: false, row: false }), (e) => wb.sheet.language.rewrite(`=${e}`, edit).slice(1));
    const page = wb.page(wb.active)!, still = { col: false, row: false };
    page.rules = page.rules.flatMap((r): CfRule[] => {
      const to = edit.range(r.range[0], r.range[1], still, still);
      return to ? [{ ...r, range: to }] : [];
    });
    page.charts = page.charts.flatMap((c): ChartSpec[] => {
      const to = edit.range(c.range[0], c.range[1], still, still);
      return to ? [{ ...c, range: to }] : [];
    });
    // Hidden rows (columns) move with the rest, and go with deleted ones.
    const moved = (set: Set<number>, row: boolean) => new Set([...set].flatMap((i) => {
      const to = edit.cell(row ? { col: 0, row: i } : { col: i, row: 0 }, still);
      return to ? [row ? to.row : to.col] : [];
    }));
    if (axis === "row") page.hiddenRows = moved(page.hiddenRows, true); else page.hiddenCols = moved(page.hiddenCols, false);
    if (page.filtered && axis === "row") page.filtered = moved(page.filtered, true);
    page.merges = page.merges.flatMap((m): [Addr, Addr][] => {
      const to = edit.range(m[0], m[1], still, still);
      return to && keyOf(to[0]) !== keyOf(to[1]) ? [to] : [];
    });
    for (const t of wb.sheet.tables()) {
      const to = edit.range(t.range[0], t.range[1], still, still);
      await wb.sheet.defineTable(t.name, to ? { ...t, range: to } : null);
    }
    if (axis === "row") {
      page.heights = new Map([...page.heights].flatMap(([row, h]): [number, number][] => {
        const to = edit.cell({ col: 0, row }, still);
        return to ? [[to.row, h]] : [];
      }));
    }
    const thing = `${n} ${axis === "row" ? "row" : "column"}${n === 1 ? "" : "s"}`;
    return setting(wb, entries, `${how === "insert" ? "inserted" : "deleted"} ${thing} at ${axis === "row" ? at + 1 : colName(at)}`);
  };
}

function sort(ascending: boolean) {
  return async (wb: Workbook, p: Params): Promise<Outcome> => {
    const r = rangeOf(p.range), by = columnOf(p.by);
    const left = Math.min(r[0].col, r[1].col), right = Math.max(r[0].col, r[1].col);
    if (by < left || by > right) refuse(`${p.by} is not a column of ${named(r)}`);
    const entries = sorted(wb.sheet, r[0], r[1], by - left, ascending, wb.sheet.language);
    wb.notes.remap(sortMoves(wb.sheet, r[0], r[1], by - left, ascending),
      (e, from, to) => movedBy(wb.sheet.language, `=${e}`, { cols: 0, rows: to.row - from.row }).slice(1));
    return setting(wb, entries, `sorted ${named(r)} by ${colName(by)}, ${ascending ? "ascending" : "descending"}`);
  };
}

// A name for a range: a letter first, then letters, digits or _; not a
// cell, nor TRUE or FALSE.
const nameOf = (s: string): string => {
  if (/^[A-Za-z]+\d+$/.test(s)) refuse(`${s} is a cell, not a name`);
  if (!/^[A-Za-z_]\w*$/.test(s) || /^(TRUE|FALSE)$/i.test(s)) refuse(`${s} is not a name: a letter first, then letters, digits or _`);
  return s.toUpperCase();
};

// A sheet's name: letters, digits, spaces or _ (Excel's quotes take the
// spaces: 'My Costs'!B2).
const sheetNameOf = (s: string): string => {
  const t = String(s).trim();
  return /^[A-Za-z0-9_ ]+$/.test(t) ? t : refuse(`${s} is not a sheet name: letters, digits, spaces or _`);
};
const pageOf = (wb: Workbook, name: string) => wb.page(name) ?? refuse(`no sheet ${name}`);

// What the grid shows changes wholesale when the active sheet does.
const shownKeys = (wb: Workbook, before: readonly string[]) => [...new Set([...before, ...wb.sheet.keys()])];

// ---- What-if and data tools (whatif.ts).

const numberOf = (s: string): number => {
  const n = Number(s);
  return s.trim() !== "" && Number.isFinite(n) ? n : refuse(`${s} is not a number`);
};

// A value as an input that comes back to it (a number in full).
const inputOf = (v: Value): string => (v === null ? "" : v instanceof CellError ? v.code : typeof v === "boolean" ? (v ? "TRUE" : "FALSE") : String(v));

// Cells tried with each of `trials` in turn, then put back as they were;
// what `read` gave for each.
async function tried<T>(wb: Workbook, cells: readonly string[], trials: readonly (readonly string[])[], read: () => T): Promise<T[]> {
  const was = cells.map((k) => [k, wb.sheet.input(k)] as [string, string]);
  const out: T[] = [];
  try {
    for (const t of trials) {
      await wb.sheet.trial(cells.map((k, i) => [k, t[i]] as [string, string]));
      out.push(read());
    }
  } finally {
    await wb.sheet.trial(was);
  }
  return out;
}

const DELIMITERS: Record<string, string> = { comma: ",", tab: "\t", space: " ", semicolon: ";" };

// ---- Conditional-format rules (rules.ts), on the active sheet.

const COMPARISONS: Record<string, Comparison> = {
  greater: ">", less: "<", between: "between", equal: "=", notequal: "<>", greaterorequal: ">=", lessorequal: "<=", contains: "contains",
  ">": ">", "<": "<", "=": "=", "<>": "<>", ">=": ">=", "<=": "<=",
};
// Excel's Light Red Fill with Dark Red Text.
const HIGHLIGHT = "background: #ffc7ce; color: #9c0006";
const styleParam = (p: Params): string => (p.style === undefined ? HIGHLIGHT : toStyle(p.style) || refuse(`${p.style} is not a style the grid can draw`));

// A rule added to the active sheet's, last (so the earlier ones win).
async function addRule(wb: Workbook, rule: CfRule): Promise<Outcome> {
  wb.page(wb.active)!.rules.push(rule);
  return changedBy(wb, [...range(rule.range[0], rule.range[1])], describeCf(rule));
}

// ---- A cell's look (formats.ts's Look), a part at a time.

// Each cell of a range's look changed by `change`.
function relook(wb: Workbook, r: [Addr, Addr], change: (look: Look, key: string) => Look): string[] {
  const keys = [...range(r[0], r[1])];
  for (const k of keys) {
    const look = change(wb.notes.get(k).look ?? {}, k);
    wb.notes.set(k, { look: Object.values(look).some((v) => v !== undefined && v !== false) ? look : undefined });
  }
  return keys;
}

const EDGES = ["outline", "all", "top", "right", "bottom", "left", "none"];

// ---- Rows and columns out of view.

// The rows (or columns) a range covers, 0-based, and as people count them.
function spanOf(r: [Addr, Addr], rows: boolean): { at: number[]; said: string } {
  const lo = rows ? Math.min(r[0].row, r[1].row) : Math.min(r[0].col, r[1].col), hi = rows ? Math.max(r[0].row, r[1].row) : Math.max(r[0].col, r[1].col);
  const name = (i: number) => (rows ? String(i + 1) : colName(i));
  const at = Array.from({ length: hi - lo + 1 }, (_, i) => lo + i);
  return { at, said: `${rows ? "row" : "column"}${at.length > 1 ? `s ${name(lo)} to ${name(hi)}` : ` ${name(lo)}`}` };
}

function hiding(rows: boolean, hide: boolean) {
  return async (wb: Workbook, p: Params): Promise<Outcome> => {
    const page = wb.page(wb.active)!, { at, said } = spanOf(rangeOf(p.range), rows);
    const set = rows ? page.hiddenRows : page.hiddenCols;
    for (const i of at) if (hide) set.add(i); else set.delete(i);
    return changedBy(wb, wb.sheet.keys(), `${hide ? "hid" : "showed"} ${said}`);
  };
}

// A table's columns' names: given, or its first row's, or its letters.
function tableColumns(wb: Workbook, t: TableDef): string[] {
  const left = Math.min(t.range[0].col, t.range[1].col), right = Math.max(t.range[0].col, t.range[1].col);
  const cols = Array.from({ length: right - left + 1 }, (_, i) => left + i);
  if (t.columns) return [...t.columns];
  return cols.map((col) => (t.headers ? show(wb.sheet.value(keyOf({ col, row: t.range[0].row }))) : colName(col)));
}

// Two ranges that share a cell.
const overlap = ([a, b]: [Addr, Addr], [c, d]: [Addr, Addr]): boolean =>
  Math.max(Math.min(a.col, b.col), Math.min(c.col, d.col)) <= Math.min(Math.max(a.col, b.col), Math.max(c.col, d.col))
  && Math.max(Math.min(a.row, b.row), Math.min(c.row, d.row)) <= Math.min(Math.max(a.row, b.row), Math.max(c.row, d.row));

// Trace Precedents or Dependents: a level further each time.
function trace(direction: Direction) {
  const [verb, more] = direction === "precedents" ? ["reads", "they read"] : ["is read by", "they are read by"];
  return async (wb: Workbook, p: Params): Promise<Outcome> => {
    const key = cellOf(p.cell), levels = wb.trace(key, direction);
    await wb.settle();
    const said = levels.length ? levels.map((l, i) => `${i ? `, and ${more}` : verb} ${l.join(" ")}`).join("") : `${verb} nothing`;
    return { ok: true, message: `${key} ${said}`, changed: wb.sheet.keys(), output: levels };
  };
}

// A watched cell: "Costs!B2", or B2 on the active sheet.
const watchedOf = (wb: Workbook, s: string): [Page, string] => {
  const { sheet, cell } = splitKey(s.trim());
  return [sheet === null ? wb.page(wb.active)! : pageOf(wb, sheet), cellOf(cell)];
};

const findOptions = (p: Params) => ({ matchCase: flag(p.matchCase), wholeCell: flag(p.wholeCell), inFormulas: flag(p.inFormulas) });
const FIND_OPTIONS = ["matchCase", "wholeCell", "inFormulas"];

const SPECS: readonly Spec[] = [
  {
    id: "cell.set", label: "Set a cell", params: ["cell", "input"], journaled: true,
    run: async (wb, p) => {
      const key = cellOf(p.cell);
      // Its rule, if it has one: stop refuses what breaks it, warn says so.
      const rule = wb.notes.get(key).validation;
      const broken = rule ? check(rule, p.input, wb.sheet.input(key) === "") : null;
      if (broken && rule!.mode === "stop") refuse(`${key} ${broken}`);
      const changed = await wb.sheet.set(key, p.input);
      return changedBy(wb, changed, `${key} = ${show(wb.sheet.value(key))}${broken ? ` (${key} ${broken})` : ""}`);
    },
  },
  {
    id: "cell.get", label: "Read a cell", params: ["cell"], journaled: false,
    run: async (wb, p) => {
      const key = cellOf(p.cell), shown = show(wb.sheet.value(key));
      return { ok: true, message: `${key} = ${shown}`, changed: [], output: shown };
    },
  },
  {
    id: "cell.comment", label: "Comment", params: ["cell", "text"], journaled: true,
    run: async (wb, p) => {
      const key = cellOf(p.cell);
      wb.notes.set(key, { comment: p.text });
      return changedBy(wb, [key], `${key} comment ${p.text}`);
    },
  },
  {
    id: "cell.format", label: "Number format or style", params: ["cell", "format"], journaled: true,
    run: async (wb, p) => {
      const key = cellOf(p.cell);
      wb.notes.set(key, { format: p.format });
      return changedBy(wb, [key], `${key} format ${p.format}`);
    },
  },
  {
    id: "range.clear", label: "Clear contents", params: ["range"], journaled: true,
    run: (wb, p) => {
      const r = rangeOf(p.range);
      return setting(wb, [...range(r[0], r[1])].map((k) => [k, ""] as const), `cleared ${named(r)}`);
    },
  },
  {
    id: "validation.set", label: "Data Validation", params: ["range", "kind"], optional: ["values", "min", "max", "mode", "when"], journaled: true,
    run: async (wb, p) => {
      const r = rangeOf(p.range), rule = ruleOf(p), keys = [...range(r[0], r[1])];
      for (const k of keys) wb.notes.set(k, { validation: rule });
      return changedBy(wb, keys, `${named(r)} ${describeRule(rule)}`);
    },
  },
  {
    id: "validation.clear", label: "Clear Validation", params: ["range"], journaled: true,
    run: async (wb, p) => {
      const r = rangeOf(p.range), keys = [...range(r[0], r[1])];
      for (const k of keys) wb.notes.set(k, { validation: undefined });
      return changedBy(wb, keys, `${named(r)} has no rule`);
    },
  },
  {
    id: "validation.circle", label: "Circle Invalid Data", params: [], optional: ["off"], journaled: true,
    run: async (wb, p) => {
      wb.circling = !flag(p.off);
      const invalid = wb.invalid();
      await wb.settle();
      return { ok: true, message: wb.circling ? `${invalid.length} invalid: ${invalid.join(" ") || "none"}` : "circles cleared", changed: invalid, output: invalid };
    },
  },
  {
    id: "range.clearFormats", label: "Clear Formats", params: ["range"], journaled: true,
    run: async (wb, p) => {
      const r = rangeOf(p.range), keys = [...range(r[0], r[1])];
      for (const k of keys) wb.notes.set(k, { format: "", style: "", styleExpression: "", look: undefined });
      return changedBy(wb, keys, `cleared the formats of ${named(r)}`);
    },
  },
  {
    id: "range.clearComments", label: "Clear Comments", params: ["range"], journaled: true,
    run: async (wb, p) => {
      const r = rangeOf(p.range), keys = [...range(r[0], r[1])];
      for (const k of keys) wb.notes.set(k, { comment: "" });
      return changedBy(wb, keys, `cleared the comments of ${named(r)}`);
    },
  },
  {
    id: "range.clearAll", label: "Clear All", params: ["range"], journaled: true,
    run: (wb, p) => {
      const r = rangeOf(p.range), keys = [...range(r[0], r[1])];
      for (const k of keys) wb.notes.set(k, { comment: "", format: "", style: "", styleExpression: "", look: undefined });
      return setting(wb, keys.map((k) => [k, ""] as const), `cleared all of ${named(r)}`);
    },
  },
  {
    id: "sheet.clear", label: "Clear all", params: [], journaled: true,
    run: (wb) => {
      wb.notes.clear();
      return setting(wb, wb.sheet.keys().map((k) => [k, ""] as const), "cleared");
    },
  },
  {
    id: "edit.copy", label: "Copy", params: ["range"], journaled: true,
    run: async (wb, p) => {
      const r = rangeOf(p.range), from = topLeft(r);
      const rows = Math.abs(r[0].row - r[1].row) + 1, cols = Math.abs(r[0].col - r[1].col) + 1;
      const grid = <T>(f: (key: string) => T): T[][] =>
        Array.from({ length: rows }, (_, i) => Array.from({ length: cols }, (_, j) => f(keyOf({ col: from.col + j, row: from.row + i }))));
      wb.clip = {
        tsv: copied(inputs(wb), r[0], r[1]), from, language: wb.sheet.language,
        inputs: grid((k) => wb.sheet.input(k)), shown: grid((k) => show(wb.sheet.value(k))), notes: grid((k) => wb.notes.get(k)),
      };
      return { ok: true, message: `copied ${named(r)}`, changed: [] };
    },
  },
  {
    id: "edit.paste", label: "Paste", params: ["at"], journaled: true,
    run: (wb, p) => {
      const at = rangeOf(p.at)[0];
      const clip = wb.clip ?? refuse("nothing copied");
      return setting(wb, pasted(clip.tsv, at, { from: clip.from, language: clip.language }), `pasted at ${keyOf(at)}`);
    },
  },
  {
    id: "edit.pasteSpecial", label: "Paste Special", params: ["at", "what"], optional: ["transpose"], journaled: true,
    run: async (wb, p) => {
      const at = rangeOf(p.at)[0];
      const clip = wb.clip ?? refuse("nothing copied");
      const what = p.what.toLowerCase();
      if (!["values", "formulas", "formats", "all"].includes(what)) refuse(`${p.what} is not values, formulas, formats or all`);
      const turned = flag(p.transpose);
      const entries: [string, string][] = [];
      clip.inputs.forEach((row, i) => row.forEach((input, j) => {
        const to = { col: at.col + (turned ? i : j), row: at.row + (turned ? j : i) };
        if (to.col >= COLS || to.row >= ROWS) return;
        const by = { cols: to.col - (clip.from.col + j), rows: to.row - (clip.from.row + i) };
        const key = keyOf(to);
        if (what === "values") entries.push([key, clip.shown[i][j]]);
        if (what === "formulas" || what === "all") entries.push([key, movedBy(clip.language, input, by)]);
        if (what === "formats" || what === "all") {
          const n = clip.notes[i][j];
          wb.notes.set(key, {
            format: n.format ?? "", style: n.style ?? "", look: n.look,
            styleExpression: n.styleExpression ? movedBy(clip.language, `=${n.styleExpression}`, by).slice(1) : "",
            ...(what === "all" ? { comment: n.comment ?? "" } : {}),
          });
        }
      }));
      return setting(wb, entries, `pasted ${what}${turned ? ", transposed," : ""} at ${keyOf(at)}`);
    },
  },
  {
    id: "edit.fillSeries", label: "Series", params: ["range"], journaled: true,
    run: (wb, p) => {
      const r = rangeOf(p.range), tl = topLeft(r);
      const rows = Math.abs(r[0].row - r[1].row) + 1, cols = Math.abs(r[0].col - r[1].col) + 1;
      // Down each column, or across each row when the selection is one row tall.
      const down = rows > 1;
      const lines = down ? cols : rows, length = down ? rows : cols;
      const at = (line: number, i: number) => keyOf(down ? { col: tl.col + line, row: tl.row + i } : { col: tl.col + i, row: tl.row + line });
      const entries: [string, string][] = [];
      for (let line = 0; line < lines; line++) {
        const first = [wb.sheet.input(at(line, 0))];
        if (!first[0]) continue;
        if (length > 2 && wb.sheet.input(at(line, 1))) first.push(wb.sheet.input(at(line, 1)));
        // A formula is moved by its offset from the cell it repeats, as Fill Down moves it.
        continued(first, length - first.length).forEach((input, i) => {
          const n = first.length + i, src = n % first.length;
          const off = n - src;
          entries.push([at(line, n), movedBy(wb.sheet.language, input, down ? { cols: 0, rows: off } : { cols: off, rows: 0 })]);
        });
      }
      return setting(wb, entries, `filled ${named(r)} as a series`);
    },
  },
  {
    id: "formulas.autoSum", label: "AutoSum", params: ["cell"], journaled: true,
    run: async (wb, p) => {
      const key = cellOf(p.cell), a = parseRange(key)![0];
      const isNumber = (col: number, row: number) => col >= 0 && row >= 0 && typeof wb.sheet.value(keyOf({ col, row })) === "number";
      let from: Addr | null = null;
      if (isNumber(a.col, a.row - 1)) {
        let row = a.row - 1;
        while (isNumber(a.col, row - 1)) row--;
        from = { col: a.col, row };
      } else if (isNumber(a.col - 1, a.row)) {
        let col = a.col - 1;
        while (isNumber(col - 1, a.row)) col--;
        from = { col, row: a.row };
      }
      if (!from) refuse(`no numbers above or to the left of ${key}`);
      const to = from!.col === a.col ? { col: a.col, row: a.row - 1 } : { col: a.col - 1, row: a.row };
      const span = `${keyOf(from!)}:${keyOf(to)}`;
      const formula = wb.sheet.language.name === "Excel" ? `=SUM(${span})` : `=SUM_RANGE("${span}")`;
      const changed = await wb.sheet.set(key, formula);
      return changedBy(wb, changed, `${key} = ${show(wb.sheet.value(key))}`);
    },
  },
  {
    id: "edit.fillDown", label: "Fill Down", params: ["range"], journaled: true,
    run: (wb, p) => {
      const r = rangeOf(p.range);
      return setting(wb, filled(inputs(wb), r[0], r[1], "down", wb.sheet.language), `filled ${named(r)} down`);
    },
  },
  {
    id: "edit.fillRight", label: "Fill Right", params: ["range"], journaled: true,
    run: (wb, p) => {
      const r = rangeOf(p.range);
      return setting(wb, filled(inputs(wb), r[0], r[1], "right", wb.sheet.language), `filled ${named(r)} right`);
    },
  },
  {
    id: "edit.undo", label: "Undo", params: [], journaled: true,
    run: async (wb) => {
      const changed = await wb.sheet.undo();
      return changedBy(wb, changed, `undo: ${changed.length} changed`);
    },
  },
  {
    id: "edit.redo", label: "Redo", params: [], journaled: true,
    run: async (wb) => {
      const changed = await wb.sheet.redo();
      return changedBy(wb, changed, `redo: ${changed.length} changed`);
    },
  },
  {
    id: "edit.find", label: "Find", params: ["text"], optional: FIND_OPTIONS, journaled: false,
    run: async (wb, p) => {
      const keys = found(wb.sheet, p.text, findOptions(p));
      return { ok: true, message: `find ${p.text}: ${keys.join(" ") || "none"}`, changed: [], output: keys };
    },
  },
  {
    id: "edit.replace", label: "Replace All", params: ["text", "with"], optional: FIND_OPTIONS, journaled: true,
    run: (wb, p) => setting(wb, replaced(wb.sheet, p.text, p.with, findOptions(p)), `replaced ${p.text}`),
  },
  { id: "rows.insert", label: "Insert Sheet Rows", params: ["at"], optional: ["count"], journaled: true, run: restructure("insert", "row") },
  { id: "rows.delete", label: "Delete Sheet Rows", params: ["at"], optional: ["count"], journaled: true, run: restructure("delete", "row") },
  { id: "columns.insert", label: "Insert Sheet Columns", params: ["at"], optional: ["count"], journaled: true, run: restructure("insert", "col") },
  { id: "columns.delete", label: "Delete Sheet Columns", params: ["at"], optional: ["count"], journaled: true, run: restructure("delete", "col") },
  { id: "data.sortAscending", label: "Sort A to Z", params: ["range", "by"], journaled: true, run: sort(true) },
  { id: "data.sortDescending", label: "Sort Z to A", params: ["range", "by"], journaled: true, run: sort(false) },
  {
    id: "names.define", label: "Define Name", params: ["name", "range"], journaled: true,
    run: async (wb, p) => {
      const n = nameOf(p.name), r = rangeOf(p.range);
      const changed = await wb.sheet.define(n, r);
      return changedBy(wb, changed, `${n} is ${wb.sheet.names().find(([x]) => x === n)![1]}`);
    },
  },
  {
    id: "names.delete", label: "Delete Name", params: ["name"], journaled: true,
    run: async (wb, p) => {
      const n = p.name.toUpperCase();
      if (!wb.sheet.name(n)) refuse(`no name ${n}`);
      const changed = await wb.sheet.define(n, null);
      return changedBy(wb, changed, `${n} deleted`);
    },
  },
  {
    id: "names.list", label: "Name Manager", params: [], journaled: false,
    run: async (wb) => {
      const names = wb.sheet.names().map(([n, r]) => `${n} ${r}`);
      return { ok: true, message: names.length ? names.join(", ") : "no names", changed: [], output: names };
    },
  },
  { id: "formulas.tracePrecedents", label: "Trace Precedents", params: ["cell"], journaled: false, run: trace("precedents") },
  { id: "formulas.traceDependents", label: "Trace Dependents", params: ["cell"], journaled: false, run: trace("dependents") },
  {
    id: "formulas.removeArrows", label: "Remove Arrows", params: [], journaled: false,
    run: async (wb) => {
      wb.clearTraces();
      return changedBy(wb, wb.sheet.keys(), "arrows removed");
    },
  },
  {
    id: "formulas.showFormulas", label: "Show Formulas", params: [], optional: ["off"], journaled: false,
    run: async (wb, p) => {
      wb.showFormulas = !flag(p.off);
      return changedBy(wb, wb.sheet.keys(), wb.showFormulas ? "showing formulas" : "showing values");
    },
  },
  {
    id: "formulas.evaluate", label: "Evaluate Formula", params: ["cell"], journaled: false,
    run: async (wb, p) => {
      const key = cellOf(p.cell), input = wb.sheet.input(key);
      if (!input.startsWith("=")) refuse(`${key} is not a formula`);
      if (wb.sheet.language.name !== "Excel") refuse("Evaluate Formula steps through Excel formulas");
      let steps: string[] = [];
      try {
        steps = evaluationSteps(input.slice(1), { get: (k) => wb.sheet.value(k) }, (n) => wb.sheet.name(n));
      } catch (e) {
        if (!(e instanceof FormulaError)) throw e;
        refuse(`${key}: parse error at ${e.at}: ${e.message}`);
      }
      return { ok: true, message: `${key}: ${steps.join(" → ")}`, changed: [], output: steps };
    },
  },
  {
    id: "formulas.watch", label: "Add Watch", params: ["cell"], journaled: false,
    run: async (wb, p) => {
      const [page, cell] = watchedOf(wb, p.cell);
      return { ok: true, message: `${wb.watch(page, cell) ? "watching" : "already watching"} ${page.name}!${cell}`, changed: [] };
    },
  },
  {
    id: "formulas.unwatch", label: "Delete Watch", params: ["cell"], journaled: false,
    run: async (wb, p) => {
      const [page, cell] = watchedOf(wb, p.cell);
      if (!wb.unwatch(page, cell)) refuse(`not watching ${page.name}!${cell}`);
      return { ok: true, message: `stopped watching ${page.name}!${cell}`, changed: [] };
    },
  },
  {
    id: "format.highlight", label: "Highlight Cells Rules", params: ["range", "op", "value"], optional: ["value2", "style"], journaled: true,
    run: (wb, p) => {
      const op = COMPARISONS[p.op.toLowerCase()] ?? refuse(`${p.op} is not a comparison (greater, less, between, equal, notEqual, greaterOrEqual, lessOrEqual, contains)`);
      if (op === "between" && p.value2 === undefined) refuse("between needs value2");
      return addRule(wb, { kind: "cellValue", range: rangeOf(p.range), op, value: p.value, ...(op === "between" ? { value2: p.value2 } : {}), style: styleParam(p) });
    },
  },
  {
    id: "format.topBottom", label: "Top/Bottom Rules", params: ["range"], optional: ["n", "bottom", "percent", "style"], journaled: true,
    run: (wb, p) => addRule(wb, { kind: "top", range: rangeOf(p.range), n: countOf(p.n ?? "10"), bottom: flag(p.bottom), percent: flag(p.percent), style: styleParam(p) }),
  },
  {
    id: "format.aboveAverage", label: "Above Average", params: ["range"], optional: ["below", "style"], journaled: true,
    run: (wb, p) => addRule(wb, { kind: "average", range: rangeOf(p.range), below: flag(p.below), style: styleParam(p) }),
  },
  {
    id: "format.duplicates", label: "Duplicate Values", params: ["range"], optional: ["unique", "style"], journaled: true,
    run: (wb, p) => addRule(wb, { kind: "duplicates", range: rangeOf(p.range), unique: flag(p.unique), style: styleParam(p) }),
  },
  {
    id: "format.colorScale", label: "Color Scales", params: ["range"], optional: ["colors"], journaled: true,
    run: (wb, p) => {
      const colors = (p.colors ?? "#f8696b,#ffeb84,#63be7b").split(",").map((c) => c.trim().toLowerCase());
      if (colors.length < 2 || colors.length > 3 || colors.some((c) => !/^#[0-9a-f]{6}$/.test(c))) refuse("a colour scale takes 2 or 3 colours (#rrggbb)");
      return addRule(wb, { kind: "colorScale", range: rangeOf(p.range), colors });
    },
  },
  {
    id: "format.iconSet", label: "Icon Sets", params: ["range"], optional: ["icons"], journaled: true,
    run: (wb, p) => {
      const icons = (p.icons ?? "arrows").toLowerCase();
      if (!(icons in ICONS)) refuse(`${p.icons} is not an icon set (${Object.keys(ICONS).join(", ")})`);
      return addRule(wb, { kind: "iconSet", range: rangeOf(p.range), icons: icons as IconSet });
    },
  },
  {
    id: "format.rules", label: "Manage Rules", params: [], journaled: false,
    run: async (wb) => {
      const listed = wb.page(wb.active)!.rules.map((r, i) => `${i + 1}. ${describeCf(r)}`);
      return { ok: true, message: listed.length ? listed.join("; ") : "no rules", changed: [], output: listed };
    },
  },
  {
    id: "format.deleteRule", label: "Delete Rule", params: ["index"], journaled: true,
    run: async (wb, p) => {
      const rules = wb.page(wb.active)!.rules, i = Number(p.index) - 1;
      if (!Number.isInteger(i) || !rules[i]) refuse(`no rule ${p.index}`);
      const [gone] = rules.splice(i, 1);
      return changedBy(wb, [...range(gone.range[0], gone.range[1])], `deleted ${describeCf(gone)}`);
    },
  },
  {
    id: "format.clearRules", label: "Clear Rules", params: ["range"], journaled: true,
    run: async (wb, p) => {
      const [a, b] = rangeOf(p.range), page = wb.page(wb.active)!;
      const over = (r: CfRule) => {
        const [c, d] = r.range;
        return Math.max(Math.min(a.col, b.col), Math.min(c.col, d.col)) <= Math.min(Math.max(a.col, b.col), Math.max(c.col, d.col))
          && Math.max(Math.min(a.row, b.row), Math.min(c.row, d.row)) <= Math.min(Math.max(a.row, b.row), Math.max(c.row, d.row));
      };
      const n = page.rules.filter(over).length;
      page.rules = page.rules.filter((r) => !over(r));
      return changedBy(wb, wb.sheet.keys(), `cleared ${n} rule${n === 1 ? "" : "s"}`);
    },
  },
  {
    id: "format.font", label: "Font", params: ["range"], optional: ["bold", "italic", "underline", "strike", "size"], journaled: true,
    run: async (wb, p) => {
      const r = rangeOf(p.range);
      const size = p.size === undefined ? undefined : Number(p.size) > 0 ? Number(p.size) : refuse(`${p.size} is not a size`);
      const parts = (["bold", "italic", "underline", "strike"] as const).filter((k) => p[k] !== undefined);
      const keys = relook(wb, r, (look) => ({ ...look, ...Object.fromEntries(parts.map((k) => [k, flag(p[k])])), ...(size ? { size } : {}) }));
      const said = [...parts.map((k) => (flag(p[k]) ? k : `not ${k}`)), ...(size ? [`size ${size}`] : [])].join(", ");
      return changedBy(wb, keys, `${rangeName(r)}: ${said || "no change"}`);
    },
  },
  {
    id: "format.border", label: "Borders", params: ["range", "edge"], optional: ["color"], journaled: true,
    run: async (wb, p) => {
      const r = rangeOf(p.range), edge = p.edge.toLowerCase(), color = (p.color ?? "#000000").toLowerCase();
      if (!EDGES.includes(edge)) refuse(`${p.edge} is not an edge (${EDGES.join(", ")})`);
      if (!/^#[0-9a-f]{6}$/.test(color)) refuse(`${p.color} is not a colour (#rrggbb)`);
      const [a, b] = r, top = Math.min(a.row, b.row), bottom = Math.max(a.row, b.row), left = Math.min(a.col, b.col), right = Math.max(a.col, b.col);
      const keys = relook(wb, r, (look, k) => {
        const at = parseRange(k)![0];
        if (edge === "none") return { ...look, borders: undefined };
        const on = (e: "top" | "right" | "bottom" | "left") => edge === "all" || edge === e
          || (edge === "outline" && ((e === "top" && at.row === top) || (e === "bottom" && at.row === bottom) || (e === "left" && at.col === left) || (e === "right" && at.col === right)));
        const borders = { ...look.borders };
        for (const e of ["top", "right", "bottom", "left"] as const) if (on(e)) borders[e] = color;
        return { ...look, borders };
      });
      return changedBy(wb, keys, `${rangeName(r)}: ${edge === "none" ? "no" : edge} border${edge === "none" || edge === "all" || edge === "outline" ? "s" : ""}`);
    },
  },
  {
    id: "format.wrap", label: "Wrap Text", params: ["range"], optional: ["off"], journaled: true,
    run: async (wb, p) => {
      const r = rangeOf(p.range), on = !flag(p.off);
      return changedBy(wb, relook(wb, r, (look) => ({ ...look, wrap: on || undefined })), `${rangeName(r)}: ${on ? "wrapped" : "not wrapped"}`);
    },
  },
  {
    id: "format.dataBar", label: "Data Bars", params: ["range"], optional: ["color"], journaled: true,
    run: (wb, p) => {
      const color = (p.color ?? "#638ec6").toLowerCase();
      if (!/^#[0-9a-f]{6}$/.test(color)) refuse(`${p.color} is not a colour (#rrggbb)`);
      return addRule(wb, { kind: "dataBar", range: rangeOf(p.range), color });
    },
  },
  { id: "rows.hide", label: "Hide Rows", params: ["range"], journaled: true, run: hiding(true, true) },
  { id: "rows.unhide", label: "Unhide Rows", params: ["range"], journaled: true, run: hiding(true, false) },
  { id: "columns.hide", label: "Hide Columns", params: ["range"], journaled: true, run: hiding(false, true) },
  { id: "columns.unhide", label: "Unhide Columns", params: ["range"], journaled: true, run: hiding(false, false) },
  {
    id: "data.filter", label: "AutoFilter", params: ["range", "column", "criterion"], journaled: true,
    run: async (wb, p) => {
      const r = rangeOf(p.range), col = columnOf(p.column), tl = topLeft(r);
      const bottom = Math.max(r[0].row, r[1].row), right = Math.max(r[0].col, r[1].col);
      if (col < tl.col || col > right) refuse(`${p.column} is not a column of ${named(r)}`);
      // The criterion as COUNTIF reads one: 5, ">100", "<>x", "north".
      const keep = criterion(NUMERIC_TEXT.test(p.criterion) ? Number(p.criterion) : p.criterion);
      const hidden = new Set<number>();
      for (let row = tl.row + 1; row <= bottom; row++) if (!keep(wb.sheet.value(keyOf({ col, row })))) hidden.add(row);
      wb.page(wb.active)!.filtered = hidden;
      return changedBy(wb, wb.sheet.keys(), `filtered ${named(r)} by ${colName(col)} ${p.criterion}: ${hidden.size} row${hidden.size === 1 ? "" : "s"} hidden`);
    },
  },
  {
    id: "data.clearFilter", label: "Clear Filter", params: [], journaled: true,
    run: async (wb) => {
      const page = wb.page(wb.active)!;
      if (!page.filtered) refuse("no filter");
      const n = [...page.filtered!].filter((r) => !page.hiddenRows.has(r)).length;
      page.filtered = null;
      return changedBy(wb, wb.sheet.keys(), `filter cleared: ${n} row${n === 1 ? "" : "s"} shown`);
    },
  },
  {
    id: "view.freezeRows", label: "Freeze Top Rows", params: ["count"], journaled: true,
    run: async (wb, p) => {
      const n = Number(p.count);
      if (!Number.isInteger(n) || n < 0 || n >= ROWS) refuse(`${p.count} is not a number of rows to freeze`);
      wb.page(wb.active)!.frozen = n;
      return changedBy(wb, [], n ? `froze ${n} row${n === 1 ? "" : "s"}` : "unfroze rows");
    },
  },
  {
    id: "cells.merge", label: "Merge Cells", params: ["range"], optional: ["center"], journaled: true,
    run: async (wb, p) => {
      const r = rangeOf(p.range), tl = topLeft(r), page = wb.page(wb.active)!;
      if (keyOf(r[0]) === keyOf(r[1])) refuse(`${keyOf(r[0])} is one cell: nothing to merge`);
      const corners: [Addr, Addr] = [tl, { col: Math.max(r[0].col, r[1].col), row: Math.max(r[0].row, r[1].row) }];
      page.merges = [...page.merges.filter((m) => !overlap(m, corners)), corners];
      // As Excel does: the top-left's value is kept, the others' cleared.
      const cleared = [...range(r[0], r[1])].filter((k) => k !== keyOf(tl) && wb.sheet.input(k) !== "");
      if (cleared.length) await wb.sheet.setMany(cleared.map((k) => [k, ""] as const));
      if (flag(p.center)) wb.notes.set(keyOf(tl), { look: { ...wb.notes.get(keyOf(tl)).look, align: "center" } });
      return changedBy(wb, [...range(r[0], r[1])], `merged ${rangeName(corners)}${cleared.length ? ` (${cleared.length} cell${cleared.length === 1 ? "" : "s"} cleared)` : ""}`);
    },
  },
  {
    id: "cells.unmerge", label: "Unmerge Cells", params: ["range"], journaled: true,
    run: async (wb, p) => {
      const r = rangeOf(p.range), page = wb.page(wb.active)!;
      const gone = page.merges.filter((m) => overlap(m, r));
      if (!gone.length) refuse(`no merge in ${rangeName(r)}`);
      page.merges = page.merges.filter((m) => !overlap(m, r));
      return changedBy(wb, gone.flatMap((m) => [...range(m[0], m[1])]), `unmerged ${gone.length}`);
    },
  },
  {
    id: "rows.height", label: "Row Height", params: ["range", "height"], journaled: true,
    run: async (wb, p) => {
      const h = Number(p.height);
      if (!Number.isInteger(h) || h < 0) refuse(`${p.height} is not a height (0 for the grid's)`);
      const page = wb.page(wb.active)!, { at, said } = spanOf(rangeOf(p.range), true);
      for (const row of at) if (h) page.heights.set(row, h); else page.heights.delete(row);
      return changedBy(wb, [], h ? `${said} ${at.length > 1 ? "are" : "is"} ${h} high` : `${said} ${at.length > 1 ? "are" : "is"} as tall as the grid's`);
    },
  },
  {
    id: "table.define", label: "Define Table", params: ["name", "range"], optional: ["headers", "columns"], journaled: true,
    run: async (wb, p) => {
      const name = p.name.trim();
      if (!/^[A-Za-z][A-Za-z0-9_]*$/.test(name)) refuse(`${p.name} is not a table name: a letter first, then letters, digits or _`);
      const r = rangeOf(p.range), width = Math.abs(r[0].col - r[1].col) + 1;
      const columns = p.columns === undefined ? null : p.columns.split(",").map((c) => c.trim());
      if (columns && columns.length !== width) refuse(`${name} has ${width} columns, and ${columns.length} name${columns.length === 1 ? "" : "s"}`);
      const headers = p.headers === undefined ? !columns : flag(p.headers);
      const corners: [Addr, Addr] = [topLeft(r), { col: Math.max(r[0].col, r[1].col), row: Math.max(r[0].row, r[1].row) }];
      const changed = await wb.sheet.defineTable(name, { name, range: corners, headers, columns });
      return changedBy(wb, changed, `${name} is ${rangeName(corners)}, with columns ${tableColumns(wb, wb.sheet.table(name)!).join(", ")}`);
    },
  },
  {
    id: "table.delete", label: "Delete Table", params: ["name"], journaled: true,
    run: async (wb, p) => {
      const t = wb.sheet.table(p.name) ?? refuse(`no table ${p.name}`);
      const changed = await wb.sheet.defineTable(t.name, null);
      return changedBy(wb, changed, `deleted ${t.name}`);
    },
  },
  {
    id: "table.list", label: "Tables", params: [], journaled: false,
    run: async (wb) => {
      const listed = wb.sheet.tables().map((t) => `${t.name} ${rangeName(t.range)} (${tableColumns(wb, t).join(", ")})`);
      return { ok: true, message: listed.length ? listed.join("; ") : "no tables", changed: [], output: listed };
    },
  },
  {
    id: "chart.insert", label: "Insert Chart", params: ["kind", "range"], optional: ["title"], journaled: true,
    run: async (wb, p) => {
      const kind = p.kind.toLowerCase() as ChartKind;
      if (!CHART_KINDS.includes(kind)) refuse(`${p.kind} is not a chart (${CHART_KINDS.join(", ")})`);
      const page = wb.page(wb.active)!, r = rangeOf(p.range);
      page.charts.push({ kind, range: r, title: p.title ?? `Chart ${page.charts.length + 1}` });
      return changedBy(wb, [], `inserted a ${kind} chart of ${named(r)}`);
    },
  },
  {
    id: "chart.list", label: "Charts", params: [], journaled: false,
    run: async (wb) => {
      const listed = wb.charts().map((c, i) => `${i + 1}. ${c.title}: ${c.kind} chart of ${c.range}`);
      return { ok: true, message: listed.length ? listed.join("; ") : "no charts", changed: [], output: listed };
    },
  },
  {
    id: "chart.delete", label: "Delete Chart", params: ["index"], journaled: true,
    run: async (wb, p) => {
      const charts = wb.page(wb.active)!.charts, i = Number(p.index) - 1;
      if (!Number.isInteger(i) || !charts[i]) refuse(`no chart ${p.index}`);
      const [gone] = charts.splice(i, 1);
      return changedBy(wb, [], `deleted ${gone.title}`);
    },
  },
  {
    id: "insert.sparkline", label: "Sparkline", params: ["range", "at"], journaled: true,
    run: async (wb, p) => {
      const r = rangeOf(p.range), key = cellOf(p.at);
      const formula = wb.sheet.language.name === "Excel" ? `=SPARKLINE(${named(r)})` : `=SPARKLINE_RANGE("${named(r)}")`;
      const changed = await wb.sheet.set(key, formula);
      return changedBy(wb, changed, `${key} = ${show(wb.sheet.value(key))}`);
    },
  },
  {
    id: "data.goalSeek", label: "Goal Seek", params: ["set", "to", "by"], journaled: true,
    run: async (wb, p) => {
      const target = cellOf(p.set), by = cellOf(p.by), to = numberOf(p.to);
      if (!wb.sheet.input(target).startsWith("=")) refuse(`${target} is not a formula`);
      if (wb.sheet.input(by).startsWith("=")) refuse(`${by} holds a formula, not a value to change`);
      const start = Number(wb.sheet.input(by)) || 0, was = wb.sheet.input(by);
      let found: { x: number } | null = null;
      try {
        found = await secant(async (x) => {
          await wb.sheet.trial([[by, String(x)]]);
          const v = wb.sheet.value(target);
          return typeof v === "number" ? v - to : NaN;
        }, start);
      } finally {
        await wb.sheet.trial([[by, was]]);
      }
      if (!found) return refuse(`${target} cannot reach ${p.to} by changing ${by}`);
      const changed = await wb.sheet.set(by, String(Number(found.x.toPrecision(12))));
      return changedBy(wb, changed, `${target} = ${show(wb.sheet.value(target))} with ${by} = ${show(wb.sheet.value(by))}`);
    },
  },
  {
    id: "data.table", label: "Data Table", params: ["range"], optional: ["row", "column"], journaled: true,
    run: async (wb, p) => {
      const r = rangeOf(p.range), tl = topLeft(r);
      const rows = Math.abs(r[0].row - r[1].row) + 1, cols = Math.abs(r[0].col - r[1].col) + 1;
      const at = (i: number, j: number) => keyOf({ col: tl.col + j, row: tl.row + i });
      const formula = (k: string) => wb.sheet.input(k).startsWith("=");
      const row = p.row === undefined ? null : cellOf(p.row), column = p.column === undefined ? null : cellOf(p.column);
      const entries: [string, string][] = [];
      if (row && column) {
        // Two inputs: the formula at the corner, the row's values across the
        // top, the column's down the left.
        if (!formula(at(0, 0))) refuse(`${at(0, 0)} has no formula`);
        const pairs = Array.from({ length: (rows - 1) * (cols - 1) }, (_, n) => [Math.floor(n / (cols - 1)) + 1, (n % (cols - 1)) + 1]);
        const got = await tried(wb, [row, column], pairs.map(([i, j]) => [wb.sheet.input(at(0, j)), wb.sheet.input(at(i, 0))]), () => inputOf(wb.sheet.value(at(0, 0))));
        pairs.forEach(([i, j], n) => entries.push([at(i, j), got[n]]));
      } else if (row || column) {
        // One input: its values along one edge, formulas along the other.
        const down = !!column, input = (column ?? row)!;
        const formulas = Array.from({ length: down ? cols - 1 : rows - 1 }, (_, n) => (down ? at(0, n + 1) : at(n + 1, 0))).filter(formula);
        if (!formulas.length) refuse(`${named(r)} has no formula in its ${down ? "top row" : "left column"}`);
        const values = Array.from({ length: down ? rows - 1 : cols - 1 }, (_, n) => (down ? at(n + 1, 0) : at(0, n + 1)));
        const got = await tried(wb, [input], values.map((k) => [wb.sheet.input(k)]), () => formulas.map((f) => inputOf(wb.sheet.value(f))));
        values.forEach((_, n) => formulas.forEach((f, m) => {
          const a = parseRange(f)![0];
          entries.push([down ? keyOf({ col: a.col, row: tl.row + n + 1 }) : keyOf({ col: tl.col + n + 1, row: a.row }), got[n][m]]);
        }));
      } else refuse("a data table needs a row input, a column input, or both");
      const changed = await wb.sheet.setMany(entries);
      return changedBy(wb, changed, `filled the data table ${named(r)}: ${entries.length} results`);
    },
  },
  {
    id: "data.removeDuplicates", label: "Remove Duplicates", params: ["range"], optional: ["columns", "headers"], journaled: true,
    run: async (wb, p) => {
      const r = rangeOf(p.range), tl = topLeft(r);
      const first = flag(p.headers) ? 1 : 0;
      const rows = Math.abs(r[0].row - r[1].row) + 1, cols = Math.abs(r[0].col - r[1].col) + 1;
      const at = (i: number, j: number) => keyOf({ col: tl.col + j, row: tl.row + i });
      const by = p.columns === undefined ? Array.from({ length: cols }, (_, j) => j)
        : p.columns.split(",").map((c) => {
          const j = columnOf(c) - tl.col;
          return j >= 0 && j < cols ? j : refuse(`${c.trim()} is not a column of ${named(r)}`);
        });
      const body = Array.from({ length: rows - first }, (_, i) => Array.from({ length: cols }, (_, j) => show(wb.sheet.value(at(i + first, j)))));
      const kept = distinctRows(body, by);
      const entries: [string, string][] = [];
      // The rows kept move up, their formulas with them; the rest are cleared.
      for (let i = 0; i < rows - first; i++) {
        for (let j = 0; j < cols; j++) {
          const from = kept[i];
          entries.push([at(i + first, j), from === undefined ? "" : movedBy(wb.sheet.language, wb.sheet.input(at(from + first, j)), { cols: 0, rows: i - from })]);
        }
      }
      const gone = body.length - kept.length;
      const changed = await wb.sheet.setMany(entries);
      return changedBy(wb, changed, `removed ${gone} duplicate row${gone === 1 ? "" : "s"} of ${named(r)}; ${kept.length} left`);
    },
  },
  {
    id: "data.textToColumns", label: "Text to Columns", params: ["range"], optional: ["delimiter", "replace"], journaled: true,
    run: async (wb, p) => {
      const r = rangeOf(p.range);
      if (r[0].col !== r[1].col) refuse("Text to Columns splits one column");
      const d = p.delimiter === undefined ? "," : DELIMITERS[p.delimiter.toLowerCase()] ?? (p.delimiter.length === 1 ? p.delimiter : refuse(`${p.delimiter} is not a delimiter (one character, or comma, tab, space, semicolon)`));
      const keys = [...range(r[0], r[1])];
      const split = keys.map((k) => splitText(show(wb.sheet.value(k)), d));
      const width = Math.max(...split.map((s) => s.length));
      const col = r[0].col;
      if (col + width > COLS) refuse(`${width} columns from ${colName(col)} do not fit on the sheet`);
      const entries: [string, string][] = [];
      split.forEach((fields, i) => {
        const row = parseRange(keys[i])![0].row;
        fields.forEach((field, j) => {
          const key = keyOf({ col: col + j, row });
          if (j > 0 && !flag(p.replace) && wb.sheet.input(key) !== "") refuse(`${key} is not empty`);
          entries.push([key, field]);
        });
      });
      const changed = await wb.sheet.setMany(entries);
      return changedBy(wb, changed, `split ${rangeName(r)} into ${width} columns`);
    },
  },
  {
    id: "formulas.use", label: "Formula language", params: ["language"], journaled: true,
    run: async (wb, p) => {
      const name = ({ excel: "Excel", rexxjs: "RexxJS" } as Record<string, LanguageName>)[p.language.toLowerCase()]
        ?? refuse(`${p.language} is not a formula language (Excel, RexxJS)`);
      const changed = await wb.setLanguage(wb.language(name));
      return changedBy(wb, changed, `${name} formulas`);
    },
  },
  {
    id: "sheet.add", label: "Insert Sheet", params: [], optional: ["name"], journaled: true,
    run: async (wb, p) => {
      let name = p.name;
      if (name === undefined) for (let i = wb.pages().length + 1; !name || wb.page(name); i++) name = `Sheet${i}`;
      name = sheetNameOf(name);
      if (wb.page(name)) refuse(`${name} is a sheet already`);
      const before = wb.sheet.keys();
      await wb.add(name);
      return changedBy(wb, shownKeys(wb, before), `added ${name}`);
    },
  },
  {
    id: "sheet.activate", label: "Go to a sheet", params: ["name"], journaled: true,
    run: async (wb, p) => {
      const page = pageOf(wb, p.name), before = wb.sheet.keys();
      wb.activate(page.name);
      return changedBy(wb, shownKeys(wb, before), page.name);
    },
  },
  {
    id: "sheet.delete", label: "Delete Sheet", params: ["name"], journaled: true,
    run: async (wb, p) => {
      const page = pageOf(wb, p.name);
      if (wb.pages().length === 1) refuse(`${page.name} is the only sheet`);
      const before = wb.sheet.keys();
      await wb.remove(page.name);
      return changedBy(wb, shownKeys(wb, before), `deleted ${page.name}`);
    },
  },
  {
    id: "file.open", label: "Open", params: [], optional: ["name", "sample"], journaled: true,
    run: (wb, p, store) => {
      if (p.name !== undefined) return open(wb, readSheetFile(JSON.parse(store.get(fileKey(savedName(store, p.name)))!)));
      if (p.sample !== undefined) return open(wb, readSheetFile(SAMPLES[p.sample.toLowerCase()] ?? refuse(`no sample ${p.sample} (budget, test, formatted)`)));
      return refuse("file.open needs a name or a sample");
    },
  },
  {
    id: "file.save", label: "Save", params: [], optional: ["name"], journaled: false,
    run: async (wb, p, store) => {
      const name = (p.name ?? wb.name).trim() || refuse("a file needs a name");
      const file = writeSheetFile(wb);
      store.set(fileKey(name), JSON.stringify({ ...file, name }));
      const names = savedNames(store).filter((n) => n.toUpperCase() !== name.toUpperCase());
      store.set(FILES, JSON.stringify([...names, name]));
      wb.name = name;
      const cells = wb.pages().reduce((n, page) => n + page.sheet.keys().length, 0);
      return { ok: true, message: `saved ${name}: ${wb.pages().length} sheet${wb.pages().length === 1 ? "" : "s"}, ${cells} cells`, changed: [] };
    },
  },
  {
    id: "file.list", label: "Saved files", params: [], journaled: false,
    run: async (_wb, _p, store) => {
      const names = savedNames(store);
      return { ok: true, message: names.length ? `saved: ${names.join(", ")}` : "no saved files", changed: [], output: names };
    },
  },
  {
    id: "file.delete", label: "Delete a saved file", params: ["name"], journaled: false,
    run: async (_wb, p, store) => {
      const name = savedName(store, p.name);
      store.remove(fileKey(name));
      store.set(FILES, JSON.stringify(savedNames(store).filter((n) => n !== name)));
      return { ok: true, message: `deleted ${name}`, changed: [] };
    },
  },
  {
    id: "file.new", label: "New", params: [], journaled: true,
    run: async (wb) => {
      const before = wb.sheet.keys();
      wb.reset();
      wb.name = "Untitled";
      wb.setupScript = "";
      await wb.settle();
      return { ok: true, message: "a new workbook", changed: before };
    },
  },
  {
    id: "file.exportCsv", label: "Export CSV", params: [], optional: ["range"], journaled: false,
    run: async (wb, p) => {
      const r = p.range === undefined ? usedRange(wb) : rangeOf(p.range), tl = topLeft(r);
      const rows = Math.abs(r[0].row - r[1].row) + 1, cols = Math.abs(r[0].col - r[1].col) + 1;
      const csv = wb.sheet.keys().length || p.range !== undefined ? toCsv(Array.from({ length: rows }, (_, i) =>
        Array.from({ length: cols }, (_, j) => wb.textOf(keyOf({ col: tl.col + j, row: tl.row + i }))))) : "";
      return { ok: true, message: `${named(r)} as CSV: ${csv ? rows : 0} rows`, changed: [], output: csv };
    },
  },
  {
    id: "file.importCsv", label: "Import CSV", params: ["at", "text"], journaled: true,
    run: (wb, p) => {
      const at = rangeOf(p.at)[0], rows = fromCsv(p.text);
      const cols = Math.max(0, ...rows.map((r) => r.length));
      if (at.col + cols > COLS) refuse(`${cols} columns from ${keyOf(at)} do not fit on the sheet`);
      if (at.row + rows.length > ROWS) refuse(`${rows.length} rows from ${keyOf(at)} do not fit on the sheet`);
      const entries = rows.flatMap((row, i) => row.map((input, j): [string, string] => [keyOf({ col: at.col + j, row: at.row + i }), input]));
      return setting(wb, entries, `imported ${rows.length} rows at ${keyOf(at)}`);
    },
  },
  {
    id: "example.paste", label: "Paste the Excel example", params: [], journaled: true,
    run: async (wb) => {
      if (wb.sheet.language.name !== "Excel") await wb.setLanguage(wb.language("Excel"));
      return setting(wb, pasted(EXAMPLE, { col: 0, row: 0 }), "pasted the example");
    },
  },
];

const BY_ID = new Map(SPECS.map((s) => [s.id, s]));

// A cell's value as a script sees it: '' for an empty one, an error's code.
const scripted = (v: Value): unknown => (v === null ? "" : v instanceof CellError ? v.code : typeof v === "boolean" ? (v ? 1 : 0) : v);

export class Commands {
  readonly #wb: Workbook;
  readonly #store: Store;
  readonly #journal: string[] = [];

  constructor(wb: Workbook, store: Store = memoryStore()) {
    this.#wb = wb;
    this.#store = store;
  }

  // Every command whose id or label holds `search` (any case).
  catalogue(search = ""): { id: string; label: string; params: string }[] {
    const s = search.toLowerCase();
    return SPECS.filter((c) => c.id.toLowerCase().includes(s) || c.label.toLowerCase().includes(s))
      .map((c) => ({ id: c.id, label: c.label, params: [...c.params, ...(c.optional ?? []).map((o) => `${o}?`)].join(", ") }));
  }

  async execute(id: string, params: Params = {}): Promise<Outcome> {
    const spec = BY_ID.get(id);
    try {
      if (!spec) refuse(`no command ${id}`);
      for (const name of spec!.params) if (params[name] === undefined) refuse(`${id} needs ${name}`);
      const outcome = await spec!.run(this.#wb, params, this.#store);
      if (outcome.ok && spec!.journaled) this.#journal.push(lineOf(id, params));
      return outcome;
    } catch (e) {
      if (e instanceof Refused || e instanceof RangeError) return { ok: false, message: e.message, changed: [] };
      throw e;
    }
  }

  run(line: string): Promise<Outcome> {
    const { id, params } = parseLine(line);
    return this.execute(id, params);
  }

  // The command lines that changed the workbook, in order.
  journal(): string[] {
    return [...this.#journal];
  }

  // A RexxJS script, driving these commands (script.ts); `say` gets its
  // SAY lines.
  script(text: string, say: (line: string) => void): Promise<{ ok: boolean; message: string }> {
    const sheet = this.#wb.sheet;
    return runScript(text, {
      run: (line) => this.run(line),
      set: (cell, input) => this.execute("cell.set", { cell, input }),
      get: (cell) => scripted(sheet.value(cell)),
    }, say);
  }
}
