// RexxSheet (docs/roadmap.md demo 19): the Tauri spreadsheet
// (RexxJS/example-app-spreadsheet) on sae. Its model, its RexxJS adapter and
// its function library are the app's own (site/rexxsheet/, with their sae
// changes marked), RexxJS is vendored and bundled (vendor/rexxjs,
// tools/bundle-rexxjs.mjs), and only the view is new: React gave way to
// ui.datagrid. A formula is a RexxJS expression: =A1 + A2, =UPPER(B1),
// =A2 |> LOWER, =SUM_RANGE("A1:A3"); a sheet's setup script (LET TAX_RATE =
// 0.08) runs before its cells.
import { load, rexxSheet } from "./rexxsheet/boot.ts";
import { COLS, ROWS, cellRef, describe, editText, refAt, shown, styleOf } from "./rexxsheet/view.ts";
import { SAMPLE_BUDGET, TEST_SHEET } from "./rexxsheet/samples.ts";

const { text, btn, textfield, hstack, text_wrapped, on_submit, focus, cells, headers, edit_text, cell_style,
        on_cell_select, on_cell_edit, column_width } = ui;

const sheet = await rexxSheet(ROWS, COLS);
const { model, adapter } = sheet;

const address = state("A1");
const input = state("");
const status = state("");
const setup = state("");
let grid = 0;

const cellAt = (r: number, c: number) => {
  const ref = refAt(r, c);
  return ref ? model.getCell(ref) : null;
};

// What the selected cell holds, in the formula bar and the status line.
const follow = (ref: string) => {
  batch(() => {
    input.set(editText(model.getCell(ref)));
    status.set(describe(ref, model.getCell(ref)));
  });
};

// A cell set through the model: it and what reads it are worked out (each
// a RexxJS evaluation, so a promise), then the grid is drawn once.
const commit = async (ref: string, content: string) => {
  await model.setCell(ref, content.trim(), adapter);
  address.set(ref);
  follow(ref);
  ui.datagrid_refresh(grid);
  print(`rexxsheet: ${ref} = ${shown(model.getCell(ref))}`);
};

const open = async (data: any) => {
  await load(sheet, data);
  setup.set(`Setup script: ${model.getSetupScript() || "(none)"}`);
  follow(address.value);
  ui.datagrid_refresh(grid);
  print(`rexxsheet: loaded ${data.name}: ${model.cells.size} cells`);
};

text("RexxSheet");
let formula = 0;
hstack(() => {
  const cell = bind(textfield("cell", () => {}), address);
  formula = bind(textfield("formula", () => {}), input);
  on_submit(cell, () => focus(formula));
  on_submit(formula, () => {
    const ref = cellRef(address.value);
    if (ref) commit(ref, input.value);
    else status.set(`${address.value}: not a cell on this sheet`);
  });
});
bind(text(""), status);

grid = ui.datagrid(ROWS, COLS + 1, 20, 10, 1, () => {
  column_width(90);
  cells((r: number, c: number) => {
    const cell = cellAt(r, c);
    return cell ? shown(cell) : String(r + 1);
  });
  headers((c: number) => (c === 0 ? "" : refAt(0, c)!.replace(/\d+$/, "")));
  edit_text((r: number, c: number) => {
    const cell = cellAt(r, c);
    return cell ? editText(cell) : "";
  });
  cell_style((r: number, c: number) => {
    const cell = cellAt(r, c);
    return cell ? styleOf(cell) : "color: #6a6f7a; text-align: end";
  });
  on_cell_select((r: number, c: number) => {
    const ref = refAt(r, ui.datagrid_col_model(grid, c));
    if (ref && ref !== address.value) address.set(ref);
  });
  on_cell_edit((r: number, c: number, t: string) => {
    const ref = refAt(r, c);
    if (ref) commit(ref, t);
  });
});
ui.datagrid_set_col_width(grid, 0, 40);

// Naming a cell in the address field shows what it holds.
address.subscribe((a: string) => {
  const ref = cellRef(a);
  if (ref) follow(ref);
});

bind(text_wrapped("", 720), setup);
text_wrapped("Formulas are RexxJS: =A1 + A2, =UPPER(B1) || '!', =A2 |> LOWER, =SUBSTR(A3, 1, 3), " +
  '=SUM_RANGE("A1:A3"), AVERAGE_RANGE, COUNT_RANGE, MIN_RANGE, MAX_RANGE, MEDIAN_RANGE, SUMIF_RANGE ...', 720);
hstack(() => {
  btn("Test sheet", () => open(TEST_SHEET));
  btn("Budget", () => open(SAMPLE_BUDGET));
  btn("Home", () => browserContext.changePage("/"));
});

await open(TEST_SHEET);
