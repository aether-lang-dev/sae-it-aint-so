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
import { COLS, ROWS, colName, keyOf, parseRange, range } from "./address.ts";
import type { Addr } from "./address.ts";
import { copied, filled, pasted } from "./copy.ts";
import { readSheetFile } from "./file.ts";
import type { SheetFile } from "./file.ts";
import { show } from "./format.ts";
import { EXAMPLE, FORMATTED, SAMPLE_BUDGET, TEST_SHEET } from "./samples.ts";
import { runScript } from "./script.ts";
import { continued } from "./series.ts";
import { check, describeRule, ruleOf } from "./validation.ts";
import { deleted, inserted, movedBy, restructured } from "./shift.ts";
import type { Scope } from "./shift.ts";
import { found, replaced, sortMoves, sorted } from "./sortfind.ts";
import { CellError } from "./values.ts";
import type { Value } from "./values.ts";
import type { LanguageName, Workbook } from "./workbook.ts";

export type Params = Readonly<Record<string, string>>;

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
  run(wb: Workbook, p: Params): Promise<Outcome>;
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

// A sheet file: the workbook emptied (one sheet), its language, its setup
// script run, its cells set, its notes kept; where undo stops.
async function open(wb: Workbook, file: SheetFile): Promise<Outcome> {
  const before = wb.sheet.keys();
  wb.reset();
  const failed = file.language === "RexxJS" ? await wb.rexx.setup(file.setupScript) : null;
  await wb.setLanguage(wb.language(file.language));
  const changed = await wb.sheet.setMany(file.entries);
  wb.sheet.forget();
  wb.notes.clear();
  for (const [key, note] of file.notes) wb.notes.set(key, note);
  wb.name = file.name;
  wb.setupScript = file.setupScript;
  await wb.settle();
  const message = `opened ${file.name}: ${file.entries.length} cells, ${file.language} formulas`;
  return { ok: true, message: failed ? `${message}; its setup script failed: ${failed.split("\n").pop()}` : message, changed: [...new Set([...before, ...changed])] };
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
      for (const k of keys) wb.notes.set(k, { format: "", style: "", styleExpression: "" });
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
      for (const k of keys) wb.notes.set(k, { comment: "", format: "", style: "", styleExpression: "" });
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
            format: n.format ?? "", style: n.style ?? "",
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
    id: "file.open", label: "Open a sample", params: ["sample"], journaled: true,
    run: (wb, p) => open(wb, readSheetFile(SAMPLES[p.sample.toLowerCase()] ?? refuse(`no sample ${p.sample} (budget, test, formatted)`))),
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
  readonly #journal: string[] = [];

  constructor(wb: Workbook) {
    this.#wb = wb;
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
      const outcome = await spec!.run(this.#wb, params);
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
