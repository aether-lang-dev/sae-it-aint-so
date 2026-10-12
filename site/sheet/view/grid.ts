// The grid panel: ui.datagrid over the workbook. Column 0 is the frozen row
// numbers; column c + 1 is sheet column c. The cell, edit_text and
// cell_style functions and on_cell_edit get model columns; on_cell_select a
// column on screen (columns move). Keys over the selection run commands:
// Delete clears it, Ctrl+C and Ctrl+V copy and paste, Ctrl+D and Ctrl+R
// fill, Ctrl+Z and Ctrl+Y (Ctrl+Shift+Z) undo and redo; while an editor is
// open, or a field has the focus, keys are theirs.
import { COLS, ROWS, addrOf, colName, keyOf } from "../address.ts";
import type { SheetView } from "./view.ts";

const SHIFT = 1, CTRL = 2, SUPER = 8;

export function sheetGrid(v: SheetView): void {
  const { cells, headers, edit_text, cell_style, on_cell_select, on_cell_edit, on_col_resize, column_width } = ui;
  const keyAt = (row: number, modelCol: number): string | null =>
    modelCol >= 1 && modelCol <= COLS && row >= 0 && row < ROWS ? keyOf({ col: modelCol - 1, row }) : null;

  v.grid = ui.datagrid(ROWS, COLS + 1, ROWS, COLS, 1, () => {
    column_width(80);
    cells((r: number, c: number) => {
      const key = keyAt(r, c);
      return key ? v.wb.textOf(key) : String(r + 1);
    });
    headers((c: number) => (c === 0 ? "" : colName(c - 1)));
    // An editor opens on what was typed, not what it came to.
    edit_text((r: number, c: number) => {
      const key = keyAt(r, c);
      return key ? v.wb.sheet.input(key) : "";
    });
    cell_style((r: number, c: number) => {
      const key = keyAt(r, c);
      return key ? v.wb.styleOf(key) : "color: #6a6f7a; text-align: end";
    });
    on_cell_select((r: number, c: number) => {
      const key = keyAt(r, ui.datagrid_col_model(v.grid, c));
      if (key && key !== v.address.value) v.address.set(key);
    });
    on_cell_edit((r: number, c: number, t: string) => {
      const key = keyAt(r, c);
      if (key) {
        v.address.set(key);
        v.run("cell.set", { cell: key, input: t.trim() });
      }
    });
    on_col_resize((c: number, w: number) => {
      const m = ui.datagrid_col_model(v.grid, c);
      if (m >= 1) print(`sheet: column ${colName(m - 1)} is ${w} wide`);
    });
  });
  ui.datagrid_set_col_width(v.grid, 0, 34);     // the row numbers

  // The address field drives the grid's selection: name a cell, go to it.
  v.address.subscribe((a: string) => {
    const at = addrOf(a);
    if (!at) return;
    const [, , r, c] = ui.datagrid_selection(v.grid);
    if (r !== at.row || ui.datagrid_col_model(v.grid, c) !== at.col + 1) ui.datagrid_select(v.grid, at.row, v.viewCol(at.col + 1));
    v.follow(keyOf(at));
  });

  ui.on_key((key: string, mods: number) => {
    if (!ui.datagrid_has_focus(v.grid) || ui.datagrid_editor(v.grid) !== 0) return;
    if (!v.selection()) return;
    const range = v.range();
    if (key === "Delete" || key === "BackSpace") {
      v.run("range.clear", { range });
      return;
    }
    if ((mods & (CTRL | SUPER)) === 0) return;
    switch (key.toLowerCase()) {
      case "c": v.run("edit.copy", { range }); return;
      case "v": v.run("edit.paste", { at: topLeftOf(range) }); return;
      case "d": v.run("edit.fillDown", { range }); return;
      case "r": v.run("edit.fillRight", { range }); return;
      case "z": v.run((mods & SHIFT) !== 0 ? "edit.redo" : "edit.undo"); return;
      case "y": v.run("edit.redo"); return;
    }
  });
}

// The top-left cell of "B4:A2" (A2), or of "B4" (B4).
function topLeftOf(range: string): string {
  const [a, b = a] = range.split(":").map((k) => addrOf(k)!);
  return keyOf({ col: Math.min(a.col, b.col), row: Math.min(a.row, b.row) });
}
