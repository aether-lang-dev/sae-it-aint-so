// The Tauri spreadsheet's control functions (its src/spreadsheet-control-
// functions.js, at RexxJS/example-app-spreadsheet 45b0993) by name, each as
// demo 18's commands: SETFORMAT("A1", "bold") runs cell.format cell=A1
// format=bold, and gives back what the app's gives. A script (script.ts)
// has them all, so the app's REXX scripts run against demo 18 as they are;
// a name with no command yet is in MISSING, saying what it would need, and
// calling one says so. The functions see the sheet only through `exec`, a
// command and its parameters in and its outcome out, as a panel does.
import { COLS, ROWS, addrOf, colName, keyOf, parseRange, range } from "./address.ts";
import { check } from "./validation.ts";
import type { Rule } from "./validation.ts";

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
}
interface State {
  readonly name: string;
  readonly sheets: readonly string[];
  readonly hiddenRows: readonly number[];
  readonly hiddenCols: readonly string[];
  readonly frozenRows: number;
  readonly rowHeights: readonly (readonly [number, number])[];
  readonly canUndo: number;
  readonly canRedo: number;
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
  if (/^[A-Za-z]$/.test(t)) return t.toUpperCase();
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
// The range two corners span, as the app's FILLDOWN takes its source and
// target apart: "A1" and "A2:A5" is A1:A5.
function spanned(a: string, b: string, fn: string): string {
  const r = [parseRange(a), parseRange(b)];
  if (!r[0] || !r[1]) throw new Error(`${fn} needs a source and a target range (e.g. "A1", "A2:A10")`);
  const all = [...r[0], ...r[1]], cols = all.map((x) => x.col), rows = all.map((x) => x.row);
  return `${keyOf({ col: Math.min(...cols), row: Math.min(...rows) })}:${keyOf({ col: Math.max(...cols), row: Math.max(...rows) })}`;
}
const rowsOf = (n: number) => `A${n}`;
const VERSION = "sae demo 18";

export const CONTROL: Readonly<Record<string, Control>> = {
  SPREADSHEET_VERSION: () => VERSION,
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
  FILLDOWN: async (exec, s, t) => (await must(exec, "edit.fillDown", { range: spanned(text(s), text(t), "FILLDOWN") }), "OK"),
  FILLRIGHT: async (exec, s, t) => (await must(exec, "edit.fillRight", { range: spanned(text(s), text(t), "FILLRIGHT") }), "OK"),
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
  HIDEROW: async (exec, n) => (await must(exec, "rows.hide", { range: rowsOf(row(n, "HIDEROW")) }), "OK"),
  UNHIDEROW: async (exec, n) => (await must(exec, "rows.unhide", { range: rowsOf(row(n, "UNHIDEROW")) }), "OK"),
  HIDECOLUMN: async (exec, c) => (await must(exec, "columns.hide", { range: `${col(c, "HIDECOLUMN")}1` }), "OK"),
  UNHIDECOLUMN: async (exec, c) => (await must(exec, "columns.unhide", { range: `${col(c, "UNHIDECOLUMN")}1` }), "OK"),
  ISROWHIDDEN: async (exec, n) => ((await state(exec)).hiddenRows.includes(row(n, "ISROWHIDDEN")) ? 1 : 0),
  ISCOLUMNHIDDEN: async (exec, c) => ((await state(exec)).hiddenCols.includes(col(c, "ISCOLUMNHIDDEN")) ? 1 : 0),
  ISROWVISIBLE: async (exec, n) => ((await state(exec)).hiddenRows.includes(row(n, "ISROWVISIBLE")) ? "0" : "1"),
  SETROWHEIGHT: async (exec, n, h) => (await must(exec, "rows.height", { range: rowsOf(row(n, "SETROWHEIGHT")), height: text(h) }), "OK"),
  // 0: the grid's own height.
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
    return table(await tables(exec), text(n));
  },
  DELETETABLE: async (exec, n) => (await must(exec, "table.delete", { name: text(n) }), ""),
  GETTABLE: async (exec, n) => table(await tables(exec), text(n)),
  LISTTABLES: async (exec) => stem((await tables(exec)).map((t) => t.name)),
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

// table.list's "Sales A1:D5 (region, amount)" lines, as the app's tables.
interface Table {
  readonly name: string;
  readonly range: string;
  readonly columns: readonly string[];
}
async function tables(exec: Exec): Promise<Table[]> {
  return ((await must(exec, "table.list")).output as string[]).map((l) => {
    const m = /^(\S+) (\S+) \((.*)\)$/.exec(l)!;
    return { name: m[1], range: m[2], columns: m[3] ? m[3].split(", ") : [] };
  });
}
const table = (ts: readonly Table[], name: string) => {
  const t = ts.find((x) => x.name.toUpperCase() === name.toUpperCase());
  return t ? JSON.stringify(t) : "";
};

// The app's names with no command here yet, and what each would need.
export const MISSING: Readonly<Record<string, string>> = {
  BATCH_SET_CELLS: "a batch of cells as JSON (SETCELLS takes a range and its values)",
  BATCH_EXECUTE: "a batch of commands as JSON",
  EXPORT: "a command giving the file's JSON (file.save keeps it in storage)",
  IMPORT: "a command taking the file's JSON (file.open reads it from storage)",
  SETSHEETNAME: "sheet renaming (the plan's 8)",
  RENAMESHEET: "sheet renaming (the plan's 8)",
  EVALUATE: "a command working out a formula without a cell",
  RECALCULATE: "nothing to do: the sheet is always worked out",
  GETSETUPSCRIPT: "commands for the setup script",
  SETSETUPSCRIPT: "commands for the setup script",
  EXECUTESETUPSCRIPT: "commands for the setup script",
  SETCOLWIDTH: "column widths in the model (the grid keeps them)",
  GETCOLWIDTH: "column widths in the model (the grid keeps them)",
  GETFILTERCRITERIA: "the filter's criterion kept (demo 18 keeps the rows it hid)",
  MOVECOLUMNLEFT: "moving columns",
  MOVECOLUMNRIGHT: "moving columns",
  FILLUP: "fill up",
  FILLLEFT: "fill left",
  AUTOFILL: "AutoFill from a source to a target (edit.fillSeries fills a range)",
  SETCELLEDITOR: "cell editors (a dropdown, a checkbox, a date in a cell)",
  GETCELLEDITOR: "cell editors",
  REMOVECELLEDITOR: "cell editors",
  CONFIGURE_AUTO_ID: "auto IDs",
  FIND_ROW_BY_ID: "auto IDs",
  UPDATE_ROW_BY_ID: "auto IDs",
  GET_NEXT_ID: "auto IDs",
  SET_TABLE_METADATA: "a table's column types and descriptions",
  GET_TABLE_METADATA: "a table's column types and descriptions",
  DELETE_TABLE_METADATA: "a table's column types and descriptions",
  LIST_TABLES: "a table's column types and descriptions (LISTTABLES lists them)",
  SORTTABLEBYCOLUMN: "a table's sort state (asc, desc, original)",
  CREATEPIVOT: "pivot tables",
  UPDATEPIVOT: "pivot tables",
  DELETEPIVOT: "pivot tables",
  GETPIVOT: "pivot tables",
  LISTPIVOTS: "pivot tables",
  PIVOTCONFIG: "pivot tables",
};

// Every control function, for a script: those above, the missing ones
// saying so, and LISTCOMMANDS. `others` are the names a script has besides
// (SETCELL, GETCELL, the range functions), for LISTCOMMANDS to list too.
export function controlFunctions(exec: Exec, others: readonly string[]): Record<string, (...args: any[]) => unknown> {
  const fns: Record<string, (...args: any[]) => unknown> = {};
  for (const [name, fn] of Object.entries(CONTROL)) fns[name] = (...args: any[]) => fn(exec, ...args);
  for (const [name, why] of Object.entries(MISSING)) fns[name] = () => {
    throw new Error(`${name} is not in demo 18 yet: it needs ${why}`);
  };
  const listed = [...new Set([...others, ...Object.keys(CONTROL), "LISTCOMMANDS"])];
  // LISTCOMMANDS() as the app's: a stem of the names a script may call;
  // LISTCOMMANDS("missing"): those it may not yet, each with what it needs.
  fns.LISTCOMMANDS = (which?: unknown) =>
    text(which).toLowerCase() === "missing" ? stem(Object.entries(MISSING).map(([n, why]) => `${n}: ${why}`)) : stem(listed);
  return fns;
}
