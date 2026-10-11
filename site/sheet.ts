// Spreadsheet (docs/roadmap.md demo 18): a 10 x 20 sheet with formulas.
// site/sheet/ is the language and the model, with no ui: a tokenizer
// generator, a recursive-descent parser into a union AST, an evaluator whose
// errors are values, and a Sheet that keeps who-reads-whom and recomputes
// downstream in order, finding cycles. This page is the view: the grid is
// ui.datagrid (selection, the arrow keys, column resize and move, in-cell
// editing that opens on the formula, all the toolkit's), styled per cell
// (numbers to the right, errors in red); the formula bar, status line,
// problem list and summary are state, bind (two-way for the fields),
// computed and each; a paste is one batch, and one refresh of the grid.
import { COLS, ROWS, addrOf, colName, keyOf } from "./sheet/address.ts";
import type { Addr } from "./sheet/address.ts";
import { Sheet, pasted } from "./sheet/sheet.ts";
import type { Problem } from "./sheet/sheet.ts";
import { describe, show } from "./sheet/format.ts";
import { names } from "./sheet/functions.ts";
import { CellError } from "./sheet/values.ts";

const { text, btn, textfield, hstack, text_wrapped, on_submit, focus, cells, headers, edit_text, cell_style,
        on_cell_select, on_cell_edit, on_col_resize, column_width } = ui;

const EXAMPLE = [
  "Item\tQty\tPrice\tTotal",
  "Apples\t6\t0.45\t=B2*C2",
  "Bread\t1\t2.2\t=B3*C3",
  "Milk\t2\t1.15\t=B4*C4",
  "Total\t=SUM(B2:B4)\t\t=SUM(D2:D4)",
  "Average\t\t=AVERAGE(C2:C4)\t=ROUND(D5/B5, 2)",
].join("\n");

const sheet = new Sheet();

// The grid's column 0 is the frozen row numbers; column c + 1 is sheet
// column c. The cell, edit_text and cell_style functions and on_cell_edit
// get model columns; on_cell_select a column on screen (columns move).
const addrAt = (row: number, modelCol: number): Addr | null =>
  modelCol >= 1 && modelCol <= COLS && row >= 0 && row < ROWS ? { col: modelCol - 1, row } : null;
const keyAt = (row: number, modelCol: number): string | null => {
  const a = addrAt(row, modelCol);
  return a ? keyOf(a) : null;
};

const address = state("A1");
const input = state("");
const status = state("");
const problems = state<Problem[]>([]);
const summary = computed(() => {
  const n = problems.value.length;
  return n === 0 ? "No problems" : `${n} problem${n === 1 ? "" : "s"}`;
}, problems);

let grid = 0;

const settled = (key: string) => {
  problems.set(sheet.problems());
  status.set(describe(key, sheet.input(key), sheet.value(key)));
  ui.datagrid_refresh(grid);
};

const commit = (key: string, text: string) => {
  batch(() => {
    sheet.set(key, text.trim());
    address.set(key);
    input.set(sheet.input(key));
    settled(key);
  });
  print(`sheet: ${key} = ${show(sheet.value(key))}`);
};

const enter = () => {
  const at = addrOf(address.value);
  if (!at) {
    status.set(`${address.value}: not a cell on this sheet`);
    return;
  }
  commit(keyOf(at), input.value);
};

// Many cells at once (a paste, a clear): one recompute, one batch.
const setAll = (entries: readonly (readonly [string, string])[], what: string) => {
  let changed: string[] = [];
  batch(() => {
    changed = sheet.setMany(entries);
    settled(keyOf(addrOf(address.value) ?? { col: 0, row: 0 }));
  });
  print(`sheet: ${what}: ${entries.length} cells set, ${changed.length} changed`);
};

// Where a sheet column is on screen now (columns can be dragged).
const viewCol = (modelCol: number): number => {
  for (let v = 0; v <= COLS; v++) if (ui.datagrid_col_model(grid, v) === modelCol) return v;
  return modelCol;
};

text("Spreadsheet");
let formula = 0;
hstack(() => {
  const cell = bind(textfield("cell", () => {}), address);
  formula = bind(textfield("formula", () => {}), input);
  on_submit(cell, () => focus(formula));
  on_submit(formula, enter);
});
bind(text(""), status);

grid = ui.datagrid(ROWS, COLS + 1, ROWS, COLS, 1, () => {
  column_width(80);
  cells((r: number, c: number) => {
    const key = keyAt(r, c);
    return key ? show(sheet.value(key)) : String(r + 1);
  });
  headers((c: number) => (c === 0 ? "" : colName(c - 1)));
  // An editor opens on what was typed, not what it came to.
  edit_text((r: number, c: number) => {
    const key = keyAt(r, c);
    return key ? sheet.input(key) : "";
  });
  cell_style((r: number, c: number) => {
    const key = keyAt(r, c);
    if (!key) return "color: #6a6f7a; text-align: end";
    const v = sheet.value(key);
    if (v instanceof CellError) return "color: #c0392b";
    return typeof v === "number" ? "text-align: end" : "";
  });
  on_cell_select((r: number, c: number) => {
    const key = keyAt(r, ui.datagrid_col_model(grid, c));
    if (key && key !== address.value) address.set(key);
  });
  on_cell_edit((r: number, c: number, t: string) => {
    const key = keyAt(r, c);
    if (key) commit(key, t);
  });
  on_col_resize((c: number, w: number) => {
    const m = ui.datagrid_col_model(grid, c);
    if (m >= 1) print(`sheet: column ${colName(m - 1)} is ${w} wide`);
  });
});

ui.datagrid_set_col_width(grid, 0, 34);     // the row numbers

// The address field drives the formula field and the grid's selection: name
// a cell, see what it holds.
address.subscribe((a: string) => {
  const at = addrOf(a);
  if (!at) return;
  const key = keyOf(at);
  const [, , r, c] = ui.datagrid_selection(grid);
  if (r !== at.row || ui.datagrid_col_model(grid, c) !== at.col + 1) ui.datagrid_select(grid, at.row, viewCol(at.col + 1));
  batch(() => {
    input.set(sheet.input(key));
    status.set(describe(key, sheet.input(key), sheet.value(key)));
  });
});

text_wrapped(`Functions: ${names().join(", ")}`, 720);
bind(text(""), summary);
each(problems, "key", (p: Problem) => text(`${p.key}: ${p.message}`));
hstack(() => {
  btn("Paste example", () => setAll(pasted(EXAMPLE, { col: 0, row: 0 }), "pasted the example"));
  btn("Clear all", () => setAll(sheet.keys().map((k) => [k, ""] as const), "cleared"));
  btn("Home", () => browserContext.changePage("/"));
});
