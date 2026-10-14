// A sheet file, in the Tauri spreadsheet's format (its .json and .rexxsheet
// files): a name, a setup script, and cells. A cell is text, or
// { value, expression } (a formula without its '='), or { content } (text
// or a formula with its '='), with a comment, a number format, a style and a
// conditional style (styleExpression). Its formulas are RexxJS, as the
// app's are, unless the file says "formulas": "excel".
//
// sae's own additions, which the app passes over: a cell's validation rule
// (validation.ts's, as an object) and its look (formats.ts's), the first
// sheet's name (sheetName), named
// ranges (names: { QTY: "B2:B4" }), conditional-format rules (rules.ts's,
// their ranges as text), charts ({ kind, range, title }) and how it is viewed
// (view: { hiddenRows, hiddenCols, frozenRows, rowHeights, colWidths,
// filter: { range, column, criterion } }, 0-based), its
// merged cells (merges: ["A1:C1"]), its tables (tables: [{ name, range,
// headers, columns }], the Tauri app's table metadata), and the workbook's
// other sheets (sheets: [{ name, cells, names, rules, charts, view, merges,
// tables }]), and the workbook's own names, a range with its sheet's name
// or a formula (bookNames: { QTY: "Sheet1!B2:B4", DOUBLE: "=LAMBDA(x, x*2)" };
// a sheet's names are its own).
// writeSheetFile writes it all.
import { addrOf, colName, keyOf, order, parseRange } from "./address.ts";
import { ICONS, rangeName } from "./rules.ts";
import type { CfRule } from "./rules.ts";
import { CHART_KINDS } from "./charts.ts";
import type { ChartKind } from "./charts.ts";
import type { TableDef } from "./language.ts";
import type { ChartSpec } from "./workbook.ts";
import { show } from "./format.ts";
import type { Note } from "./notes.ts";
import { ruleOf } from "./validation.ts";
import { editorIn } from "./editors.ts";
import type { AutoId, Filter, Page, Pivot, Workbook } from "./workbook.ts";
import { AGGREGATES } from "./pivot.ts";
import type { Aggregate } from "./pivot.ts";

export interface FileSheet {
  readonly name: string;
  readonly entries: readonly [string, string][];   // [key, input] for Sheet.setMany
  readonly notes: ReadonlyMap<string, Note>;
  readonly names: readonly [string, string][];     // [NAME, "B2:B4"], or a formula [NAME, "=LAMBDA(x, x*2)"]
  readonly rules: readonly CfRule[];
  readonly charts: readonly ChartSpec[];
  readonly view: {
    readonly hiddenRows: readonly number[]; readonly hiddenCols: readonly number[]; readonly frozenRows: number;
    readonly rowHeights: readonly [number, number][]; readonly colWidths: readonly [number, number][];
    readonly filter: Filter | null;
  };
  readonly merges: readonly string[];
  readonly tables: readonly TableDef[];
  readonly autoId: AutoId | null;
  readonly pivots: readonly [string, Pivot][];
}

export interface SheetFile {
  readonly name: string;
  readonly language: "Excel" | "RexxJS";
  readonly setupScript: string;
  readonly sheets: readonly FileSheet[];           // the first one, then any others
  readonly bookNames: readonly [string, string][]; // [NAME, "Sheet1!B2:B4"], or a formula [NAME, "=LAMBDA(x, x*2)"]
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
  readonly look?: Record<string, unknown> | null;
  readonly editor?: unknown;
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
  if (c.look && typeof c.look === "object") note.look = c.look;
  const editor = editorIn(c.editor);
  if (editor) note.editor = editor;
  return note;
}

// Rules as written, read back; one that is not a rule is left out.
function rulesOf(rules: unknown): CfRule[] {
  if (!Array.isArray(rules)) return [];
  const kinds = ["cellValue", "top", "average", "duplicates", "colorScale", "iconSet"];
  return rules.flatMap((r: any): CfRule[] => {
    const corners = parseRange(String(r?.range ?? ""));
    if (!corners || !kinds.includes(r?.kind) || (r.kind === "iconSet" && !(r.icons in ICONS))) return [];
    return [{ ...r, range: corners } as CfRule];
  });
}

function chartsOf(charts: unknown): ChartSpec[] {
  if (!Array.isArray(charts)) return [];
  return charts.flatMap((c: any): ChartSpec[] => {
    const corners = parseRange(String(c?.range ?? ""));
    return corners && CHART_KINDS.includes(c?.kind) ? [{ kind: c.kind as ChartKind, range: corners, title: String(c.title ?? "") }] : [];
  });
}

// How a sheet was viewed: rows and columns hidden, rows frozen.
function viewOf(v: any): FileSheet["view"] {
  const indexes = (xs: unknown) => (Array.isArray(xs) ? xs.map(Number).filter((n) => Number.isInteger(n) && n >= 0) : []);
  const sizes = (xs: unknown) => (Array.isArray(xs) ? xs.filter((p: unknown) => Array.isArray(p) && Number.isInteger(p[0]) && p[1] > 0).map((p: number[]): [number, number] => [p[0], p[1]]) : []);
  const r = parseRange(String(v?.filter?.range ?? "")), column = addrOf(`${v?.filter?.column ?? ""}1`);
  const filter = r && column ? { range: r, column: column.col, criterion: String(v.filter.criterion ?? "") } : null;
  return { hiddenRows: indexes(v?.hiddenRows), hiddenCols: indexes(v?.hiddenCols), frozenRows: Number.isInteger(v?.frozenRows) && v.frozenRows > 0 ? v.frozenRows : 0,
    rowHeights: sizes(v?.rowHeights), colWidths: sizes(v?.colWidths), filter };
}

// Tables as written ({ name, range, headers, columns }), read back.
function tablesOf(tables: unknown): TableDef[] {
  if (!Array.isArray(tables)) return [];
  return tables.flatMap((t: any): TableDef[] => {
    const r = parseRange(String(t?.range ?? ""));
    if (!r || !/^[A-Za-z][A-Za-z0-9_]*$/.test(String(t?.name ?? ""))) return [];
    const byName = (o: unknown) => (o && typeof o === "object" && !Array.isArray(o) ? Object.fromEntries(Object.entries(o).map(([k, v]) => [k, String(v)])) : undefined);
    return [{ name: String(t.name), range: r, headers: t.headers !== false, columns: Array.isArray(t.columns) ? t.columns.map(String) : null, types: byName(t.types), descriptions: byName(t.descriptions) }];
  });
}

// A sheet as written: the file itself for the first, or one of its sheets.
function sheetOf(name: string, s: any): FileSheet {
  const list = Object.entries((s?.cells ?? {}) as Cells).map(([k, c]): [string, string | FileCell] => [k.toUpperCase(), c]);
  return {
    name,
    entries: list.map(([k, c]): [string, string] => [k, inputOf(c)]).filter(([, input]) => input !== ""),
    notes: new Map(list.map(([k, c]): [string, Note] => [k, noteOf(c)]).filter(([, n]) => Object.keys(n).length)),
    names: Object.entries((s?.names ?? {}) as Record<string, unknown>).map(([n, r]): [string, string] => [n.toUpperCase(), String(r)]),
    rules: rulesOf(s?.rules),
    charts: chartsOf(s?.charts),
    view: viewOf(s?.view),
    merges: Array.isArray(s?.merges) ? s.merges.map(String).filter((m: string) => parseRange(m)) : [],
    tables: tablesOf(s?.tables),
    autoId: autoIdOf(s?.autoId),
    pivots: pivotsOf(s?.pivots),
  };
}

// Pivots as written (the app's configuration, its id and what it covered),
// read back; one that is not a pivot is left out.
function pivotsOf(pivots: unknown): [string, Pivot][] {
  if (!Array.isArray(pivots)) return [];
  const names = (xs: unknown) => (Array.isArray(xs) ? xs.map(String) : []);
  return pivots.flatMap((p: any): [string, Pivot][] => {
    const source = parseRange(String(p?.sourceRange ?? "")), output = addrOf(String(p?.outputCell ?? "")), agg = String(p?.aggFunction ?? "").toUpperCase() as Aggregate;
    if (!p?.id || !source || !output || !AGGREGATES.includes(agg)) return [];
    const filters = p.filters && typeof p.filters === "object" ? Object.fromEntries(Object.entries(p.filters).map(([k, v]) => [k, String(v)])) : {};
    return [[String(p.id), { source, output, rows: names(p.rowFields), cols: names(p.colFields), value: String(p.valueField ?? ""), agg, filters, written: parseRange(String(p.written ?? "")) }]];
  });
}

// Auto IDs ({ column: "A", next: 1001, prefix: "ID-" }), or null.
function autoIdOf(a: any): AutoId | null {
  const at = addrOf(`${a?.column ?? ""}1`), next = Number(a?.next);
  return at && Number.isInteger(next) ? { column: at.col, next, prefix: String(a?.prefix ?? "") } : null;
}

export function readSheetFile(data: any): SheetFile {
  const others = Array.isArray(data?.sheets) ? data.sheets : [];
  return {
    name: String(data?.name ?? "Untitled"),
    language: String(data?.formulas ?? "").toLowerCase() === "excel" ? "Excel" : "RexxJS",
    setupScript: String(data?.setupScript ?? ""),
    sheets: [
      sheetOf(String(data?.sheetName ?? "Sheet1"), data),
      ...others.map((s: any, i: number) => sheetOf(String(s?.name ?? `Sheet${i + 2}`), s)),
    ],
    bookNames: Object.entries((data?.bookNames ?? {}) as Record<string, unknown>).map(([n, r]): [string, string] => [n.toUpperCase(), String(r)]),
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
const rulesIn = (page: Page) => page.rules.map((r) => ({ ...r, range: rangeName(r.range) }));
const tablesIn = (page: Page) => page.sheet.tables().map((t) => ({
  name: t.name, range: rangeName(t.range), headers: t.headers, columns: t.columns,
  ...(t.types && Object.keys(t.types).length ? { types: t.types } : {}), ...(t.descriptions && Object.keys(t.descriptions).length ? { descriptions: t.descriptions } : {}),
}));
const chartsIn = (page: Page) => page.charts.map((c) => ({ kind: c.kind, range: rangeName(c.range), title: c.title }));
const up = (a: number, b: number) => a - b;
const viewIn = (page: Page) => ({
  hiddenRows: [...page.hiddenRows].sort(up), hiddenCols: [...page.hiddenCols].sort(up), frozenRows: page.frozen,
  rowHeights: [...page.heights].sort(([a], [b]) => a - b), colWidths: [...page.widths].sort(([a], [b]) => a - b),
  // The filter's rows are worked out again when the file is opened.
  ...(page.filter ? { filter: { range: rangeName(page.filter.range), column: colName(page.filter.column), criterion: page.filter.criterion } } : {}),
});

// A sheet's parts as the file has them.
const sheetIn = (p: Page) => ({
  cells: cellsOf(p), names: namesOf(p), rules: rulesIn(p), charts: chartsIn(p), view: viewIn(p), merges: p.merges.map(rangeName), tables: tablesIn(p),
  ...(p.autoId ? { autoId: { column: colName(p.autoId.column), next: p.autoId.next, prefix: p.autoId.prefix } } : {}),
  ...(p.pivots.size ? {
    pivots: [...p.pivots].map(([id, pv]) => ({
      id, sourceRange: rangeName(pv.source), rowFields: pv.rows, colFields: pv.cols, valueField: pv.value, aggFunction: pv.agg, outputCell: keyOf(pv.output), filters: pv.filters,
      ...(pv.written ? { written: rangeName(pv.written) } : {}),
    })),
  } : {}),
});

// The workbook as a file: JSON-ready.
export function writeSheetFile(wb: Workbook) {
  const [first, ...others] = wb.pages();
  return {
    name: wb.name,
    formulas: wb.sheet.language.name === "Excel" ? "excel" : "rexxjs",
    setupScript: wb.setupScript,
    sheetName: first.name,
    ...sheetIn(first),
    sheets: others.map((p) => ({ name: p.name, ...sheetIn(p) })),
    ...(wb.names().length ? { bookNames: Object.fromEntries(wb.names()) } : {}),
  };
}
