// The Tauri spreadsheet's control functions (its src/spreadsheet-control-
// functions.js, at RexxJS/example-app-spreadsheet 45b0993) by name, each as
// demo 18's commands: SETFORMAT("A1", "bold") runs cell.format cell=A1
// format=bold, and gives back what the app's gives. A script (script.ts)
// has them all, so the app's REXX scripts run against demo 18 as they are.
// The functions see the sheet only through `exec`, a
// command and its parameters in and its outcome out, as a panel does.
import { COLS, ROWS, addrOf, colName, keyOf, parseRange, range } from "./address.ts";
import { check } from "./validation.ts";
import type { Rule } from "./validation.ts";
import type { Addr } from "./address.ts";

export interface Done {
  readonly ok: boolean;
  readonly message: string;
  readonly output?: unknown;
}
export type Exec = (id: string, params: Record<string, string>) => Promise<Done>;
type Control = (exec: Exec, ...args: any[]) => unknown;

// What cell.about and sheet.state give (commands.ts).
interface About {
  readonly value: unknown;
  readonly input: string;
  readonly format: string;
  readonly comment: string;
  readonly wrap: number;
  readonly merged: string;
  readonly validation: Rule | null;
  readonly editor: { readonly type: string; readonly config: object } | null;
}
interface State {
  readonly name: string;
  readonly sheets: readonly string[];
  readonly hiddenRows: readonly number[];
  readonly hiddenCols: readonly string[];
  readonly frozenRows: number;
  readonly rowHeights: readonly (readonly [number, number])[];
  readonly colWidths: readonly (readonly [string, number])[];
  readonly filter: { readonly range: string; readonly column: string; readonly criterion: string } | null;
  readonly canUndo: number;
  readonly canRedo: number;
  readonly autoId: { readonly column: string; readonly next: string } | null;
}

// A command that must be done: a refusal is the function's error, as the
// app's functions throw theirs.
async function must(exec: Exec, id: string, params: Record<string, string> = {}): Promise<Done> {
  const o = await exec(id, params);
  if (!o.ok) throw new Error(o.message);
  return o;
}
const about = async (exec: Exec, cell: unknown) => (await must(exec, "cell.about", { cell: text(cell) })).output as About;
const state = async (exec: Exec) => (await must(exec, "sheet.state")).output as State;

// The app's arguments: text, 1 for yes, rows counted from 1, a column by
// its letter or its number.
const text = (a: unknown) => (a === undefined || a === null ? "" : String(a));
const yes = (a: unknown) => a === 1 || a === "1" || a === true || a === "true";
function row(a: unknown, fn: string): number {
  const n = parseInt(text(a), 10);
  if (!(n >= 1)) throw new Error(`${fn} needs a row number (e.g. 2)`);
  return n;
}
function col(a: unknown, fn: string): string {
  const t = text(a).trim();
  const n = /^\d+$/.test(t) ? parseInt(t, 10) : NaN;
  if (n >= 1) return colName(n - 1);
  if (/^[A-Za-z]{1,3}$/.test(t)) return t.toUpperCase();
  throw new Error(`${fn} needs a column, a letter or a number (e.g. "B" or 2)`);
}
function cell(a: unknown, fn: string) {
  const at = addrOf(text(a).trim());
  if (!at) throw new Error(`${fn} needs a cell reference (e.g. "A1")`);
  return at;
}
// A REXX stem: {0: count, 1: first, ...}.
const stem = (xs: readonly unknown[]): Record<string, unknown> => Object.fromEntries([[0, xs.length], ...xs.map((x, i) => [i + 1, x])]);
const unstem = (v: unknown): unknown[] => {
  if (Array.isArray(v)) return v;
  if (typeof v === "string") return JSON.parse(v) as unknown[];
  const s = v as Record<string, unknown>;
  return Array.from({ length: Number(s?.[0] ?? 0) }, (_, i) => s[i + 1]);
};
// The range a source and a target span, as the app's FILLDOWN takes them
// apart ("A1" and "A2:A5" is A1:A5), and how many lines of it are the
// source, repeated into the rest.
function spanned(a: string, b: string, fn: string, across: boolean): { range: string; source: string } {
  const r = [parseRange(a), parseRange(b)];
  if (!r[0] || !r[1]) throw new Error(`${fn} needs a source and a target range (e.g. "A1", "A2:A10")`);
  const all = [...r[0], ...r[1]], cols = all.map((x) => x.col), rows = all.map((x) => x.row);
  const lines = across ? Math.abs(r[0][0].col - r[0][1].col) + 1 : Math.abs(r[0][0].row - r[0][1].row) + 1;
  return { range: `${keyOf({ col: Math.min(...cols), row: Math.min(...rows) })}:${keyOf({ col: Math.max(...cols), row: Math.max(...rows) })}`, source: String(lines) };
}
const rowsOf = (n: number) => `A${n}`;
const VERSION = "sae demo 18";

export const CONTROL: Readonly<Record<string, Control>> = {
  SPREADSHEET_VERSION: () => VERSION,
  EXPORT: async (exec) => (await must(exec, "file.export")).output,
  IMPORT: async (exec, json) => (await must(exec, "file.import", { text: text(json) }), "OK"),
  EVALUATE: async (exec, formula) => (await must(exec, "formulas.calculate", { formula: text(formula) })).output,
  RECALCULATE: async (exec) => (await must(exec, "formulas.recalculate")).output,
  GETSETUPSCRIPT: async (exec) => (await must(exec, "setup.get")).output,
  SETSETUPSCRIPT: async (exec, script) => (await must(exec, "setup.set", { text: text(script) }), "OK"),
  EXECUTESETUPSCRIPT: async (exec) => (await must(exec, "setup.run"), "OK"),
  // [{address, value}, ...]: each set that can be; a summary, as the app's.
  BATCH_SET_CELLS: async (exec, updates) => {
    const errors: { address: string; error: string }[] = [];
    const list = unstem(updates) as { address?: unknown; value?: unknown }[];
    for (const u of list) {
      const o = await exec("cell.set", { cell: text(u.address), input: text(u.value) });
      if (!o.ok) errors.push({ address: text(u.address), error: o.message });
    }
    return JSON.stringify({ total: list.length, success: list.length - errors.length, errors: errors.length, ...(errors.length ? { errorDetails: errors } : {}) });
  },
  GETEXPRESSION: async (exec, c) => {
    const input = (await about(exec, c)).input;
    return input.startsWith("=") ? input.slice(1) : "";
  },
  CLEARCELL: async (exec, c) => (await must(exec, "range.clear", { range: text(c) }), ""),
  SETFORMAT: async (exec, c, f) => (await must(exec, "cell.format", { cell: text(c), format: text(f) }), text(f)),
  GETFORMAT: async (exec, c) => (await about(exec, c)).format,
  SETCOMMENT: async (exec, c, t) => (await must(exec, "cell.comment", { cell: text(c), text: text(t) }), text(t)),
  GETCOMMENT: async (exec, c) => (await about(exec, c)).comment,
  GETROW: (_, c) => cell(c, "GETROW").row + 1,
  GETCOL: (_, c) => cell(c, "GETCOL").col + 1,
  GETCOLNAME: (_, c) => colName(cell(c, "GETCOLNAME").col),
  MAKECELLREF: (_, c, r) => `${col(c, "MAKECELLREF")}${row(r, "MAKECELLREF")}`,
  GETCELLS: async (exec, r) => {
    const span = parseRange(text(r));
    if (!span) throw new Error('GETCELLS needs a range (e.g. "A1:B5")');
    const cells: unknown[] = [];
    for (const k of range(span[0], span[1])) {
      const a = await about(exec, k);
      cells.push({ ref: k, value: a.value, expression: a.input.startsWith("=") ? a.input.slice(1) : "", comment: a.comment, format: a.format });
    }
    return stem(cells);
  },
  SETCELLS: async (exec, r, values) => {
    const span = parseRange(text(r));
    if (!span) throw new Error('SETCELLS needs a range (e.g. "A1:A3")');
    const vs = unstem(values);
    let i = 0;
    for (const k of range(span[0], span[1])) if (i < vs.length) await must(exec, "cell.set", { cell: k, input: text(vs[i++]) });
    return "OK";
  },
  CLEAR: async (exec) => (await must(exec, "sheet.clear"), "OK"),
  GETSHEETNAME: async (exec) => (await state(exec)).name,
  INSERTROW: async (exec, n) => (await must(exec, "rows.insert", { at: String(row(n, "INSERTROW")) }), "OK"),
  DELETEROW: async (exec, n) => (await must(exec, "rows.delete", { at: String(row(n, "DELETEROW")) }), "OK"),
  INSERTCOLUMN: async (exec, c) => (await must(exec, "columns.insert", { at: col(c, "INSERTCOLUMN") }), "OK"),
  DELETECOLUMN: async (exec, c) => (await must(exec, "columns.delete", { at: col(c, "DELETECOLUMN") }), "OK"),
  FILLDOWN: async (exec, s, t) => (await must(exec, "edit.fillDown", spanned(text(s), text(t), "FILLDOWN", false)), "OK"),
  FILLRIGHT: async (exec, s, t) => (await must(exec, "edit.fillRight", spanned(text(s), text(t), "FILLRIGHT", true)), "OK"),
  FILLUP: async (exec, s, t) => (await must(exec, "edit.fillUp", spanned(text(s), text(t), "FILLUP", false)), "OK"),
  FILLLEFT: async (exec, s, t) => (await must(exec, "edit.fillLeft", spanned(text(s), text(t), "FILLLEFT", true)), "OK"),
  // The way the target lies from the source, as the app's: below it, down.
  AUTOFILL: async (exec, s, t) => {
    const [src, to] = [parseRange(text(s)), parseRange(text(t))];
    if (!src || !to) throw new Error('AUTOFILL needs a source and a target range (e.g. "A1:A3", "A4:A10")');
    const lo = (r: [Addr, Addr], k: "row" | "col") => Math.min(r[0][k], r[1][k]), hi = (r: [Addr, Addr], k: "row" | "col") => Math.max(r[0][k], r[1][k]);
    const way = lo(to, "row") > hi(src, "row") ? "Down" : hi(to, "row") < lo(src, "row") ? "Up" : lo(to, "col") > hi(src, "col") ? "Right" : hi(to, "col") < lo(src, "col") ? "Left" : null;
    if (!way) throw new Error("AUTOFILL: the target must lie beside the source");
    return (await must(exec, `edit.fill${way}`, spanned(text(s), text(t), "AUTOFILL", way === "Right" || way === "Left")), "");
  },
  SORTRANGE: async (exec, r, by, ascending) => {
    const id = ascending === undefined || yes(ascending) ? "data.sortAscending" : "data.sortDescending";
    return (await must(exec, id, { range: text(r), by: col(by, "SORTRANGE") }), "OK");
  },
  SETWRAPTEXT: async (exec, c, on) => (await must(exec, "format.wrap", yes(on) ? { range: text(c) } : { range: text(c), off: "1" }), "OK"),
  GETWRAPTEXT: async (exec, c) => (await about(exec, c)).wrap,
  FIND: async (exec, t, matchCase, wholeCell, inFormulas) =>
    stem((await must(exec, "edit.find", { text: text(t), ...options(matchCase, wholeCell, inFormulas) })).output as string[]),
  REPLACE: async (exec, t, by, matchCase, wholeCell, inFormulas) =>
    (await must(exec, "edit.replace", { text: text(t), with: text(by), ...options(matchCase, wholeCell, inFormulas) })).output,
  MOVECOLUMNLEFT: async (exec, c) => (await must(exec, "columns.move", { at: col(c, "MOVECOLUMNLEFT"), way: "left" }), ""),
  MOVECOLUMNRIGHT: async (exec, c) => (await must(exec, "columns.move", { at: col(c, "MOVECOLUMNRIGHT"), way: "right" }), ""),
  RENAMESHEET: async (exec, from, to) => (await must(exec, "sheet.rename", { name: text(from), to: text(to) }), text(to)),
  // The app's SETSHEETNAME names its document, which it never shows; here
  // it renames the active sheet, as GETSHEETNAME reads it.
  SETSHEETNAME: async (exec, to) => (await must(exec, "sheet.rename", { name: (await state(exec)).name, to: text(to) }), text(to)),
  // A cell's editor (editors.ts): type checkbox, dropdown or date, and the
  // app's config ({"options": [...]}, {"format": ...}) as JSON.
  SETCELLEDITOR: async (exec, c, type, config) => {
    const conf = (typeof config === "string" && config ? JSON.parse(config) : config ?? {}) as { options?: unknown; format?: unknown };
    await must(exec, "cell.editor", {
      cell: text(c), kind: text(type), ...(Array.isArray(conf.options) ? { options: conf.options.map(text).join(",") } : {}), ...(conf.format ? { format: text(conf.format) } : {}),
    });
    return text(c);
  },
  GETCELLEDITOR: async (exec, c) => {
    const e = (await about(exec, c)).editor;
    return e ? JSON.stringify(e) : "";
  },
  REMOVECELLEDITOR: async (exec, c) => ((await about(exec, c)).editor ? (await must(exec, "cell.editor", { cell: text(c), kind: "none" }), text(c)) : text(c)),
  // Pivot tables (pivot.ts): the app's configuration as JSON, {sourceRange,
  // rowFields, colFields, valueField, aggFunction, outputCell, filters}.
  CREATEPIVOT: async (exec, id, json) => {
    const c = (typeof json === "string" ? JSON.parse(json) : json ?? {}) as Record<string, unknown>;
    const list = (xs: unknown) => (Array.isArray(xs) ? xs.map(text).join(",") : "");
    await must(exec, "pivot.create", {
      id: text(id), source: text(c.sourceRange), value: text(c.valueField), agg: text(c.aggFunction), output: text(c.outputCell),
      rows: list(c.rowFields), cols: list(c.colFields), filters: JSON.stringify(c.filters ?? {}),
    });
    return text(id);
  },
  UPDATEPIVOT: async (exec, id) => (await must(exec, "pivot.update", { id: text(id) }), text(id)),
  DELETEPIVOT: async (exec, id) => (await must(exec, "pivot.delete", { id: text(id) }), text(id)),
  GETPIVOT: async (exec, id) => {
    const o = await exec("pivot.get", { id: text(id) });
    return o.ok ? JSON.stringify(o.output) : "";
  },
  LISTPIVOTS: async (exec) => JSON.stringify((await must(exec, "pivot.list")).output),
  // A configuration for CREATEPIVOT, its field lists as JSON arrays.
  PIVOTCONFIG: (_, source, value, agg, output, rows, cols) => JSON.stringify({
    sourceRange: text(source), valueField: text(value), aggFunction: text(agg).toUpperCase(), outputCell: text(output),
    rowFields: rows ? JSON.parse(text(rows)) : [], colFields: cols ? JSON.parse(text(cols)) : [],
  }),
  HIDEROW: async (exec, n) => (await must(exec, "rows.hide", { range: rowsOf(row(n, "HIDEROW")) }), "OK"),
  UNHIDEROW: async (exec, n) => (await must(exec, "rows.unhide", { range: rowsOf(row(n, "UNHIDEROW")) }), "OK"),
  HIDECOLUMN: async (exec, c) => (await must(exec, "columns.hide", { range: `${col(c, "HIDECOLUMN")}1` }), "OK"),
  UNHIDECOLUMN: async (exec, c) => (await must(exec, "columns.unhide", { range: `${col(c, "UNHIDECOLUMN")}1` }), "OK"),
  ISROWHIDDEN: async (exec, n) => ((await state(exec)).hiddenRows.includes(row(n, "ISROWHIDDEN")) ? 1 : 0),
  ISCOLUMNHIDDEN: async (exec, c) => ((await state(exec)).hiddenCols.includes(col(c, "ISCOLUMNHIDDEN")) ? 1 : 0),
  ISROWVISIBLE: async (exec, n) => ((await state(exec)).hiddenRows.includes(row(n, "ISROWVISIBLE")) ? "0" : "1"),
  SETROWHEIGHT: async (exec, n, h) => (await must(exec, "rows.height", { range: rowsOf(row(n, "SETROWHEIGHT")), height: text(h) }), "OK"),
  SETCOLWIDTH: async (exec, c, w) => (await must(exec, "columns.width", { range: `${col(c, "SETCOLWIDTH")}1`, width: text(w) }), "OK"),
  // 0: the grid's own width (and height, below).
  GETCOLWIDTH: async (exec, c) => {
    const letter = col(c, "GETCOLWIDTH");
    return (await state(exec)).colWidths.find(([at]) => at === letter)?.[1] ?? 0;
  },
  GETFILTERCRITERIA: async (exec) => {
    const filter = (await state(exec)).filter;
    return filter ? JSON.stringify(filter) : "";
  },
  GETROWHEIGHT: async (exec, n) => {
    const r = row(n, "GETROWHEIGHT");
    return (await state(exec)).rowHeights.find(([at]) => at === r)?.[1] ?? 0;
  },
  DEFINENAMEDRANGE: async (exec, n, r) => (await must(exec, "names.define", { name: text(n), range: text(r) }), "OK"),
  DELETENAMEDRANGE: async (exec, n) => (await must(exec, "names.delete", { name: text(n) }), "OK"),
  GETNAMEDRANGE: async (exec, n) => named(await names(exec)).get(text(n).toUpperCase()) ?? "",
  GETALLNAMEDRANGES: async (exec) => {
    const all = [...named(await names(exec))];
    return Object.fromEntries([[0, all.length], ...all.flatMap(([n, r], i) => [[`${i + 1}.NAME`, n], [`${i + 1}.RANGE`, r]])]);
  },
  FREEZEPANES: async (exec, rows, cols) => {
    if (parseInt(text(cols) || "0", 10) > 0) throw new Error("FREEZEPANES: demo 18 freezes rows only");
    return (await must(exec, "view.freezeRows", { count: text(rows) || "0" }), "OK");
  },
  UNFREEZEPANES: async (exec) => (await must(exec, "view.freezeRows", { count: "0" }), "OK"),
  GETFROZENPANES: async (exec) => ({ ROWS: (await state(exec)).frozenRows, COLUMNS: 0 }),
  SETCELLVALIDATION: async (exec, c, type, ...args) => (await must(exec, "validation.set", { range: text(c), ...validation(text(type), args) }), "OK"),
  CLEARCELLVALIDATION: async (exec, c) => (await must(exec, "validation.clear", { range: text(c) }), "OK"),
  VALIDATECELL: async (exec, c, v) => {
    const rule = (await about(exec, c)).validation;
    return rule && check(rule, text(v), true) !== null ? 0 : 1;
  },
  UNDO: async (exec) => ((await state(exec)).canUndo ? (await must(exec, "edit.undo"), 1) : 0),
  REDO: async (exec) => ((await state(exec)).canRedo ? (await must(exec, "edit.redo"), 1) : 0),
  CANUNDO: async (exec) => (await state(exec)).canUndo,
  CANREDO: async (exec) => (await state(exec)).canRedo,
  ADDSHEET: async (exec, n) => (await must(exec, "sheet.add", { name: text(n) }), text(n)),
  DELETESHEET: async (exec, n) => (await must(exec, "sheet.delete", { name: text(n) }), ""),
  SETACTIVESHEET: async (exec, n) => (await must(exec, "sheet.activate", { name: text(n) }), text(n)),
  GETACTIVESHEET: async (exec) => (await state(exec)).name,
  GETSHEETNAMES: async (exec) => stem((await state(exec)).sheets),
  // The app filters every row by a substring; demo 18's AutoFilter keeps
  // the first row as headers and reads the criterion as COUNTIF does.
  APPLYROWFILTER: async (exec, c, criteria) => {
    const letter = col(c, "APPLYROWFILTER");
    return (await must(exec, "data.filter", { range: `A1:${colName(COLS - 1)}${ROWS}`, column: letter, criterion: text(criteria) }), "");
  },
  CLEARROWFILTER: async (exec) => (await must(exec, "data.clearFilter"), ""),
  MERGECELLS: async (exec, r) => {
    await must(exec, "cells.merge", { range: text(r) });
    return (await about(exec, text(r).split(":")[0])).merged.split(":")[0];
  },
  UNMERGECELLS: async (exec, c) => {
    const merged = (await about(exec, c)).merged;
    await must(exec, "cells.unmerge", { range: text(c) });
    return merged.split(":")[0];
  },
  GETMERGEDRANGE: async (exec, c) => (await about(exec, c)).merged,
  ISCELLMERGED: async (exec, c) => ((await about(exec, c)).merged ? "1" : "0"),
  DEFINETABLE: async (exec, n, r, headers) => {
    await must(exec, "table.define", { name: text(n), range: text(r), ...(headers === undefined || yes(headers) ? { headers: "1" } : {}) });
    return JSON.stringify(await table(exec, text(n)));
  },
  DELETETABLE: async (exec, n) => (await must(exec, "table.delete", { name: text(n) }), ""),
  GETTABLE: async (exec, n) => {
    const t = await table(exec, text(n));
    return t ? JSON.stringify(t) : "";
  },
  LISTTABLES: async (exec) => stem(await tableNames(exec)),
  // The app's table metadata: {range, columns: {name: letter}, hasHeader,
  // types, descriptions}, a table here with its columns named so.
  SET_TABLE_METADATA: async (exec, n, json) => {
    const meta = (typeof json === "string" ? JSON.parse(json) : json) as { range?: unknown; columns?: Record<string, unknown>; hasHeader?: unknown; types?: unknown; descriptions?: unknown };
    const r = parseRange(text(meta?.range));
    if (!r || !meta.columns || typeof meta.columns !== "object") throw new Error("Table metadata must include range and columns");
    const letters = Object.entries(meta.columns).map(([name, letter]) => [name, text(letter).toUpperCase()]);
    const names = Array.from({ length: Math.abs(r[0].col - r[1].col) + 1 }, (_, i) => colName(Math.min(r[0].col, r[1].col) + i))
      .map((letter) => letters.find(([, l]) => l === letter)?.[0] ?? letter);
    await must(exec, "table.define", {
      name: text(n), range: text(meta.range), headers: meta.hasHeader === false ? "0" : "1", columns: names.join(","),
      types: JSON.stringify(meta.types ?? {}), descriptions: JSON.stringify(meta.descriptions ?? {}),
    });
    return `Table metadata set for '${text(n)}'`;
  },
  GET_TABLE_METADATA: async (exec, n) => {
    const t = await table(exec, text(n));
    if (!t) return "";
    const left = parseRange(t.range)![0].col;
    return JSON.stringify({ range: t.range, columns: Object.fromEntries(t.columns.map((c, i) => [c, colName(left + i)])), hasHeader: t.headers, types: t.types, descriptions: t.descriptions });
  },
  DELETE_TABLE_METADATA: async (exec, n) => (await must(exec, "table.delete", { name: text(n) }), `Table metadata deleted for '${text(n)}'`),
  LIST_TABLES: async (exec) => JSON.stringify(await tableNames(exec)),
  // asc, desc, then original.
  SORTTABLEBYCOLUMN: async (exec, n, c) => (await must(exec, "table.sort", { name: text(n), column: col(c, "SORTTABLEBYCOLUMN") })).output,
  CONFIGURE_AUTO_ID: async (exec, c, start, prefix) => {
    if (c === null || c === undefined || text(c) === "" || text(c) === "null") return (await must(exec, "ids.configure"), "Auto-ID disabled");
    const from = start === undefined ? "1" : text(start), pre = prefix === undefined ? "" : text(prefix);
    await must(exec, "ids.configure", { column: col(c, "CONFIGURE_AUTO_ID"), start: from, prefix: pre });
    return `Auto-ID configured: column=${text(c)}, nextId=${from}, prefix="${pre}"`;
  },
  FIND_ROW_BY_ID: async (exec, id) => String((await must(exec, "ids.find", { id: text(id) })).output),
  // [{column, value}, ...] set in the row with that ID.
  UPDATE_ROW_BY_ID: async (exec, id, updates) => {
    const row = String((await must(exec, "ids.find", { id: text(id) })).output);
    if (!row) throw new Error(`Row with ID ${text(id)} not found`);
    for (const u of unstem(updates) as { column?: unknown; value?: unknown }[]) await must(exec, "cell.set", { cell: `${col(u.column, "UPDATE_ROW_BY_ID")}${row}`, input: text(u.value) });
    return row;
  },
  GET_NEXT_ID: async (exec) => {
    const auto = (await state(exec)).autoId;
    if (!auto) throw new Error("Auto-ID column is not configured for this sheet");
    return auto.next;
  },
};

const options = (matchCase: unknown, wholeCell: unknown, inFormulas: unknown): Record<string, string> =>
  Object.fromEntries(([["matchCase", matchCase], ["wholeCell", wholeCell], ["inFormulas", inFormulas]] as const).filter(([, v]) => yes(v)).map(([k]) => [k, "1"]));

// The app's validation types as demo 18's rules: list, number (min, max),
// text (a length from min to max; a pattern is not taken yet).
function validation(type: string, args: readonly unknown[]): Record<string, string> {
  const limits = (kind: string) => ({ kind, ...(args[0] !== undefined ? { min: text(args[0]) } : {}), ...(args[1] !== undefined ? { max: text(args[1]) } : {}) });
  switch (type.toLowerCase()) {
    case "list": return { kind: "list", values: text(args[0]) };
    case "number": return limits("decimal");
    case "text":
      if (args[2] !== undefined) throw new Error("SETCELLVALIDATION: demo 18 has no pattern rule yet");
      return limits("length");
    default: throw new Error(`SETCELLVALIDATION: ${type} is not list, number or text`);
  }
}

// names.list's "NAME A1:B2" lines.
const names = async (exec: Exec) => (await must(exec, "names.list")).output as string[];
const named = (lines: readonly string[]) => new Map(lines.map((l) => l.split(" ") as [string, string]));

// A table as table.get gives it, or null; the tables' names, from
// table.list's "Sales A1:D5 (region, amount)" lines.
interface Table {
  readonly name: string;
  readonly range: string;
  readonly headers: boolean;
  readonly columns: readonly string[];
  readonly types: Readonly<Record<string, string>>;
  readonly descriptions: Readonly<Record<string, string>>;
}
async function table(exec: Exec, name: string): Promise<Table | null> {
  const o = await exec("table.get", { name });
  return o.ok ? (o.output as Table) : null;
}
const tableNames = async (exec: Exec) => ((await must(exec, "table.list")).output as string[]).map((l) => l.split(" ")[0]);


type Fn = (...args: any[]) => unknown;

// Every control function, for a script: those above, LISTCOMMANDS and
// BATCH_EXECUTE. `others` are the functions a
// script has besides (SETCELL, GETCELL, the range functions), which
// LISTCOMMANDS lists and BATCH_EXECUTE calls too.
export function controlFunctions(exec: Exec, others: Readonly<Record<string, Fn>>): Record<string, Fn> {
  const fns: Record<string, Fn> = {};
  for (const [name, fn] of Object.entries(CONTROL)) fns[name] = (...args: any[]) => fn(exec, ...args);
  const listed = [...new Set([...Object.keys(others), ...Object.keys(CONTROL), "LISTCOMMANDS", "BATCH_EXECUTE"])];
  // LISTCOMMANDS() as the app's: a stem of the names a script may call.
  fns.LISTCOMMANDS = () => stem(listed);
  // [{command, args}, ...]: each run in turn, by any of these names; what
  // each gave or why it failed, as the app's.
  fns.BATCH_EXECUTE = async (commands: unknown) => {
    const results: Record<string, unknown>[] = [];
    for (const [index, c] of (unstem(commands) as { command?: unknown; args?: unknown }[]).entries()) {
      const command = text(c.command).toUpperCase();
      const fn = fns[command] ?? others[command];
      if (!fn || command === "BATCH_EXECUTE") {
        results.push({ index, command, success: false, error: `Unknown command: ${command}` });
        continue;
      }
      try {
        results.push({ index, command, success: true, result: await fn(...(Array.isArray(c.args) ? c.args : [])) });
      } catch (e) {
        results.push({ index, command, success: false, error: (e as Error).message });
      }
    }
    return JSON.stringify(results);
  };
  return fns;
}
